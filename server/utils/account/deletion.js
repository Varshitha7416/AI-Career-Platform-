const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Referral = require('../../models/Referral');
const { POLICY, loadModels, unmappedModels } = require('./policy');
const { fault } = require('../testFaults');
const { isDevEnvironment } = require('../../services/email/config');

// Account deletion = ANONYMIZE the User document + clean every collection per policy.js. See docs/26-account-management.md.
//
// Crash safety without transactions (a standalone mongod has none):
//   1. ONE atomic update of the user document turns it into a tombstone (deletedAt set, identity wiped, password unusable,
//      tokenVersion bumped). From this instant the account cannot log in and every old JWT is rejected.
//   2. Cleanup of the other collections follows. Every step is idempotent and keyed by the user id, and the user document keeps
//      `deletionCompletedAt` unset until cleanup VERIFIED clean, so an interrupted deletion is found and finished later
//      (completePendingDeletions: run at server start, periodically, and by `npm run maintenance:account-deletions`).
//   3. The API answers success only when verification found nothing left; otherwise 503 DELETION_INCOMPLETE.

loadModels();

const log = (msg) => console.warn(`[account] ${msg}`); // ids and step names only, never emails or names

const PLACEHOLDER_DOMAIN = 'deleted.invalid';
const KEEP = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'tokenVersion', 'deletedAt', 'deletionCompletedAt']);
const SET_PATHS = new Set(['name', 'email', 'password', 'role', 'isReferrer', 'emailVerified']);
const OPEN = ['requested', 'pending', 'accepted'];

const deletedEmail = (id) => `deleted+${id}@${PLACEHOLDER_DOMAIN}`;

// Everything not explicitly kept or replaced is unset, so profile fields added later are wiped too.
const tombstoneUpdate = (id) => {
  const $unset = {};
  for (const p of Object.keys(User.schema.paths)) {
    const top = p.split('.')[0];
    if (KEEP.has(top) || SET_PATHS.has(top) || top === 'notificationPrefs') continue;
    $unset[top] = '';
  }
  return {
    $set: {
      name: 'Deleted user',
      email: deletedEmail(id),
      // not a bcrypt hash, so no password can ever match it
      password: `!deleted!${crypto.randomBytes(24).toString('hex')}`,
      role: 'jobseeker',
      isReferrer: false,
      emailVerified: false,
      deletedAt: new Date(),
      'notificationPrefs.applications': false,
      'notificationPrefs.interviews': false,
      'notificationPrefs.referrals': false,
      'notificationPrefs.programs': false,
      'notificationPrefs.reminders': false,
      'notificationPrefs.support': false,
    },
    $inc: { tokenVersion: 1 },
    $unset,
  };
};

// Referral rows involve ANOTHER user. The deleted side's content goes (message text, resume copy), open requests are closed so
// the counterparty is not left waiting, and the counterparty's record stays readable (it now shows "Deleted user").
const anonymizeReferrals = async (uid) => {
  const now = new Date();
  await Referral.updateMany(
    { seeker: uid, status: { $in: OPEN } },
    { $set: { status: 'withdrawn', active: false, respondedAt: now }, $push: { statusHistory: { status: 'withdrawn', at: now } } },
  );
  await Referral.updateMany(
    { referrer: uid, status: { $in: OPEN } },
    { $set: { status: 'declined', active: false, respondedAt: now }, $push: { statusHistory: { status: 'declined', at: now } } },
  );
  // The seeker's own text and resume copy are the deleted user's personal data.
  await Referral.updateMany({ seeker: uid }, { $set: { message: '' }, $unset: { resumeSnapshot: '', resumeInfo: '', resume: '' } });
};

// Support history is kept (category, status, admin responses and notes) but the user's own words and identity are removed.
const anonymizeContactMessages = async (uid) => {
  const ContactMessage = mongoose.model('ContactMessage');
  await ContactMessage.updateMany(
    { user: uid, anonymizedAt: null },
    { $set: { subject: ContactMessage.REMOVED, message: ContactMessage.REMOVED, name: '', email: '', contentHash: '', anonymizedAt: new Date() } },
    { timestamps: false },
  );
};

const countRemaining = async (uid) => {
  let n = 0;
  n += await mongoose.model('ContactMessage').countDocuments({ user: uid, anonymizedAt: null });
  for (const [name, p] of Object.entries(POLICY)) {
    if (p.action === 'delete') n += await mongoose.model(name).countDocuments({ [p.field]: uid });
  }
  n += await Referral.countDocuments({
    $or: [
      { seeker: uid, $or: [{ message: { $nin: [null, ''] } }, { resumeSnapshot: { $exists: true } }, { resumeInfo: { $exists: true } }, { resume: { $exists: true } }] },
      { seeker: uid, status: { $in: OPEN } },
      { referrer: uid, status: { $in: OPEN } },
    ],
  });
  return n;
};

// Idempotent. Throws on the first failing step (the tombstone stays, completion stays unmarked).
const runCleanup = async (userId) => {
  const uid = new mongoose.Types.ObjectId(String(userId));
  for (let pass = 0; pass < 3; pass += 1) {
    for (const [name, p] of Object.entries(POLICY)) {
      if (p.action !== 'delete') continue;
      await fault(`account.cleanup.${name}`);
      await mongoose.model(name).deleteMany({ [p.field]: uid });
    }
    await fault('account.cleanup.Referral');
    await anonymizeReferrals(uid);
    await fault('account.cleanup.ContactMessage');
    await anonymizeContactMessages(uid);
    // A request that was already past authentication when the tombstone was written can still add a row: look again.
    if ((await countRemaining(uid)) === 0) {
      await fault('account.cleanup.complete');
      await User.updateOne({ _id: uid, deletedAt: { $ne: null } }, { $set: { deletionCompletedAt: new Date() } });
      return true;
    }
  }
  throw Object.assign(new Error('rows remain after cleanup'), { name: 'CleanupIncomplete' });
};

