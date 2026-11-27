/*
 * Settings tests (node:test): notification preferences (persistence, validation, defaults, enforcement per category incl. program
 * notifications), password change / logout-all session revocation, account-deletion hardening (late write + sweep rescan) and the
 * User sweep index. Needs a LOCAL disposable MongoDB:
 *
 *   SETTINGS_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:settings
 *
 * Refuses anything that is not localhost/127.0.0.1. Starts the API as a child process (port 5210 by default) with explicit
 * MONGO_URI/JWT_SECRET (never the .env values), uses its own database (careernest_b2a1_settings_*) and drops it at the end.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

const BASE = process.env.SETTINGS_TEST_MONGO || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('Set SETTINGS_TEST_MONGO to a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27017');
}
process.env.NODE_ENV = 'test';
const PORT = Number(process.env.TEST_PORT || 5210);
const DB = `careernest_b2a1_settings_${process.pid}`;
const URI = `${BASE.replace(/\/$/, '')}/${DB}`;
const API = `http://127.0.0.1:${PORT}/api`;
const SERVER_DIR = path.join(__dirname, '..', '..');
const PW = 'Sunrise2025';
let server;
let seq = 0;

const call = async (token, method, url, body) => {
  const res = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json };
};
const newUser = async (tag = 'u') => {
  const email = `${tag}${++seq}.${process.pid}@example.com`;
  assert.equal((await call(null, 'POST', '/auth/signup', { name: `Person ${tag}${seq}`, email, password: PW })).status, 201);
  const l = await call(null, 'POST', '/auth/login', { email, password: PW });
  assert.equal(l.status, 200);
  return { email, token: l.body.token, id: l.body.user.id, oid: new mongoose.Types.ObjectId(l.body.user.id) };
};
const col = (n) => mongoose.connection.collection(n);

let notifyMod;
before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, MONGO_URI: URI, JWT_SECRET: 'test-secret-that-is-definitely-longer-than-32-chars', PORT: String(PORT), CLIENT_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 25000);
    server.stdout.on('data', (d) => { if (String(d).includes('Server running')) { clearTimeout(t); resolve(); } });
    server.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  });
  await mongoose.connect(URI);
  notifyMod = require('../../utils/notify');
});

after(async () => {
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  await mongoose.disconnect();
  if (server) { server.removeAllListeners('exit'); server.kill(); }
});

const CATS = ['applications', 'interviews', 'referrals', 'programs', 'reminders', 'support'];

// ------------------------------------------------------------------ mapping
test('type -> category mapping is the published one', () => {
  assert.deepEqual(notifyMod.PREF_KEY, { application: 'applications', interview: 'interviews', referral: 'referrals', program: 'programs', reminder: 'reminders', support: 'support' });
  assert.deepEqual([...notifyMod.NOTIFICATION_CATEGORIES].sort(), [...CATS].sort());
  assert.equal(notifyMod.prefCategoryFor('system'), null);
});

// ------------------------------------------------------------------ defaults / persistence / validation
test('defaults: every category is on, also for a user stored without the field (legacy)', async () => {
  const u = await newUser('def');
  const me = await call(u.token, 'GET', '/auth/me');
  for (const c of CATS) assert.equal(me.body.user.notificationPrefs[c], true, c);
  await col('users').updateOne({ _id: u.oid }, { $unset: { notificationPrefs: '' } });
  const legacy = await call(u.token, 'GET', '/auth/me');
  for (const c of CATS) assert.equal(legacy.body.user.notificationPrefs[c], true, `legacy ${c}`);
  // and they still receive notifications
  const n = await notifyMod.notify(u.id, { type: 'program', title: 'legacy ok' });
  assert.ok(n);
});

test('each toggle is independent and persisted in MongoDB', async () => {
  const u = await newUser('per');
  for (const c of CATS) {
    const r = await call(u.token, 'PUT', '/auth/profile', { notificationPrefs: { [c]: false } });
    assert.equal(r.status, 200, c);
    assert.equal(r.body.user.notificationPrefs[c], false);
  }
  const doc = await col('users').findOne({ _id: u.oid });
  for (const c of CATS) assert.equal(doc.notificationPrefs[c], false, `db ${c}`);
  const r = await call(u.token, 'PUT', '/auth/profile', { notificationPrefs: { programs: true } });
  const me = (await call(u.token, 'GET', '/auth/me')).body.user.notificationPrefs;
  assert.equal(r.status, 200);
  assert.equal(me.programs, true);
  for (const c of CATS.filter((x) => x !== 'programs')) assert.equal(me[c], false, `unchanged ${c}`);
});

test('validation: booleans only, unknown keys and non-objects rejected, nothing saved on failure', async () => {
  const u = await newUser('val');
  for (const bad of [{ programs: 'false' }, { programs: 0 }, { support: null }, { reminders: {} }, { hacker: true }, { role: 'admin' }, [], 'x', null]) {
    const r = await call(u.token, 'PUT', '/auth/profile', { notificationPrefs: bad });
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.notEqual(r.status, 401);
  }
  const doc = await col('users').findOne({ _id: u.oid });
  assert.notEqual(doc.role, 'admin');
  assert.equal(doc.hacker, undefined);
  assert.equal((await call(null, 'PUT', '/auth/profile', { notificationPrefs: { programs: false } })).status, 401);
});

// ------------------------------------------------------------------ enforcement
test('notify honours each category preference and always delivers system notices', async () => {
  const types = { applications: 'application', interviews: 'interview', referrals: 'referral', programs: 'program', reminders: 'reminder', support: 'support' };
  for (const [cat, type] of Object.entries(types)) {
    const u = await newUser(`enf${cat}`);
    await call(u.token, 'PUT', '/auth/profile', { notificationPrefs: { [cat]: false } });
    assert.equal(await notifyMod.notify(u.id, { type, title: 'x' }), null, `${cat} off`);
    for (const [otherCat, otherType] of Object.entries(types)) {
      if (otherCat === cat) continue;
      assert.ok(await notifyMod.notify(u.id, { type: otherType, title: 'y' }), `${otherType} still on while ${cat} off`);
    }
    assert.ok(await notifyMod.notify(u.id, { title: 'system notice' }), 'system always delivered');
    await call(u.token, 'PUT', '/auth/profile', { notificationPrefs: { [cat]: true } });
    assert.ok(await notifyMod.notify(u.id, { type, title: 'back on' }), `${cat} on again`);
  }
});

test('Career Program notifications respect the programs preference (real API flow)', async () => {
  const u = await newUser('prog');
  const program = (await col('programs').insertOne({ slug: `p-${process.pid}`, title: 'Settings Prog', provider: 'Prov', description: 'A reasonably long description.', category: 'Cat A', source: 'demo', isActive: true, published: true })).insertedId;
  const count = () => col('notifications').countDocuments({ user: u.oid, type: 'program' });
  let r = await call(u.token, 'PUT', `/programs/${program}/enrollment`, { status: 'saved' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(await count(), 1, 'notified while programs is on');
  await call(u.token, 'PUT', '/auth/profile', { notificationPrefs: { programs: false } });
  r = await call(u.token, 'PUT', `/programs/${program}/enrollment`, { status: 'in-progress' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await col('programenrollments').findOne({ user: u.oid })).status, 'in-progress', 'the action itself still works');
  assert.equal(await count(), 1, 'no new notification while programs is off');
  await call(u.token, 'PUT', '/auth/profile', { notificationPrefs: { programs: true } });
  r = await call(u.token, 'PUT', `/programs/${program}/enrollment`, { status: 'completed' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(await count(), 2);
});

// ------------------------------------------------------------------ security
test('change password: needs the current password, revokes other sessions, returns a working token', async () => {
  const u = await newUser('pw');
  const other = (await call(null, 'POST', '/auth/login', { email: u.email, password: PW })).body.token;
  assert.equal((await call(other, 'GET', '/auth/me')).status, 200);
  let r = await call(u.token, 'PUT', '/auth/profile', { newPassword: 'Moonlight2026' });
  assert.equal(r.status, 400);
  r = await call(u.token, 'PUT', '/auth/profile', { currentPassword: 'wrong-password1', newPassword: 'Moonlight2026' });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'INVALID_CURRENT_PASSWORD');
  assert.equal((await call(other, 'GET', '/auth/me')).status, 200, 'failed attempts revoke nothing');
  r = await call(u.token, 'PUT', '/auth/profile', { currentPassword: PW, newPassword: 'Moonlight2026' });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  assert.equal((await call(other, 'GET', '/auth/me')).body.code, 'INVALID_TOKEN');
  assert.equal((await call(u.token, 'GET', '/auth/me')).status, 401);
  assert.equal((await call(r.body.token, 'GET', '/auth/me')).status, 200);
  assert.equal((await call(null, 'POST', '/auth/login', { email: u.email, password: PW })).status, 401);
  assert.equal((await call(null, 'POST', '/auth/login', { email: u.email, password: 'Moonlight2026' })).status, 200);
});

test('logout-all revokes every token including the current one', async () => {
  const u = await newUser('lo');
  const second = (await call(null, 'POST', '/auth/login', { email: u.email, password: PW })).body.token;
  assert.equal((await call(u.token, 'POST', '/account/logout-all', {})).status, 200);
  assert.equal((await call(u.token, 'GET', '/auth/me')).status, 401);
  assert.equal((await call(second, 'GET', '/auth/me')).status, 401);
  assert.equal((await call(null, 'POST', '/auth/login', { email: u.email, password: PW })).status, 200);
});

test('/auth/me exposes email and verification status for the Settings page', async () => {
  const u = await newUser('ver');
  const me = (await call(u.token, 'GET', '/auth/me')).body.user;
  assert.equal(me.email, u.email);
  assert.equal(me.emailVerified, false);
});

// ------------------------------------------------------------------ deletion hardening
test('notify never writes for a deleted (tombstoned) user', async () => {
  const u = await newUser('tomb');
  await col('users').updateOne({ _id: u.oid }, { $set: { deletedAt: new Date() } });
  assert.equal(await notifyMod.notify(u.id, { type: 'system', title: 'late' }), null);
  assert.equal(await col('notifications').countDocuments({ user: u.oid }), 0);
});

test('a row written after deletion verification is removed by the next sweep (late-write simulation)', async () => {
  const { completePendingDeletions, countRemaining } = require('../../utils/account/deletion');
  const u = await newUser('late');
  const r = await call(u.token, 'POST', '/account/delete', { password: PW, confirmation: 'DELETE' });
  assert.equal(r.status, 200);
  const tomb = await col('users').findOne({ _id: u.oid });
  assert.ok(tomb.deletedAt && tomb.deletionCompletedAt, 'deletion fully completed and marked');

  // an in-flight request that passed authentication before the tombstone lands its write now
  await col('notifications').insertOne({ user: u.oid, type: 'system', title: 'stray', read: false, createdAt: new Date() });
  await col('savedjobs').insertOne({ user: u.oid, job: new mongoose.Types.ObjectId(), createdAt: new Date() });
  assert.equal(await countRemaining(u.oid), 2);

  const res = await completePendingDeletions({ graceMs: 0 });
  assert.ok(res.strayCleaned >= 1, JSON.stringify(res));
  assert.equal(await countRemaining(u.oid), 0);
  assert.equal(await col('notifications').countDocuments({ user: u.oid }), 0);
  assert.equal(await col('savedjobs').countDocuments({ user: u.oid }), 0);
  assert.ok((await col('users').findOne({ _id: u.oid })).deletionCompletedAt, 'stays marked complete');
  // a second pass finds nothing to do
  assert.equal((await completePendingDeletions({ graceMs: 0 })).strayCleaned, 0);
  // and live users are untouched
  const live = await newUser('live');
  await col('notifications').insertOne({ user: live.oid, type: 'system', title: 'keep', read: false });
  await completePendingDeletions({ graceMs: 0 });
  assert.equal(await col('notifications').countDocuments({ user: live.oid }), 1);
});

// ------------------------------------------------------------------ index
test('User has the partial deleted-sweep index, in the model and in MongoDB, and the sweep query can use it', async () => {
  const User = require('../../models/User');
  const declared = User.schema.indexes().find(([, o]) => o.name === 'deleted_sweep_idx');
  assert.ok(declared, 'declared in the schema (so npm run indexes manages it)');
  assert.deepEqual(declared[0], { deletedAt: 1, deletionCompletedAt: 1 });
  await User.init();
  const idx = (await col('users').indexes()).find((i) => i.name === 'deleted_sweep_idx');
  assert.ok(idx, 'created in the database');
  assert.deepEqual(idx.partialFilterExpression, { deletedAt: { $type: 'date' } });
  const plan = await col('users').find({ deletedAt: { $type: 'date', $lte: new Date() }, deletionCompletedAt: null }).explain('queryPlanner');
  assert.ok(JSON.stringify(plan.queryPlanner.winningPlan).includes('deleted_sweep_idx'), 'winning plan uses the index');
});
