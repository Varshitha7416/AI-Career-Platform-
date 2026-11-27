/*
 * The referral demo seed creates email-verified demo users that can actually send referral requests.
 * Runs scripts/seedReferralDemo.js (child process) against a disposable local DB whose name ends in _demo, then the API on port 5243.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { startServer, BASE, SERVER_DIR } = require('./_harness');

const DB = `careernest_b2a4_seed_${process.pid}_demo`;
const SCRIPT = path.join(SERVER_DIR, 'scripts', 'seedReferralDemo.js');
let H;
const seed = (db, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], {
  cwd: SERVER_DIR, encoding: 'utf8', env: { ...process.env, MONGO_URI: `${BASE.replace(/\/$/, '')}/${db}`, NODE_ENV: 'test' },
});

before(async () => {
  assert.equal(seed(DB, '--apply').status, 0);
  H = await startServer({ port: 5243, dbName: DB });
});
after(async () => { if (H) await H.stop(); });

test('seed script keeps its guards (non-_demo database refused) and is idempotent', () => {
  const bad = seed('careernest_b2a4_notdemo', '--apply');
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /must end in "_demo"/);
  const again = seed(DB, '--apply');
  assert.equal(again.status, 0);
  assert.match(again.stdout, /created this run: 0/);
});

test('demo users are emailVerified and can send a referral request', async () => {
  const User = require('../../models/User');
  const users = await User.find({ email: /\.demo@example\.com$/ }).select('emailVerified emailVerifiedAt').lean();
  assert.equal(users.length, 8);
  assert.ok(users.every((u) => u.emailVerified === true && u.emailVerifiedAt));

  const login = await H.call(null, 'POST', '/auth/login', { email: 'vikram.rao.demo@example.com', password: 'Demo@12345' });
  assert.equal(login.status, 200);
  const t = login.body.token;
  const found = await H.call(t, 'GET', `/referrals/find?company=${encodeURIComponent('Northwind Labs')}`);
  assert.equal(found.status, 200, JSON.stringify(found.body));
  const list = found.body.providers || found.body.referrers || found.body.users || [];
  assert.ok(list.length > 0, JSON.stringify(found.body).slice(0, 200));
  const resumes = await H.call(t, 'GET', '/resumes');
  const r = await H.call(t, 'POST', '/referrals', {
    providerId: list[0]._id || list[0].id,
    message: 'Hello, I would really appreciate a referral for this role. Thank you for considering it.',
    resumeId: resumes.body.resumes[0]._id,
    acknowledgeResumeShare: true,
    externalJob: { company: 'Northwind Labs', title: 'QA Lead', url: 'https://example.com/careers/qa-lead' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test('a demo user left unverified by an older seed is repaired on rerun', async () => {
  const User = require('../../models/User');
  await User.updateOne({ email: 'meera.joshi.demo@example.com' }, { $set: { emailVerified: false }, $unset: { emailVerifiedAt: 1 } });
  assert.equal(seed(DB, '--apply').status, 0);
  const u = await User.findOne({ email: 'meera.joshi.demo@example.com' }).lean();
  assert.equal(u.emailVerified, true);
});
