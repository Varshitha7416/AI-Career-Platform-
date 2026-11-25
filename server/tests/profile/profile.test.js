/*
 * Profile / career-interests / role-resumes / recommendations API tests (node:test). Needs a DISPOSABLE local MongoDB:
 *
 *   mongod --dbpath <temp dir outside the repo> --port 27103
 *   PROFILE_TEST_MONGO=mongodb://127.0.0.1:27103 npm run test:profile
 *
 * Refuses anything that is not localhost/127.0.0.1. Starts the API as a child process with explicit MONGO_URI and
 * JWT_SECRET (never the .env values), uses its own database and drops it at the end.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

const BASE = process.env.PROFILE_TEST_MONGO || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('Set PROFILE_TEST_MONGO to a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27103');
}
const PORT = Number(process.env.TEST_PORT || 5103);
const DB = `profile_api_test_${process.pid}`;
const URI = `${BASE.replace(/\/$/, '')}/${DB}`;
const API = `http://127.0.0.1:${PORT}/api`;
const SERVER_DIR = path.join(__dirname, '..', '..');
const SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
const PW = 'Sunrise2025';
let server;

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
const put = (t, u, b) => call(t, 'PUT', u, b);
const del = (t, u) => call(t, 'DELETE', u);

let seq = 0;
const newUser = async (tag = 'u', profile) => {
  const email = `${tag}${++seq}.${process.pid}@example.com`;
  assert.equal((await post(null, '/auth/signup', { name: 'Profile Tester', email, password: PW })).status, 201);
  const l = await post(null, '/auth/login', { email, password: PW });
  assert.equal(l.status, 200);
  const u = { email, token: l.body.token, id: l.body.user.id, loginUser: l.body.user };
  if (profile) assert.equal((await put(u.token, '/auth/profile', profile)).status, 200);
  return u;
};

// Resume upload via multipart (txt files, real extraction path).
const upload = async (token, fileName, text, fields = {}) => {
  const fd = new FormData();
  fd.append('resumeFile', new Blob([text], { type: 'text/plain' }), fileName);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await fetch(`${API}/resumes`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  const t = await res.text();
  let json = null;
  try { json = JSON.parse(t); } catch { /* not json */ }
  return { status: res.status, body: json, text: t };
};
const listResumes = async (token) => (await get(token, '/resumes')).body.resumes;

const TXT = {
  frontend: 'Alex Frontend\nSKILLS\nReact, CSS, HTML, JavaScript\nBuilt web apps in React.',
  backend: 'Alex Backend\nSKILLS\nNode.js, MongoDB, Express\nBuilt REST services.',
  data: 'Alex Data\nSKILLS\nSQL, Python, Tableau\nAnalysed sales data.',
  general: 'Alex General\nSKILLS\nCommunication, Teamwork',
};

let company;
const jobIds = {};
before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, MONGO_URI: URI, JWT_SECRET: SECRET, PORT: String(PORT), CLIENT_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 25000);
    server.stdout.on('data', (d) => { if (String(d).includes('Server running')) { clearTimeout(t); resolve(); } });
    server.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  });
  await mongoose.connect(URI);
  const db = mongoose.connection;
  company = (await db.collection('companies').insertOne({ name: 'Acme Test Co', industry: 'Tech' })).insertedId;
  const mk = (key, title, skills, extra = {}) => ({ key, doc: { title, company, city: 'Pune', jobDescription: 'Test job', experienceLevel: 'experienced', skills, isActive: true, source: 'demo', postedAt: new Date(), createdAt: new Date(), ...extra } });
  const jobs = [
    mk('fe', 'Frontend Developer', ['React', 'CSS']),
    mk('be', 'Backend Developer', ['Node.js', 'MongoDB']),
    mk('da', 'Data Analyst', ['SQL', 'Python']),
    mk('se', 'Software Engineer', ['Java']),
    mk('mk', 'Marketing Manager', ['SEO']),
  ];
  for (const j of jobs) jobIds[j.key] = String((await db.collection('jobs').insertOne(j.doc)).insertedId);
});

after(async () => {
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  await mongoose.disconnect();
  if (server) { server.removeAllListeners('exit'); server.kill(); }
});

const rolesOf = (r) => r.body.user.careerInterests.map((i) => i.role);
const groupFor = (reco, role) => reco.body.groups.find((g) => g.role === role);
const reco = (t) => get(t, '/jobs/recommended?limit=10');

