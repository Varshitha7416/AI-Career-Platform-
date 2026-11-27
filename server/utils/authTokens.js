const crypto = require('crypto');
const AuthToken = require('../models/AuthToken');
const AuthRecoveryState = require('../models/AuthRecoveryState');

// Account-flow tokens (password reset now; email verification later).
//
// TOKEN RULES
//  - the raw token is 256 bits from crypto.randomBytes and is returned ONCE, to be put in the emailed link
//  - only its SHA-256 hash is stored, so the database never contains a usable token
//
// COORDINATION RULES (see docs/22-password-reset-email.md for the race analysis)
//  - Everything that must be atomic is ONE conditional update of ONE document: the per-(user, purpose) AuthRecoveryState.
//    No transactions (standalone mongod has none), no cross-document invariants, no reliance on ObjectId ordering.
//  - issue = reserve (atomic cooldown + hourly budget + DB-assigned seq) -> create record -> email -> activate (compare-and-set
//    on seq). A link becomes usable ONLY after its email was accepted, and a newer seq always wins over an older one, so a
//    failed, throttled, delayed or crashed request can never invalidate or duplicate a usable link.
//  - the usable link lives inside the state document, so "supersede", "consume" and "revoke" are single-document atomic.
//  - a consumed link is NEVER made usable again (there is no un-consume operation).

const RAW_RE = /^[A-Za-z0-9_-]{43}$/; // base64url of 32 bytes
const hashToken = (raw) => crypto.createHash('sha256').update(String(raw), 'utf8').digest('hex');
const newRawToken = () => crypto.randomBytes(32).toString('base64url');
const looksLikeToken = (v) => typeof v === 'string' && RAW_RE.test(v);

const HOUR_MS = 60 * 60 * 1000;
const USEFUL_MS = 2 * 60 * 1000; // a link with less than this left does not count as "the owner has a usable link"

const VERIFY = 'email_verification';

// Link lifetime. Password reset: RESET_TOKEN_TTL_MINUTES (default 30). Email verification: VERIFY_TOKEN_TTL_HOURS (default 24, 1..168).
const ttlMinutes = (env = process.env, purpose) => {
  if (purpose === VERIFY) {
    const h = Number(env.VERIFY_TOKEN_TTL_HOURS);
    return Number.isFinite(h) && h >= 1 && h <= 168 ? Math.round(h * 60) : 24 * 60;
  }
  const n = Number(env.RESET_TOKEN_TTL_MINUTES);
  return Number.isFinite(n) && n >= 5 && n <= 24 * 60 ? Math.round(n) : 30;
};

// Cooldown (seconds between reset emails per account) and hourly budget. Outside NODE_ENV=test the values are clamped to
// sane ranges so a typo cannot disable protection; tests may use 0 / large values to exercise concurrency.
// Email verification has its own knobs (VERIFY_COOLDOWN_SECONDS / VERIFY_MAX_PER_HOUR) with the same clamping.
const limits = (env = process.env, purpose) => {
  const testing = env.NODE_ENV === 'test';
  const verify = purpose === VERIFY;
  const cd = Number(verify ? env.VERIFY_COOLDOWN_SECONDS : env.RESET_COOLDOWN_SECONDS);
  const mx = Number(verify ? env.VERIFY_MAX_PER_HOUR : env.RESET_MAX_PER_HOUR);
  const cooldownSeconds = Number.isFinite(cd) && (testing ? cd >= 0 && cd <= 3600 : cd >= 30 && cd <= 3600) ? cd : 60;
  const maxPerHour = Number.isInteger(mx) && (testing ? mx >= 1 && mx <= 100000 : mx >= 1 && mx <= 20) ? mx : 5;
  return { cooldownMs: cooldownSeconds * 1000, maxPerHour };
};

const stateId = (userId, purpose) => `${purpose}:${String(userId)}`;
const states = () => AuthRecoveryState.collection;
const EPOCH = new Date(0);

// Make sure the state document exists. Two processes may race here: the loser gets E11000 on the unique _id, which only
// means "it exists now".
const ensureState = async (userId, purpose) => {
  try {
    await states().updateOne(
      { _id: stateId(userId, purpose) },
      { $setOnInsert: { user: userId, purpose, seq: 0, activeSeq: 0, active: null, windowCount: 0 } },
      { upsert: true },
    );
  } catch (err) {
    if (!err || err.code !== 11000) throw err;
  }
};

// STEP 1 — atomic reservation: cooldown + hourly budget + sequence number in ONE conditional update.
// Returns { seq } when granted, or { throttled: 'cooldown' | 'budget' } (nothing is modified in that case).
//  - cooldown is FIXED: a throttled request never extends it, so an attacker cannot keep the owner out by hammering.
//  - the hourly budget does NOT apply while the account has no usable link left (>= USEFUL_MS to live): the owner can always
//    get a new link, so exhausting the budget (e.g. by a third party) cannot lock them out. Emails/hour stay bounded.
const reserve = async (userId, purpose, env = process.env) => {
  const { cooldownMs, maxPerHour } = limits(env, purpose);
  await ensureState(userId, purpose);
  const NOW = '$$NOW';
  const windowExpired = { $lte: [{ $ifNull: ['$windowStart', EPOCH] }, { $subtract: [NOW, HOUR_MS] }] };
  const id = stateId(userId, purpose);
  const granted = await states().findOneAndUpdate(
    {
      _id: id,
      $expr: {
        $and: [
          { $lte: [{ $ifNull: ['$cooldownUntil', EPOCH] }, NOW] },
          {
            $or: [
              windowExpired,
              { $lt: [{ $ifNull: ['$windowCount', 0] }, maxPerHour] },
              { $not: [{ $gt: [{ $ifNull: ['$active.expiresAt', EPOCH] }, { $add: [NOW, USEFUL_MS] }] }] },
            ],
          },
        ],
      },
    },
    [{
      $set: {
        seq: { $add: [{ $ifNull: ['$seq', 0] }, 1] },
        cooldownUntil: { $add: [NOW, cooldownMs] },
        windowCount: { $cond: [windowExpired, 1, { $add: [{ $ifNull: ['$windowCount', 0] }, 1] }] },
        windowStart: { $cond: [windowExpired, NOW, '$windowStart'] },
      },
    }],
    { returnDocument: 'after' },
  );
  if (granted) return { seq: granted.seq };
  const cur = await states().findOne({ _id: id }, { projection: { cooldownUntil: 1, windowCount: 1 } });
  return { throttled: cur && (cur.windowCount || 0) >= maxPerHour && !(cur.cooldownUntil && cur.cooldownUntil > new Date()) ? 'budget' : 'cooldown' };
};

