const User = require('../models/User');
const AuthToken = require('../models/AuthToken');
const { validateEmail } = require('../utils/authValidation');
const T = require('../utils/authTokens');
const { sendEmail, isAvailable } = require('../services/email');
const { appBaseUrl } = require('../services/email/config');
const { dbReady } = require('./passwordResetController');

// Email verification (docs/23). Same coordination primitives as password reset (utils/authTokens.js), purpose
// 'email_verification': a token of one purpose can never be used for the other (every lookup is keyed by purpose, the
// state document id carries it, and the token record enum is checked), and tokens are 256-bit random, stored as SHA-256 only.
const PURPOSE = T.VERIFY;

const GENERIC_REQUEST = { message: 'If an unverified account exists for this email address, we will send a verification link shortly.' };
const UNAVAILABLE = { message: 'Verification email is temporarily unavailable. Please try again later.', code: 'EMAIL_UNAVAILABLE' };
const INVALID = { message: 'This verification link is invalid. Please request a new one.', code: 'INVALID_VERIFICATION_TOKEN' };
const EXPIRED = { message: 'This verification link has expired. Please request a new one.', code: 'VERIFICATION_LINK_EXPIRED' };
const USED = { message: 'This verification link was already used. If you verified your email, you can simply log in. Otherwise request a new link.', code: 'VERIFICATION_LINK_USED' };
const INTERRUPTED = { message: 'We could not confirm your email address and this link can no longer be used. Please request a new verification link.', code: 'VERIFICATION_INTERRUPTED' };

const bodyOf = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
const logFailure = (what, err) => console.error(`${what}: ${(err && (err.code || err.name)) || 'ERROR'}`); // codes only

// reserve -> create (inactive) -> email -> activate, exactly like the reset flow (race analysis: docs/22).
// Returns { status: 'sent' } | { status: 'throttled', reason } | { status: 'failed', code }. Never throws.
// A link that was never emailed is never activated, so a failure cannot leave a usable-but-undelivered link behind, and a
// throttled request never touches an existing usable link.
const issueVerification = async (user) => {
  try {
    const r = await T.reserve(user._id, PURPOSE);
    if (r.throttled) return { status: 'throttled', reason: r.throttled };
    const { raw, doc } = await T.createPending(user._id, PURPOSE, r.seq, 0);
    const verifyUrl = `${appBaseUrl()}/verify-email#token=${raw}`; // fragment: never sent to servers, proxies or Referer headers
    let sent;
    try {
      sent = await sendEmail('emailVerification', user.email, { name: user.name, verifyUrl, expiresHours: Math.round(T.ttlMinutes(process.env, PURPOSE) / 60) });
    } catch (err) {
      await T.markDelivery(doc._id, 'failed', (err && err.code) || 'EMAIL_SEND_FAILED').catch(() => {});
      logFailure('verification email failed', err);
      return { status: 'failed', code: (err && err.code) || 'EMAIL_SEND_FAILED' };
    }
    await T.markDelivery(doc._id, sent.state).catch(() => {});
    await T.activate(doc);
    return { status: 'sent' };
  } catch (err) {
    logFailure('verification issue failed', err);
    return { status: 'failed', code: 'ISSUE_FAILED' };
  }
};

// POST /api/auth/verify-email  { token }   (public: the link works from any device)
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = bodyOf(req);
    if (!T.looksLikeToken(token)) return res.status(400).json(INVALID);
    if (!(await dbReady())) return res.status(503).json({ message: 'The service is temporarily unavailable. Please try again in a moment.', code: 'SERVICE_UNAVAILABLE' });

    // The single atomic step: exactly one request consumes the link; replays, expired, superseded and wrong-purpose
    // tokens all get null. There is no un-consume: a failure below means "request a new link".
    const consumed = await T.consumeToken(token, PURPOSE);
    if (!consumed) {
      // Only a holder of the full 256-bit token can reach this branch, so telling "used" from "expired" from "unknown"
      // reveals nothing about accounts. Looked up by hash AND purpose, so a password-reset token never matches.
      const rec = await AuthToken.findOne({ tokenHash: T.hashToken(token), purpose: PURPOSE }).select('usedAt expiresAt revokedAt').lean();
      if (rec && rec.usedAt) return res.status(400).json(USED);
      if (rec && rec.expiresAt <= new Date()) return res.status(400).json(EXPIRED);
      return res.status(400).json(INVALID);
    }
    try {
      const user = await User.findOneAndUpdate(
        { _id: consumed.user, deletedAt: null },
        { $set: { emailVerified: true }, $min: { emailVerifiedAt: new Date() } }, // keep the first verification time
        { returnDocument: 'before' },
      ).select('emailVerified emailVerifiedAt');
      if (!user) { await T.markUsed(consumed.tokenId).catch(() => {}); return res.status(400).json(INVALID); }
      if (!user.emailVerifiedAt) await User.updateOne({ _id: consumed.user, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } }).catch(() => {});
    } catch (err) {
      logFailure('email verification interrupted', err);
      return res.status(503).json(INTERRUPTED);
    }
    await T.markUsed(consumed.tokenId).catch(() => {});
    return res.status(200).json({ message: 'Your email address is verified. Thank you!', verified: true });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/verification/resend  (authenticated; allowed while unverified). Honest answers: the caller proved who they are.
const resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('name email emailVerified');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.emailVerified) return res.status(200).json({ message: 'Your email address is already verified.', alreadyVerified: true });
    if (!isAvailable()) return res.status(503).json(UNAVAILABLE);
    if (!(await dbReady())) return res.status(503).json({ message: 'The service is temporarily unavailable. Please try again in a moment.', code: 'SERVICE_UNAVAILABLE' });

    const r = await issueVerification(user);
    if (r.status === 'throttled') {
      const { cooldownMs } = T.limits(process.env, PURPOSE);
      return res.status(429).json({
        message: r.reason === 'budget'
          ? 'You have requested too many verification emails. Please try again later, and use the newest email we sent.'
          : 'A verification email was sent recently. Please wait a moment and check your inbox (and spam folder) before requesting another.',
        code: 'VERIFICATION_THROTTLED', retryAfterSeconds: Math.ceil(cooldownMs / 1000),
      });
    }
    if (r.status === 'failed') return res.status(503).json(UNAVAILABLE);
    return res.status(200).json({ message: 'We have sent a new verification link. It may take a few minutes to arrive.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/verification/request  { email }   (public; for an expired link when not logged in)
// Identical answer for unknown, verified, unverified, throttled and failed cases; work happens after responding.
const requestVerification = async (req, res, next) => {
  try {
    const email = validateEmail(bodyOf(req).email);
    if (email.error) return res.status(400).json({ message: 'Please fix the highlighted fields', code: 'VALIDATION_ERROR', errors: { email: email.error } });
    if (!isAvailable()) return res.status(503).json(UNAVAILABLE);
    if (!(await dbReady())) return res.status(503).json({ message: 'The service is temporarily unavailable. Please try again in a moment.', code: 'SERVICE_UNAVAILABLE' });

    res.status(200).json(GENERIC_REQUEST);
    try {
      const user = await User.findOne({ email: email.value, deletedAt: null }).select('name email emailVerified');
      if (user && !user.emailVerified) await issueVerification(user);
    } catch (err) { logFailure('verification request failed', err); }
  } catch (error) {
    if (!res.headersSent) next(error);
  }
};

module.exports = { verifyEmail, resendVerification, requestVerification, issueVerification, GENERIC_REQUEST, PURPOSE };