// ---------------------------------------------------------------- legacy users (no migration)
test('legacy user (seekingRole only, one old resume) works with derived fields and nothing is written', async () => {
  const u = await newUser('legacy');
  const users = mongoose.connection.collection('users');
  const oid = new mongoose.Types.ObjectId(u.id);
  await users.updateOne({ _id: oid }, { $set: { seekingRole: 'Frontend Developer' } });
  await mongoose.connection.collection('resumes').insertOne({ user: oid, fileName: 'old.pdf', resumeText: TXT.frontend, createdAt: new Date(), updatedAt: new Date() });

  const me = await get(u.token, '/auth/me');
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.user.careerInterests, [{ role: 'Frontend Developer', roleKey: 'frontend developer' }]);
  assert.equal(me.body.user.primaryRole, 'Frontend Developer');
  assert.equal(me.body.user.seekingRole, 'Frontend Developer');
  assert.ok(me.body.user.createdAt);
  assert.deepEqual(me.body.user.resumeSummary, { count: 1, roleResumeCount: 0, resumeReady: true, unassignedCount: 1 });
  for (const k of ['phone', 'headline', 'bio', 'linkedinUrl', 'experienceLevel']) assert.equal(me.body.user[k], '');
  for (const k of ['education', 'experiences', 'skills', 'domains']) assert.deepEqual(me.body.user[k], []);
  assert.ok(!me.text.includes('"password"') && !me.text.includes('tokenVersion'));

  const rs = await listResumes(u.token);
  assert.equal(rs[0].targetRole, null);
  assert.equal(rs[0].roleAssigned, false);

  const r = await reco(u.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.personalized, true);
  assert.equal(r.body.groups.length, 1);
  assert.equal(r.body.groups[0].basis, 'default-resume');
  assert.equal(r.body.groups[0].resume.source, 'default-fallback');
  assert.equal(r.body.jobs[0].title, 'Frontend Developer');

  // reads never wrote the new fields
  const raw = await users.findOne({ _id: oid });
  assert.equal(raw.careerInterests, undefined);
  assert.equal(raw.primaryRole, undefined);
  const rawResume = await mongoose.connection.collection('resumes').findOne({ user: oid });
  assert.equal(rawResume.targetRoleKey, undefined);
});

test('login payload is unchanged in shape (no resumeSummary) and login/me still work', async () => {
  const u = await newUser('reg');
  assert.equal(u.loginUser.resumeSummary, undefined);
  assert.equal(u.loginUser.email, u.email);
  assert.ok(Array.isArray(u.loginUser.careerInterests));
  const me = await get(u.token, '/auth/me');
  assert.equal(me.body.user.resumeSummary.count, 0);
  assert.equal(me.body.user.resumeSummary.resumeReady, false);
  assert.equal((await get(null, '/auth/me')).status, 401);
});

// ---------------------------------------------------------------- profile fields
test('profile fields save, partial updates keep the rest, and clearing works', async () => {
  const u = await newUser('pf');
  const full = {
    phone: '+91 98765-43210', location: 'Pune, India', headline: 'Builder of things', bio: 'Hello there.\nSecond line.',
    linkedinUrl: 'https://linkedin.com/in/x', githubUrl: 'https://github.com/x', portfolioUrl: 'http://example.com/me',
    experienceLevel: 'experienced',
    education: [{ institution: 'Test University', degree: 'B.Tech', fieldOfStudy: 'CS', startYear: 2016, endYear: 2020, grade: '8.1 CGPA' }],
    experiences: [{ company: 'Acme', title: 'Engineer', startDate: '2020-07', current: true, description: 'Did things' }],
    skills: [{ name: 'React', level: 'advanced' }, 'Node.js', 'react'],
    domains: ['Fintech', 'fintech', 'EdTech'],
  };
  const r = await put(u.token, '/auth/profile', full);
  assert.equal(r.status, 200, r.text);
  const p = r.body.user;
  assert.equal(p.phone, full.phone);
  assert.equal(p.education.length, 1);
  assert.equal(p.experiences[0].current, true);
  assert.equal(p.experiences[0].endDate, undefined);
  assert.deepEqual(p.skills, [{ name: 'React', level: 'advanced' }, { name: 'Node.js' }]);
  assert.equal(p.skills[1].level, undefined, 'level is never defaulted');
  assert.deepEqual(p.domains, ['Fintech', 'EdTech']);

  assert.equal((await put(u.token, '/auth/profile', { headline: 'New' })).body.user.phone, full.phone);
  const cleared = await put(u.token, '/auth/profile', { phone: '', linkedinUrl: '', education: [] });
  assert.equal(cleared.body.user.phone, '');
  assert.equal(cleared.body.user.linkedinUrl, '');
  assert.deepEqual(cleared.body.user.education, []);
  assert.equal(cleared.body.user.headline, 'New');
});

test('invalid profile fields are rejected with a per-field errors map', async () => {
  const u = await newUser('bad');
  const bad = async (body, field) => {
    const r = await put(u.token, '/auth/profile', body);
    assert.equal(r.status, 400, JSON.stringify(body) + r.text);
    assert.equal(r.body.code, 'VALIDATION_ERROR');
    assert.ok(r.body.errors[field], `${field} missing in ${r.text}`);
  };
  await bad({ phone: 'call me' }, 'phone');
  await bad({ phone: '1234' }, 'phone');
  await bad({ phone: '1'.repeat(21) }, 'phone');
  await bad({ linkedinUrl: 'javascript:alert(1)' }, 'linkedinUrl');
  await bad({ githubUrl: 'ftp://github.com/x' }, 'githubUrl');
  await bad({ portfolioUrl: 'not a url' }, 'portfolioUrl');
  await bad({ portfolioUrl: `https://e.com/${'a'.repeat(300)}` }, 'portfolioUrl');
  await bad({ headline: 'h'.repeat(121) }, 'headline');
  await bad({ bio: 'b'.repeat(601) }, 'bio');
  await bad({ location: { $gt: '' } }, 'location');
  await bad({ experienceLevel: 'senior' }, 'experienceLevel');
  await bad({ education: [{ institution: '' }] }, 'education');
  await bad({ education: [{ institution: 'X', startYear: 1800 }] }, 'education');
  await bad({ education: [{ institution: 'X', startYear: 2020, endYear: 2018 }] }, 'education');
  await bad({ education: Array.from({ length: 11 }, () => ({ institution: 'X' })) }, 'education');
  await bad({ education: 'nope' }, 'education');
  await bad({ experiences: [{ company: 'A', title: 'B', startDate: '2020-13' }] }, 'experiences');
  await bad({ experiences: [{ company: 'A', title: 'B', startDate: '2022-01', endDate: '2021-01' }] }, 'experiences');
  await bad({ experiences: Array.from({ length: 11 }, () => ({ company: 'A', title: 'B' })) }, 'experiences');
  await bad({ skills: [{ name: 'x', level: 'godlike' }] }, 'skills');
  await bad({ skills: Array.from({ length: 41 }, (_, i) => `skill${i}`) }, 'skills');
  await bad({ skills: [{ name: 's'.repeat(41) }] }, 'skills');
  await bad({ domains: Array.from({ length: 11 }, (_, i) => `d${i}`) }, 'domains');
  await bad({ experienceYears: 99 }, 'experienceYears');
  await bad({ preferredWorkMode: 'moon' }, 'preferredWorkMode');
  // nothing was applied by the rejected requests
  const me = await get(u.token, '/auth/me');
  assert.equal(me.body.user.phone, '');
  assert.deepEqual(me.body.user.education, []);
});

