/*
 * Skill Gap API tests (node:test). Needs a DISPOSABLE local MongoDB:
 *   mongod --dbpath <temp dir outside the repo> --port 27120
 *   SKILLGAP_TEST_MONGO=mongodb://127.0.0.1:27120 npm run test:skillgap
 * Local only. Starts tests/skillgap/harness.js as a child with explicit env (never .env). Gemini is replaced by the
 * NODE_ENV=test fixture hook (GEMINI_TEST_FIXTURE), so no real AI call is ever made. Own DB, dropped at the end.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');

const BASE = process.env.SKILLGAP_TEST_MONGO || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('Set SKILLGAP_TEST_MONGO to a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27120');
}
const PORT = Number(process.env.TEST_PORT || 5120);
const DB = `skillgap_api_test_${process.pid}`;
const URI = `${BASE.replace(/\/$/, '')}/${DB}`;
const API = `http://127.0.0.1:${PORT}/api`;
const SERVER_DIR = path.join(__dirname, '..', '..');
const FIXTURE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'skillgap-fx-')), 'gemini.json');
const PW = 'Sunrise2025';
let server;

const setAi = (obj) => fs.writeFileSync(FIXTURE, JSON.stringify(obj));
const aiCalls = () => (fs.existsSync(`${FIXTURE}.calls`) ? fs.readFileSync(`${FIXTURE}.calls`, 'utf8').split('\n').filter(Boolean).length : 0);

const call = async (token, method, url, body) => {
  const res = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
};
const get = (t, u) => call(t, 'GET', u);
const post = (t, u, b) => call(t, 'POST', u, b);
const del = (t, u) => call(t, 'DELETE', u);

let seq = 0;
const newUser = async () => {
  const email = `sg${++seq}.${process.pid}@example.com`;
  assert.equal((await post(null, '/auth/signup', { name: 'Skill Tester', email, password: PW })).status, 201);
  const l = await post(null, '/auth/login', { email, password: PW });
  return { token: l.body.token, id: l.body.user.id };
};
const upload = async (token, fileName, text) => {
  const fd = new FormData();
  fd.append('resumeFile', new Blob([text], { type: 'text/plain' }), fileName);
  const res = await fetch(`${API}/resumes`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  return JSON.parse(await res.text());
};

// Docker is only LISTED under SKILLS (declared, never used in a sentence) => partial; React/CSS are shown in use => matched.
const RESUME = 'Alex Dev\nSKILLS\nReact, CSS, HTML, Docker\nBuilt dashboards using React and CSS at Acme.';
const AI_OK = {
  requirements: [], summary: 'Good base; Docker is thin.',
  assessments: [{ skill: 'Docker', status: 'partial', evidence: 'React, CSS, HTML, Docker', reason: 'AI wording that must not replace the deterministic reason', suggestion: 'Add detail if true.' }],
};
let jobId; let u1; let u2; let resumeId;

before(async () => {
  setAi({ response: AI_OK });
  server = spawn(process.execPath, [path.join('tests', 'skillgap', 'harness.js')], {
    cwd: SERVER_DIR,
    env: { ...process.env, MONGO_URI: URI, JWT_SECRET: 'test-secret-that-is-definitely-longer-than-32-chars', PORT: String(PORT), NODE_ENV: 'test', GEMINI_API_KEY: 'test-key', GEMINI_TEST_FIXTURE: FIXTURE },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 25000);
    server.stdout.on('data', (d) => { if (String(d).includes('Server running')) { clearTimeout(t); resolve(); } });
    server.stderr.on('data', (d) => process.stderr.write(d));
    server.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  });
  await mongoose.connect(URI);
  const company = (await mongoose.connection.collection('companies').insertOne({ name: 'Acme Test Co' })).insertedId;
  jobId = String((await mongoose.connection.collection('jobs').insertOne({
    title: 'Frontend Developer', company, city: 'Pune', jobDescription: 'Build UIs', experienceLevel: 'fresher',
    skills: ['React', 'CSS'], preferredSkills: ['Docker'], isActive: true, source: 'demo', createdAt: new Date(), updatedAt: new Date(),
  })).insertedId);
  u1 = await newUser();
  u2 = await newUser();
  resumeId = (await upload(u1.token, 'alex.txt', RESUME)).resume._id;
  assert.ok(resumeId);
});

after(async () => {
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  await mongoose.disconnect();
  if (server) { server.removeAllListeners('exit'); server.kill(); }
  try { fs.rmSync(path.dirname(FIXTURE), { recursive: true, force: true }); } catch { /* ignore */ }
});

