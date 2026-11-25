/*
 * Seed the curated DEMO career programs (ADDITIVE ONLY: inserts missing programs, never deletes or overwrites).
 *
 *   npm run seed:programs               # dry run (default): prints the plan, writes nothing
 *   npm run seed:programs -- --apply    # inserts programs that do not exist yet (matched by slug)
 *
 * Programs are matched by `slug` and written with $setOnInsert, so re-running is a no-op and any manual edits to an
 * existing program are preserved. Programs are demo content (source: 'demo'); `url` is only the provider's public
 * home page. Users' enrollments are never touched.
 *
 * Safety: dry run by default; --apply required to write; refuses NODE_ENV=production; refuses any non-local
 * database unless SEED_ALLOW_REMOTE_DB=<exact database name> is set (even for the dry run).
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Program = require('../models/Program');
const { PROGRAMS } = require('../data/programs');

const args = process.argv.slice(2);
const KNOWN_FLAGS = ['--apply', '--help'];
const APPLY = args.includes('--apply');

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
if (args.includes('--help')) {
  console.log('Usage: npm run seed:programs [-- --apply]\nDry run by default. See the header of scripts/seed-programs.js.');
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
  return { hosts, dbName: m[3] || 'test', isLocal }; // no db in the URI => MongoDB default "test"
};
const assertSafeTarget = () => {
  const target = describeTarget();
  if (!target) fail('Refusing to run: MONGO_URI is missing or not a valid MongoDB URI.');
  if (process.env.NODE_ENV === 'production') fail('Refusing to run: NODE_ENV is "production".');
  console.log(`Target: host=${target.hosts.join(',')} database=${target.dbName} (${target.isLocal ? 'local' : 'REMOTE'})`);
  if (!target.isLocal) {
    if (process.env.SEED_ALLOW_REMOTE_DB !== target.dbName) {
      fail(`Refusing to connect to a REMOTE database. If you really mean it, set SEED_ALLOW_REMOTE_DB=${target.dbName} (the exact database name).`);
    }
    console.warn(`WARNING: remote database "${target.dbName}" explicitly confirmed.`);
  }
};

const run = async () => {
  assertSafeTarget();
  console.log(APPLY ? 'Mode: APPLY (additive inserts only)' : 'Mode: DRY RUN (nothing will be written)');
  await mongoose.connect(process.env.MONGO_URI);

  const existing = new Set((await Program.collection.find({}, { projection: { slug: 1 } }).toArray()).map((p) => p.slug));
  const toInsert = PROGRAMS.filter((p) => !existing.has(p.slug));

  console.log(`\nPrograms in the dataset: ${PROGRAMS.length} | already in the database: ${PROGRAMS.length - toInsert.length} | to INSERT: ${toInsert.length}`);
  if (toInsert.length) console.log('  ' + toInsert.map((p) => `${p.title} (${p.provider})`).join('\n  '));

  if (!APPLY) {
    console.log('\nDry run complete. Nothing was written. Re-run with --apply to insert the programs listed above.');
    return;
  }
  if (!toInsert.length) {
    console.log('\nNothing to do: all demo programs already exist.');
    return;
  }

  const now = new Date();
  const res = await Program.collection.bulkWrite(
    toInsert.map((p) => ({
      updateOne: {
        filter: { slug: p.slug },
        update: { $setOnInsert: { ...p, isActive: true, source: 'demo', createdAt: now, updatedAt: now } },
        upsert: true,
      },
    }))
  );
  await Program.createIndexes();
  console.log(`\nInserted ${res.upsertedCount} programs. Nothing was deleted or overwritten.`);
};

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
