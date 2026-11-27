/*
 * Multi-PROCESS roadmap lock tests (node:test). Two independent `node server.js` processes share one disposable local
 * MongoDB, so the lock has to work through the database, not through process memory. Needs:
 *
 *   mongod --dbpath <temp dir outside the repo> --port 27150
 *   ROADMAP_MP_TEST_MONGO=mongodb://127.0.0.1:27150 npm run test:roadmap
 *
 * Skipped without ROADMAP_MP_TEST_MONGO; refuses anything that is not localhost. Gemini is never contacted: the servers run
 * with NODE_ENV=test and GEMINI_TEST_FIXTURE (a JSON file with an optional delay / fail-first-N), and every call is counted in
 * "<fixture>.calls", which both processes append to. The analyses are inserted directly. Own database, dropped at the end.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.ROADMAP_MP_TEST_MONGO || '';
const enabled = !!BASE;
if (enabled && !/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('ROADMAP_MP_TEST_MONGO must be a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27150');
}
const skip = enabled ? false : 'set ROADMAP_MP_TEST_MONGO to run the multi-process tests';

const SERVER_DIR = path.join(__dirname, '..', '..');
const SECRET = 'multiprocess-test-secret-that-is-definitely-longer-than-32-chars';
const DB = `roadmap_mp_test_${process.pid}`;
const PORTS = [Number(process.env.MP_PORT_A || 5161), Number(process.env.MP_PORT_B || 5162)];
const STALE_MS = 6000; // shortened lock timing, honoured only because the servers run with NODE_ENV=test
const MAX_WAIT_MS = 15000;

let mongoose; let Analysis; let Roadmap; let User; let signToken; let canonicalKey;
let tmp; let fixture; const servers = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setFixture = (obj) => fs.writeFileSync(fixture, JSON.stringify(obj));
const aiCalls = () => (fs.existsSync(`${fixture}.calls`) ? fs.readFileSync(`${fixture}.calls`, 'utf8').split('\n').filter(Boolean).length : 0);
const resetCalls = () => { try { fs.unlinkSync(`${fixture}.calls`); } catch { /* none yet */ } };

// One valid answer for the single gap skill (React => task t1).
const TASKS = { tasks: [{ id: 't1', skill: 'React', objective: 'Build components.', activity: 'Study hooks.', exercise: 'Build a small app.', completionCriteria: 'App works.' }] };

const startServer = async (port) => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env, MONGO_URI: `${BASE.replace(/\/$/, '')}/${DB}`, JWT_SECRET: SECRET, PORT: String(port), NODE_ENV: 'test',
      GEMINI_API_KEY: 'test-key', GEMINI_TEST_FIXTURE: fixture, ROADMAP_LOCK_STALE_MS: String(STALE_MS), ROADMAP_LOCK_MAX_WAIT_MS: String(MAX_WAIT_MS),
      CLIENT_ORIGIN: 'http://localhost:5173',
    },
    stdio: 'ignore',
  });
  const srv = { child, port, api: `http://127.0.0.1:${port}/api` };
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return srv; } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`server on ${port} did not start`);
};

const call = async (srv, token, method, url, body) => {
  const res = await fetch(srv.api + url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, body: json };
};

let seq = 0;
const newCase = async () => {
  seq += 1;
  const u = await User.create({ name: 'MP Tester', email: `mp${seq}.${process.pid}@example.com`, password: 'x'.repeat(20), emailVerified: true });
  const analysis = await Analysis.create({
    user: u._id, title: 'MP analysis', mode: 'resume', basis: 'resume-verified', targetKind: 'role-only', targetRole: 'Frontend Developer',
    requirements: [{ skill: 'React', key: canonicalKey('React'), kind: 'required' }],
    result: { matched: [], partial: [], missing: [{ skill: 'React', key: canonicalKey('React'), kind: 'required', importance: 'high', priority: 'high', why: 'needed' }] },
    score: { value: 0, method: 'v2', counts: { required: 1, preferred: 0, matched: 0, partial: 0, missing: 1 } },
  });
  return { token: signToken(u), id: String(analysis._id), userId: String(u._id) };
};
const lockOf = async (id) => (await Analysis.findById(id).select('+roadmapLock').lean()).roadmapLock;
const rmCount = (id) => Roadmap.countDocuments({ analysis: id });