const adminLocks = () => mongoose.connection.collection('accountlocks');
const acquireAdminLock = async (owner) => {
  const now = new Date();
  try {
    const r = await adminLocks().findOneAndUpdate(
      { _id: 'admin-deletion', $or: [{ expiresAt: { $lt: now } }, { expiresAt: { $exists: false } }] },
      { $set: { owner, expiresAt: new Date(now.getTime() + 30000) } },
      { upsert: true, returnDocument: 'after' },
    );
    return Boolean(r);
  } catch (err) {
    if (err && err.code === 11000) return false; // held by someone else
    throw err;
  }
};
const releaseAdminLock = (owner) => adminLocks().deleteOne({ _id: 'admin-deletion', owner }).catch(() => {});

// Returns { ok: true } | { ok: false, code, status, message }. `user` is the loaded, authenticated, password-verified User.
const deleteAccount = async (user) => {
  const id = String(user._id);
  const owner = crypto.randomBytes(8).toString('hex');
  const isAdmin = user.role === 'admin';
  if (isAdmin && !(await acquireAdminLock(owner))) {
    return { ok: false, status: 409, code: 'BUSY', message: 'Another account deletion is in progress. Please try again in a moment.' };
  }
  try {
    if (isAdmin) {
      const others = await User.countDocuments({ role: 'admin', deletedAt: null, _id: { $ne: user._id } });
      if (others < 1) {
        return { ok: false, status: 409, code: 'LAST_ADMIN', message: 'You are the only administrator. Make another account an administrator before deleting this one.' };
      }
    }
    if (isDevEnvironment(process.env)) {
      try { await mongoose.model('OutboxEmail').deleteMany({ to: user.email }); } catch { /* dev-only data */ }
    }
    const t = await User.updateOne({ _id: user._id, deletedAt: null }, tombstoneUpdate(id));
    if (!t.modifiedCount) return { ok: false, status: 409, code: 'ALREADY_DELETED', message: 'This account was already deleted.' };
  } finally {
    if (isAdmin) await releaseAdminLock(owner);
  }
  try {
    await runCleanup(id);
  } catch (err) {
    log(`deletion cleanup incomplete user=${id} reason=${err && err.name}`);
    return {
      ok: false,
      status: 503,
      code: 'DELETION_INCOMPLETE',
      message: 'Your account is closed and can no longer be used, but we could not finish removing all of its data yet. We will complete this automatically; nothing further is needed from you.',
    };
  }
  return { ok: true };
};

// Finishes interrupted deletions. `graceMs` skips tombstones that a live request may still be cleaning up.
// Also RE-SCANS tombstones completed within `rescanMs` (default 24h): a request that was already authenticated when the account
// was deleted can write a row after the verification pass. countRemaining is cheap; runCleanup only runs when a stray row exists.
// The {$type:'date'} term lets the partial index on User (deleted_sweep_idx) serve these queries.
const completePendingDeletions = async ({ graceMs = 120000, limit = 50, rescanMs = 24 * 60 * 60 * 1000 } = {}) => {
  const cutoff = new Date(Date.now() - graceMs);
  const pending = await User.find({ deletedAt: { $type: 'date', $lte: cutoff }, deletionCompletedAt: null }).select('_id').limit(limit).lean();
  let completed = 0;
  let failed = 0;
  for (const u of pending) {
    try { await runCleanup(u._id); completed += 1; } catch (err) { failed += 1; log(`resume failed user=${u._id} reason=${err && err.name}`); }
  }
  let strayCleaned = 0;
  if (rescanMs > 0) {
    const recent = await User.find({ deletedAt: { $type: 'date', $gte: new Date(Date.now() - rescanMs) }, deletionCompletedAt: { $ne: null } }).select('_id').limit(limit * 4).lean();
    for (const u of recent) {
      try {
        if ((await countRemaining(new mongoose.Types.ObjectId(String(u._id)))) > 0) {
          await runCleanup(u._id);
          strayCleaned += 1;
          log(`stray rows removed for deleted user=${u._id}`);
        }
      } catch (err) { failed += 1; log(`rescan failed user=${u._id} reason=${err && err.name}`); }
    }
  }
  return { found: pending.length, completed, failed, strayCleaned };
};

const startSweep = (env = process.env) => {
  const test = env.NODE_ENV === 'test';
  const every = Number(env.ACCOUNT_SWEEP_INTERVAL_MS);
  const interval = test && every > 0 ? every : 10 * 60 * 1000;
  const graceMs = test && env.ACCOUNT_SWEEP_GRACE_MS !== undefined ? Number(env.ACCOUNT_SWEEP_GRACE_MS) : 120000;
  const run = () => completePendingDeletions({ graceMs }).catch((e) => log(`sweep error reason=${e && e.name}`));
  const miss = unmappedModels();
  if (miss.length) log(`models reference User but have no deletion policy: ${miss.join(', ')}`);
  mongoose.connection.once('open', () => { setTimeout(run, test ? 200 : 30000).unref(); });
  setInterval(run, interval).unref();
};

module.exports = { deleteAccount, runCleanup, countRemaining, completePendingDeletions, startSweep, tombstoneUpdate, deletedEmail };
