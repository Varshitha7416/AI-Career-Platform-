/*
 * Maintenance: finish account deletions that were interrupted after the account was closed but before every collection was
 * cleaned (users with deletedAt set and deletionCompletedAt unset). Safe to run repeatedly (every step is idempotent).
 *
 *   npm run maintenance:account-deletions
 *
 * Refuses NODE_ENV=production unless ACCOUNT_MAINTENANCE_ALLOW_PRODUCTION=true, and refuses a non-local database unless
 * MAINTENANCE_ALLOW_REMOTE_DB=<exact database name> is set. (The running server also does this automatically every 10 minutes.)
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { SAFE_SCRIPT_OPTIONS } = require('../config/dbOptions');
const { completePendingDeletions } = require('../utils/account/deletion');

const fail = (m) => { console.error(m); process.exit(1); };
(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) fail('MONGO_URI is not set');
  if (process.env.NODE_ENV === 'production' && process.env.ACCOUNT_MAINTENANCE_ALLOW_PRODUCTION !== 'true') fail('Refusing to run with NODE_ENV=production');
  const local = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri);
  const dbName = (uri.split('?')[0].split('/').pop() || 'test');
  if (!local && process.env.MAINTENANCE_ALLOW_REMOTE_DB !== dbName) fail(`Refusing a non-local database. Set MAINTENANCE_ALLOW_REMOTE_DB=${dbName} to confirm.`);
  await mongoose.connect(uri, SAFE_SCRIPT_OPTIONS);
  const r = await completePendingDeletions({ graceMs: 0 });
  console.log(`pending: ${r.found}, completed: ${r.completed}, failed: ${r.failed}`);
  await mongoose.disconnect();
  process.exit(r.failed ? 1 : 0);
})().catch((e) => fail(`Failed: ${e.name}`));