test('auth is required and roles/skills suggestions work', async () => {
  assert.equal((await get(null, '/skill-gap/roles')).status, 401);
  const roles = await get(u1.token, '/skill-gap/roles?q=front');
  assert.equal(roles.status, 200);
  assert.ok(roles.body.roles.includes('Frontend Developer'));
  assert.equal(roles.body.count, roles.body.roles.length);
  const sk = await get(u1.token, '/skill-gap/skills?q=react&limit=5');
  assert.equal(sk.status, 200);
  assert.ok(sk.body.skills.some((s) => s.name === 'React' && s.key));
  assert.ok(sk.body.skills.length <= 5);
  const rx = await get(u1.token, '/skill-gap/skills?q=' + encodeURIComponent('(.*'));
  assert.equal(rx.status, 200, 'regex input is escaped');
});

test('resume analysis (job): saved, evidence verified, no resume text, reuse without new AI call', async () => {
  const before = aiCalls();
  const r = await post(u1.token, '/skill-gap/resume', { resumeId, jobId });
  assert.equal(r.status, 201, r.text);
  const a = r.body.analysis;
  assert.equal(a.mode, 'resume');
  assert.equal(a.basis, 'resume-verified');
  assert.equal(a.targetKind, 'job');
  assert.equal(a.score.value, 90);
  assert.deepEqual(a.counts, { matched: 2, partial: 1, missing: 0, required: 2, preferred: 1 });
  assert.equal(a.job.title, 'Frontend Developer');
  assert.equal(a.job.company, 'Acme Test Co');
  assert.equal(a.jobDeleted, false);
  assert.equal(a.resumeDeleted, false);
  assert.equal(a.hasRoadmap, false);
  assert.equal(a.roadmapId, null);
  assert.ok(a.result.matched.every((m) => m.evidence && RESUME.includes(m.evidence)));
  assert.equal(a.result.partial.length, 1);
  const docker = a.result.partial[0];
  assert.equal(docker.skill, 'Docker');
  assert.equal(docker.mention, 'skills-list');
  assert.equal(docker.evidence, 'React, CSS, HTML, Docker'); // the real list line, not invented
  assert.match(docker.reason, /listed in your skills section, but no project, job or achievement/);
  assert.equal(a.score.method, 'v2');
  assert.ok(a.disclaimer && a.methodNote);
  assert.ok(!r.text.includes('Built dashboards using React and CSS at Acme.\n') && !r.text.includes('resumeText'));
  assert.equal(aiCalls(), before + 1);

  const again = await post(u1.token, '/skill-gap/resume', { resumeId, jobId });
  assert.equal(again.status, 200);
  assert.equal(again.body.reused, true);
  assert.equal(again.body.analysis._id, a._id);
  assert.equal(aiCalls(), before + 1, 'reuse makes no AI call');
});

test('manual analysis: labelled manual-input, no evidence, aliases merged, role-only requirements from AI', async () => {
  setAi({ response: { requirements: [{ skill: 'SQL', kind: 'required', importance: 'high', source: 'ai-role' }, { skill: 'Tableau', kind: 'preferred', source: 'ai-role' }], summary: 'Learn Tableau.' } });
  const r = await post(u1.token, '/skill-gap/manual', {
    targetRole: 'Data Analyst', skills: [{ name: 'sql', level: 'beginner' }, { name: 'SQL', level: 'advanced' }, 'Excel'], experienceYears: 2, goals: 'Move into analytics',
  });
  assert.equal(r.status, 201, r.text);
  const a = r.body.analysis;
  assert.equal(a.basis, 'manual-input');
  assert.equal(a.targetKind, 'role-only');
  assert.equal(a.input.manualSkills.filter((s) => s.name === 'SQL').length, 1);
  assert.equal(a.input.manualSkills.find((s) => s.name === 'SQL').level, 'advanced');
  assert.ok(a.result.matched.every((m) => m.source === 'manual' && m.evidence === undefined));
  assert.equal(a.score.value, Math.round((100 * 4.5) / (4.5 + 1.5)));
  assert.equal(a.result.partial.length, 0);
  assert.deepEqual(a.result.additional.map((x) => x.skill), ['Excel']);
  assert.ok(a.requirements.every((q) => q.source === 'ai-role'));
});