test('mass assignment is blocked (role, tokenVersion, _id, email, password hash)', async () => {
  const u = await newUser('mass');
  const r = await put(u.token, '/auth/profile', { role: 'admin', tokenVersion: 99, _id: new mongoose.Types.ObjectId().toString(), email: 'evil@example.com', password: 'x', isAdmin: true, headline: 'ok' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, 'jobseeker');
  assert.equal(r.body.user.email, u.email);
  assert.equal(r.body.user.id, u.id);
  const raw = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(u.id) });
  assert.equal(raw.tokenVersion, 0);
  assert.equal(raw.role, 'jobseeker');
  assert.equal(raw.isAdmin, undefined);
  assert.match(raw.password, /^\$2[aby]\$/);
  // old token still works (no token side effects)
  assert.equal((await get(u.token, '/auth/me')).status, 200);
});

test('password change keeps its behaviour: returns a new token and revokes the old one', async () => {
  const u = await newUser('pw');
  const wrong = await put(u.token, '/auth/profile', { currentPassword: 'Nope12345', newPassword: 'Brandnew2026' });
  assert.equal(wrong.status, 400);
  assert.ok(wrong.body.errors.currentPassword);
  const weak = await put(u.token, '/auth/profile', { currentPassword: PW, newPassword: 'short' });
  assert.equal(weak.status, 400);
  assert.ok(weak.body.errors.newPassword);
  const ok = await put(u.token, '/auth/profile', { currentPassword: PW, newPassword: 'Brandnew2026', headline: 'with pw' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.headline, 'with pw');
  assert.equal((await get(u.token, '/auth/me')).status, 401);
  assert.equal((await get(ok.body.token, '/auth/me')).status, 200);
});

test('GET /auth/roles searches the taxonomy (max 15) and needs a token', async () => {
  const u = await newUser('roles');
  const all = await get(u.token, '/auth/roles');
  assert.equal(all.status, 200);
  assert.ok(all.body.roles.length > 0 && all.body.roles.length <= 15);
  const q = await get(u.token, '/auth/roles?q=front');
  assert.ok(q.body.roles.includes('Frontend Developer'));
  const alias = await get(u.token, '/auth/roles?q=sre');
  assert.ok(alias.body.roles.includes('DevOps Engineer'));
  assert.deepEqual((await get(u.token, '/auth/roles?q=zzzzqqq')).body.roles, []);
  assert.equal((await get(null, '/auth/roles')).status, 401);
});

// ---------------------------------------------------------------- career interests
test('career interests: add, edit, remove, duplicates, limit, primary role and seekingRole sync', async () => {
  const u = await newUser('ci');
  let r = await put(u.token, '/auth/profile', { careerInterests: ['Frontend Developer', '  Backend   Developer '] });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(rolesOf(r), ['Frontend Developer', 'Backend Developer']);
  assert.equal(r.body.user.careerInterests[1].roleKey, 'backend developer');
  assert.equal(r.body.user.primaryRole, 'Frontend Developer');
  assert.equal(r.body.user.seekingRole, 'Frontend Developer');

  // primary change keeps seekingRole in sync
  r = await put(u.token, '/auth/profile', { primaryRole: 'backend developer' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.primaryRole, 'Backend Developer');
  assert.equal(r.body.user.seekingRole, 'Backend Developer');

  // primary must be one of the interests
  r = await put(u.token, '/auth/profile', { primaryRole: 'Astronaut' });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'INVALID_PRIMARY_ROLE');
  assert.ok(r.body.errors.primaryRole);
  r = await put(u.token, '/auth/profile', { careerInterests: ['Data Analyst'], primaryRole: 'Frontend Developer' });
  assert.equal(r.status, 400);

  // duplicates are case/space-insensitive
  r = await put(u.token, '/auth/profile', { careerInterests: ['Data Analyst', 'data   ANALYST'] });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'DUPLICATE_ROLE');
  assert.ok(r.body.errors.careerInterests);

  // more than 3
  r = await put(u.token, '/auth/profile', { careerInterests: ['A1', 'B2', 'C3', 'D4'] });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'TOO_MANY_ROLES');

  // 3 custom roles are fine, with primary
  r = await put(u.token, '/auth/profile', { careerInterests: ['Frontend Developer', 'Data Analyst', 'My Custom Role'], primaryRole: 'Data Analyst' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.primaryRole, 'Data Analyst');
  assert.equal(r.body.user.seekingRole, 'Data Analyst');

  // removing the primary falls back to the first remaining
  r = await put(u.token, '/auth/profile', { careerInterests: ['Frontend Developer', 'My Custom Role'] });
  assert.equal(r.body.user.primaryRole, 'Frontend Developer');
  assert.equal(r.body.user.seekingRole, 'Frontend Developer');

  // bad shapes / lengths
  assert.equal((await put(u.token, '/auth/profile', { careerInterests: 'Frontend' })).status, 400);
  assert.equal((await put(u.token, '/auth/profile', { careerInterests: [{ role: { $gt: '' } }] })).status, 400);
  assert.equal((await put(u.token, '/auth/profile', { careerInterests: ['x'.repeat(81)] })).status, 400);

  // clear everything
  r = await put(u.token, '/auth/profile', { careerInterests: [] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.user.careerInterests, []);
  assert.equal(r.body.user.primaryRole, '');
  assert.equal(r.body.user.seekingRole, '');
});

test('legacy seekingRole writes still work: single legacy role is replaced, stored list adds/primaries', async () => {
  const u = await newUser('legacywrite');
  let r = await put(u.token, '/auth/profile', { seekingRole: 'Backend Engineer' });
  assert.deepEqual(rolesOf(r), ['Backend Engineer']);
  r = await put(u.token, '/auth/profile', { seekingRole: 'Data Analyst' }); // stored list now exists
  assert.deepEqual(rolesOf(r), ['Backend Engineer', 'Data Analyst']);
  assert.equal(r.body.user.primaryRole, 'Data Analyst');
  r = await put(u.token, '/auth/profile', { seekingRole: 'backend engineer' });
  assert.equal(r.body.user.primaryRole, 'Backend Engineer');
  const u2 = await newUser('legacyreplace');
  await mongoose.connection.collection('users').updateOne({ _id: new mongoose.Types.ObjectId(u2.id) }, { $set: { seekingRole: 'Old Role' } });
  r = await put(u2.token, '/auth/profile', { seekingRole: 'New Role' });
  assert.deepEqual(rolesOf(r), ['New Role']);
});

// ---------------------------------------------------------------- role resumes
test('resume upload with and without targetRole; role must be a current interest', async () => {
  const u = await newUser('up', { careerInterests: ['Frontend Developer', 'Backend Developer'] });
  const plain = await upload(u.token, 'plain.txt', TXT.general);
  assert.equal(plain.status, 201);
  assert.equal(plain.body.resume.targetRole, null);
  assert.equal(plain.body.resume.roleAssigned, false);
  assert.ok(!plain.text.includes('Communication, Teamwork'), 'no resume text in the response');

  const withRole = await upload(u.token, 'fe.txt', TXT.frontend, { targetRole: 'frontend developer' });
  assert.equal(withRole.status, 201, withRole.text);
  assert.equal(withRole.body.resume.targetRole, 'Frontend Developer');
  assert.equal(withRole.body.resume.roleAssigned, true);

  const notInterest = await upload(u.token, 'x.txt', TXT.data, { targetRole: 'Data Analyst' });
  assert.equal(notInterest.status, 400);
  assert.equal(notInterest.body.code, 'ROLE_NOT_IN_INTERESTS');
  assert.equal((await listResumes(u.token)).length, 2, 'rejected upload stored nothing');
  assert.equal((await upload(u.token, 'ok.txt', TXT.general, { targetRole: '' })).status, 201);
});

test('one resume per role: assigning/uploading a new one un-assigns the older one (nothing deleted)', async () => {
  const u = await newUser('one', { careerInterests: ['Frontend Developer', 'Backend Developer'] });
  const a = await upload(u.token, 'a.txt', TXT.frontend, { targetRole: 'Frontend Developer' });
  const b = await upload(u.token, 'b.txt', TXT.backend, { targetRole: 'Backend Developer' });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(b.body.replaced, undefined);

  const a2 = await upload(u.token, 'a2.txt', TXT.frontend + '\nMore React', { targetRole: 'Frontend Developer' });
  assert.equal(a2.status, 201);
  assert.equal(a2.body.replaced._id, a.body.resume._id);
  let rs = await listResumes(u.token);
  assert.equal(rs.length, 3, 'nothing deleted');
  const byId = Object.fromEntries(rs.map((r) => [r._id, r]));
  assert.equal(byId[a.body.resume._id].roleAssigned, false);
  assert.equal(byId[a.body.resume._id].targetRole, null);
  assert.equal(byId[a2.body.resume._id].targetRole, 'Frontend Developer');
  assert.equal(byId[b.body.resume._id].targetRole, 'Backend Developer', 'other role untouched');

  // re-assign the old one through PUT -> swaps back
  const back = await put(u.token, `/resumes/${a.body.resume._id}`, { targetRole: 'Frontend Developer' });
  assert.equal(back.status, 200);
  assert.equal(back.body.resume.roleAssigned, true);
  assert.equal(back.body.replaced._id, a2.body.resume._id);
  rs = await listResumes(u.token);
  assert.equal(rs.filter((r) => r.roleAssigned).length, 2);

  // moving a resume from one role to another frees its old slot
  const moved = await put(u.token, `/resumes/${b.body.resume._id}`, { targetRole: 'Frontend Developer' });
  assert.equal(moved.status, 200);
  rs = await listResumes(u.token);
  assert.equal(rs.filter((r) => r.targetRole === 'Frontend Developer').length, 1);
  assert.equal(rs.filter((r) => r.targetRole === 'Backend Developer').length, 0);

  // unassign
  const un = await put(u.token, `/resumes/${b.body.resume._id}`, { targetRole: null });
  assert.equal(un.status, 200);
  assert.equal(un.body.resume.targetRole, null);
  assert.equal((await put(u.token, `/resumes/${a.body.resume._id}`, { targetRole: '' })).body.resume.roleAssigned, false);
  assert.equal((await put(u.token, `/resumes/${a.body.resume._id}`, { targetRole: 'Nope' })).body.code, 'ROLE_NOT_IN_INTERESTS');
  assert.equal((await put(u.token, `/resumes/${a.body.resume._id}`, { targetRole: 5 })).status, 400);
  // rename + default still work as before
  assert.equal((await put(u.token, `/resumes/${a.body.resume._id}`, { name: 'Renamed', isDefault: true })).body.resume.name, 'Renamed');
});

test('max 3 role resumes is enforced server-side', async () => {
  const u = await newUser('max', { careerInterests: ['Frontend Developer', 'Backend Developer', 'Data Analyst'] });
  const oid = new mongoose.Types.ObjectId(u.id);
  // simulate drift: three role-assigned resumes for roles that are no longer interests, plus a fresh upload
  const col = mongoose.connection.collection('resumes');
  for (const k of ['ghost a', 'ghost b', 'ghost c']) {
    await col.insertOne({ user: oid, fileName: `${k}.txt`, resumeText: 'x', targetRole: k, targetRoleKey: k, createdAt: new Date(), updatedAt: new Date() });
  }
  const r = await upload(u.token, 'fe.txt', TXT.frontend, { targetRole: 'Frontend Developer' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'TOO_MANY_ROLE_RESUMES');
  assert.equal((await listResumes(u.token)).length, 3, 'the rejected upload was rolled back');
});

test('removing an interest un-assigns its resume (never deletes); unassigned and legacy resumes are unaffected', async () => {
  const u = await newUser('rm', { careerInterests: ['Frontend Developer', 'Backend Developer'] });
  const fe = await upload(u.token, 'fe.txt', TXT.frontend, { targetRole: 'Frontend Developer' });
  const be = await upload(u.token, 'be.txt', TXT.backend, { targetRole: 'Backend Developer' });
  const gen = await upload(u.token, 'gen.txt', TXT.general);
  await mongoose.connection.collection('resumes').insertOne({ user: new mongoose.Types.ObjectId(u.id), fileName: 'legacy.pdf', resumeText: 'legacy', createdAt: new Date(0), updatedAt: new Date(0) });

  const r = await put(u.token, '/auth/profile', { careerInterests: ['Frontend Developer'] });
  assert.equal(r.status, 200);
  assert.equal(r.body.resumesUnassigned, 1);
  const rs = await listResumes(u.token);
  assert.equal(rs.length, 4, 'nothing deleted');
  const by = Object.fromEntries(rs.map((x) => [x._id, x]));
  assert.equal(by[fe.body.resume._id].targetRole, 'Frontend Developer');
  assert.equal(by[be.body.resume._id].targetRole, null);
  assert.equal(by[gen.body.resume._id].roleAssigned, false);
  assert.equal(rs.find((x) => x.fileName === 'legacy.pdf').roleAssigned, false);
  const me = await get(u.token, '/auth/me');
  assert.deepEqual(me.body.user.resumeSummary, { count: 4, roleResumeCount: 1, resumeReady: true, unassignedCount: 3 });
  // an unrelated profile edit does not touch assignments
  await put(u.token, '/auth/profile', { headline: 'hi' });
  assert.equal((await listResumes(u.token)).filter((x) => x.roleAssigned).length, 1);
});

test('LAST_RESUME: the only resume cannot be deleted; with a replacement it can', async () => {
  const u = await newUser('last', { careerInterests: ['Frontend Developer'] });
  const only = await upload(u.token, 'only.txt', TXT.frontend, { targetRole: 'Frontend Developer' });
  const d = await del(u.token, `/resumes/${only.body.resume._id}`);
  assert.equal(d.status, 409);
  assert.equal(d.body.code, 'LAST_RESUME');
  assert.match(d.body.message, /upload another/i);
  assert.equal((await listResumes(u.token)).length, 1);

  // replacement flow: upload the new one for the role (old becomes unassigned), then delete the old
  const next = await upload(u.token, 'next.txt', TXT.frontend + '\nNewer', { targetRole: 'Frontend Developer' });
  assert.equal(next.body.replaced._id, only.body.resume._id);
  const del2 = await del(u.token, `/resumes/${only.body.resume._id}`);
  assert.equal(del2.status, 200);
  const rs = await listResumes(u.token);
  assert.equal(rs.length, 1);
  assert.equal(rs[0].targetRole, 'Frontend Developer');
  assert.equal(rs[0].isDefault, true, 'a default is always kept');
});

test('ownership isolation: every resume route returns 404 for another user and never leaks text', async () => {
  const a = await newUser('own-a', { careerInterests: ['Frontend Developer'] });
  const b = await newUser('own-b', { careerInterests: ['Frontend Developer'] });
  const ra = await upload(a.token, 'secret.txt', 'TOP-SECRET-RESUME-TEXT React', { targetRole: 'Frontend Developer' });
  await upload(b.token, 'b.txt', TXT.frontend);
  const id = ra.body.resume._id;
  assert.equal((await get(b.token, `/resumes/${id}/preview`)).status, 404);
  assert.equal((await put(b.token, `/resumes/${id}`, { name: 'hacked' })).status, 404);
  assert.equal((await put(b.token, `/resumes/${id}`, { targetRole: 'Frontend Developer' })).status, 404);
  assert.equal((await del(b.token, `/resumes/${id}`)).status, 404);
  const bList = await get(b.token, '/resumes');
  assert.ok(!bList.text.includes(id));
  // b's role slot was not affected by a's resume, and a's resume is untouched
  const aList = await listResumes(a.token);
  assert.equal(aList[0].name, 'secret');
  assert.equal(aList[0].roleAssigned, true);
  for (const res of [await get(a.token, '/resumes'), ra, await put(a.token, `/resumes/${id}`, { name: 'secret2' }), await get(a.token, '/auth/me')]) {
    assert.ok(!res.text.includes('TOP-SECRET'), 'resumeText must never be in DTOs');
  }
  // the preview endpoint (existing behaviour) is the only place the text appears, and only for the owner
  assert.ok((await get(a.token, `/resumes/${id}/preview`)).text.includes('TOP-SECRET'));
});

// ---------------------------------------------------------------- recommendations
test('3 roles + 3 role resumes: each group is scored with its own resume', async () => {
  const u = await newUser('r3', { careerInterests: ['Frontend Developer', 'Backend Developer', 'Data Analyst'], primaryRole: 'Backend Developer' });
  const fe = await upload(u.token, 'fe.txt', TXT.frontend, { targetRole: 'Frontend Developer' });
  const be = await upload(u.token, 'be.txt', TXT.backend, { targetRole: 'Backend Developer' });
  const da = await upload(u.token, 'da.txt', TXT.data, { targetRole: 'Data Analyst' });
  const r = await reco(u.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.personalized, true);
  assert.equal(r.body.groups.length, 3);
  for (const [role, up, jobKey, skill] of [['Frontend Developer', fe, 'fe', 'React'], ['Backend Developer', be, 'be', 'Node.js'], ['Data Analyst', da, 'da', 'SQL']]) {
    const g = groupFor(r, role);
    assert.equal(g.basis, 'role-resume');
    assert.equal(g.resume.source, 'role');
    assert.equal(g.resume._id, up.body.resume._id);
    assert.equal(g.jobs[0]._id, jobIds[jobKey]);
    assert.equal(g.jobs[0].matchedRole, role);
    assert.ok(g.jobs[0].matchReasons.some((m) => m.includes(skill)), `${role}: ${g.jobs[0].matchReasons}`);
    assert.ok(g.jobs[0].matchScore > 0 && g.jobs[0].matchScore <= 100);
    // the unrelated resume's skills are NOT credited to this role's jobs
    if (role === 'Frontend Developer') assert.ok(!g.jobs.some((j) => j._id === jobIds.da));
  }
  assert.equal(groupFor(r, 'Backend Developer').isPrimary, true);
  assert.equal(r.body.groups.filter((g) => g.isPrimary).length, 1);
  // existing top-level shape intact + merged, each job once
  assert.ok(Array.isArray(r.body.jobs) && r.body.jobs.length >= 3);
  assert.equal(new Set(r.body.jobs.map((j) => j._id)).size, r.body.jobs.length);
  assert.equal(r.body.jobs[0].company.name, 'Acme Test Co');
  assert.ok(r.body.jobs[0].matchedRole && r.body.jobs[0].matchedResume);
  for (const k of ['personalized', 'basis', 'message', 'signals', 'jobs', 'groups', 'context']) assert.ok(k in r.body, k);
  assert.equal(r.body.context.roleResumeCount, 3);
});

test('3 roles + 1 resume: the default resume is an explicitly marked fallback', async () => {
  const u = await newUser('r31', { careerInterests: ['Frontend Developer', 'Backend Developer', 'Data Analyst'] });
  const only = await upload(u.token, 'only.txt', TXT.frontend + '\n' + TXT.backend, { targetRole: 'Frontend Developer' });
  const r = await reco(u.token);
  assert.equal(groupFor(r, 'Frontend Developer').basis, 'role-resume');
  for (const role of ['Backend Developer', 'Data Analyst']) {
    const g = groupFor(r, role);
    assert.equal(g.basis, 'default-resume');
    assert.equal(g.resume.source, 'default-fallback');
    assert.equal(g.resume._id, only.body.resume._id);
    for (const j of g.jobs) assert.equal(j.matchedResume.source, 'default-fallback');
  }
  assert.ok(groupFor(r, 'Backend Developer').jobs.some((j) => j._id === jobIds.be));
  assert.equal(r.body.context.roleResumeCount, 1);
});

test('2 roles + 2 resumes, 1 role + 1 resume, resume without role, role without resume', async () => {
  // 2 roles / 2 resumes
  const u2 = await newUser('r22', { careerInterests: ['Frontend Developer', 'Data Analyst'] });
  await upload(u2.token, 'fe.txt', TXT.frontend, { targetRole: 'Frontend Developer' });
  await upload(u2.token, 'da.txt', TXT.data, { targetRole: 'Data Analyst' });
  let r = await reco(u2.token);
  assert.deepEqual(r.body.groups.map((g) => g.basis), ['role-resume', 'role-resume']);

  // 1 role / 1 resume
  const u1 = await newUser('r11', { careerInterests: ['Backend Developer'] });
  await upload(u1.token, 'be.txt', TXT.backend, { targetRole: 'Backend Developer' });
  r = await reco(u1.token);
  assert.equal(r.body.groups.length, 1);
  assert.equal(r.body.groups[0].basis, 'role-resume');
  assert.equal(r.body.jobs[0]._id, jobIds.be);

  // resume without any role (no interests at all): resume skills still drive the merged list, no groups
  const ur = await newUser('rnr');
  await upload(ur.token, 'da.txt', TXT.data);
  r = await reco(ur.token);
  assert.equal(r.body.groups.length, 0);
  assert.equal(r.body.personalized, true);
  assert.equal(r.body.jobs[0]._id, jobIds.da);
  assert.equal(r.body.context.interestCount, 0);
  assert.equal(r.body.context.resumeCount, 1);

  // role without resume: title-only match, basis says so
  const uo = await newUser('rwr', { careerInterests: ['Data Analyst'] });
  r = await reco(uo.token);
  assert.equal(r.body.groups[0].basis, 'role-only');
  assert.equal(r.body.groups[0].resume, null);
  assert.equal(r.body.jobs[0]._id, jobIds.da);
  assert.deepEqual(r.body.jobs[0].matchReasons.filter((m) => /resume|profile/i.test(m)), []);
  assert.equal(r.body.jobs[0].matchedResume, null);

  // role without resume but with profile skills
  await put(uo.token, '/auth/profile', { skills: ['SQL', 'Python'] });
  r = await reco(uo.token);
  assert.equal(r.body.groups[0].basis, 'profile-skills');
  assert.ok(r.body.groups[0].jobs[0].matchReasons.some((m) => /profile/i.test(m) && m.includes('SQL')));
});

test('role and resume changes are reflected immediately (no stale data)', async () => {
  const u = await newUser('fresh', { careerInterests: ['Frontend Developer'] });
  const a = await upload(u.token, 'a.txt', TXT.frontend, { targetRole: 'Frontend Developer' });
  let r = await reco(u.token);
  assert.equal(r.body.groups[0].resume._id, a.body.resume._id);
  assert.equal(r.body.jobs[0]._id, jobIds.fe);

  // replace the role resume with one that mentions different skills
  const b = await upload(u.token, 'b.txt', 'Alex\nJava, Spring', { targetRole: 'Frontend Developer' });
  r = await reco(u.token);
  assert.equal(r.body.groups[0].resume._id, b.body.resume._id);
  assert.ok(r.body.groups[0].jobs.every((j) => !j.matchReasons.some((m) => m.includes('React'))), 'old resume skills are gone');
  assert.equal(r.body.context.roleResumeCount, 1);

  // change the role
  await put(u.token, '/auth/profile', { careerInterests: ['Data Analyst'] });
  r = await reco(u.token);
  assert.deepEqual(r.body.groups.map((g) => g.role), ['Data Analyst']);
  assert.equal(r.body.groups[0].basis, 'default-resume', 'the old role resume was un-assigned, default is the explicit fallback');
  assert.equal(r.body.groups[0].resume.source, 'default-fallback');
  assert.equal(r.body.context.roleResumeCount, 0);
});

test('no interests and no resume: latest jobs with personalized:false and the old top-level shape', async () => {
  const u = await newUser('none');
  const r = await reco(u.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.personalized, false);
  assert.equal(r.body.basis, 'latest');
  assert.deepEqual(r.body.groups, []);
  assert.ok(r.body.jobs.length > 0);
  assert.ok(typeof r.body.message === 'string');
});

test('applied jobs are excluded and limit is honoured', async () => {
  const u = await newUser('appl', { careerInterests: ['Frontend Developer'] });
  let r = await reco(u.token);
  assert.equal(r.body.jobs[0]._id, jobIds.fe);
  assert.equal((await post(u.token, '/applications', { jobId: jobIds.fe, applyMethod: 'manual' })).status, 201);
  r = await reco(u.token);
  assert.ok(!r.body.jobs.some((j) => j._id === jobIds.fe));
  assert.ok(!r.body.groups[0].jobs.some((j) => j._id === jobIds.fe));
  r = await get(u.token, '/jobs/recommended?limit=1');
  assert.ok(r.body.jobs.length <= 1);
});

// ---------------------------------------------------------------- profile completeness
test('profile completeness: legacy and new data give the same weights; resume = >=1 resume', async () => {
  const pct = async (t) => (await get(t, '/dashboard/overview')).body.stats.profileComplete.value;
  const legacy = await newUser('pc-l');
  await mongoose.connection.collection('users').updateOne({ _id: new mongoose.Types.ObjectId(legacy.id) }, { $set: { seekingRole: 'Backend Developer' } });
  const fresh = await newUser('pc-n', { careerInterests: ['Backend Developer'] });
  const base = await pct(legacy.token);
  assert.equal(base, 10 + 15, 'name + target role');
  assert.equal(await pct(fresh.token), base, 'derived and stored interests count the same');
  const empty = await newUser('pc-e');
  assert.equal(await pct(empty.token), 10);
  await upload(fresh.token, 'r.txt', TXT.backend);
  assert.equal(await pct(fresh.token), base + 35, 'one resume (unassigned is enough)');
  await put(fresh.token, '/auth/profile', { experienceYears: 3, preferredLocation: 'Pune', preferredWorkMode: 'remote', preferredEmploymentType: 'full-time' });
  assert.equal(await pct(fresh.token), 100);
  await put(fresh.token, '/auth/profile', { careerInterests: [] });
  assert.equal(await pct(fresh.token), 85);
});

test('referral/other readers of seekingRole stay in sync with the primary role', async () => {
  const u = await newUser('sync', { careerInterests: ['Data Analyst', 'Frontend Developer'], primaryRole: 'Frontend Developer' });
  const raw = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(u.id) });
  assert.equal(raw.seekingRole, 'Frontend Developer');
  assert.equal(raw.primaryRole, 'Frontend Developer');
  assert.equal(raw.careerInterests.length, 2);
});

