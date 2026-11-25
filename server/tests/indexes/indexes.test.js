// Index-management tests. Need a disposable local MongoDB:  INDEX_TEST_MONGO=mongodb://127.0.0.1:<port> npm run test:indexes
// Never point this at a real database: it refuses non-local URIs and creates/drops its own throwaway databases.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');
const { resolveAutoIndex, connectOptions, parseTarget } = require('../../config/dbOptions');

const BASE = process.env.INDEX_TEST_MONGO;
const SERVER_DIR = path.join(__dirname, '..', '..');
const script = (db, args = [], env = {}) => spawnSync(process.execPath, ['scripts/manageIndexes.js', ...args], {
  cwd: SERVER_DIR, encoding: 'utf8', env: { ...process.env, MONGO_URI: `${BASE}/${db}`, NODE_ENV: 'test', ...env },
});
let conn;
const dbs = [];
const fresh = (name) => { dbs.push(name); return name; };
const raw = (db) => conn.useDb(db).db;

before(async () => {
  if (!BASE || !/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error('Set INDEX_TEST_MONGO to a local mongod, e.g. mongodb://127.0.0.1:27061');
  conn = await mongoose.createConnection(BASE).asPromise();
});
after(async () => {
  for (const d of dbs) await conn.useDb(d).dropDatabase().catch(() => {});
  await conn.close();
});

test('policy: local DB auto-indexes, remote does not, AUTO_INDEX overrides', () => {
  assert.equal(resolveAutoIndex('mongodb://127.0.0.1:27017/x', {}).autoIndex, true);
  assert.equal(resolveAutoIndex('mongodb://localhost/x', {}).autoIndex, true);
  assert.equal(resolveAutoIndex('mongodb+srv://u:p@cluster0.abc.mongodb.net/test', {}).autoIndex, false);
  assert.equal(resolveAutoIndex('mongodb://db.example.com:27017/x', {}).autoIndex, false);
  assert.equal(resolveAutoIndex('mongodb://127.0.0.1,db.example.com/x', {}).autoIndex, false);
  assert.equal(resolveAutoIndex('', {}).autoIndex, false);
  assert.equal(resolveAutoIndex('mongodb+srv://u:p@c.mongodb.net/test', { AUTO_INDEX: 'true' }).autoIndex, true);
  assert.equal(resolveAutoIndex('mongodb://127.0.0.1/x', { AUTO_INDEX: 'false' }).autoIndex, false);
  assert.deepEqual(connectOptions('mongodb+srv://u:p@c.mongodb.net/', {}), { autoIndex: false, autoCreate: false });
  assert.equal(parseTarget('mongodb+srv://u:p@c.mongodb.net/?retryWrites=true').dbName, 'test');
});

test('connecting with the remote-style policy creates NO indexes and NO collections', async () => {
  const db = fresh('idx_noauto');
  const code = [
    "process.env.AUTO_INDEX='false';",
    "const m=require('mongoose'); const {connectOptions}=require('./config/dbOptions');",
    "const fs=require('fs'),path=require('path');",
    "fs.readdirSync('./models').filter(f=>f.endsWith('.js')).forEach(f=>require(path.resolve('./models',f)));",
    'm.connect(process.env.MONGO_URI, connectOptions(process.env.MONGO_URI)).then(async()=>{',
    '  await Promise.all(m.modelNames().map(n=>m.model(n).init()));',
    '  await new Promise(r=>setTimeout(r,1500)); process.exit(0)});',
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', code], { cwd: SERVER_DIR, encoding: 'utf8', env: { ...process.env, MONGO_URI: `${BASE}/${db}` } });
  assert.equal(r.status, 0, r.stderr);
  const cols = await raw(db).listCollections().toArray();
  assert.equal(cols.length, 0, `collections created: ${cols.map((c) => c.name)}`);
});

test('connecting with the local policy still auto-creates indexes (dev/demo behaviour preserved)', async () => {
  const db = fresh('idx_local_auto');
  const code = [
    "const m=require('mongoose'); const {connectOptions}=require('./config/dbOptions');",
    "const R=require('./models/Referral');",
    'm.connect(process.env.MONGO_URI, connectOptions(process.env.MONGO_URI)).then(async()=>{await R.init(); process.exit(0)});',
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', code], { cwd: SERVER_DIR, encoding: 'utf8', env: { ...process.env, MONGO_URI: `${BASE}/${db}` } });
  assert.equal(r.status, 0, r.stderr);
  const names = (await raw(db).collection('referrals').indexes()).map((i) => i.name);
  assert.ok(names.includes('seeker_1_referrer_1_jobKey_1'), names.join());
});

test('dry run lists missing indexes (Referral, SavedJob, Application, Resume, ResumeAnalysis, CoverLetter) and writes nothing', async () => {
  const db = fresh('idx_dry');
  const r = script(db);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  for (const n of ['Referral', 'SavedJob', 'Application', 'Resume', 'ResumeAnalysis', 'CoverLetter']) assert.match(r.stdout, new RegExp(`\\n${n}  \\(`), `${n} missing from output`);
  assert.match(r.stdout, /MISSING\s+seeker_1_referrer_1_jobKey_1\s+\[unique, partial\]/);
  assert.match(r.stdout, /MISSING\s+user_1_job_1\s+\[unique\]/);
  assert.match(r.stdout, /Mode: DRY RUN/);
  assert.match(r.stdout, /Nothing was written/);
  const cols = await raw(db).listCollections().toArray();
  assert.equal(cols.length, 0);
});

test('--apply creates every missing index, verifies, and a rerun finds nothing to do', async () => {
  const db = fresh('idx_apply');
  await raw(db).collection('referrals').insertMany([ // legacy-shaped referrals (no `active`) must not block the partial unique index
    { seeker: new mongoose.Types.ObjectId(), referrer: new mongoose.Types.ObjectId(), status: 'requested' },
    { seeker: new mongoose.Types.ObjectId(), referrer: new mongoose.Types.ObjectId(), status: 'accepted' },
  ]);
  const a = script(db, ['--apply']);
  assert.equal(a.status, 0, a.stderr + a.stdout);
  assert.match(a.stdout, /Verification: PASSED/);
  const idx = await raw(db).collection('referrals').indexes();
  const uniq = idx.find((i) => i.name === 'seeker_1_referrer_1_jobKey_1');
  assert.ok(uniq && uniq.unique && uniq.partialFilterExpression.active === true);
  assert.equal((await raw(db).collection('referrals').countDocuments()), 2, 'documents untouched');
  const again = script(db);
  assert.equal(again.status, 0);
  assert.doesNotMatch(again.stdout, /MISSING|BLOCKED|CONFLICT/);
  assert.match(again.stdout, /0 missing/);
  assert.match(again.stdout, /Nothing to create/);
});

test('duplicate data blocks a unique index; other indexes are still created; documents are untouched', async () => {
  const db = fresh('idx_dups');
  const u = new mongoose.Types.ObjectId();
  const j = new mongoose.Types.ObjectId();
  await raw(db).collection('applications').insertMany([{ user: u, job: j, status: 'applied' }, { user: u, job: j, status: 'applied' }]);
  const dry = script(db);
  assert.match(dry.stdout, /BLOCKED\s+user_1_job_1/);
  assert.match(dry.stdout, /1 duplicate group\(s\)/);
  const apply = script(db, ['--apply', '--only=Application,Referral']);
  assert.equal(apply.status, 0, apply.stderr + apply.stdout);
  const appIdx = (await raw(db).collection('applications').indexes()).map((i) => i.name);
  assert.ok(!appIdx.includes('user_1_job_1'), 'blocked unique index must not be created');
  const refIdx = (await raw(db).collection('referrals').indexes()).map((i) => i.name);
  assert.ok(refIdx.includes('seeker_1_referrer_1_jobKey_1'), 'safe indexes still created');
  assert.equal(await raw(db).collection('applications').countDocuments(), 2, 'duplicates not removed');
});

test('conflicting and extra existing indexes are reported and never dropped or modified', async () => {
  const db = fresh('idx_conflict');
  const users = raw(db).collection('users');
  await users.insertOne({ name: 'A', email: 'a@x.test', password: 'x' });
  await users.createIndex({ email: 1 }, { name: 'email_1' }); // non-unique: conflicts with the model's unique email index
  await users.createIndex({ name: 1 }, { name: 'legacy_name_idx' }); // not in the model
  const r = script(db, ['--apply', '--only=User']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /CONFLICT\s+email_1/);
  assert.match(r.stdout, /EXTRA\s+legacy_name_idx/);
  const idx = await users.indexes();
  const email = idx.find((i) => i.name === 'email_1');
  assert.ok(email && !email.unique, 'conflicting index must be left exactly as it was');
  assert.ok(idx.find((i) => i.name === 'legacy_name_idx'), 'extra index must not be dropped');
  assert.equal(await users.countDocuments(), 1);
});

test('guards: remote URI refused without confirmation, --apply on remote needs --confirm-backup, production refused (all before connecting)', () => {
  const remote = 'mongodb+srv://u:p@cluster0.invalid.mongodb.net/';
  const run = (args, env) => spawnSync(process.execPath, ['scripts/manageIndexes.js', ...args], { cwd: SERVER_DIR, encoding: 'utf8', timeout: 20000, env: { ...process.env, MONGO_URI: remote, ...env } });
  let r = run([], { MAINTENANCE_ALLOW_REMOTE_DB: '' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Refusing to connect to a REMOTE database\. Set MAINTENANCE_ALLOW_REMOTE_DB=test/);
  r = run(['--apply'], { MAINTENANCE_ALLOW_REMOTE_DB: 'test' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--confirm-backup/);
  r = run([], { NODE_ENV: 'production', MAINTENANCE_ALLOW_REMOTE_DB: 'test' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /production/);
  r = run(['--bogus'], {});
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Unknown argument/);
});
