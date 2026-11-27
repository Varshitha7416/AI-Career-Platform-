const crypto = require('crypto');

// First-admin bootstrap (docs/23). Pure logic over a MongoDB `db` handle so it can be tested without the CLI.
//
// Design: promote an EXISTING account whose email is VERIFIED (ownership proven by the verification link), and only with a
// one-time operator secret. Nothing here is reachable over HTTP.
//
// Concurrency / single-admin guarantee: a sentinel document with the fixed _id "first-admin" in the `adminbootstrap`
// collection. insertOne on a fixed _id is atomic and unique by construction (no index build needed, which matters because
// index building is OFF for Atlas), so of N simultaneous runs exactly one inserts it and the others are refused. The
// sentinel is claimed BEFORE the role change. A run that crashes after claiming but before promoting leaves a 'claimed'
// sentinel with no admin; it can be taken over (atomically, by compare-and-set on its claimedAt) after STALE_MS.
const SENTINEL_ID = 'first-admin';
const MIN_SECRET_LENGTH = 24;
const STALE_MS = 5 * 60 * 1000;

class BootstrapError extends Error {
  constructor(code, message) { super(message); this.name = 'BootstrapError'; this.code = code; }
}

// Constant-time comparison of two secrets of any length (digests have equal length, so timingSafeEqual never throws).
const secretsMatch = (expected, provided) => {
  const h = (v) => crypto.createHash('sha256').update(String(v), 'utf8').digest();
  return crypto.timingSafeEqual(h(expected), h(provided));
};

const normaliseEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

// Returns { email, userId }. Throws BootstrapError (codes: BAD_CONFIG, BAD_SECRET, BAD_EMAIL, ADMIN_EXISTS, BOOTSTRAP_CLAIMED,
// NO_SUCH_USER, NOT_VERIFIED). The secrets are never included in an error message.
const bootstrapAdmin = async ({ db, email, expectedSecret, providedSecret, now = () => new Date() }) => {
  if (typeof expectedSecret !== 'string' || expectedSecret.length < MIN_SECRET_LENGTH) {
    throw new BootstrapError('BAD_CONFIG', `BOOTSTRAP_ADMIN_SECRET must be set to a random value of at least ${MIN_SECRET_LENGTH} characters.`);
  }
  if (typeof providedSecret !== 'string' || !providedSecret || !secretsMatch(expectedSecret, providedSecret)) {
    throw new BootstrapError('BAD_SECRET', 'The bootstrap secret does not match.');
  }
  const target = normaliseEmail(email);
  if (!target || target.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(target)) throw new BootstrapError('BAD_EMAIL', 'A valid --email is required.');

  const users = db.collection('users');
  const sentinels = db.collection('adminbootstrap');

  if (await users.findOne({ role: 'admin' }, { projection: { _id: 1 } })) {
    throw new BootstrapError('ADMIN_EXISTS', 'An admin account already exists. This command only creates the FIRST admin.');
  }
  const user = await users.findOne({ email: target, deletedAt: null }, { projection: { _id: 1, emailVerified: 1 } });
  if (!user) throw new BootstrapError('NO_SUCH_USER', 'No active account with that email exists. Sign up first, then verify the email.');
  if (user.emailVerified !== true) throw new BootstrapError('NOT_VERIFIED', "That account's email address is not verified. Verify it first (the verification link proves you own the address).");

  // Claim the one-time sentinel (atomic).
  const claimedAt = now();
  let claimed = false;
  try {
    await sentinels.insertOne({ _id: SENTINEL_ID, status: 'claimed', email: target, userId: user._id, claimedAt });
    claimed = true;
  } catch (err) {
    if (!err || err.code !== 11000) throw err;
    // Stale takeover: a previous run claimed but never finished and no admin exists (checked above).
    const took = await sentinels.findOneAndUpdate(
      { _id: SENTINEL_ID, status: 'claimed', claimedAt: { $lt: new Date(claimedAt.getTime() - STALE_MS) } },
      { $set: { email: target, userId: user._id, claimedAt } },
    );
    claimed = !!took;
  }
  if (!claimed) throw new BootstrapError('BOOTSTRAP_CLAIMED', 'The first-admin bootstrap was already performed or is running in another process.');

  // Promote, guarded on the account still being verified, active and not an admin already.
  const res = await users.updateOne(
    { _id: user._id, emailVerified: true, deletedAt: null, role: { $ne: 'admin' } },
    { $set: { role: 'admin' }, $inc: { tokenVersion: 1 } }, // new privileges: retire older sessions
  );
  if (res.matchedCount !== 1) {
    await sentinels.deleteOne({ _id: SENTINEL_ID, claimedAt }).catch(() => {}); // release only OUR claim
    throw new BootstrapError('NOT_VERIFIED', 'The account changed while bootstrapping (no longer verified or active). Nothing was changed.');
  }
  await sentinels.updateOne({ _id: SENTINEL_ID }, { $set: { status: 'completed', completedAt: now() } });
  return { email: target, userId: String(user._id) };
};

module.exports = { bootstrapAdmin, BootstrapError, secretsMatch, SENTINEL_ID, MIN_SECRET_LENGTH, STALE_MS };
