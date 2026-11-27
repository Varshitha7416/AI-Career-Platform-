/*
 * Admin dashboard / job + company management API tests (node:test). Needs a LOCAL disposable MongoDB:
 *
 *   ADMIN_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:admin
 *
 * Refuses anything that is not localhost/127.0.0.1. Starts the API as a child process with explicit MONGO_URI and
 * JWT_SECRET (never the .env values), uses its own database (careernest_a2_*) and drops it at the end.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

const BASE = process.env.ADMIN_TEST_MONGO || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('Set ADMIN_TEST_MONGO to a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27017');
}
const PORT = Number(process.env.TEST_PORT || 5112);
const DB = `careernest_a2_admin_${process.pid}`;
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
  return { status: res.status, body: json };
};
const get = (t, u) => call(t, 'GET', u);
const post = (t, u, b) => call(t, 'POST', u, b);
const put = (t, u, b) => call(t, 'PUT', u, b);
const del = (t, u) => call(t, 'DELETE', u);

let seq = 0;
let admin;
let seeker;
const newUser = async (tag, extra = {}) => {
  const email = `${tag}${++seq}.${process.pid}@example.com`;
  const s = await post(null, '/auth/signup', { name: 'Admin Tester', email, password: PW, ...extra });
  assert.equal(s.status, 201, JSON.stringify(s.body));
  const l = await post(null, '/auth/login', { email, password: PW });
  assert.equal(l.status, 200);
  return { email, token: l.body.token, id: l.body.user.id };
};

const day = 24 * 3600 * 1000;
const future = (n = 30) => new Date(Date.now() + n * day).toISOString();

const validJob = (company, over = {}) => ({
  title: 'Platform Engineer', company, city: 'Pune', jobDescription: 'Build things', experienceLevel: 'experienced',
  experienceMinYears: 2, experienceMaxYears: 5, skills: ['Node.js', 'MongoDB'], category: 'Engineering', ...over,
});

let companyA;
let companyB;
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
  admin = await newUser('admin');
  await mongoose.connection.collection('users').updateOne({ email: admin.email }, { $set: { role: 'admin', emailVerified: true } });
  seeker = await newUser('seeker');
  companyA = String((await mongoose.connection.collection('companies').insertOne({ name: 'Alpha Systems', industry: 'Tech' })).insertedId);
  companyB = String((await mongoose.connection.collection('companies').insertOne({ name: 'Beta Labs', industry: 'Tech', isActive: false, archivedAt: new Date() })).insertedId);
});

after(async () => {
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  await mongoose.disconnect();
  if (server) { server.removeAllListeners('exit'); server.kill(); }
});

const ADMIN_ENDPOINTS = [
  ['GET', '/admin/overview'], ['GET', '/admin/activity'],
  ['GET', '/admin/jobs'], ['POST', '/admin/jobs'], ['GET', '/admin/jobs/507f1f77bcf86cd799439011'], ['PUT', '/admin/jobs/507f1f77bcf86cd799439011'],
  ['POST', '/admin/jobs/507f1f77bcf86cd799439011/activate'], ['POST', '/admin/jobs/507f1f77bcf86cd799439011/deactivate'],
  ['POST', '/admin/jobs/507f1f77bcf86cd799439011/close'], ['POST', '/admin/jobs/507f1f77bcf86cd799439011/reopen'],
  ['GET', '/admin/companies'], ['GET', '/admin/companies/options'], ['POST', '/admin/companies'], ['GET', '/admin/companies/507f1f77bcf86cd799439011'],
  ['PUT', '/admin/companies/507f1f77bcf86cd799439011'], ['POST', '/admin/companies/507f1f77bcf86cd799439011/archive'],
  ['POST', '/admin/companies/507f1f77bcf86cd799439011/restore'], ['DELETE', '/admin/companies/507f1f77bcf86cd799439011'],
];

test('every admin endpoint: 401 without a token, 403 for a non-admin', async () => {
  for (const [method, url] of ADMIN_ENDPOINTS) {
    const anon = await call(null, method, url, method === 'GET' ? undefined : {});
    assert.equal(anon.status, 401, `${method} ${url} anon`);
    const user = await call(seeker.token, method, url, method === 'GET' ? undefined : {});
    assert.equal(user.status, 403, `${method} ${url} seeker`);
  }
});

test('a client-supplied role cannot grant admin (signup body, profile update, headers)', async () => {
  const sneaky = await newUser('sneaky', { role: 'admin' });
  assert.equal((await get(sneaky.token, '/admin/overview')).status, 403);
  await put(sneaky.token, '/auth/profile', { role: 'admin' });
  assert.equal((await get(sneaky.token, '/admin/overview')).status, 403);
  const res = await fetch(`${API}/admin/overview`, { headers: { Authorization: `Bearer ${sneaky.token}`, 'X-User-Role': 'admin' } });
  assert.equal(res.status, 403);
  const me = await get(sneaky.token, '/auth/me');
  assert.notEqual(me.body.user.role, 'admin');
  assert.equal((await get(admin.token, '/auth/me')).body.user.role, 'admin');
});

test('company: create, validate, edit, list/search, options', async () => {
  let r = await post(admin.token, '/admin/companies', { name: 'A' });
  assert.equal(r.status, 400);
  r = await post(admin.token, '/admin/companies', { name: 'Gamma Works', website: 'javascript:alert(1)' });
  assert.equal(r.status, 400);
  r = await post(admin.token, '/admin/companies', { name: 'Gamma Works', logoUrl: 'ftp://x.test/l.png' });
  assert.equal(r.status, 400);
  r = await post(admin.token, '/admin/companies', { name: 'Gamma Works', industry: 'Retail', location: 'Delhi', size: '50-200', description: 'Shops', website: 'https://gamma.example.com', logoUrl: 'https://gamma.example.com/logo.png' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.company._id;
  assert.equal(r.body.company.isActive, true);
  assert.equal((await post(admin.token, '/admin/companies', { name: 'gamma works' })).status, 400, 'duplicate name (case-insensitive)');
  r = await put(admin.token, `/admin/companies/${id}`, { industry: 'E-commerce', website: 'not a url' });
  assert.equal(r.status, 400);
  r = await put(admin.token, `/admin/companies/${id}`, { industry: 'E-commerce' });
  assert.equal(r.status, 200);
  assert.equal(r.body.company.industry, 'E-commerce');
  r = await get(admin.token, '/admin/companies?q=gamma');
  assert.equal(r.body.total, 1);
  r = await get(admin.token, '/admin/companies?status=archived');
  assert.deepEqual(r.body.companies.map((c) => c.name), ['Beta Labs']);
  assert.equal((await get(admin.token, '/admin/companies?status=bogus')).status, 400);
  r = await get(admin.token, '/admin/companies/options');
  const names = r.body.companies.map((c) => c.name);
  assert.ok(names.includes('Alpha Systems') && names.includes('Gamma Works') && !names.includes('Beta Labs'));
});

test('job: validation (bad URL, bad ranges, bad dates, unknown/archived company)', async () => {
  const bad = async (over, fragment) => {
    const r = await post(admin.token, '/admin/jobs', validJob(companyA, over));
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.match(r.body.message, fragment);
  };
  await bad({ applyUrl: 'javascript:alert(1)' }, /Apply URL/);
  await bad({ applyUrl: 'ftp://x.test/job' }, /Apply URL/);
  await bad({ experienceMinYears: 5, experienceMaxYears: 2 }, /Maximum experience/);
  await bad({ salaryMin: 20, salaryMax: 10 }, /Maximum salary/);
  await bad({ applicationDeadline: 'not-a-date' }, /deadline must be a valid date/);
  await bad({ applicationDeadline: new Date(Date.now() - 5 * day).toISOString() }, /cannot be in the past/);
  await bad({ title: '   ' }, /Title/);
  await bad({ workMode: 'moon' }, /Work mode/);
  await bad({ company: '507f1f77bcf86cd799439011' }, /Company not found/);
  await bad({ company: companyB }, /archived/);
  await bad({ category: 'x'.repeat(81) }, /Category/);
  const r = await post(admin.token, '/admin/jobs', { title: 'T' });
  assert.equal(r.status, 400);
});

let openJob;
let draftJob;
test('job: create, view, edit and lifecycle with audit entries', async () => {
  let r = await post(admin.token, '/admin/jobs', validJob(companyA, { title: 'Open Platform Engineer', applicationDeadline: future(), applyUrl: 'https://careers.example.com/1', source: 'api', postedBy: seeker.id }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  openJob = r.body.job;
  assert.equal(openJob.source, 'manual', 'client cannot set source');
  assert.equal(openJob.postedBy, admin.id, 'postedBy comes from the token');
  assert.equal(openJob.availability, 'open');
  assert.match(openJob.jobCode, /^CN-\d{6}$/);

  r = await get(admin.token, `/admin/jobs/${openJob._id}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.job.company.name, 'Alpha Systems');

  r = await put(admin.token, `/admin/jobs/${openJob._id}`, { title: 'Senior Platform Engineer', isActive: false, source: 'demo', applyUrl: 'bad' });
  assert.equal(r.status, 400);
  r = await put(admin.token, `/admin/jobs/${openJob._id}`, { title: 'Senior Platform Engineer', isActive: false, source: 'demo' });
  assert.equal(r.status, 200);
  assert.equal(r.body.job.isActive, true, 'edit body cannot flip isActive');
  assert.equal(r.body.job.source, 'manual');
  assert.equal(r.body.job.title, 'Senior Platform Engineer');
  assert.equal((await put(admin.token, `/admin/jobs/${openJob._id}`, { company: companyB })).status, 400);

  r = await post(admin.token, '/admin/jobs', validJob(companyA, { title: 'Draft Role', city: 'Mumbai', category: 'Design' }));
  draftJob = r.body.job;

  r = await post(admin.token, `/admin/jobs/${draftJob._id}/deactivate`, {});
  assert.equal(r.body.job.availability, 'inactive');
  r = await post(admin.token, `/admin/jobs/${draftJob._id}/activate`, {});
  assert.equal(r.body.job.availability, 'open');
  r = await post(admin.token, `/admin/jobs/${draftJob._id}/close`, {});
  assert.equal(r.body.job.availability, 'closed');
  assert.ok(r.body.job.closedAt);
  r = await post(admin.token, `/admin/jobs/${draftJob._id}/reopen`, {});
  assert.equal(r.body.job.availability, 'open');
  assert.equal(r.body.job.closedAt, undefined);
  assert.equal((await post(admin.token, '/admin/jobs/507f1f77bcf86cd799439011/close', {})).status, 404);
  assert.equal((await post(admin.token, '/admin/jobs/not-an-id/close', {})).status, 400);

  const log = await mongoose.connection.collection('adminauditlogs').find({}).toArray();
  const actions = log.map((e) => e.action);
  for (const a of ['job.created', 'job.updated', 'job.deactivated', 'job.activated', 'job.closed', 'job.reopened']) assert.ok(actions.includes(a), a);
  assert.ok(log.every((e) => String(e.actor) === admin.id));
  assert.ok(log.every((e) => !/password|token/i.test(e.summary)));
});

test('bare date deadline means end of that day', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const r = await post(admin.token, '/admin/jobs', validJob(companyA, { title: 'Deadline Today', applicationDeadline: today }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.job.applicationDeadline, `${today}T23:59:59.999Z`);
  await mongoose.connection.collection('jobs').deleteOne({ _id: new mongoose.Types.ObjectId(r.body.job._id) });
});

test('job: filters, search and pagination in the admin list', async () => {
  const mk = (over) => post(admin.token, '/admin/jobs', validJob(companyA, over));
  const closed = (await mk({ title: 'Closed Analyst', city: 'Chennai' })).body.job;
  await post(admin.token, `/admin/jobs/${closed._id}/close`, {});
  const hidden = (await mk({ title: 'Hidden Analyst', city: 'Chennai' })).body.job;
  await post(admin.token, `/admin/jobs/${hidden._id}/deactivate`, {});
  // An expired job can only exist when the deadline passes after creation: write it directly.
  const exp = (await mk({ title: 'Expired Analyst', city: 'Chennai' })).body.job;
  await mongoose.connection.collection('jobs').updateOne({ _id: new mongoose.Types.ObjectId(exp._id) }, { $set: { applicationDeadline: new Date(Date.now() - 2 * day) } });

  const count = async (qs) => (await get(admin.token, `/admin/jobs?${qs}`)).body;
  assert.equal((await count('city=chennai')).total, 3);
  assert.equal((await count('city=chennai&status=closed')).jobs[0].title, 'Closed Analyst');
  assert.equal((await count('city=chennai&status=inactive')).jobs[0].title, 'Hidden Analyst');
  const e = await count('city=chennai&status=expired');
  assert.equal(e.total, 1);
  assert.equal(e.jobs[0].availability, 'expired');
  assert.equal((await count('city=chennai&status=active')).total, 0);
  assert.equal((await count(`company=${companyA}&category=design`)).total, 1);
  assert.equal((await count('q=alpha')).total, 5, 'search matches the company name');
  assert.equal((await count(`q=${openJob.jobCode}`)).total, 1, 'search matches the job code');
  assert.equal((await get(admin.token, '/admin/jobs?status=weird')).status, 400);
  assert.equal((await get(admin.token, '/admin/jobs?company=zzz')).status, 400);
  // regex input is escaped, not interpreted
  assert.equal((await count('q=.*')).total, 0);

  const p1 = await count('limit=4&page=1');
  const p2 = await count('limit=4&page=2');
  assert.equal(p1.total, 5);
  assert.equal(p1.pages, 2);
  assert.equal(p1.jobs.length, 4);
  assert.equal(p2.jobs.length, 1);
  const ids = new Set([...p1.jobs, ...p2.jobs].map((j) => j._id));
  assert.equal(ids.size, 5);
});

test('public listings hide inactive, closed and expired jobs; detail rules', async () => {
  const list = await get(seeker.token, '/jobs?limit=50');
  const titles = list.body.jobs.map((j) => j.title).sort();
  assert.deepEqual(titles, ['Draft Role', 'Senior Platform Engineer']);
  const meta = await get(seeker.token, '/jobs/meta');
  assert.equal(meta.body.total, 2);
  const reco = await get(seeker.token, '/jobs/recommended');
  const recoTitles = JSON.stringify(reco.body);
  assert.ok(!recoTitles.includes('Closed Analyst') && !recoTitles.includes('Hidden Analyst') && !recoTitles.includes('Expired Analyst'));

  const all = (await get(admin.token, '/admin/jobs?city=chennai')).body.jobs;
  const byTitle = Object.fromEntries(all.map((j) => [j.title, j]));
  // closed / expired remain viewable (with availability) so saved jobs and applications keep working
  const closedView = await get(seeker.token, `/jobs/${byTitle['Closed Analyst']._id}`);
  assert.equal(closedView.status, 200);
  assert.equal(closedView.body.job.availability, 'closed');
  assert.equal((await get(seeker.token, `/jobs/${byTitle['Expired Analyst']._id}`)).body.job.availability, 'expired');
  // hidden: 404 for a stranger, visible to admin and to someone who saved it
  const hiddenId = byTitle['Hidden Analyst']._id;
  assert.equal((await get(seeker.token, `/jobs/${hiddenId}`)).status, 404);
  assert.equal((await get(admin.token, `/jobs/${hiddenId}`)).status, 200);
  assert.equal((await post(admin.token, '/saved-jobs', { jobId: hiddenId })).status, 201);
  assert.equal((await get(admin.token, '/jobs?limit=50')).body.jobs.some((j) => j._id === hiddenId), false);
  assert.equal((await get(admin.token, `/jobs/${hiddenId}`)).body.job.availability, 'inactive');
});

test('legacy /api/jobs admin endpoints still work and are audited', async () => {
  assert.equal((await post(seeker.token, '/jobs', validJob(companyA))).status, 403);
  let r = await post(admin.token, '/jobs', validJob(companyA, { title: 'Legacy Created' }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.job._id;
  assert.equal((await put(admin.token, `/jobs/${id}`, { title: 'Legacy Edited' })).status, 200);
  assert.equal((await put(admin.token, `/jobs/${id}`, { isActive: 'false' })).status, 400, 'isActive must be a real boolean');
  assert.equal((await put(admin.token, `/jobs/${id}`, { isActive: false })).status, 200);
  assert.equal((await del(admin.token, `/jobs/${id}`)).status, 200);
  const actions = (await mongoose.connection.collection('adminauditlogs').find({ summary: /Legacy/ }).toArray()).map((e) => e.action);
  assert.deepEqual(actions.sort(), ['job.created', 'job.deleted', 'job.updated', 'job.updated']);
});

test('company: archive, restore, delete blocked with jobs, jobs keep populating', async () => {
  const withJobs = companyA;
  let r = await get(admin.token, `/admin/companies/${withJobs}`);
  assert.equal(r.body.company.jobCount, 5, 'counts every job of the company, incl. closed/inactive');
  r = await del(admin.token, `/admin/companies/${withJobs}`);
  assert.equal(r.status, 409);
  assert.ok(await mongoose.connection.collection('companies').findOne({ _id: new mongoose.Types.ObjectId(withJobs) }));

  r = await post(admin.token, `/admin/companies/${withJobs}/archive`, {});
  assert.equal(r.status, 200);
  assert.equal(r.body.company.isActive, false);
  assert.ok(r.body.company.archivedAt);
  assert.equal((await post(admin.token, '/admin/jobs', validJob(withJobs))).status, 400, 'archived company not selectable');
  assert.ok(!(await get(admin.token, '/admin/companies/options')).body.companies.some((c) => c.name === 'Alpha Systems'));
  // existing jobs of the archived company still populate
  const pub = await get(seeker.token, '/jobs?limit=50');
  assert.equal(pub.body.jobs.length, 2);
  assert.equal(pub.body.jobs[0].company.name, 'Alpha Systems');
  assert.equal((await get(seeker.token, `/jobs/${openJob._id}`)).body.job.company.name, 'Alpha Systems');
  // editing an existing job of an archived company is still allowed (company unchanged)
  assert.equal((await put(admin.token, `/admin/jobs/${openJob._id}`, { city: 'Nashik' })).status, 200);

  r = await post(admin.token, `/admin/companies/${withJobs}/restore`, {});
  assert.equal(r.body.company.isActive, true);
  assert.equal(r.body.company.archivedAt, undefined);
  assert.equal((await post(admin.token, '/admin/jobs', validJob(withJobs, { title: 'After Restore' }))).status, 201);

  const lone = (await post(admin.token, '/admin/companies', { name: 'Delta Lone' })).body.company._id;
  assert.equal((await del(admin.token, `/admin/companies/${lone}`)).status, 200);
  assert.equal((await get(admin.token, `/admin/companies/${lone}`)).status, 404);

  const actions = (await mongoose.connection.collection('adminauditlogs').find({ targetType: 'company' }).toArray()).map((e) => e.action);
  for (const a of ['company.created', 'company.updated', 'company.archived', 'company.restored', 'company.deleted']) assert.ok(actions.includes(a), a);
});

test('overview metrics match the database; activity is paginated', async () => {
  const db = mongoose.connection;
  const now = new Date();
  // seed program data directly (read-only stats; these models belong to another module)
  const p1 = (await db.collection('programs').insertOne({ slug: 'a2-p1', title: 'P1', provider: 'X', description: 'd', category: 'c', isActive: true })).insertedId;
  await db.collection('programs').insertOne({ slug: 'a2-p2', title: 'P2', provider: 'X', description: 'd', category: 'c', isActive: false });
  await db.collection('programenrollments').insertMany([
    { user: new mongoose.Types.ObjectId(seeker.id), program: p1, status: 'saved' },
    { user: new mongoose.Types.ObjectId(admin.id), program: p1, status: 'completed' },
  ]);
  const verifiedExpected = await db.collection('users').countDocuments({ emailVerified: true });
  const usersExpected = await db.collection('users').countDocuments({});

  const r = await get(admin.token, '/admin/overview');
  assert.equal(r.status, 200);
  const o = r.body;
  assert.equal(o.users.total, usersExpected);
  assert.equal(o.users.verified, verifiedExpected);
  assert.equal(o.users.unverified, usersExpected - verifiedExpected);
  const jobs = await db.collection('jobs').find({}).toArray();
  assert.equal(o.jobs.total, jobs.length);
  assert.equal(o.jobs.inactive, jobs.filter((j) => j.isActive === false).length);
  assert.equal(o.jobs.closed, jobs.filter((j) => j.isActive !== false && j.status === 'closed').length);
  assert.equal(o.jobs.expired, jobs.filter((j) => j.isActive !== false && j.status !== 'closed' && j.applicationDeadline && j.applicationDeadline < now).length);
  assert.equal(o.jobs.active + o.jobs.closed + o.jobs.inactive + o.jobs.expired, o.jobs.total);
  assert.equal(o.companies.total, await db.collection('companies').countDocuments({}));
  assert.equal(o.companies.archived, 1);
  assert.equal(o.companies.active, o.companies.total - 1);
  assert.deepEqual(o.programs, { total: 2, active: 1, inactive: 1, archived: 0, enrollments: { total: 2, orphaned: 0, byStatus: { saved: 1, 'in-progress': 0, completed: 1 } } });
  assert.equal(o.recentActivity.length, 10);
  assert.equal(o.recentActivity[0].actorName, 'Admin Tester');

  const a1 = await get(admin.token, '/admin/activity?limit=5&page=1');
  const a2 = await get(admin.token, '/admin/activity?limit=5&page=2');
  assert.equal(a1.body.activity.length, 5);
  assert.equal(a1.body.total, await db.collection('adminauditlogs').countDocuments({}));
  assert.ok(a1.body.pages >= 2);
  assert.notEqual(a1.body.activity[0].id, a2.body.activity[0].id);
  assert.ok(new Date(a1.body.activity[0].createdAt) >= new Date(a1.body.activity[4].createdAt));
  assert.equal((await get(admin.token, '/admin/activity?limit=9999')).body.activity.length <= 50, true);
});

test('recordAdminAction never throws', async () => {
  const { recordAdminAction } = require('../../utils/adminAudit');
  // Not connected in this process through the same mongoose default? It is connected; force a validation failure.
  assert.equal(await recordAdminAction({ actor: 'not-an-object-id', action: 'x.y', targetType: 'x' }), false);
});