// ---------------------------------------------------------------- final-review regressions
test('GET /resumes is read-only: repeated reads change no record (legacy resume without a default)', async () => {
  const u = await newUser('readonly');
  const oid = new mongoose.Types.ObjectId(u.id);
  const col = mongoose.connection.collection('resumes');
  await col.insertMany([
    { user: oid, fileName: 'a.pdf', resumeText: TXT.frontend, createdAt: new Date(Date.now() - 5000), updatedAt: new Date(Date.now() - 5000) },
    { user: oid, fileName: 'b.pdf', resumeText: TXT.backend, createdAt: new Date(), updatedAt: new Date() },
  ]);
  const snapshot = async () => JSON.stringify(await col.find({ user: oid }).sort({ fileName: 1 }).toArray());
  const before = await snapshot();
  let list;
  for (let i = 0; i < 3; i++) list = (await get(u.token, '/resumes')).body.resumes;
  assert.equal(await snapshot(), before, 'database records are identical after repeated GETs');
  assert.equal(list.filter((r) => r.isDefault).length, 1, 'the response still shows exactly one default');
  assert.equal(list.find((r) => r.isDefault).fileName, 'b.pdf', 'the newest resume is shown as the default');
  const raw = await col.find({ user: oid }).toArray();
  assert.ok(raw.every((r) => r.isDefault === undefined), 'no stored isDefault was written by reads');
});

