/*
 * Roadmap API tests (node:test). Needs a DISPOSABLE local MongoDB:
 *
 *   mongod --dbpath <temp dir outside the repo> --port 27130
 *   ROADMAP_TEST_MONGO=mongodb://127.0.0.1:27130 npm run test:roadmap
 *
 * Without ROADMAP_TEST_MONGO these tests are skipped. Refuses anything that is not localhost/127.0.0.1.
 * The router runs IN-PROCESS (real protect / aiLimiter / error handler, real HTTP, real MongoDB); Gemini is stubbed
 * through config/gemini `_setRawGenerate`, so no network call is ever made. SkillGapAnalysis documents are inserted
 * directly (the analysis-creation API belongs to another workstream). Own database, dropped at the end.
 */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.ROADMAP_TEST_MONGO || '';
const enabled = !!BASE;
if (enabled && !/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('ROADMAP_TEST_MONGO must be a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27130');
}
const skip = enabled ? false : 'set ROADMAP_TEST_MONGO to run the API tests';

process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
const DB = `roadmap_api_test_${process.pid}`;

let mongoose; let server; let API; let gemini; let aiLimiter;
let User; let Analysis; let Roadmap; let Program; let Enrollment; let signToken; let canonicalKey;
let aiCalls = 0; let aiMode = 'ok'; let aiGate = null; let failFirst = false;

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
const get = (t, u) => call(t, 'GET', u);
const post = (t, u, b) => call(t, 'POST', u, b);
const put = (t, u, b) => call(t, 'PUT', u, b);
const del = (t, u) => call(t, 'DELETE', u);

// Stub transport: echoes a valid answer for the tasks named in the prompt (or fails on demand).
const stub = async (prompt) => {
  aiCalls += 1;
  if (aiGate) await aiGate;
  if (failFirst && aiCalls === 1) { const e = new Error('quota'); e.status = 429; throw e; }
  if (aiMode === 'quota') { const e = new Error('quota'); e.status = 429; throw e; }
  if (aiMode === 'garbage') return 'this is not json at all';
  if (aiMode === 'hallucinated') return JSON.stringify({ tasks: [{ id: 't1', skill: 'Underwater Basket Weaving', objective: 'x', activity: 'y', exercise: 'z', completionCriteria: 'w' }] });
  const tasks = [...prompt.matchAll(/id=(t\d+) \| skill=([^|]+?) \|/g)].map((x) => ({
    id: x[1], skill: x[2], objective: `AI objective for ${x[2]}`, activity: 'AI activity', exercise: `AI exercise for ${x[2]}`, completionCriteria: 'AI criteria',
  }));
  return JSON.stringify({ tasks });
};

let seq = 0;
const newUser = async (tag = 'u') => {
  seq += 1;
  const u = await User.create({ name: 'Road Tester', email: `${tag}${seq}.${process.pid}@example.com`, password: 'x'.repeat(20), emailVerified: true });
  return { id: String(u._id), token: signToken(u) };
};

const M = (skill, priority = 'medium', kind = 'required') => ({ skill, key: canonicalKey(skill), kind, importance: priority, priority, why: 'needed' });
const mkAnalysis = (userId, over = {}) => Analysis.create({
  user: userId, title: 'Analysis', mode: 'resume', basis: 'resume-verified', targetKind: 'role-only', targetRole: 'Full Stack Developer',
  requirements: [{ skill: 'React', key: canonicalKey('React'), kind: 'required' }],
  result: {
    matched: [{ skill: 'HTML', key: canonicalKey('HTML'), kind: 'required' }],
    partial: [{ skill: 'SQL', key: canonicalKey('SQL'), kind: 'required', importance: 'medium' }],
    missing: [M('React', 'high'), M('Docker', 'medium'), M('Kubernetes', 'low')],
  },
  score: { value: 40, method: 'v1', counts: { required: 5, preferred: 0, matched: 1, partial: 1, missing: 3 } },
  ...over,
});