before(async () => {
  if (!enabled) return;
  process.env.JWT_SECRET = SECRET;
  mongoose = require('mongoose');
  ({ signToken } = require('../../utils/jwtConfig'));
  ({ canonicalKey } = require('../../utils/ai/skillSynonyms'));
  User = require('../../models/User'); Analysis = require('../../models/SkillGapAnalysis'); Roadmap = require('../../models/LearningRoadmap');
  await mongoose.connect(`${BASE.replace(/\/$/, '')}/${DB}`); // the test's own, independent MongoDB connection
  await Roadmap.init();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-mp-'));
  fixture = path.join(tmp, 'fixture.json');
  setFixture({ response: TASKS });
  for (const p of PORTS) servers.push(await startServer(p));
});

after(async () => {
  for (const s of servers) { try { s.child.kill(); } catch { /* already gone */ } }
  if (!enabled) return;
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  await mongoose.disconnect();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
});

test('the lock-timing overrides are ignored unless NODE_ENV is exactly "test"', () => {
  const { execFileSync } = require('node:child_process');
  const run = (nodeEnv) => Number(execFileSync(process.execPath, ['-e', "process.stdout.write(String(require('./utils/roadmap/lock').STALE_MS))"], {
    cwd: SERVER_DIR, env: { ...process.env, NODE_ENV: nodeEnv, ROADMAP_LOCK_STALE_MS: '5' },
  }));
  assert.equal(run('test'), 5);
  assert.equal(run('production'), 180000);
  assert.equal(run('development'), 180000);
  assert.equal(run(''), 180000);
});

test('two processes, simultaneous requests: ONE Gemini call, one roadmap, both get the same persisted roadmap', { skip }, async () => {
  const c = await newCase();
  setFixture({ response: TASKS, delayMs: 3000 }); resetCalls();
  const [ra, rb] = await Promise.all(servers.map((s) => call(s, c.token, 'POST', `/skill-gap/${c.id}/roadmap`, {})));
  assert.deepEqual([ra.status, rb.status].sort(), [200, 201], JSON.stringify([ra.body, rb.body]));
  assert.equal(ra.body.roadmap._id, rb.body.roadmap._id, 'same persisted roadmap');
  assert.equal([ra, rb].filter((r) => r.body.existing === true).length, 1);
  assert.equal(aiCalls(), 1, 'exactly one Gemini generation across both processes');
  assert.equal(await rmCount(c.id), 1);
  assert.equal(await lockOf(c.id), undefined, 'lock released');
  const stored = await Roadmap.findOne({ analysis: c.id }).lean();
  assert.equal(String(stored._id), ra.body.roadmap._id);
});

test('progress is preserved: duplicate non-regenerate requests from both processes never reset or regenerate', { skip }, async () => {
  const c = await newCase();
  setFixture({ response: TASKS }); resetCalls();
  const first = await call(servers[0], c.token, 'POST', `/skill-gap/${c.id}/roadmap`, {});
  assert.equal(first.status, 201);
  const rid = first.body.roadmap._id; const tid = first.body.roadmap.stages[0].tasks[0].id;
  assert.equal((await call(servers[1], c.token, 'PUT', `/skill-gap/roadmaps/${rid}/tasks/${tid}`, { status: 'completed', notes: 'done in B' })).status, 200);
  resetCalls();
  const rs = await Promise.all([0, 1, 0, 1].map((i) => call(servers[i], c.token, 'POST', `/skill-gap/${c.id}/roadmap`, {})));
  assert.ok(rs.every((r) => r.status === 200 && r.body.existing === true));
  assert.ok(rs.every((r) => r.body.roadmap._id === rid && r.body.roadmap.progress.completed === 1));
  assert.equal(aiCalls(), 0, 'no AI call for requests that only need the existing roadmap');
  const task = (await Roadmap.findById(rid).lean()).stages[0].tasks[0];
  assert.equal(task.status, 'completed'); assert.equal(task.notes, 'done in B');
});

test('simultaneous regenerate from both processes: one regeneration (progress reset once), same roadmap document', { skip }, async () => {
  const c = await newCase();
  setFixture({ response: TASKS }); resetCalls();
  const first = await call(servers[0], c.token, 'POST', `/skill-gap/${c.id}/roadmap`, {});
  const rid = first.body.roadmap._id; const tid = first.body.roadmap.stages[0].tasks[0].id;
  await call(servers[0], c.token, 'PUT', `/skill-gap/roadmaps/${rid}/tasks/${tid}`, { status: 'in-progress' });
  setFixture({ response: TASKS, delayMs: 2500 }); resetCalls();
  const rs = await Promise.all(servers.map((s) => call(s, c.token, 'POST', `/skill-gap/${c.id}/roadmap`, { regenerate: true })));
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 201]);
  assert.equal(aiCalls(), 1);
  assert.ok(rs.every((r) => r.body.roadmap._id === rid));
  assert.equal(await rmCount(c.id), 1);
  assert.equal((await Roadmap.findById(rid).lean()).stages[0].tasks[0].status, 'not-started', 'reset by the single regeneration');
});