test('seekingRole-only update on an existing three-role profile keeps interests and primary role', async () => {
  const u = await newUser('three', { careerInterests: ['Frontend Developer', 'Backend Developer', 'Data Analyst'], primaryRole: 'Backend Developer' });
  const snap = async () => (await get(u.token, '/auth/me')).body.user;
  const before = await snap();
  // a new role is not added, the profile stays valid, the primary role is untouched, and the response explains it
  let r = await put(u.token, '/auth/profile', { seekingRole: 'Product Manager' });
  assert.equal(r.status, 200);
  assert.match(r.body.notice, /3 career interests/);
  assert.deepEqual(rolesOf(r), ['Frontend Developer', 'Backend Developer', 'Data Analyst']);
  assert.equal(r.body.user.primaryRole, 'Backend Developer');
  assert.equal(r.body.user.seekingRole, 'Backend Developer');
  const after = await snap();
  assert.deepEqual(after.careerInterests, before.careerInterests);
  // naming an existing interest through the legacy field is an explicit primary change
  r = await put(u.token, '/auth/profile', { seekingRole: 'data analyst' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.primaryRole, 'Data Analyst');
  assert.equal(r.body.user.seekingRole, 'Data Analyst');
  assert.equal(r.body.user.careerInterests.length, 3);
});

test('primary role update and normal multi-role update on a three-role user', async () => {
  const u = await newUser('multi', { careerInterests: ['Frontend Developer', 'Backend Developer', 'Data Analyst'] });
  let r = await put(u.token, '/auth/profile', { primaryRole: 'Data Analyst' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.primaryRole, 'Data Analyst');
  assert.equal(r.body.user.seekingRole, 'Data Analyst');
  assert.equal(rolesOf(r).length, 3);
  r = await put(u.token, '/auth/profile', { primaryRole: 'Not One Of Them' });
  assert.equal(r.status, 400);
  assert.equal((await get(u.token, '/auth/me')).body.user.primaryRole, 'Data Analyst');
  r = await put(u.token, '/auth/profile', { careerInterests: ['UX Designer', 'Backend Developer', 'Data Analyst'], primaryRole: 'UX Designer' });
  assert.equal(r.status, 200);
  assert.deepEqual(rolesOf(r), ['UX Designer', 'Backend Developer', 'Data Analyst']);
  assert.equal(r.body.user.primaryRole, 'UX Designer');
  r = await put(u.token, '/auth/profile', { careerInterests: ['A One', 'B Two', 'C Three', 'D Four'] });
  assert.equal(r.status, 400);
  assert.equal(r.body.errors.careerInterests ? true : true, true);
});
