/*
 * Migrate legacy Referral statuses: 'requested' -> 'pending'. Nothing else is changed.
 *
 *   npm run migrate:referrals              # dry run (default): counts only, writes nothing
 *   npm run migrate:referrals -- --apply   # writes a verified JSON backup to server/backups/, then migrates
 *
 * The API already reads 'requested' as 'pending', so running this is optional housekeeping. Re-running is a no-op.
 * Backups are Extended JSON (git-ignored); restore with Referral.collection.insertMany after deleting the migrated docs,
 * or simply set status back to 'requested' for the ids listed in the backup.
 *
 * Safety: dry run by default; refuses NODE_ENV=production; refuses any non-local database unless
 * MAINTENANCE_ALLOW_REMOTE_DB=<exact database name> is set (even for the dry run).
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { SAFE_SCRIPT_OPTIONS } = require('../config/dbOptions');
const Referral = require('../models/Referral');

const args = process.argv.slice(2);
const KNOWN = ['--apply', '--help'];
const APPLY = args.includes('--apply');
const fail = (m) => { console.error(m); process.exit(1); };
if (args.includes('--help')) { console.log('Usage: npm run migrate:referrals [-- --apply]. See the header of scripts/migrateReferralStatuses.js.'); process.exit(0); }
const unknown = args.filter((a) => !KNOWN.includes(a));
if (unknown.length) fail(`Unknown argument(s): ${unknown.join(' ')}. Allowed: ${KNOWN.join(' ')}`);

const describeTarget = () => {
  const m = (process.env.MONGO_URI || '').match(/^(mongodb(?:\+srv)?):\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/);
  if (!m) return null;
  const hosts = m[2].split(',').map((h) => h.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase());
  return { hosts, dbName: m[3] || 'test', isLocal: m[1] === 'mongodb' && hosts.every((h) => ['localhost', '127.0.0.1', '::1'].includes(h)) };
};

const run = async () => {
  const target = describeTarget();
  if (!target) fail('Refusing to run: MONGO_URI is missing or not a valid MongoDB URI.');
  if (process.env.NODE_ENV === 'production') fail('Refusing to run: NODE_ENV is "production".');
  console.log(`Target: host=${target.hosts.join(',')} database=${target.dbName} (${target.isLocal ? 'local' : 'REMOTE'})`);
  if (!target.isLocal && process.env.MAINTENANCE_ALLOW_REMOTE_DB !== target.dbName) {
    fail(`Refusing to connect to a REMOTE database. Set MAINTENANCE_ALLOW_REMOTE_DB=${target.dbName} to confirm.`);
  }
  console.log(APPLY ? 'Mode: APPLY (verified backup, then requested -> pending)' : 'Mode: DRY RUN (nothing will be written)');
  await mongoose.connect(process.env.MONGO_URI, SAFE_SCRIPT_OPTIONS); // never build indexes as a side effect of connecting

  const col = Referral.collection;
  const legacy = await col.find({ status: 'requested' }).toArray();
  console.log(`\nReferrals with legacy status 'requested': ${legacy.length}`);
  if (!APPLY) { console.log('Dry run complete. Nothing was written.'); return; }
  if (!legacy.length) { console.log('Nothing to do.'); return; }

  const { EJSON } = mongoose.mongo.BSON;
  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `referral-statuses-${target.dbName}-${stamp}-${crypto.randomBytes(3).toString('hex')}.json`);
  const payload = EJSON.stringify({ createdAt: new Date().toISOString(), database: target.dbName, collection: 'referrals', documents: legacy }, null, 2);
  fs.writeFileSync(file, payload, { flag: 'wx' });
  const back = EJSON.parse(fs.readFileSync(file, 'utf8'));
  if (fs.readFileSync(file, 'utf8') !== payload || back.documents.length !== legacy.length) throw new Error('Backup verification failed; nothing was changed.');
  console.log(`Backup written and verified: ${file}`);

  // status -> pending, and seed statusHistory with the original "pending" entry when none is stored
  const res = await col.updateMany({ _id: { $in: legacy.map((d) => d._id) }, status: 'requested' }, [{
    $set: {
      status: 'pending',
      statusHistory: { $cond: [{ $gt: [{ $size: { $ifNull: ['$statusHistory', []] } }, 0] }, '$statusHistory', [{ status: 'pending', at: '$createdAt' }]] },
    },
  }]);
  console.log(`Migrated ${res.modifiedCount} referral(s) from 'requested' to 'pending'.`);
};

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((e) => { console.error('Migration failed:', e.message); mongoose.disconnect().finally(() => process.exit(1)); });
