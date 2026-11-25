/*
 * Maintenance: find (and optionally delete) SavedJob records whose Job no longer exists.
 *
 *   npm run maintenance:orphan-saved-jobs              # dry run (default): report only, writes nothing
 *   npm run maintenance:orphan-saved-jobs -- --apply   # back up, re-check, then delete orphaned SavedJobs
 *
 * Rules enforced by this script:
 *  - Never runs automatically; normal API reads never delete anything (GET /saved-jobs only omits orphans).
 *  - Dry run is the default. Deletion requires the explicit --apply flag.
 *  - Before deleting, the orphaned documents are written to a NEW timestamped JSON backup file
 *    (never overwrites an existing file) and the file is read back and verified. If that fails, nothing is deleted.
 *  - Each targeted record is re-checked as still orphaned immediately before deletion.
 *  - Applications are REPORT-ONLY. This script never deletes or modifies Application records.
 *  - Refuses NODE_ENV=production, and refuses any non-local database unless explicitly confirmed
 *    with MAINTENANCE_ALLOW_REMOTE_DB=<exact database name> (required even for the dry run).
 *
 * Restoring from a backup: the file is Extended JSON. Load it with
 *   const { EJSON } = mongoose.mongo.BSON; const { documents } = EJSON.parse(fs.readFileSync(file, 'utf8'));
 *   await mongoose.connection.collection('savedjobs').insertMany(documents);
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { SAFE_SCRIPT_OPTIONS } = require('../config/dbOptions');
const SavedJob = require('../models/SavedJob');
const Application = require('../models/Application');
const Job = require('../models/Job');

// EJSON ships with the MongoDB driver that mongoose already depends on (no extra dependency).
const { EJSON } = mongoose.mongo.BSON;

const BATCH = 500;
const args = process.argv.slice(2);
const KNOWN_FLAGS = ['--apply', '--help'];
const APPLY = args.includes('--apply');

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

if (args.includes('--help')) {
  console.log('Usage: npm run maintenance:orphan-saved-jobs [-- --apply]\nDefault is a dry run. See the header of scripts/cleanup-orphan-saved-jobs.js.');
  process.exit(0);
}
const unknown = args.filter((a) => !KNOWN_FLAGS.includes(a));
if (unknown.length) fail(`Unknown argument(s): ${unknown.join(' ')}. Allowed: ${KNOWN_FLAGS.join(' ')}`);

// ---- Safety guard: runs BEFORE any database connection is opened ----
const describeTarget = () => {
  const uri = process.env.MONGO_URI || '';
  const m = uri.match(/^(mongodb(?:\+srv)?):\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/);
  if (!m) return null;
  const hosts = m[2].split(',').map((h) => h.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase());
  const isLocal = m[1] === 'mongodb' && hosts.every((h) => ['localhost', '127.0.0.1', '::1'].includes(h));
  // With no database in the URI, MongoDB uses its default database named "test".
  return { hosts, dbName: m[3] || 'test', isLocal };
};

const assertSafeTarget = () => {
  const target = describeTarget();
  if (!target) fail('Refusing to run: MONGO_URI is missing or not a valid MongoDB URI.');
  if (process.env.NODE_ENV === 'production') fail('Refusing to run: NODE_ENV is "production".');
  console.log(`Target: host=${target.hosts.join(',')} database=${target.dbName} (${target.isLocal ? 'local' : 'REMOTE'})`);
  if (!target.isLocal) {
    if (process.env.MAINTENANCE_ALLOW_REMOTE_DB !== target.dbName) {
      fail(
        'Refusing to connect to a REMOTE database. If you really mean it, set ' +
        `MAINTENANCE_ALLOW_REMOTE_DB=${target.dbName} (the exact database name).`
      );
    }
    console.warn(`WARNING: remote database "${target.dbName}" explicitly confirmed.`);
  }
  return target;
};

// Orphan = a document in `model`'s collection whose `job` has no matching document in the jobs collection.
const findOrphans = (model, extraMatch = {}) =>
  model.collection
    .aggregate([
      { $match: extraMatch },
      { $lookup: { from: Job.collection.name, localField: 'job', foreignField: '_id', as: '_job' } },
      { $match: { _job: { $size: 0 } } },
      { $project: { _job: 0 } },
    ])
    .toArray();

const perUser = (docs) => {
  const counts = new Map();
  docs.forEach((d) => counts.set(String(d.user), (counts.get(String(d.user)) || 0) + 1));
  return [...counts].map(([user, n]) => `${user}: ${n}`);
};

const backupDir = path.join(__dirname, '..', 'backups');

// Writes a brand-new backup (flag 'wx' fails if the path exists) and verifies it by reading it back.
const writeVerifiedBackup = (target, docs) => {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(backupDir, `orphan-saved-jobs-${target.dbName}-${stamp}-${crypto.randomBytes(3).toString('hex')}.json`);
  const payload = EJSON.stringify(
    {
      createdAt: new Date().toISOString(),
      database: target.dbName,
      host: target.hosts.join(','),
      collection: SavedJob.collection.name,
      count: docs.length,
      documents: docs,
    },
    { relaxed: false },
    2
  );
  fs.writeFileSync(file, payload, { flag: 'wx' });

  const readBack = fs.readFileSync(file, 'utf8');
  if (readBack !== payload) throw new Error('Backup verification failed: file content differs from what was written.');
  const parsed = EJSON.parse(readBack);
  const expected = new Set(docs.map((d) => String(d._id)));
  const got = new Set(parsed.documents.map((d) => String(d._id)));
  if (parsed.count !== docs.length || got.size !== expected.size || [...expected].some((id) => !got.has(id))) {
    throw new Error('Backup verification failed: document ids do not match.');
  }
  return { file, bytes: Buffer.byteLength(payload) };
};

const run = async () => {
  const target = assertSafeTarget();
  console.log(APPLY ? 'Mode: APPLY (will delete orphaned SavedJobs after a verified backup)' : 'Mode: DRY RUN (no changes will be made)');

  await mongoose.connect(process.env.MONGO_URI, SAFE_SCRIPT_OPTIONS); // never build indexes as a side effect of connecting

  const savedOrphans = await findOrphans(SavedJob);
  const appOrphans = await findOrphans(Application);

  console.log(`\nSavedJobs whose job no longer exists: ${savedOrphans.length}`);
  if (savedOrphans.length) {
    console.log('  per user ->', perUser(savedOrphans).join(' | '));
    console.log('  sample   ->', savedOrphans.slice(0, 10).map((d) => `${d._id} (job ${d.job})`).join(', '));
  }
  console.log(`Applications whose job no longer exists (REPORT ONLY, never modified): ${appOrphans.length}`);
  if (appOrphans.length) console.log('  per user ->', perUser(appOrphans).join(' | '));

  if (!APPLY) {
    console.log('\nDry run complete. Nothing was changed. Re-run with --apply to delete the orphaned SavedJobs listed above.');
    return;
  }
  if (!savedOrphans.length) {
    console.log('\nNothing to delete.');
    return;
  }

  // 1. Verified backup first. If this throws, we stop before any delete.
  const backup = writeVerifiedBackup(target, savedOrphans);
  console.log(`\nBackup written and verified: ${backup.file} (${backup.bytes} bytes, ${savedOrphans.length} documents)`);

  // 2. Re-check each target immediately before deleting, in batches; delete only what is STILL orphaned.
  const ids = savedOrphans.map((d) => d._id);
  let deleted = 0;
  let skipped = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const stillOrphaned = await findOrphans(SavedJob, { _id: { $in: chunk } });
    skipped += chunk.length - stillOrphaned.length;
    if (!stillOrphaned.length) continue;
    const res = await SavedJob.collection.deleteMany({ _id: { $in: stillOrphaned.map((d) => d._id) } });
    deleted += res.deletedCount;
  }

  console.log(`Deleted ${deleted} orphaned SavedJob(s). Skipped ${skipped} that were no longer orphaned. Applications untouched.`);
};

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Maintenance failed:', err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