// STEP 2 — create the (not yet usable) link record. Returns { raw, doc }; `raw` must never be stored or logged.
const createPending = async (userId, purpose, seq, tokenVersion, env = process.env) => {
  const raw = newRawToken();
  const doc = await AuthToken.create({
    user: userId, purpose, seq, tokenVersion: tokenVersion || 0, tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + ttlMinutes(env, purpose) * 60 * 1000),
  });
  return { raw, doc };
};

// Audit only (never decides usability). Failures here are not security relevant.
const markDelivery = (id, delivery, deliveryCode) =>
  AuthToken.updateOne({ _id: id }, { $set: { delivery, ...(deliveryCode ? { deliveryCode } : {}) } });

// STEP 4 — activation: compare-and-set on seq. Succeeds only if no link with an equal or higher seq was ever activated, which
// replaces the previous usable link in the same atomic update. Returns true when `doc` is now THE usable link.
// A late, older request (delayed insert, slow transport) fails here and leaves the newer link untouched.
const activate = async (doc) => {
  const won = await states().findOneAndUpdate(
    { _id: stateId(doc.user, doc.purpose), $or: [{ activeSeq: { $lt: doc.seq } }, { activeSeq: { $exists: false } }] },
    {
      $set: {
        activeSeq: doc.seq,
        active: { tokenId: doc._id, hash: doc.tokenHash, expiresAt: doc.expiresAt, tokenVersion: doc.tokenVersion || 0, seq: doc.seq },
      },
      $unset: { consumedAt: '', revokedAt: '' },
    },
    { returnDocument: 'before' },
  );
  if (!won) {
    await AuthToken.updateOne({ _id: doc._id, revokedAt: null }, { $set: { revokedAt: new Date() } }).catch(() => {});
    return false;
  }
  // Audit trail: mark the superseded link and this one. Usability was already decided by the update above.
  const prev = won.active && won.active.tokenId;
  if (prev) await AuthToken.updateOne({ _id: prev, usedAt: null, revokedAt: null }, { $set: { revokedAt: new Date() } }).catch(() => {});
  await AuthToken.updateOne({ _id: doc._id }, { $set: { activatedAt: new Date() } }).catch(() => {});
  return true;
};

// Non-consuming lookup: the token must be THE usable link of its account: unused, unrevoked, unexpired, purpose matches.
// Returns { user, tokenId, tokenVersion } or null.
const peekToken = async (raw, purpose) => {
  if (!looksLikeToken(raw)) return null;
  const s = await states().findOne({ purpose, 'active.hash': hashToken(raw), 'active.expiresAt': { $gt: new Date() } });
  return s && s.active ? { user: s.user, tokenId: s.active.tokenId, tokenVersion: s.active.tokenVersion || 0 } : null;
};

// ONE atomic update: resolves for exactly one caller; everyone else (a concurrent request, a replay, an expired / revoked /
// other-purpose token) gets null, indistinguishably. There is deliberately NO way to un-consume: once this returns a result
// the link is dead for good, whatever happens next (crash, timeout, failover, ambiguous write).
const consumeToken = async (raw, purpose) => {
  if (!looksLikeToken(raw)) return null;
  const before = await states().findOneAndUpdate(
    { purpose, 'active.hash': hashToken(raw), 'active.expiresAt': { $gt: new Date() } },
    { $set: { active: null, consumedAt: new Date() } },
    { returnDocument: 'before' },
  );
  if (!before || !before.active) return null;
  return { user: before.user, tokenId: before.active.tokenId, tokenVersion: before.active.tokenVersion || 0 };
};

// Audit only, after the fact.
const markUsed = (tokenId) => AuthToken.updateOne({ _id: tokenId, usedAt: null }, { $set: { usedAt: new Date() } });

// Kills the usable link of this account (used after a password change through ANY path). Links that are still in flight
// (reserved / emailed but not yet activated) carry the old tokenVersion and are refused at use, see tokenVersionFilter.
const revokeAllLinks = async (userId, purpose) => {
  const now = new Date();
  await states().updateOne({ _id: stateId(userId, purpose), active: { $ne: null } }, { $set: { active: null, revokedAt: now } });
  await AuthToken.updateMany({ user: userId, purpose, usedAt: null, revokedAt: null }, { $set: { revokedAt: now } });
};

// Mongo filter value matching a user's stored tokenVersion (missing counts as 0, like the auth middleware).
const tokenVersionFilter = (tv) => ((tv || 0) === 0 ? { $in: [0, null] } : tv);

module.exports = {
  hashToken, newRawToken, looksLikeToken, ttlMinutes, limits, stateId, USEFUL_MS, VERIFY,
  reserve, createPending, markDelivery, activate, peekToken, consumeToken, markUsed, revokeAllLinks, tokenVersionFilter,
};
