const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { validateEmail, validatePassword } = require('../utils/authValidation');
const { BCRYPT_ROUNDS } = require('./authController');
const T = require('../utils/authTokens');
const { fault } = require('../utils/testFaults');
const { sendEmail, isAvailable } = require('../services/email');
const { appBaseUrl } = require('../services/email/config');

const PURPOSE = 'password_reset';

// Honest wording: the request was ACCEPTED. We never claim an email was sent or delivered (a local outbox stores it, a real
// provider may only accept it, and neither proves the message reached an inbox). Identical for registered and unknown addresses.
const GENERIC_FORGOT = { message: 'If an account exists for this email address, we will send password reset instructions shortly.' };
const UNAVAILABLE = { message: 'Password reset by email is temporarily unavailable. Please try again later.', code: 'EMAIL_UNAVAILABLE' };
const DB_UNAVAILABLE = { message: 'The service is temporarily unavailable. Please try again in a moment.', code: 'SERVICE_UNAVAILABLE' };
const INVALID_TOKEN = { message: 'This password reset link is invalid or has expired. Please request a new one.', code: 'INVALID_RESET_TOKEN' };
const INTERRUPTED = {
  message: 'We could not confirm that your password was reset, and this link can no longer be used. Try logging in with your new password; if that does not work, request a new reset link.',
  code: 'RESET_INTERRUPTED',
};