test('failed first generation (in one process) lets the waiting request in the OTHER process retry and succeed', { skip }, async () => {
  const c = await newCase();
  setFixture({ response: TASKS, delayMs: 2500, failFirstCalls: 1 }); resetCalls();
  const [ra, rb] = await Promise.all(servers.map((s) => call(s, c.token, 'POST', `/skill-gap/${c.id}/roadmap`, {})));
  assert.deepEqual([ra.status, rb.status].sort(), [201, 429], JSON.stringify([ra.body, rb.body]));
  assert.equal(aiCalls(), 2, 'one failed call + one successful retry');
  assert.equal(await rmCount(c.id), 1);
  assert.equal(await lockOf(c.id), undefined, 'no lock left behind by the failure');
});

test('stale lock from a dead process is recovered by either process', { skip }, async () => {
  const c = await newCase();
  setFixture({ response: TASKS }); resetCalls();
  await Analysis.updateOne({ _id: c.id }, { $set: { roadmapLock: { token: 'dead-process', at: new Date(Date.now() - 10 * 60 * 1000) } } }, { timestamps: false });
  const r = await call(servers[1], c.token, 'POST', `/skill-gap/${c.id}/roadmap`, {});
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(aiCalls(), 1);
  assert.equal(await lockOf(c.id), undefined);
});

test('holder process is KILLED mid-generation: the waiter takes over after the lock goes stale (no deadlock, no permanent lock)', { skip }, async () => {
  const c = await newCase();
  const victim = await startServer(PORTS[0] + 20); // a third, disposable process that will be killed
  try {
    setFixture({ response: TASKS, delayMs: 20000 }); resetCalls();
    const doomed = call(victim, c.token, 'POST', `/skill-gap/${c.id}/roadmap`, {}).catch(() => ({ status: 'connection lost' }));
    for (let i = 0; i < 40 && !(await lockOf(c.id)); i += 1) await sleep(100); // wait until the victim holds the lock
    assert.ok(await lockOf(c.id), 'victim acquired the lock');
    victim.child.kill('SIGKILL'); // dies while holding the lock; nothing releases it
    assert.equal((await doomed).status, 'connection lost');
    setFixture({ response: TASKS }); // the retry answers immediately
    const t0 = Date.now();
    const r = await call(servers[0], c.token, 'POST', `/skill-gap/${c.id}/roadmap`, {});
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const waited = Date.now() - t0;
    assert.ok(waited >= STALE_MS - 2500 && waited < MAX_WAIT_MS + 5000, `waited ${waited} ms (stale ${STALE_MS}, max wait ${MAX_WAIT_MS})`);
    assert.equal(aiCalls(), 2, 'the killed call + the takeover');
    assert.equal(await rmCount(c.id), 1);
    assert.equal(await lockOf(c.id), undefined);
  } finally { try { victim.child.kill('SIGKILL'); } catch { /* gone */ } }
});

test('a live holder that outlasts the wait limit yields 409 ROADMAP_BUSY (no hang); a later retry succeeds once the lock is free', { skip }, async () => {
  const c = await newCase();
  const live = Date.now();
  await Analysis.updateOne({ _id: c.id }, { $set: { roadmapLock: { token: 'busy-elsewhere', at: new Date(live) } } }, { timestamps: false });
  // Fresh foreign lock, wait limit (15 s) is longer than the stale limit (6 s) in this configuration, so this request would
  // simply take over after 6 s. To observe the 409, hold the lock "fresh" by re-stamping it while the request waits.
  setFixture({ response: TASKS }); resetCalls();
  const keepAlive = setInterval(() => { Analysis.updateOne({ _id: c.id }, { $set: { 'roadmapLock.at': new Date() } }, { timestamps: false }).catch(() => {}); }, 1000);
  let r;
  try { r = await call(servers[0], c.token, 'POST', `/skill-gap/${c.id}/roadmap`, {}); } finally { clearInterval(keepAlive); }
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.equal(r.body.code, 'ROADMAP_BUSY');
  assert.equal(aiCalls(), 0, 'a waiter that gives up made no AI call');
  assert.equal((await lockOf(c.id)).token, 'busy-elsewhere', 'the waiter never frees a lock it does not own');
  await Analysis.updateOne({ _id: c.id }, { $unset: { roadmapLock: 1 } }, { timestamps: false }); // the real holder finishes
  const retry = await call(servers[1], c.token, 'POST', `/skill-gap/${c.id}/roadmap`, {});
  assert.equal(retry.status, 201);
  assert.equal(await rmCount(c.id), 1);
});