test('validation errors, 404s and NO_REQUIREMENTS', async () => {
  const bad = async (path, body, field) => {
    const r = await post(u1.token, path, body);
    assert.equal(r.status, 400, JSON.stringify(body) + r.text);
    assert.equal(r.body.code, 'VALIDATION_ERROR');
    if (field) assert.ok(r.body.errors[field], r.text);
  };
  await bad('/skill-gap/resume', {}, 'resumeId');
  await bad('/skill-gap/resume', { resumeId }, 'targetRole');
  await bad('/skill-gap/resume', { resumeId: 'nope', jobId: 'x' }, 'jobId');
  await bad('/skill-gap/resume', { resumeId, targetRole: 'Dev', jobDescription: 'x'.repeat(8001) }, 'jobDescription');
  await bad('/skill-gap/manual', { targetRole: 'Dev', skills: [] }, 'skills');
  await bad('/skill-gap/manual', { targetRole: 'Dev', skills: Array.from({ length: 61 }, (_, i) => `S${i}`) }, 'skills');
  await bad('/skill-gap/manual', { targetRole: 'Dev', skills: [{ name: 'React', level: 'guru' }] }, 'skills');
  await bad('/skill-gap/manual', { skills: ['React'] }, 'targetRole');
  await bad('/skill-gap/manual', { targetRole: 'Dev', skills: ['React'], experienceYears: 99 }, 'experienceYears');
  assert.equal((await post(u1.token, '/skill-gap/resume', { resumeId: '64b000000000000000000000', jobId })).status, 404);
  assert.equal((await post(u2.token, '/skill-gap/resume', { resumeId, jobId })).status, 404, 'resume owned by another user');
  assert.equal((await post(u1.token, '/skill-gap/resume', { resumeId, jobId: '64b000000000000000000000' })).status, 404);

  const calls = aiCalls();
  setAi({ response: { requirements: [] } });
  const r = await post(u1.token, '/skill-gap/manual', { targetRole: 'Underwater Basket Weaver', skills: ['Weaving'] });
  assert.equal(r.status, 422);
  assert.equal(r.body.code, 'NO_REQUIREMENTS');
  assert.equal(aiCalls(), calls + 1);
});

test('AI failures save nothing and map to 429 / 502 / 503', async () => {
  const count = () => mongoose.connection.collection('skillgapanalyses').countDocuments({ user: new mongoose.Types.ObjectId(u2.id) });
  const body = { targetRole: 'QA Engineer', skills: ['Selenium'] };
  setAi({ error: { status: 429, message: 'quota exceeded' } });
  let r = await post(u2.token, '/skill-gap/manual', body);
  assert.equal(r.status, 429);
  assert.equal(r.body.code, 'AI_QUOTA');
  setAi({ responseText: 'this is not json' });
  r = await post(u2.token, '/skill-gap/manual', body);
  assert.equal(r.status, 502);
  assert.equal(r.body.code, 'AI_BAD_RESPONSE');
  setAi({ error: { status: 500, message: 'boom' } });
  r = await post(u2.token, '/skill-gap/manual', body);
  assert.equal(r.status, 502);
  assert.equal(r.body.code, 'AI_ERROR');
  assert.equal(await count(), 0);
});