// A brief connection blip (driver reconnecting after a network hiccup, host resume from sleep) must not turn into a 503 for a
// healthy service: wait a short, bounded time for the connection to come back. A real outage still answers 503.
const dbReady = async (conn = mongoose.connection, graceMs = 1500) => {
  const end = Date.now() + graceMs;
  while (conn.readyState !== 1) {
    if (Date.now() >= end) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
  return true;
};

const bodyOf = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
const logFailure = (what, err) => console.error(`${what}: ${(err && (err.code || err.name)) || 'ERROR'}`); // codes only, never content or tokens

// Runs AFTER the response was sent, so the response time is the same for registered and unregistered addresses.
//
// Protocol (races analysed in docs/22): reserve -> create (inactive) -> email -> activate.
//  * reserve is ONE atomic update (cooldown + hourly budget + DB-assigned seq). A throttled request does nothing else: it
//    never touches the account's existing usable link.
//  * the link becomes usable ONLY after the email was accepted, and ONLY if no newer seq was activated meanwhile.
//  * crash after reserve                -> nothing was created; the old link is untouched (cooldown is the only cost).
//  * crash after create / before email  -> an inactive orphan record; nobody ever received its token.
//  * crash / error after email, before activate -> the owner holds a link that never activates (safe failure: the old
//    link stays usable and the owner can ask again after the cooldown).
//  * insert or email delayed past a newer request -> activation fails the seq compare-and-set; the newer link stays.
const deliverReset = async (email) => {
  const user = await User.findOne({ email, deletedAt: null }).select('name email tokenVersion');
  if (!user) return;

  const r = await T.reserve(user._id, PURPOSE);
  if (r.throttled) { console.warn(`password reset throttled: ${r.throttled}`); return; } // no address in the log
  await fault('forgot.afterReserve');

  const { raw, doc } = await T.createPending(user._id, PURPOSE, r.seq, user.tokenVersion);
  await fault('forgot.afterInsert');

  const resetUrl = `${appBaseUrl()}/reset-password#token=${raw}`; // fragment: never sent to servers, proxies or Referer headers
  let sent;
  try {
    await fault('forgot.beforeSend');
    sent = await sendEmail('passwordReset', user.email, { name: user.name, resetUrl, expiresMinutes: T.ttlMinutes() });
  } catch (err) {
    // Failed or AMBIGUOUS (e.g. stored but the caller saw an error): the link is never activated, so the owner's existing
    // usable link (if any) keeps working and no unusable-but-"valid" link exists.
    await T.markDelivery(doc._id, 'failed', (err && err.code) || 'EMAIL_SEND_FAILED').catch(() => {});
    logFailure('password reset email failed', err);
    return;
  }
  await fault('forgot.afterSend');
  await T.markDelivery(doc._id, sent.state).catch(() => {});
  await fault('forgot.beforeActivate');
  const active = await T.activate(doc);
  if (!active) console.warn('password reset link superseded by a newer request');
};

// POST /api/auth/forgot-password  { email }
const forgotPassword = async (req, res, next) => {
  try {
    const email = validateEmail(bodyOf(req).email);
    if (email.error) {
      // Format problems are the same for every address, so this reveals nothing about registered accounts.
      return res.status(400).json({ message: 'Please fix the highlighted fields', code: 'VALIDATION_ERROR', errors: { email: email.error } });
    }
    // Global, account-independent conditions may be reported honestly: they say nothing about any account.
    if (!isAvailable()) return res.status(503).json(UNAVAILABLE);
    if (!(await dbReady())) return res.status(503).json(DB_UNAVAILABLE);

    res.status(200).json(GENERIC_FORGOT); // "accepted": delivery is attempted afterwards, identically for every address
    try { await deliverReset(email.value); } catch (err) { logFailure('password reset request failed', err); }
  } catch (error) {
    if (!res.headersSent) next(error);
  }
};

// POST /api/auth/reset-password  { token, password, confirmPassword }
const resetPassword = async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = bodyOf(req);

    // 1) Token first: every unknown / expired / used / revoked / superseded / wrong-purpose token gets the same generic answer.
    const found = await T.peekToken(token, PURPOSE);
    if (!found) return res.status(400).json(INVALID_TOKEN);
    const user = await User.findById(found.user).select('name email tokenVersion deletedAt');
    // A password change since the link was issued (profile change or another reset) makes the link unusable.
    if (!user || user.deletedAt || (user.tokenVersion || 0) !== found.tokenVersion) return res.status(400).json(INVALID_TOKEN);

    // 2) New password: same policy as signup, plus the confirmation. A rejected password does NOT burn the token.
    const errors = {};
    const pw = validatePassword(password, { email: user.email, name: user.name });
    if (pw.error) errors.password = pw.error;
    if (typeof confirmPassword !== 'string' || confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please fix the highlighted fields', code: 'VALIDATION_ERROR', errors });

    // 3) Hash before consuming, so nothing slow happens between consuming the token and updating the password.
    const hashed = await bcrypt.hash(pw.value, BCRYPT_ROUNDS);

    // 4) The single atomic step: only ONE of any number of simultaneous requests gets the link. From here on the link is dead
    //    for good: there is NO compensation path that could make it usable again, whatever fails below.
    const consumed = await T.consumeToken(token, PURPOSE);
    if (!consumed) return res.status(400).json(INVALID_TOKEN);

    // 5) New password + tokenVersion bump in ONE document operation (retires every JWT issued before this moment), conditioned
    //    on the tokenVersion the link was issued for. Any error here (before, during or after the write; including ambiguous
    //    outcomes where the database committed but the caller saw an error) ends in a safe failure: the user requests a new
    //    link or simply logs in if the change did land.
    try {
      await fault('reset.afterConsume');
      const updated = await User.findOneAndUpdate(
        { _id: consumed.user, tokenVersion: T.tokenVersionFilter(consumed.tokenVersion) },
        { $set: { password: hashed }, $inc: { tokenVersion: 1 } },
      );
      await fault('reset.afterPasswordUpdate');
      if (!updated) return res.status(400).json(INVALID_TOKEN);
    } catch (err) {
      logFailure('password reset interrupted', err);
      return res.status(503).json(INTERRUPTED);
    }

    // 6) Audit trail (best effort; usability was settled in step 4).
    await T.markUsed(consumed.tokenId).catch(() => {});
    await T.revokeAllLinks(consumed.user, PURPOSE).catch(() => {});

    res.status(200).json({ message: 'Your password has been reset. You can now log in with your new password.' });

    // Security notice (best effort, after responding; failures never affect the reset).
    try { await sendEmail('passwordChanged', user.email, { name: user.name }); } catch (err) { logFailure('password changed notice failed', err); }
  } catch (error) {
    if (!res.headersSent) next(error);
  }
};

module.exports = { forgotPassword, resetPassword, dbReady, GENERIC_FORGOT, PURPOSE };