before(async () => {
  if (!enabled) return;
  mongoose = require('mongoose');
  const express = require('express');
  const { errorHandler, notFound } = require('../../middleware/errorHandler');
  gemini = require('../../config/gemini');
  aiLimiter = require('../../middleware/aiLimiter').aiLimiter;
  ({ signToken } = require('../../utils/jwtConfig'));
  ({ canonicalKey } = require('../../utils/ai/skillSynonyms'));
  User = require('../../models/User'); Analysis = require('../../models/SkillGapAnalysis'); Roadmap = require('../../models/LearningRoadmap');
  Program = require('../../models/Program'); Enrollment = require('../../models/ProgramEnrollment');
  await mongoose.connect(`${BASE.replace(/\/$/, '')}/${DB}`);
  await Roadmap.init();
  gemini._setRawGenerate(stub);
  const app = express();
  app.use(express.json());
  app.use('/api/skill-gap', require('../../routes/roadmapRoutes'));
  app.use(notFound);
  app.use(errorHandler);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  API = `http://127.0.0.1:${server.address().port}/api/skill-gap`;
  await Program.insertMany([
    { slug: 'web', title: 'Full-Stack Web Development Foundations', provider: 'freeCodeCamp', description: 'd', category: 'SE', level: 'Beginner', duration: '12 weeks', skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js'], url: 'https://www.freecodecamp.org' },
    { slug: 'azure', title: 'Azure Fundamentals', provider: 'Microsoft Learn', description: 'd', category: 'Cloud', level: 'Beginner', duration: '4 weeks', skills: ['Azure', 'Docker'], url: 'https://learn.microsoft.com' },
    { slug: 'inactive', title: 'Inactive Docker', provider: 'X', description: 'd', category: 'Cloud', skills: ['Docker'], isActive: false },
  ]);
});

beforeEach(() => { aiCalls = 0; aiMode = 'ok'; aiGate = null; failFirst = false; if (aiLimiter) aiLimiter.reset(); });

after(async () => {
  if (!enabled) return;
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  gemini._setRawGenerate(null);
  await mongoose.disconnect();
  if (server) server.close();
});

const tasksOf = (roadmap) => roadmap.stages.flatMap((s) => s.tasks);

test('auth required on every route', { skip }, async () => {
  for (const [m, u] of [['GET', '/overview'], ['GET', '/compare'], ['GET', '/roadmaps'], ['POST', '/507f1f77bcf86cd799439011/roadmap'], ['GET', '/507f1f77bcf86cd799439011/programs']]) {
    assert.equal((await call(null, m, u)).status, 401, `${m} ${u}`);
  }
});

test('create roadmap: validated skeleton + AI text + catalogue resources; persists across requests', { skip }, async () => {
  const u = await newUser(); const a = await mkAnalysis(u.id);
  const r = await post(u.token, `/${a._id}/roadmap`, { weeklyHours: 6 });
  assert.equal(r.status, 201);
  const rm = r.body.roadmap;
  const tasks = tasksOf(rm);
  assert.deepEqual(tasks.map((t) => t.skill).sort(), ['Docker', 'Kubernetes', 'React', 'SQL']);
  assert.ok(tasks.every((t) => t.estimatedHours >= 2 && t.estimatedHours <= 40));
  assert.ok(tasks.every((t) => t.status === 'not-started'));
  assert.equal(tasks.find((t) => t.skill === 'React').objective, 'AI objective for React');
  const resources = Object.fromEntries(tasks.map((t) => [t.skill, t.resource]));
  assert.equal(resources.React.type, 'program');
  assert.equal(resources.React.url, 'https://www.freecodecamp.org');
  assert.equal(resources.Docker.title, 'Azure Fundamentals'); // active program only
  assert.equal(resources.Kubernetes, null);
  assert.equal(rm.weeklyHours, 6);
  assert.match(rm.estimateNote, /vary with your experience/i);
  assert.equal(rm.progress.percent, 0);
  assert.equal(aiCalls, 1);
  // Highest-priority gap first; Kubernetes comes after its prerequisite Docker.
  assert.equal(rm.stages[0].tasks[0].skill, 'React');
  const order = tasks.map((t) => t.skill);
  assert.ok(order.indexOf('Docker') < order.indexOf('Kubernetes'));

  const again = await get(u.token, `/${a._id}/roadmap`);
  assert.equal(again.status, 200);
  assert.equal(again.body.roadmap._id, rm._id);
  assert.equal((await get(u.token, `/roadmaps/${rm._id}`)).body.roadmap.stages.length, rm.stages.length);
  const list = await get(u.token, '/roadmaps');
  assert.equal(list.body.count, 1);
  assert.equal(list.body.roadmaps[0].stages, undefined); // summary only
  assert.equal(await Roadmap.countDocuments({ user: u.id }), 1);
  assert.equal(await Enrollment.countDocuments({}), 0, 'never creates enrollments');
});

test('without weeklyHours there is no fixed duration; second POST returns the existing roadmap without AI', { skip }, async () => {
  const u = await newUser(); const a = await mkAnalysis(u.id);
  const first = await post(u.token, `/${a._id}/roadmap`, {});
  assert.equal(first.status, 201);
  assert.equal(first.body.roadmap.weeklyHours, null);
  assert.match(first.body.roadmap.estimateNote, /no fixed duration/i);
  const second = await post(u.token, `/${a._id}/roadmap`, {});
  assert.equal(second.status, 200);
  assert.equal(second.body.existing, true);
  assert.equal(second.body.roadmap._id, first.body.roadmap._id);
  assert.equal(aiCalls, 1);
});

test('input validation, NOTHING_TO_LEARN, ownership', { skip }, async () => {
  const u = await newUser(); const other = await newUser('o'); const a = await mkAnalysis(u.id);
  assert.equal((await post(u.token, `/${a._id}/roadmap`, { weeklyHours: 0 })).status, 400);
  assert.equal((await post(u.token, `/${a._id}/roadmap`, { weeklyHours: 61 })).status, 400);
  assert.equal((await post(u.token, `/${a._id}/roadmap`, { weeklyHours: 'x' })).status, 400);
  assert.equal((await post(u.token, `/${a._id}/roadmap`, { regenerate: 'yes' })).status, 400);
  assert.equal((await post(u.token, '/not-an-id/roadmap', {})).status, 400);
  assert.equal(aiCalls, 0);
  const done = await mkAnalysis(u.id, { result: { matched: [{ skill: 'HTML', key: canonicalKey('HTML') }], partial: [], missing: [] } });
  const n = await post(u.token, `/${done._id}/roadmap`, {});
  assert.equal(n.status, 422); assert.equal(n.body.code, 'NOTHING_TO_LEARN');
  assert.equal(aiCalls, 0);
  assert.equal((await post(other.token, `/${a._id}/roadmap`, {})).status, 404);
  assert.equal((await get(other.token, `/${a._id}/roadmap`)).status, 404);
  assert.equal((await get(other.token, `/${a._id}/programs`)).status, 404);
  const none = await get(u.token, `/${a._id}/roadmap`);
  assert.equal(none.status, 404); assert.equal(none.body.code, 'NO_ROADMAP');
});

test('AI failures map to friendly errors and save nothing; no fake roadmap', { skip }, async () => {
  const u = await newUser(); const a = await mkAnalysis(u.id);
  aiMode = 'quota';
  let r = await post(u.token, `/${a._id}/roadmap`, {});
  assert.equal(r.status, 429); assert.equal(r.body.code, 'AI_QUOTA');
  aiMode = 'garbage';
  r = await post(u.token, `/${a._id}/roadmap`, {});
  assert.equal(r.status, 502); assert.equal(r.body.code, 'AI_BAD_RESPONSE');
  aiMode = 'hallucinated';
  r = await post(u.token, `/${a._id}/roadmap`, {});
  assert.equal(r.status, 502); assert.equal(r.body.code, 'AI_BAD_RESPONSE');
  assert.equal(await Roadmap.countDocuments({ user: u.id }), 0);
  assert.equal((await get(u.token, `/${a._id}/roadmap`)).status, 404);
});

test('task updates: status, notes, timestamps, idempotency, reopen, validation, progress persistence', { skip }, async () => {
  const u = await newUser(); const a = await mkAnalysis(u.id);
  const rm = (await post(u.token, `/${a._id}/roadmap`, {})).body.roadmap;
  const url = `/roadmaps/${rm._id}/tasks/t1`;
  const scoreBefore = (await Analysis.findById(a._id)).score.value;

  let r = await put(u.token, url, { status: 'in-progress' });
  assert.equal(r.status, 200);
  let t = tasksOf(r.body.roadmap).find((x) => x.id === 't1');
  assert.equal(t.status, 'in-progress'); assert.ok(t.startedAt); assert.equal(t.completedAt, null);
  const started = t.startedAt;
  assert.equal(r.body.roadmap.progress.inProgress, 1);

  r = await put(u.token, url, { status: 'in-progress' }); // repeat
  t = tasksOf(r.body.roadmap).find((x) => x.id === 't1');
  assert.equal(t.startedAt, started);

  r = await put(u.token, url, { status: 'completed', notes: 'Finished the exercise' });
  t = tasksOf(r.body.roadmap).find((x) => x.id === 't1');
  assert.equal(t.status, 'completed'); assert.ok(t.completedAt); assert.equal(t.startedAt, started); assert.equal(t.notes, 'Finished the exercise');
  const completedAt = t.completedAt;
  const total = r.body.roadmap.progress.total;
  assert.equal(r.body.roadmap.progress.percent, Math.round((1 / total) * 100));
  const updatedAt = r.body.roadmap.updatedAt;

  r = await put(u.token, url, { status: 'completed' }); // repeat: nothing changes
  assert.equal(tasksOf(r.body.roadmap).find((x) => x.id === 't1').completedAt, completedAt);
  assert.equal(r.body.roadmap.updatedAt, updatedAt);

  // persisted: separate request, and the stored document agrees
  const reread = await get(u.token, `/roadmaps/${rm._id}`);
  assert.equal(reread.body.roadmap.progress.completed, 1);
  assert.equal(reread.body.roadmap.stages.flatMap((s) => s.progress.completed).reduce((x, y) => x + y, 0), 1);
  assert.equal(reread.body.roadmap.remainingEstimatedHours, reread.body.roadmap.totalEstimatedHours - tasksOf(reread.body.roadmap).find((x) => x.id === 't1').estimatedHours);

  // reopen
  r = await put(u.token, url, { status: 'in-progress' });
  t = tasksOf(r.body.roadmap).find((x) => x.id === 't1');
  assert.equal(t.status, 'in-progress'); assert.equal(t.completedAt, null); assert.equal(r.body.roadmap.progress.completed, 0);
  r = await put(u.token, url, { status: 'not-started' });
  t = tasksOf(r.body.roadmap).find((x) => x.id === 't1');
  assert.equal(t.startedAt, null); assert.equal(t.notes, 'Finished the exercise'); // notes survive

  // notes only; clearing notes
  assert.equal((await put(u.token, url, { notes: 'x' })).status, 200);
  r = await put(u.token, url, { notes: '' });
  assert.equal(tasksOf(r.body.roadmap).find((x) => x.id === 't1').notes, '');

  // validation
  assert.equal((await put(u.token, url, {})).status, 400);
  assert.equal((await put(u.token, url, { status: 'done' })).status, 400);
  assert.equal((await put(u.token, url, { notes: 'n'.repeat(1001) })).status, 400);
  assert.equal((await put(u.token, url, { notes: 5 })).status, 400);
  assert.equal((await put(u.token, `/roadmaps/${rm._id}/tasks/t999`, { status: 'completed' })).status, 404);
  assert.equal((await put(u.token, `/roadmaps/bad/tasks/t1`, { status: 'completed' })).status, 400);

  // completing tasks never changes the analysis score
  await put(u.token, url, { status: 'completed' });
  assert.equal((await Analysis.findById(a._id)).score.value, scoreBefore);
});

test('skill level: user-stated, stored, clearable, validated; never changes score', { skip }, async () => {
  const u = await newUser(); const a = await mkAnalysis(u.id);
  const rm = (await post(u.token, `/${a._id}/roadmap`, {})).body.roadmap;
  const key = encodeURIComponent(canonicalKey('React'));
  let r = await put(u.token, `/roadmaps/${rm._id}/skills/${key}`, { level: 'intermediate' });
  assert.equal(r.status, 200);
  assert.equal(r.body.roadmap.skills.find((s) => s.skill === 'React').level, 'intermediate');
  assert.equal(r.body.roadmap.skills.find((s) => s.skill === 'Docker').level, null);
  r = await put(u.token, `/roadmaps/${rm._id}/skills/${key}`, { level: 'advanced' });
  assert.equal(r.body.roadmap.skills.find((s) => s.skill === 'React').level, 'advanced');
  assert.equal((await Roadmap.findById(rm._id)).skillLevels.length, 1);
  assert.equal((await put(u.token, `/roadmaps/${rm._id}/skills/${key}`, { level: 'expert' })).status, 400);
  assert.equal((await put(u.token, `/roadmaps/${rm._id}/skills/${key}`, {})).status, 400);
  assert.equal((await put(u.token, `/roadmaps/${rm._id}/skills/${encodeURIComponent('s:nothing')}`, { level: 'beginner' })).status, 404);
  r = await put(u.token, `/roadmaps/${rm._id}/skills/${key}`, { level: null });
  assert.equal(r.body.roadmap.skills.find((s) => s.skill === 'React').level, null);
  assert.equal((await Roadmap.findById(rm._id)).skillLevels.length, 0);
  assert.equal((await Analysis.findById(a._id)).score.value, 40);
});

test('ownership isolation: another user cannot read, update, delete or see roadmaps', { skip }, async () => {
  const u = await newUser(); const o = await newUser('o'); const a = await mkAnalysis(u.id);
  const rm = (await post(u.token, `/${a._id}/roadmap`, {})).body.roadmap;
  assert.equal((await get(o.token, `/roadmaps/${rm._id}`)).status, 404);
  assert.equal((await put(o.token, `/roadmaps/${rm._id}/tasks/t1`, { status: 'completed' })).status, 404);
  assert.equal((await put(o.token, `/roadmaps/${rm._id}/skills/${encodeURIComponent(canonicalKey('React'))}`, { level: 'beginner' })).status, 404);
  assert.equal((await del(o.token, `/roadmaps/${rm._id}`)).status, 404);
  assert.equal((await get(o.token, '/roadmaps')).body.count, 0);
  const ov = await get(o.token, '/overview');
  assert.equal(ov.body.latestAnalysis, null); assert.equal(ov.body.activeRoadmap, null);
  assert.equal(tasksOf((await get(u.token, `/roadmaps/${rm._id}`)).body.roadmap).every((t) => t.status === 'not-started'), true);
});

test('regenerate replaces the roadmap and resets progress; delete keeps the analysis', { skip }, async () => {
  const u = await newUser(); const a = await mkAnalysis(u.id);
  const rm = (await post(u.token, `/${a._id}/roadmap`, {})).body.roadmap;
  await put(u.token, `/roadmaps/${rm._id}/tasks/t1`, { status: 'completed', notes: 'done' });
  await put(u.token, `/roadmaps/${rm._id}/skills/${encodeURIComponent(canonicalKey('React'))}`, { level: 'beginner' });
  const r = await post(u.token, `/${a._id}/roadmap`, { regenerate: true, weeklyHours: 10 });
  assert.equal(r.status, 201);
  assert.equal(r.body.roadmap.progress.completed, 0);
  assert.equal(r.body.roadmap.weeklyHours, 10);
  assert.ok(tasksOf(r.body.roadmap).every((t) => t.status === 'not-started' && t.notes === ''));
  assert.ok(r.body.roadmap.skills.every((s) => s.level === null));
  assert.equal(await Roadmap.countDocuments({ user: u.id, analysis: a._id }), 1);
  assert.equal(aiCalls, 2);

  assert.equal((await del(u.token, `/roadmaps/${r.body.roadmap._id}`)).status, 200);
  assert.equal((await get(u.token, `/roadmaps/${r.body.roadmap._id}`)).status, 404);
  assert.ok(await Analysis.findById(a._id), 'analysis kept');
  // a new roadmap can be generated afterwards
  assert.equal((await post(u.token, `/${a._id}/roadmap`, {})).status, 201);
});

test('programs: real catalogue matches, enrollment read-only, empty list when nothing matches', { skip }, async () => {
  const u = await newUser(); const a = await mkAnalysis(u.id);
  const web = await Program.findOne({ slug: 'web' });
  await Enrollment.create({ user: u.id, program: web._id, status: 'in-progress' });
  const r = await get(u.token, `/${a._id}/programs`);
  assert.equal(r.status, 200);
  const titles = r.body.programs.map((p) => p.program.title);
  assert.deepEqual(titles.sort(), ['Azure Fundamentals', 'Full-Stack Web Development Foundations']);
  const w = r.body.programs.find((p) => p.program.slug === 'web');
  assert.deepEqual(w.matchedSkills, ['React']);
  assert.deepEqual(w.enrollment, { status: 'in-progress' });
  assert.equal(r.body.programs.find((p) => p.program.slug === 'azure').enrollment, null);
  assert.equal(r.body.count, 2);
  assert.equal(await Enrollment.countDocuments({}), 1, 'no enrollment created');

  const none = await mkAnalysis(u.id, { result: { matched: [], partial: [], missing: [M('COBOL')] } });
  const e = await get(u.token, `/${none._id}/programs`);
  assert.deepEqual(e.body, { count: 0, programs: [] });
});

test('overview: nulls/empties with no data; real totals, next action, recent after activity', { skip }, async () => {
  const u = await newUser();
  let ov = (await get(u.token, '/overview')).body;
  assert.equal(ov.latestAnalysis, null); assert.equal(ov.activeRoadmap, null); assert.equal(ov.nextAction, null);
  assert.deepEqual(ov.totals, { total: 0, tasks: 0, completed: 0, inProgress: 0, notStarted: 0, percent: 0 });
  assert.deepEqual(ov.skillsInProgress, []); assert.deepEqual(ov.recent, []);

  const a = await mkAnalysis(u.id);
  ov = (await get(u.token, '/overview')).body;
  assert.equal(ov.latestAnalysis._id, String(a._id));
  assert.equal(ov.latestAnalysis.hasRoadmap, false);
  assert.equal(ov.activeRoadmap, null);

  const rm = (await post(u.token, `/${a._id}/roadmap`, {})).body.roadmap;
  ov = (await get(u.token, '/overview')).body;
  assert.equal(ov.latestAnalysis.hasRoadmap, true);
  assert.equal(ov.activeRoadmap._id, rm._id);
  assert.equal(ov.nextAction.taskId, 't1');
  assert.equal(ov.nextAction.stage, rm.stages[0].title);

  await put(u.token, `/roadmaps/${rm._id}/tasks/t1`, { status: 'completed' });
  await put(u.token, `/roadmaps/${rm._id}/tasks/t2`, { status: 'in-progress' });
  ov = (await get(u.token, '/overview')).body;
  assert.equal(ov.totals.completed, 1); assert.equal(ov.totals.inProgress, 1);
  assert.equal(ov.nextAction.taskId, 't2');
  assert.equal(ov.latestAnalysis.roadmapPercent, ov.totals.percent);
  assert.equal(ov.recent.length, 2);
  assert.ok(ov.skillsInProgress.length >= 1);
});

test('compare: only own analyses, same target deltas, different target warning, validation', { skip }, async () => {
  const u = await newUser(); const o = await newUser('o');
  const older = await mkAnalysis(u.id, { createdAt: new Date('2026-01-01') });
  const newer = await mkAnalysis(u.id, {
    createdAt: new Date('2026-02-01'), score: { value: 70, method: 'v1', counts: { required: 5, matched: 3, partial: 1, missing: 1 } },
    result: { matched: [{ skill: 'HTML', key: canonicalKey('HTML') }, { skill: 'React', key: canonicalKey('React') }], partial: [{ skill: 'SQL', key: canonicalKey('SQL') }], missing: [M('Docker', 'medium')] },
  });
  const other = await mkAnalysis(u.id, { targetRole: 'Data Analyst', createdAt: new Date('2026-03-01') });
  const foreign = await mkAnalysis(o.id);
  await post(u.token, `/${older._id}/roadmap`, {});

  let r = await get(u.token, `/compare?a=${newer._id}&b=${older._id}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.a._id, String(older._id)); assert.equal(r.body.b._id, String(newer._id));
  assert.equal(r.body.sameTarget, true); assert.equal(r.body.scoreDelta, 30); assert.equal(r.body.warning, null);
  assert.deepEqual(r.body.newlySkills, [{ skill: 'React' }]);
  assert.deepEqual(r.body.resolvedMissing, [{ skill: 'React' }]);
  assert.deepEqual(r.body.stillMissing, [{ skill: 'Docker', priority: 'medium' }]);
  assert.deepEqual(r.body.needsImprovement, [{ skill: 'SQL' }]);
  assert.equal(r.body.roadmap.a, 0); assert.equal(r.body.roadmap.b, null);

  r = await get(u.token, `/compare?a=${older._id}&b=${other._id}`);
  assert.equal(r.status, 200); assert.equal(r.body.sameTarget, false); assert.ok(r.body.warning);
  assert.equal(r.body.scoreDelta, null);

  assert.equal((await get(u.token, `/compare?a=${older._id}&b=${foreign._id}`)).status, 404);
  assert.equal((await get(o.token, `/compare?a=${older._id}&b=${foreign._id}`)).status, 404);
  assert.equal((await get(u.token, `/compare?a=${older._id}`)).status, 400);
  assert.equal((await get(u.token, '/compare?a=x&b=y')).status, 400);
  assert.equal((await get(u.token, `/compare?a=${older._id}&b=${older._id}`)).status, 200);
});

test('summary reports deleted resume/job flags (history is retained)', { skip }, async () => {
  const u = await newUser();
  const a = await mkAnalysis(u.id, { targetKind: 'job', job: new mongoose.Types.ObjectId(), resume: new mongoose.Types.ObjectId(), jobSnapshot: { title: 'Gone Job', company: 'Co' }, resumeSnapshot: { name: 'Old CV' } });
  const ov = (await get(u.token, '/overview')).body.latestAnalysis;
  assert.equal(ov._id, String(a._id));
  assert.equal(ov.jobDeleted, true); assert.equal(ov.resumeDeleted, true);
  assert.equal(ov.job, null); assert.equal(ov.jobSnapshot.title, 'Gone Job');
});

// ---------------------------------------------------------------- concurrency (backend lock, not a UI guard)
const gate = () => { let open; const p = new Promise((r) => { open = r; }); return { p, open }; };
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
// The controller sends its response and releases the lock in a `finally` right AFTER it, so a client can see the 201 a few
// milliseconds before the lock is gone. Wait (bounded) for the release; the invariant asserted is unchanged: it IS released.
const lockGone = async (id) => { for (let i = 0; i < 60; i += 1) { const l = await lockOf(id); if (l === undefined) return l; await settle(50); } return lockOf(id); };
const lockOf = async (id) => (await Analysis.findById(id).select('+roadmapLock').lean()).roadmapLock;

test('concurrent POSTs for one analysis: exactly one Gemini call, one roadmap, consistent responses', { skip }, async () => {
  const u = await newUser('c1'); const a = await mkAnalysis(u.id);
  const g = gate(); aiGate = g.p;
  const reqs = [1, 2, 3, 4].map(() => post(u.token, `/${a._id}/roadmap`, {}));
  await settle(700); // all four are in flight: one holds the lock inside the stub, three wait
  assert.equal(aiCalls, 1);
  g.open();
  const rs = await Promise.all(reqs);
  assert.equal(aiCalls, 1, 'duplicates must not call the AI');
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 200, 200, 201]);
  const ids = new Set(rs.map((r) => r.body.roadmap._id));
  assert.equal(ids.size, 1);
  assert.equal(rs.filter((r) => r.body.existing === true).length, 3);
  assert.equal(await Roadmap.countDocuments({ analysis: a._id }), 1);
  assert.equal(await lockGone(a._id), undefined, 'lock released');
});

test('concurrent regenerate: one regeneration, progress reset once, no duplicate roadmaps', { skip }, async () => {
  const u = await newUser('c2'); const a = await mkAnalysis(u.id);
  const first = await post(u.token, `/${a._id}/roadmap`, {});
  assert.equal(first.status, 201);
  const rid = first.body.roadmap._id; const tid = first.body.roadmap.stages[0].tasks[0].id;
  assert.equal((await put(u.token, `/roadmaps/${rid}/tasks/${tid}`, { status: 'completed' })).status, 200);
  aiCalls = 0;
  const g = gate(); aiGate = g.p;
  const reqs = [1, 2, 3].map(() => post(u.token, `/${a._id}/roadmap`, { regenerate: true }));
  await settle(700);
  g.open();
  const rs = await Promise.all(reqs);
  assert.equal(aiCalls, 1);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 200, 201]);
  assert.equal(await Roadmap.countDocuments({ analysis: a._id }), 1);
  const after = (await get(u.token, `/${a._id}/roadmap`)).body.roadmap;
  assert.equal(after._id, rid, 'same document is regenerated in place');
  assert.equal(after.progress.completed, 0, 'regenerate resets progress (and does so once)');
  // A later plain request keeps the new roadmap and its progress untouched.
  await put(u.token, `/roadmaps/${rid}/tasks/${after.stages[0].tasks[0].id}`, { status: 'in-progress' });
  aiCalls = 0;
  const again = await post(u.token, `/${a._id}/roadmap`, {});
  assert.equal(again.status, 200); assert.equal(aiCalls, 0);
  assert.equal(again.body.roadmap.progress.inProgress, 1);
});

test('failure then retry: failed holder frees the lock, a waiting request retries itself, nothing duplicated', { skip }, async () => {
  const u = await newUser('c3'); const a = await mkAnalysis(u.id);
  failFirst = true;
  const g = gate(); aiGate = g.p;
  const reqs = [post(u.token, `/${a._id}/roadmap`, {}), post(u.token, `/${a._id}/roadmap`, {})];
  await settle(700);
  g.open();
  const rs = await Promise.all(reqs);
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 429]);
  assert.equal(aiCalls, 2, 'one failed call + one successful retry');
  assert.equal(await Roadmap.countDocuments({ analysis: a._id }), 1);
  assert.equal(await lockGone(a._id), undefined);
});

test('a failed generation leaves nothing behind and the lock free for an immediate retry', { skip }, async () => {
  const u = await newUser('c4'); const a = await mkAnalysis(u.id);
  aiMode = 'quota';
  assert.equal((await post(u.token, `/${a._id}/roadmap`, {})).status, 429);
  assert.equal(await Roadmap.countDocuments({ analysis: a._id }), 0);
  assert.equal(await lockGone(a._id), undefined);
  aiMode = 'ok';
  assert.equal((await post(u.token, `/${a._id}/roadmap`, {})).status, 201);
});

test('stale lock (crashed holder) is taken over; a fresh foreign lock gives 409 ROADMAP_BUSY without any AI call', { skip }, async () => {
  const lock = require('../../utils/roadmap/lock');
  const u = await newUser('c5'); const a = await mkAnalysis(u.id);
  await Analysis.updateOne({ _id: a._id }, { $set: { roadmapLock: { token: 'dead', at: new Date(Date.now() - 10 * 60 * 1000) } } }, { timestamps: false });
  assert.equal((await post(u.token, `/${a._id}/roadmap`, {})).status, 201, 'stale lock must not block forever');
  assert.equal(await lockGone(a._id), undefined);

  const b = await mkAnalysis(u.id);
  await Analysis.updateOne({ _id: b._id }, { $set: { roadmapLock: { token: 'someone-else', at: new Date() } } }, { timestamps: false });
  lock._setMaxWait(700);
  try {
    aiCalls = 0;
    const r = await post(u.token, `/${b._id}/roadmap`, {});
    assert.equal(r.status, 409); assert.equal(r.body.code, 'ROADMAP_BUSY');
    assert.equal(aiCalls, 0);
    assert.equal((await lockOf(b._id)).token, 'someone-else', 'a waiter never releases a lock it does not own');
  } finally { lock._setMaxWait(0); }
});

test('locking does not touch the analysis updatedAt or leak into API output', { skip }, async () => {
  const u = await newUser('c6'); const a = await mkAnalysis(u.id);
  const before = (await Analysis.findById(a._id).lean()).updatedAt.getTime();
  await settle(20);
  assert.equal((await post(u.token, `/${a._id}/roadmap`, {})).status, 201);
  assert.equal((await Analysis.findById(a._id).lean()).updatedAt.getTime(), before);
  const ov = await get(u.token, '/overview');
  assert.equal(JSON.stringify(ov.body).includes('roadmapLock'), false);
});