test('history: newest first, pagination, filters, ownership isolation, delete', async () => {
  setAi({ response: { requirements: [{ skill: 'Selenium', kind: 'required', source: 'ai-role' }, { skill: 'Jira', kind: 'preferred', source: 'ai-role' }] } });
  const ids = [];
  for (let i = 0; i < 3; i += 1) {
    const r = await post(u2.token, '/skill-gap/manual', { targetRole: 'QA Engineer', skills: [`Tool ${i}`], goals: `g${i}` });
    assert.equal(r.status, 201, r.text);
    ids.push(r.body.analysis._id);
  }
  const p1 = await get(u2.token, '/skill-gap?limit=2&page=1');
  assert.equal(p1.status, 200);
  assert.equal(p1.body.total, 3);
  assert.equal(p1.body.pages, 2);
  assert.equal(p1.body.count, 2);
  assert.equal(p1.body.analyses[0]._id, ids[2]);
  assert.ok(!('result' in p1.body.analyses[0]) && !('requirements' in p1.body.analyses[0]) && !('jobDescriptionText' in p1.body.analyses[0]));
  assert.equal((await get(u2.token, '/skill-gap?limit=2&page=2')).body.analyses[0]._id, ids[0]);
  assert.equal((await get(u2.token, '/skill-gap?mode=resume')).body.total, 0);
  assert.equal((await get(u2.token, '/skill-gap?targetRole=qa')).body.total, 3);
  assert.equal((await get(u2.token, '/skill-gap?mode=bogus')).status, 400);
  assert.equal((await get(u2.token, '/skill-gap?limit=0')).status, 400);
  assert.equal((await get(u2.token, '/skill-gap?limit=500')).status, 200);
  assert.equal((await get(u1.token, '/skill-gap?targetRole=qa')).body.total, 0, 'other user sees nothing');

  assert.equal((await get(u2.token, `/skill-gap/${ids[0]}`)).status, 200);
  assert.equal((await get(u1.token, `/skill-gap/${ids[0]}`)).status, 404);
  assert.equal((await del(u1.token, `/skill-gap/${ids[0]}`)).status, 404);
  assert.equal((await get(u2.token, '/skill-gap/not-an-id')).status, 400);

  // roadmap join + cascade delete
  const roadmaps = mongoose.connection.collection('learningroadmaps');
  await roadmaps.insertOne({
    user: new mongoose.Types.ObjectId(u2.id), analysis: new mongoose.Types.ObjectId(ids[0]), title: 't', targetRole: 'QA Engineer',
    stages: [{ id: 's1', order: 1, title: 'S', tasks: [{ id: 't1', skill: 'a', skillKey: 'a', title: 'x', status: 'completed' }, { id: 't2', skill: 'b', skillKey: 'b', title: 'y', status: 'not-started' }] }],
  });
  const full = await get(u2.token, `/skill-gap/${ids[0]}`);
  assert.equal(full.body.analysis.hasRoadmap, true);
  assert.equal(full.body.analysis.roadmapPercent, 50);
  const list = await get(u2.token, '/skill-gap?limit=3');
  assert.equal(list.body.analyses.find((a) => a._id === ids[0]).roadmapPercent, 50);
  assert.equal(list.body.analyses.find((a) => a._id === ids[1]).hasRoadmap, false);
  const d = await del(u2.token, `/skill-gap/${ids[0]}`);
  assert.equal(d.status, 200);
  assert.equal(d.body.roadmapDeleted, true);
  assert.equal(await roadmaps.countDocuments({}), 0);
  assert.equal((await get(u2.token, `/skill-gap/${ids[0]}`)).status, 404);
  const d2 = await del(u2.token, `/skill-gap/${ids[1]}`);
  assert.equal(d2.body.roadmapDeleted, false);
});

