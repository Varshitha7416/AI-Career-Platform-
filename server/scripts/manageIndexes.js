/*
 * Deliberate index management for CareerNest. The app itself does NOT build indexes when it connects to a remote
 * database (see config/dbOptions.js); this script is the controlled way to do it.
 *
 *   npm run indexes                                  # dry run (default): list, compare, check duplicates; writes nothing
 *   npm run indexes -- --only=Referral,Resume         # limit to some models
 *   npm run indexes -- --apply                        # create ONLY the missing, safe indexes, then verify
 *
 * What it does, per model/collection:
 *   1. lists the indexes currently in the database;
 *   2. lists the indexes the model schema requires;
 *   3. classifies each required index: OK (present, same options) | MISSING | CONFLICT (same keys or name exist with
 *      different options: reported, never touched) ; existing indexes the schema does not know are listed as EXTRA;
 *   4. for every MISSING unique index, checks the data for duplicates first; an index whose data has duplicates is
 *      BLOCKED and is not created, even with --apply;
 *   5. with --apply: createIndex for the missing, unblocked indexes only, then re-reads the indexes to verify them.
 * It never drops, rebuilds or modifies an existing index and never changes documents. Index builds do read the
 * collection, so run them off-peak on large collections.
 *
 * Safety (checked BEFORE any connection is opened):
 *   - refuses NODE_ENV=production;
 *   - a database that is not local (e.g. Atlas) is refused unless MAINTENANCE_ALLOW_REMOTE_DB=<exact db name> is set,
 *     even for the dry run; a URI without a database name means MongoDB's default db "test";
 *   - --apply on a remote database additionally requires --confirm-backup (you assert a backup/snapshot exists).
 * Connects with autoIndex/autoCreate off, so merely connecting changes nothing.
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { parseTarget, SAFE_SCRIPT_OPTIONS } = require('../config/dbOptions');

const args = process.argv.slice(2);
const KNOWN = ['--apply', '--confirm-backup', '--help'];
const APPLY = args.includes('--apply');
const CONFIRM_BACKUP = args.includes('--confirm-backup');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice(7).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : null;

const fail = (m, code = 1) => { console.error(m); process.exit(code); };
if (args.includes('--help')) {
  console.log('Usage: npm run indexes [-- --only=Model1,Model2] [-- --apply [--confirm-backup]]. See the header of scripts/manageIndexes.js.');
  process.exit(0);
}
const unknown = args.filter((a) => !KNOWN.includes(a) && !a.startsWith('--only='));
if (unknown.length) fail(`Unknown argument(s): ${unknown.join(' ')}. Allowed: ${KNOWN.join(' ')} --only=<Models>`);

// ---- helpers (exported for tests) ---------------------------------------------------------------------------
const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object' && !(v instanceof Date) && !v._bsontype) {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {});
  }
  return v;
};
const keyStr = (spec) => JSON.stringify(Object.entries(spec));
const defaultName = (spec) => Object.entries(spec).map(([k, v]) => `${k}_${v}`).join('_');
const normOpts = (o = {}) => ({
  unique: !!o.unique,
  sparse: !!o.sparse,
  partialFilterExpression: o.partialFilterExpression ? JSON.stringify(canon(o.partialFilterExpression)) : null,
  expireAfterSeconds: o.expireAfterSeconds ?? null,
});
const sameOpts = (a, b) => JSON.stringify(normOpts(a)) === JSON.stringify(normOpts(b));

const requiredIndexes = (Model) => Model.schema.indexes().map(([spec, opts = {}]) => {
  const options = { ...opts };
  delete options.background; // Mongoose adds this legacy flag; irrelevant to MongoDB 4.2+
  const name = options.name || defaultName(spec);
  return { spec, options, name };
});

const classify = (required, existing) => {
  const found = [];
  const extras = [];
  const matchedKeys = new Set(['[["_id",1]]']);
  for (const r of required) {
    const byKey = existing.find((e) => keyStr(e.key) === keyStr(r.spec));
    const byName = existing.find((e) => e.name === r.name);
    matchedKeys.add(keyStr(r.spec));
    if (byKey) {
      found.push({ ...r, status: sameOpts(byKey, r.options) ? 'OK' : 'CONFLICT', existingName: byKey.name,
        detail: sameOpts(byKey, r.options) ? '' : `exists as "${byKey.name}" with different options` });
    } else if (byName) {
      found.push({ ...r, status: 'CONFLICT', existingName: byName.name, detail: `name "${r.name}" is used by an index with different keys` });
    } else {
      found.push({ ...r, status: 'MISSING' });
    }
  }
  for (const e of existing) if (!matchedKeys.has(keyStr(e.key))) extras.push(e);
  return { found, extras };
};

// Duplicate groups that would make the unique index build fail. Counts and sample ids only (no field values).
const checkDuplicates = async (collection, r) => {
  const fields = Object.keys(r.spec);
  const match = r.options.partialFilterExpression ? { ...r.options.partialFilterExpression } : {};
  if (r.options.sparse) fields.forEach((f) => { match[f] = { ...(match[f] || {}), $exists: true }; });
  const group = { _id: Object.fromEntries(fields.map((f) => [f.replace(/\./g, '_'), `$${f}`])), n: { $sum: 1 }, ids: { $push: '$_id' } };
  const pipeline = [{ $match: match }, { $group: group }, { $match: { n: { $gt: 1 } } }];
  const groups = await collection.aggregate([...pipeline, { $count: 'groups' }], { allowDiskUse: true }).toArray();
  const total = groups[0] ? groups[0].groups : 0;
  if (!total) return { total: 0, sample: [] };
  const sample = await collection.aggregate([...pipeline, { $limit: 3 }, { $project: { _id: 0, copies: '$n', ids: { $slice: ['$ids', 3] } } }], { allowDiskUse: true }).toArray();
  return { total, sample };
};

const run = async () => {
  const target = parseTarget(process.env.MONGO_URI);
  if (!target) fail('Refusing to run: MONGO_URI is missing or not a valid MongoDB URI.');
  if (process.env.NODE_ENV === 'production') fail('Refusing to run: NODE_ENV is "production".');
  console.log(`Target: host=${target.hosts.join(',')} database=${target.dbName} (${target.isLocal ? 'local' : 'REMOTE'})`);
  if (!target.isLocal && process.env.MAINTENANCE_ALLOW_REMOTE_DB !== target.dbName) {
    fail(`Refusing to connect to a REMOTE database. Set MAINTENANCE_ALLOW_REMOTE_DB=${target.dbName} to confirm.`);
  }
  if (APPLY && !target.isLocal && !CONFIRM_BACKUP) {
    fail('Refusing to --apply on a REMOTE database without --confirm-backup (confirm that a backup/snapshot exists first).');
  }
  console.log(APPLY ? 'Mode: APPLY (create missing, safe indexes only; nothing is dropped or modified)' : 'Mode: DRY RUN (nothing will be written)');

  // Register every model (side-effect free: autoIndex/autoCreate are off for this connection).
  const modelsDir = path.join(__dirname, '..', 'models');
  fs.readdirSync(modelsDir).filter((f) => f.endsWith('.js')).forEach((f) => require(path.join(modelsDir, f)));
  await mongoose.connect(process.env.MONGO_URI, SAFE_SCRIPT_OPTIONS);
  const db = mongoose.connection.db;

  const models = mongoose.modelNames().map((n) => mongoose.model(n)).filter((M) => !ONLY || ONLY.includes(M.modelName.toLowerCase()));
  if (ONLY && !models.length) fail(`No model matches --only=${ONLY.join(',')}. Models: ${mongoose.modelNames().join(', ')}`);

  const summary = { ok: 0, missing: 0, conflict: 0, blocked: 0, created: 0, failed: 0, extra: 0 };
  const plan = [];
  for (const Model of models) {
    const colName = Model.collection.name;
    const exists = (await db.listCollections({ name: colName }, { nameOnly: true }).toArray()).length > 0;
    const existing = exists ? await db.collection(colName).indexes() : [];
    const { found, extras } = classify(requiredIndexes(Model), existing);
    console.log(`\n${Model.modelName}  (collection "${colName}"${exists ? '' : ', does not exist yet'})`);
    console.log(`  existing: ${existing.length ? existing.map((e) => e.name).join(', ') : '(none)'}`);
    for (const r of found) {
      let line = `  ${r.status.padEnd(8)} ${r.name}${r.options.unique ? '  [unique' + (r.options.partialFilterExpression ? ', partial' : '') + (r.options.sparse ? ', sparse' : '') + ']' : ''}`;
      if (r.detail) line += `  -- ${r.detail}`;
      if (r.status === 'OK') summary.ok++;
      if (r.status === 'CONFLICT') summary.conflict++;
      if (r.status === 'MISSING') {
        summary.missing++;
        r.blocked = false;
        if (r.options.unique && exists) {
          const dup = await checkDuplicates(db.collection(colName), r);
          if (dup.total) {
            r.blocked = true;
            summary.blocked++;
            line = line.replace('MISSING ', 'BLOCKED ');
            line += `\n             ${dup.total} duplicate group(s) would make this unique index fail, e.g. ${JSON.stringify(dup.sample)}. Resolve the duplicates first.`;
          } else {
            line += '  (no duplicate data)';
          }
        }
        plan.push({ Model, colName, r });
      }
      console.log(line);
    }
    for (const e of extras) { summary.extra++; console.log(`  EXTRA    ${e.name}  (not defined by the model; left untouched)`); }
  }

  const todo = plan.filter((p) => !p.r.blocked);
  console.log(`\nSummary: ${summary.ok} ok, ${summary.missing} missing (${summary.blocked} blocked by duplicates), ${summary.conflict} conflict(s) to review manually, ${summary.extra} extra (untouched).`);
  if (!APPLY) {
    console.log(todo.length ? `Dry run complete. ${todo.length} index(es) would be created with --apply. Nothing was written.` : 'Dry run complete. Nothing to create. Nothing was written.');
    return;
  }
  if (!todo.length) { console.log('Nothing to create.'); return; }

  for (const { colName, r } of todo) {
    try {
      await db.collection(colName).createIndex(r.spec, { ...r.options, name: r.name });
      summary.created++;
      console.log(`Created ${colName}.${r.name}`);
    } catch (e) {
      summary.failed++;
      console.error(`FAILED  ${colName}.${r.name}: ${e.message}`);
    }
  }

  // Verify by re-reading the indexes from the database.
  let verified = true;
  for (const { colName, r } of todo) {
    const now = await db.collection(colName).indexes();
    const hit = now.find((e) => keyStr(e.key) === keyStr(r.spec));
    if (!hit || !sameOpts(hit, r.options)) { verified = false; console.error(`VERIFY FAILED ${colName}.${r.name}`); }
  }
  console.log(`\nCreated ${summary.created}, failed ${summary.failed}. Verification: ${verified && !summary.failed ? 'PASSED' : 'FAILED'}.`);
  if (!verified || summary.failed) process.exitCode = 1;
};

if (require.main === module) {
  run()
    .then(() => mongoose.disconnect())
    .then(() => process.exit(process.exitCode || 0))
    .catch((e) => { console.error('Index management failed:', e.message); mongoose.disconnect().finally(() => process.exit(1)); });
}

module.exports = { canon, keyStr, defaultName, normOpts, sameOpts, requiredIndexes, classify };
