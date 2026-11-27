/*
 * Resume Analyzer history / compare / export API tests (node:test). No AI is called: analyses are inserted directly
 * (the AI service is out of scope for this suite). Disposable local DB, port 5241.
 *
 *   RESUME_HISTORY_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:resume-history
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./_harness');
const { compareAnalyses } = require('../../utils/resumeAnalysisCompare');

let H;
let M;
const U = {};
const D = {};

const mkAnalysis = (user, resume, extra = {}) => M.Analysis.create({
  user, resume: resume._id, type: 'general',
  resumeSnapshot: { name: resume.name, fileName: resume.fileName, fileType: 'pdf' },
  overallScore: 60, matchPercentage: null, summary: 'Summary text',
  strengths: ['Clear layout', 'Strong Python'], missingSkills: ['Docker'], suggestions: ['Add metrics: quantify results'],
  result: { overallScore: 60, matchingSkills: [{ skill: 'Python' }] },
  ...extra,
});

before(async () => {
  H = await startServer({ port: 5241, dbName: `careernest_b2a4_hist_${process.pid}` });
  M = {
    Resume: require('../../models/Resume'), Analysis: require('../../models/ResumeAnalysis'),
    Job: require('../../models/Job'), Company: require('../../models/Company'),
  };
  U.alice = await H.mkUser('alice');
  U.bob = await H.mkUser('bob');
  U.unverified = await H.mkUser('unv', { verified: false });
  D.r1 = await M.Resume.create({ user: U.alice.id, fileName: 'alice-one.pdf', name: 'Alice One', fileType: 'pdf', resumeText: 'text one' });
  D.r2 = await M.Resume.create({ user: U.alice.id, fileName: 'alice-two.pdf', name: 'Alice Two', fileType: 'pdf', resumeText: 'text two' });
  D.rb = await M.Resume.create({ user: U.bob.id, fileName: 'bob.pdf', name: 'Bob', fileType: 'pdf', resumeText: 'bob text' });
  const co = await M.Company.create({ name: 'HistCo' });
  D.job = await M.Job.create({ title: 'Backend Dev', company: co._id, city: 'Pune', jobDescription: 'desc', experienceLevel: 'fresher' });
  D.job2 = await M.Job.create({ title: 'Other Role', company: co._id, city: 'Pune', jobDescription: 'desc', experienceLevel: 'fresher' });

  D.gen1 = await mkAnalysis(U.alice.id, D.r1, { createdAt: new Date('2026-01-01') });
  D.gen2 = await mkAnalysis(U.alice.id, D.r1, {
    createdAt: new Date('2026-02-01'), overallScore: 72, strengths: ['Clear layout', 'Good projects'], missingSkills: [], suggestions: ['Add links: link your repos'],
    result: { overallScore: 72, matchingSkills: [{ skill: 'Python' }, { skill: 'SQL' }] },
  });
  D.jobA = await mkAnalysis(U.alice.id, D.r2, {
    type: 'job-specific', job: D.job._id, jobSnapshot: { title: 'Backend Dev', company: 'HistCo' }, overallScore: 70, matchPercentage: 55,
    missingSkills: ['Docker', 'Kubernetes'], createdAt: new Date('2026-03-01'),
  });
  D.jobB = await mkAnalysis(U.alice.id, D.r2, {
    type: 'job-specific', job: D.job._id, jobSnapshot: { title: 'Backend Dev', company: 'HistCo' }, overallScore: 80, matchPercentage: 75,
    missingSkills: ['Kubernetes', 'Redis'], createdAt: new Date('2026-04-01'),
  });
  // legacy document: no type, no snapshots, no result, no overallScore (older format)
  const legacy = await M.Analysis.collection.insertOne({
    user: new (require('mongoose').Types.ObjectId)(U.alice.id), resume: D.r1._id, matchPercentage: 40,
    missingSkills: ['Go'], strengths: ['Short and clear'], suggestions: ['Add summary'], createdAt: new Date('2025-12-01'), updatedAt: new Date('2025-12-01'),
  });
  D.legacyId = String(legacy.insertedId);
  D.bobA = await mkAnalysis(U.bob.id, D.rb);
});

after(async () => { if (H) await H.stop(); });

const A = (k) => String(D[k]._id);

test('list: existing contract (count, analyses, no result) plus pagination metadata; newest first; own only', async () => {
  const r = await H.call(U.alice.token, 'GET', '/resume-analysis');
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 5);
  assert.equal(r.body.total, 5);
  assert.equal(r.body.page, 1);
  assert.equal(r.body.analyses[0]._id, A('jobB'));
  assert.ok(r.body.analyses.every((a) => !('result' in a) && !('inputHash' in a)));
  assert.ok(!r.body.analyses.some((a) => a._id === A('bobA')));
  for (const k of ['_id', 'type', 'resume', 'resumeDeleted', 'job', 'jobDeleted', 'overallScore', 'matchPercentage', 'createdAt']) assert.ok(k in r.body.analyses[0], k);
});

test('list: pagination beyond the first page and filters by resume / type', async () => {
  let r = await H.call(U.alice.token, 'GET', '/resume-analysis?limit=2&page=2');
  assert.equal(r.body.count, 2);
  assert.equal(r.body.pages, 3);
  assert.equal(r.body.page, 2);
  r = await H.call(U.alice.token, 'GET', '/resume-analysis?limit=2&page=3');
  assert.equal(r.body.count, 1);
  assert.equal((await H.call(U.alice.token, 'GET', '/resume-analysis?page=0')).status, 400);
  r = await H.call(U.alice.token, 'GET', `/resume-analysis?resumeId=${D.r2._id}`);
  assert.equal(r.body.total, 2);
  r = await H.call(U.alice.token, 'GET', '/resume-analysis?type=general');
  assert.equal(r.body.total, 3); // gen1, gen2 and the legacy doc without a type
});

test('detail: own analysis opens with score, strengths, missing skills, suggestions; others get 404', async () => {
  let r = await H.call(U.alice.token, 'GET', `/resume-analysis/${A('gen2')}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.analysis.overallScore, 72);
  assert.deepEqual(r.body.analysis.strengths, ['Clear layout', 'Good projects']);
  assert.ok(Array.isArray(r.body.analysis.missingSkills) && Array.isArray(r.body.analysis.suggestions));
  r = await H.call(U.bob.token, 'GET', `/resume-analysis/${A('gen2')}`);
  assert.equal(r.status, 404);
  assert.equal((await H.call(U.alice.token, 'GET', `/resume-analysis/${A('bobA')}`)).status, 404);
  assert.equal((await H.call(null, 'GET', `/resume-analysis/${A('gen2')}`)).status, 401);
  assert.equal((await H.call(U.alice.token, 'GET', '/resume-analysis/not-an-id')).status, 400);
});

test('detail/list: legacy document without type, snapshot or result does not break (never 500)', async () => {
  const r = await H.call(U.alice.token, 'GET', `/resume-analysis/${D.legacyId}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.analysis.result, null);
  assert.equal(r.body.analysis.type, 'general');
});

test('unverified users can read history, detail and export, and POST is no longer blocked (optional email verification, docs/31)', async () => {
  assert.equal((await H.call(U.unverified.token, 'GET', '/resume-analysis')).status, 200);
  const u = await M.Resume.create({ user: U.unverified.id, fileName: 'u.pdf', name: 'U', fileType: 'pdf', resumeText: 't' });
  const a = await mkAnalysis(U.unverified.id, u);
  assert.equal((await H.call(U.unverified.token, 'GET', `/resume-analysis/${a._id}`)).status, 200);
  assert.equal((await H.call(U.unverified.token, 'GET', `/resume-analysis/${a._id}/export?format=pdf`, undefined, true)).status, 200);
  // Optional verification: POST is no longer gated. A deliberately invalid resumeId is used so the request is rejected by input
  // validation (400) BEFORE any AI call; the point is that it is not refused with 403 EMAIL_NOT_VERIFIED.
  const post = await H.call(U.unverified.token, 'POST', '/resume-analysis', { resumeId: 'not-an-id' });
  assert.equal(post.status, 400, JSON.stringify(post.body));
  assert.equal(post.body.message, 'A valid resumeId is required');
  assert.notEqual(post.body.code, 'EMAIL_NOT_VERIFIED');
});

test('compare: two job-specific analyses of the same job (deltas, missing skills resolved/new/unchanged)', async () => {
  const r = await H.call(U.alice.token, 'GET', `/resume-analysis/compare?a=${A('jobA')}&b=${A('jobB')}`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const c = r.body.comparison;
  assert.equal(c.scoreDelta, 10);
  assert.equal(c.matchDelta, 20);
  assert.equal(c.sameTarget, true);
  assert.equal(c.sameResume, true);
  assert.deepEqual(c.missingSkills.resolved, ['Docker']);
  assert.deepEqual(c.missingSkills.new, ['Redis']);
  assert.deepEqual(c.missingSkills.unchanged, ['Kubernetes']);
  assert.equal(c.a.resume, 'Alice Two');
  assert.ok(c.a.createdAt && c.b.createdAt);
});

test('compare: two general analyses (strengths gained/lost, matched skills, suggestions diff)', async () => {
  const r = await H.call(U.alice.token, 'GET', `/resume-analysis/compare?a=${A('gen1')}&b=${A('gen2')}`);
  const c = r.body.comparison;
  assert.equal(c.scoreDelta, 12);
  assert.equal(c.matchDelta, null);
  assert.deepEqual(c.strengths.gained, ['Good projects']);
  assert.deepEqual(c.strengths.lost, ['Strong Python']);
  assert.deepEqual(c.strengths.unchanged, ['Clear layout']);
  assert.deepEqual(c.matchedSkills.gained, ['SQL']);
  assert.deepEqual(c.suggestions.added, ['Add links: link your repos']);
  assert.ok(c.notes.some((n) => /no job match percentage/.test(n)));
});

test('compare: incompatible (general vs job-specific, different resumes, different jobs) explains the difference', async () => {
  const r = await H.call(U.alice.token, 'GET', `/resume-analysis/compare?a=${A('gen2')}&b=${A('jobB')}`);
  const c = r.body.comparison;
  assert.equal(c.matchDelta, null);
  assert.equal(c.scoreDelta, 8);
  assert.equal(c.sameTarget, false);
  assert.ok(c.notes.some((n) => /general/.test(n) && /job-specific/.test(n)), c.notes.join(' | '));
  assert.ok(c.notes.some((n) => /Different resumes/.test(n)));
});

test('compare: legacy analysis (no score, no result) compares only what is comparable', async () => {
  const r = await H.call(U.alice.token, 'GET', `/resume-analysis/compare?a=${D.legacyId}&b=${A('gen2')}`);
  assert.equal(r.status, 200);
  const c = r.body.comparison;
  assert.equal(c.scoreDelta, null);
  assert.equal(c.matchedSkills, null);
  assert.ok(c.notes.some((n) => /no readiness score/.test(n)));
  assert.ok(c.notes.some((n) => /older format/.test(n)));
  assert.deepEqual(c.missingSkills.resolved, ['Go']);
});

test('compare: validation and strict ownership (both ids must be the caller\'s)', async () => {
  assert.equal((await H.call(U.alice.token, 'GET', '/resume-analysis/compare?a=x&b=y')).status, 400);
  assert.equal((await H.call(U.alice.token, 'GET', `/resume-analysis/compare?a=${A('gen1')}`)).status, 400);
  assert.equal((await H.call(U.alice.token, 'GET', `/resume-analysis/compare?a=${A('gen1')}&b=${A('gen1')}`)).status, 400);
  assert.equal((await H.call(U.alice.token, 'GET', `/resume-analysis/compare?a=${A('gen1')}&b=${A('bobA')}`)).status, 404);
  assert.equal((await H.call(U.bob.token, 'GET', `/resume-analysis/compare?a=${A('gen1')}&b=${A('gen2')}`)).status, 404);
  assert.equal((await H.call(null, 'GET', `/resume-analysis/compare?a=${A('gen1')}&b=${A('gen2')}`)).status, 401);
});

test('export: valid PDF with attachment headers and sanitized filename', async () => {
  const evil = await M.Resume.create({ user: U.alice.id, fileName: 'x.pdf', name: '../Evil"; <b>name</b>\r\n', fileType: 'pdf', resumeText: 't' });
  const a = await mkAnalysis(U.alice.id, evil, { summary: '<script>alert(1)</script> rupee ₹ and — dash' });
  const r = await H.call(U.alice.token, 'GET', `/resume-analysis/${a._id}/export?format=pdf`, undefined, true);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  const cd = r.headers.get('content-disposition');
  assert.match(cd, /^attachment; filename="[A-Za-z0-9._-]+\.pdf"$/);
  assert.ok(!/\.\.|<|"[^;]*"[^;]*"/.test(cd.replace(/^attachment; filename="/, '').slice(0, -1)));
  assert.equal(r.buffer.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok(r.buffer.length > 1500, `size ${r.buffer.length}`);
  assert.ok(r.buffer.subarray(-32).toString('latin1').includes('%%EOF'));
});

test('export: ownership enforced, bad format rejected, default format is pdf', async () => {
  assert.equal((await H.call(U.bob.token, 'GET', `/resume-analysis/${A('gen1')}/export?format=pdf`, undefined, true)).status, 404);
  assert.equal((await H.call(null, 'GET', `/resume-analysis/${A('gen1')}/export?format=pdf`, undefined, true)).status, 401);
  assert.equal((await H.call(U.alice.token, 'GET', `/resume-analysis/${A('gen1')}/export?format=docx`)).status, 400);
  assert.equal((await H.call(U.alice.token, 'GET', `/resume-analysis/${A('gen1')}/export`, undefined, true)).status, 200);
  // legacy doc exports too
  assert.equal((await H.call(U.alice.token, 'GET', `/resume-analysis/${D.legacyId}/export?format=pdf`, undefined, true)).status, 200);
});

test('deleted resume and deleted job: list/detail/compare/export keep working with snapshots (never 500)', async () => {
  const r3 = await M.Resume.create({ user: U.alice.id, fileName: 'gone.pdf', name: 'Gone Resume', fileType: 'pdf', resumeText: 't' });
  const j3 = await M.Job.create({ title: 'Temp Job', company: (await M.Company.findOne({ name: 'HistCo' }))._id, city: 'X', jobDescription: 'd', experienceLevel: 'fresher' });
  const a = await mkAnalysis(U.alice.id, r3, { type: 'job-specific', job: j3._id, jobSnapshot: { title: 'Temp Job', company: 'HistCo' }, matchPercentage: 50 });
  // delete through the API (backfills snapshots) and delete the job directly
  const del = await H.call(U.alice.token, 'DELETE', `/resumes/${r3._id}`);
  assert.equal(del.status, 200, JSON.stringify(del.body));
  await M.Job.deleteOne({ _id: j3._id });

  let r = await H.call(U.alice.token, 'GET', `/resume-analysis/${a._id}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.analysis.resumeDeleted, true);
  assert.equal(r.body.analysis.resume, null);
  assert.equal(r.body.analysis.resumeSnapshot.name, 'Gone Resume');
  assert.equal(r.body.analysis.jobDeleted, true);
  assert.equal(r.body.analysis.jobSnapshot.title, 'Temp Job');

  r = await H.call(U.alice.token, 'GET', `/resume-analysis?resumeId=${r3._id}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 1);

  r = await H.call(U.alice.token, 'GET', `/resume-analysis/compare?a=${A('jobA')}&b=${a._id}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.comparison.notes.some((n) => /Resume no longer available/.test(n)));
  assert.equal(r.body.comparison.b.target, 'Temp Job - HistCo');

  r = await H.call(U.alice.token, 'GET', `/resume-analysis/${a._id}/export?format=pdf`, undefined, true);
  assert.equal(r.status, 200);
  assert.equal(r.buffer.subarray(0, 4).toString(), '%PDF');
});

test('unit: compareAnalyses is pure and treats a missing structure gracefully', () => {
  const c = compareAnalyses({ _id: 'a', strengths: [], missingSkills: [], suggestions: [] }, { _id: 'b', strengths: ['x'], missingSkills: ['y'], suggestions: [] });
  assert.equal(c.scoreDelta, null);
  assert.deepEqual(c.strengths.gained, ['x']);
  assert.ok(Array.isArray(c.notes) && c.notes.length > 0);
});