test('deleted source resume and job keep history readable with flags and snapshots', async () => {
  setAi({ response: AI_OK });
  const rid = (await upload(u1.token, 'temp.txt', RESUME)).resume._id;
  const r = await post(u1.token, '/skill-gap/resume', { resumeId: rid, jobId });
  assert.equal(r.status, 201, r.text);
  const id = r.body.analysis._id;
  const db = mongoose.connection;
  await db.collection('resumes').deleteOne({ _id: new mongoose.Types.ObjectId(rid) });
  const tmpJob = (await db.collection('jobs').insertOne({ title: 'Temp Job', company: (await db.collection('companies').findOne({}))._id, skills: ['React'], isActive: true, jobDescription: 'x', experienceLevel: 'fresher', city: 'X' })).insertedId;
  await db.collection('resumes').updateOne({ _id: new mongoose.Types.ObjectId(resumeId) }, { $set: { updatedAt: new Date() } });
  const r2 = await post(u1.token, '/skill-gap/resume', { resumeId, jobId: String(tmpJob) });
  assert.equal(r2.status, 201, r2.text);
  await db.collection('jobs').deleteOne({ _id: tmpJob });
  const a = (await get(u1.token, `/skill-gap/${id}`)).body.analysis;
  assert.equal(a.resumeDeleted, true);
  assert.equal(a.resume, null);
  assert.equal(a.resumeSnapshot.fileName, 'temp.txt');
  const b = (await get(u1.token, `/skill-gap/${r2.body.analysis._id}`)).body.analysis;
  assert.equal(b.jobDeleted, true);
  assert.equal(b.job, null);
  assert.equal(b.jobSnapshot.title, 'Temp Job');
});

test('custom job description: requirements grounded in the text; short JD gets role skills labelled ai-role', async () => {
  setAi({ response: { requirements: [{ skill: 'GraphQL', kind: 'required', source: 'job-text' }, { skill: 'Next.js', kind: 'preferred', source: 'ai-role' }] } });
  const r = await post(u1.token, '/skill-gap/resume', { resumeId, targetRole: 'Frontend Developer', jobDescription: 'We need someone strong in GraphQL.' });
  assert.equal(r.status, 201, r.text);
  const a = r.body.analysis;
  assert.equal(a.targetKind, 'custom-jd');
  assert.equal(a.jobDescriptionProvided, true);
  assert.equal(a.requirements.find((q) => q.skill === 'GraphQL').source, 'job-text');
  assert.equal(a.requirements.find((q) => q.skill === 'Next.js').source, 'ai-role');
  assert.deepEqual(a.result.missing.map((m) => m.skill).sort(), ['GraphQL', 'Next.js']);
  assert.equal(a.score.value, 0);
});

test('one Summary contract: the analysis list, the roadmap overview and compare return identical analysis summaries', async () => {
  const u = await newUser();
  const rid = (await upload(u.token, 'sum.txt', RESUME)).resume._id;
  const tasks = [{ id: 't1', skill: 'Docker', objective: 'Containerise an app.', activity: 'Write a Dockerfile.', exercise: 'Containerise a small API.', completionCriteria: 'The app runs from an image.' }];
  setAi({ response: { ...AI_OK, tasks } });
  try {
    const created = await post(u.token, '/skill-gap/resume', { resumeId: rid, jobId });
    assert.equal(created.status, 201, created.text);
    const id = created.body.analysis._id;
    assert.equal((await post(u.token, `/skill-gap/${id}/roadmap`, {})).status, 201);

    const fromList = (await get(u.token, '/skill-gap?limit=50')).body.analyses.find((x) => x._id === id);
    const fromOverview = (await get(u.token, '/skill-gap/overview')).body.latestAnalysis;
    const fromCompare = (await get(u.token, `/skill-gap/compare?a=${id}&b=${id}`)).body.a;
    assert.ok(fromList.hasRoadmap && fromList.roadmapId);
    assert.deepEqual(fromOverview, fromList, 'roadmap overview summary must equal the analysis list summary');
    assert.deepEqual(fromCompare, fromList, 'compare summary must equal the analysis list summary');
    assert.deepEqual(Object.keys(fromOverview).sort(), Object.keys(fromList).sort());
    // the full view embeds the same summary fields
    const full = (await get(u.token, `/skill-gap/${id}`)).body.analysis;
    // (the full view's `score` is a superset of the summary's {value, method}: it adds coverage and counts)
    for (const k of Object.keys(fromList).filter((x) => x !== 'score')) assert.deepEqual(full[k], fromList[k], `full.${k}`);
    assert.deepEqual({ value: full.score.value, method: full.score.method }, fromList.score);
    // the internal lock field never appears in any response
    assert.ok(![JSON.stringify(fromList), JSON.stringify(full)].some((t) => t.includes('roadmapLock')));
  } finally { setAi({ response: AI_OK }); }
});
