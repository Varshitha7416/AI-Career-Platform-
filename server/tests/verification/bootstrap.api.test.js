/*
 * First-admin bootstrap tests (node:test). Needs a DISPOSABLE local MongoDB:
 *
 *   VERIFY_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:verify
 *
 * Skipped without it. Uses its own database (dropped at the end); the CLI is run as a real child process with explicit env
 * (never the .env credentials: MONGO_URI is always overridden to the disposable database).
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');
const { bootstrapAdmin, BootstrapError, SENTINEL_ID, STALE_MS } = require('../../utils/bootstrapAdmin');

const BASE = process.env.VERIFY_TEST_MONGO || process.env.RESET_TEST_MONGO || '';
const enabled = !!BASE;
if (enabled && !/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) throw new Error('VERIFY_TEST_MONGO must be a LOCAL disposable mongod');
const skip = enabled ? false : 'set VERIFY_TEST_MONGO to run the bootstrap tests';

const DB = `bootstrap_test_${process.pid}`;
const URI = `${BASE.replace(/\/$/, '')}/${DB}`;
const SERVER_DIR = path.join(__dirname, '..', '..');
const SECRET = 'correct-horse-battery-staple-0123456789';
let db; let seq = 0;

const users = () => db.collection('users');
const sentinels = () => db.collection('adminbootstrap');
const addUser = async (over = {}) => {
  seq += 1;
  const doc = { name: 'U', email: `boot${seq}.${process.pid}@example.com`, password: 'x', role: 'jobseeker', emailVerified: true, deletedAt: null, tokenVersion: 0, ...over };
  doc._id = (await users().insertOne(doc)).insertedId;
  return doc;
};
const reset = async () => { await users().deleteMany({}); await sentinels().deleteMany({}); };
const admins = () => users().countDocuments({ role: 'admin' });
const attempt = (email, over = {}) => bootstrapAdmin({ db, email, expectedSecret: SECRET, providedSecret: SECRET, ...over });
const code = (p) => p.then(() => null, (e) => (e instanceof BootstrapError ? e.code : `UNEXPECTED:${e && e.message}`));

const cli = (args, env = {}) => new Promise((resolve) => {
  const e = { ...process.env, MONGO_URI: URI, NODE_ENV: 'test', BOOTSTRAP_ADMIN_SECRET: SECRET, BOOTSTRAP_ADMIN_SECRET_INPUT: SECRET, ...env };
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
  const child = spawn(process.execPath, ['scripts/bootstrapAdmin.js', ...args], { cwd: SERVER_DIR, env: e, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('exit', (c) => resolve({ code: c, out }));
});

before(async () => { if (skip) return; await mongoose.connect(URI); db = mongoose.connection.db; });
after(async () => { if (skip) return; try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ } await mongoose.disconnect(); });

test('bootstrap: promotes an existing VERIFIED account, retires its sessions, records a completed sentinel', { skip }, async () => {
  await reset();
  const u = await addUser();
  const r = await attempt(u.email.toUpperCase());
  assert.equal(r.email, u.email);
  const after = await users().findOne({ _id: u._id });
  assert.equal(after.role, 'admin');
  assert.equal(after.tokenVersion, 1);
  const s = await sentinels().findOne({ _id: SENTINEL_ID });
  assert.equal(s.status, 'completed');
  assert.ok(!JSON.stringify(s).includes(SECRET));
});

test('bootstrap: wrong or missing secret changes nothing', { skip }, async () => {
  await reset();
  const u = await addUser();
  assert.equal(await code(attempt(u.email, { providedSecret: 'wrong-secret-wrong-secret-wrong' })), 'BAD_SECRET');
  assert.equal(await code(attempt(u.email, { providedSecret: '' })), 'BAD_SECRET');
  assert.equal(await code(attempt(u.email, { providedSecret: undefined })), 'BAD_SECRET');
  assert.equal(await code(attempt(u.email, { expectedSecret: 'too-short' , providedSecret: 'too-short' })), 'BAD_CONFIG');
  assert.equal(await admins(), 0);
  assert.equal(await sentinels().countDocuments({}), 0, 'a failed secret never claims the sentinel');
});

test('bootstrap: refuses when an admin already exists (however it was created)', { skip }, async () => {
  await reset();
  await addUser({ role: 'admin' });
  const u = await addUser();
  assert.equal(await code(attempt(u.email)), 'ADMIN_EXISTS');
  assert.equal(await admins(), 1);
  assert.equal((await users().findOne({ _id: u._id })).role, 'jobseeker');
});

test('bootstrap: second run after success is refused (no second admin)', { skip }, async () => {
  await reset();
  const a = await addUser(); const b = await addUser();
  await attempt(a.email);
  assert.equal(await code(attempt(b.email)), 'ADMIN_EXISTS');
  assert.equal(await code(attempt(a.email)), 'ADMIN_EXISTS');
  assert.equal(await admins(), 1);
});

test('bootstrap: target must exist, be active and have a VERIFIED email', { skip }, async () => {
  await reset();
  const unverified = await addUser({ emailVerified: false });
  const legacy = await addUser(); await users().updateOne({ _id: legacy._id }, { $unset: { emailVerified: '' } });
  const deleted = await addUser({ deletedAt: new Date() });
  assert.equal(await code(attempt(unverified.email)), 'NOT_VERIFIED');
  assert.equal(await code(attempt(legacy.email)), 'NOT_VERIFIED');
  assert.equal(await code(attempt(deleted.email)), 'NO_SUCH_USER');
  assert.equal(await code(attempt('nobody@example.com')), 'NO_SUCH_USER');
  assert.equal(await code(attempt('not-an-email')), 'BAD_EMAIL');
  assert.equal(await admins(), 0);
  assert.equal(await sentinels().countDocuments({}), 0, 'refusals before the claim leave no sentinel');
});

test('bootstrap: concurrent library calls (12, three different targets) -> exactly one admin', { skip }, async () => {
  await reset();
  const us = [await addUser(), await addUser(), await addUser()];
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => code(attempt(us[i % 3].email))));
  assert.equal(results.filter((r) => r === null).length, 1, JSON.stringify(results));
  assert.ok(results.filter((r) => r !== null).every((r) => ['ADMIN_EXISTS', 'BOOTSTRAP_CLAIMED'].includes(r)), JSON.stringify(results));
  assert.equal(await admins(), 1);
});

test('bootstrap: a stale unfinished claim can be taken over; a fresh one cannot', { skip }, async () => {
  await reset();
  const u = await addUser();
  await sentinels().insertOne({ _id: SENTINEL_ID, status: 'claimed', email: 'x@example.com', claimedAt: new Date() });
  assert.equal(await code(attempt(u.email)), 'BOOTSTRAP_CLAIMED');
  assert.equal(await admins(), 0);
  await sentinels().updateOne({ _id: SENTINEL_ID }, { $set: { claimedAt: new Date(Date.now() - STALE_MS - 60000) } });
  assert.equal(await code(attempt(u.email)), null);
  assert.equal(await admins(), 1);
});

test('bootstrap: a completed sentinel blocks everything even if the admin was later removed by hand', { skip }, async () => {
  await reset();
  const a = await addUser(); const b = await addUser();
  await attempt(a.email);
  await users().updateOne({ _id: a._id }, { $set: { role: 'jobseeker' } });
  assert.equal(await code(attempt(b.email)), 'BOOTSTRAP_CLAIMED', 'deliberate: re-bootstrapping needs a conscious DB edit of the sentinel');
});

// ---------------------------------------------------------------- the real CLI
test('CLI: success promotes the account; prints neither the secret nor the password hash', { skip }, async () => {
  await reset();
  const u = await addUser({ password: '$2a$12$thisIsAFakeHashForTestingOnlyXXXXXXXXXXXXXXXXXXXXXXXXXX' });
  const r = await cli(['--email', u.email, '--yes']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /is now the first admin/);
  assert.ok(!r.out.includes(SECRET));
  assert.ok(!r.out.includes('thisIsAFake'));
  assert.equal((await users().findOne({ _id: u._id })).role, 'admin');
});

test('CLI: wrong secret, missing --yes, secret as argument, missing config -> refused, nothing changed', { skip }, async () => {
  await reset();
  const u = await addUser();
  const wrong = await cli(['--email', u.email, '--yes'], { BOOTSTRAP_ADMIN_SECRET_INPUT: 'nope-nope-nope-nope-nope-nope' });
  assert.notEqual(wrong.code, 0); assert.match(wrong.out, /BAD_SECRET/); assert.ok(!wrong.out.includes(SECRET));
  const noYes = await cli(['--email', u.email]);
  assert.notEqual(noYes.code, 0); assert.match(noYes.out, /--yes/);
  const arg = await cli(['--email', u.email, '--yes', '--secret', SECRET]);
  assert.notEqual(arg.code, 0); assert.match(arg.out, /Unknown argument/);
  assert.ok(!arg.out.includes(SECRET), 'a secret passed on the command line is never echoed');
  const noCfg = await cli(['--email', u.email, '--yes'], { BOOTSTRAP_ADMIN_SECRET: undefined });
  assert.notEqual(noCfg.code, 0); assert.match(noCfg.out, /BOOTSTRAP_ADMIN_SECRET is not set/);
  assert.equal(await admins(), 0);
});

test('CLI: refuses NODE_ENV=production without BOOTSTRAP_ALLOW_PRODUCTION, and remote databases without the exact-name allow', { skip }, async () => {
  await reset();
  const u = await addUser();
  const prod = await cli(['--email', u.email, '--yes'], { NODE_ENV: 'production' });
  assert.notEqual(prod.code, 0); assert.match(prod.out, /production/);
  const remote = await cli(['--email', u.email, '--yes'], { MONGO_URI: 'mongodb://db.example.invalid:27017/careernest_x' });
  assert.notEqual(remote.code, 0); assert.match(remote.out, /REMOTE database/);
  const wrongName = await cli(['--email', u.email, '--yes'], { MONGO_URI: 'mongodb://db.example.invalid:27017/careernest_x', BOOTSTRAP_ALLOW_REMOTE_DB: 'other' });
  assert.notEqual(wrongName.code, 0); assert.match(wrongName.out, /REMOTE database/);
  const srv = await cli(['--email', u.email, '--yes'], { MONGO_URI: 'mongodb+srv://u:p@cluster.example.invalid/careernest_x' });
  assert.notEqual(srv.code, 0); assert.match(srv.out, /REMOTE/);
  assert.ok(!/u:p@|:p@/.test(srv.out), 'credentials in the URI are never printed');
  assert.equal(await admins(), 0);
  const prodOk = await cli(['--email', u.email, '--yes'], { NODE_ENV: 'production', BOOTSTRAP_ALLOW_PRODUCTION: 'true' });
  assert.equal(prodOk.code, 0, prodOk.out); // explicitly allowed (local disposable db)
  assert.equal(await admins(), 1);
});

test('CLI: five concurrent processes racing for the same and different accounts -> exactly one admin', { skip }, async () => {
  await reset();
  const us = [await addUser(), await addUser(), await addUser()];
  const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => cli(['--email', us[i % 3].email, '--yes'])));
  assert.equal(rs.filter((r) => r.code === 0).length, 1, rs.map((r) => r.out).join('\n---\n'));
  assert.equal(await admins(), 1);
  for (const r of rs) assert.ok(!r.out.includes(SECRET));
});
