const crypto = require('crypto');
const SkillGapAnalysis = require('../../models/SkillGapAnalysis');

// Per-analysis generation lock, stored ON the analysis document so it works across several server processes
// (an in-memory map would not). Acquisition is one atomic findOneAndUpdate: only one caller can flip the lock from
// "free or stale" to "mine". A crashed holder cannot block anyone for long: locks older than STALE_MS are taken over.
// Updates use `timestamps: false` so locking never changes the analysis' updatedAt.

// Timing can be shortened for tests, but ONLY when NODE_ENV is exactly "test" (never in development or production).
const testTiming = (name, fallback) => (process.env.NODE_ENV === 'test' && Number(process.env[name]) > 0 ? Number(process.env[name]) : fallback);
const STALE_MS = testTiming('ROADMAP_LOCK_STALE_MS', 3 * 60 * 1000); // longer than the AI timeout (45s) with its one retry
const POLL_MS = 250;
const DEFAULT_MAX_WAIT_MS = testTiming('ROADMAP_LOCK_MAX_WAIT_MS', 2 * 60 * 1000);
let maxWaitMs = DEFAULT_MAX_WAIT_MS;

let sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const _setSleep = (fn) => { sleep = fn || ((ms) => new Promise((r) => setTimeout(r, ms))); };

const freeOrStale = () => ({
  $or: [{ 'roadmapLock.token': { $exists: false } }, { 'roadmapLock.token': null }, { 'roadmapLock.at': { $lt: new Date(Date.now() - STALE_MS) } }],
});

// Returns the lock token when acquired, or null when somebody else currently holds a fresh lock.
const tryAcquire = async (analysisId, userId) => {
  const token = crypto.randomBytes(12).toString('hex');
  const won = await SkillGapAnalysis.findOneAndUpdate(
    { _id: analysisId, user: userId, ...freeOrStale() },
    { $set: { roadmapLock: { token, at: new Date() } } },
    { timestamps: false, projection: { _id: 1 } },
  );
  return won ? token : null;
};

// Only the holder (matching token) can release, so a late finally{} never frees somebody else's lock.
const release = (analysisId, token) => SkillGapAnalysis.updateOne(
  { _id: analysisId, 'roadmapLock.token': token },
  { $unset: { roadmapLock: 1 } },
  { timestamps: false },
);

// Waits until the lock is free (or stale) or the deadline passes. Returns true when it may try to acquire again.
const waitUntilFree = async (analysisId, userId) => {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const held = await SkillGapAnalysis.exists({ _id: analysisId, user: userId, $nor: [freeOrStale()] });
    if (!held) return true;
  }
  return false;
};

const _setMaxWait = (ms) => { maxWaitMs = ms || DEFAULT_MAX_WAIT_MS; };

module.exports = { tryAcquire, release, waitUntilFree, STALE_MS, _setSleep, _setMaxWait };
