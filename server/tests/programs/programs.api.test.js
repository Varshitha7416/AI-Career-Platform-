/*
 * Career Programs API tests (node:test). Runs against a DISPOSABLE local MongoDB:
 *
 *   PROGRAMS_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:programs
 *
 * Refuses anything that is not localhost/127.0.0.1. Starts the API as a child process on TEST_PORT (default 5033)
 * with an explicit MONGO_URI/JWT_SECRET (never the .env values), uses its own database and drops it at the end.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

const BASE = process.env.PROGRAMS_TEST_MONGO || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('Set PROGRAMS_TEST_MONGO to a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27017');
}
const PORT = Number(process.env.TEST_PORT || 5033);
const DB = `careernest_a3_programs_${process.pid}`;
const URI = `${BASE.replace(/\/$/, '')}/${DB}`;
const API = `http://127.0.0.1:${PORT}/api`;
const SERVER_DIR = path.join(__dirname, '..', '..');

let server;
let M;
const U = {};
const P = {};

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

const mkUser = async (key) => {
  const email = `${key}.${process.pid}@example.com`;
  let r = await post(null, '/auth/signup', { name: `User ${key}`, email, password: 'secret12' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  r = await post(null, '/auth/login', { email, password: 'secret12' });
  assert.equal(r.status, 200);
  U[key] = { id: r.body.user.id, token: r.body.token };
};

const titles = (r) => r.body.programs.map((p) => p.title);
const notifs = (userId) => M.Notification.find({ user: userId, type: 'program' }).lean();
const mk = (extra) => M.Program.create({ description: 'A reasonably long description.', provider: 'TestProv', category: 'Cat A', ...extra });

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, MONGO_URI: URI, JWT_SECRET: 'test-secret-not-real', PORT: String(PORT), CLIENT_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 20000);
    server.stdout.on('data', (d) => { if (String(d).includes('Server running')) { clearTimeout(t); resolve(); } });
    server.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  });
  await mongoose.connect(URI);
  M = { User: require('../../models/User'), Program: require('../../models/Program'), Enrollment: require('../../models/ProgramEnrollment'), Notification: require('../../models/Notification') };
  await mkUser('alice');
  await mkUser('bob');
  await mkUser('admin');
  await M.User.updateOne({ _id: U.admin.id }, { role: 'admin' });

  P.py = await mk({ slug: 'py-basics', title: 'Python Basics', level: 'Beginner', duration: '3 weeks', category: 'Cat A', skills: ['Python'] });
  P.sql = await mk({ slug: 'sql-mid', title: 'SQL Intermediate', level: 'Intermediate', duration: '8 weeks', category: 'Cat B', skills: ['SQL'] });
  P.k8s = await mk({ slug: 'k8s-adv', title: 'Kubernetes Advanced', level: 'Advanced', duration: '6 months (flexible)', category: 'Cat B', skills: ['Kubernetes'] });
  P.free = await mk({ slug: 'self-paced', title: 'Self Paced Thing', level: 'Beginner', duration: 'Self-paced', category: 'Cat A' });
  P.old = await mk({ slug: 'retired', title: 'Retired Program', level: 'Beginner', duration: '2 weeks', category: 'Cat A', isActive: false });
  P.ms = await mk({ slug: 'ms-prog', title: 'Milestone Program', level: 'Beginner', duration: '10 weeks', category: 'Cat C', milestones: [{ title: 'One', order: 1 }, { title: 'Two', order: 2 }, { title: 'Three', order: 3 }, { title: 'Four', order: 4 }] });
  // legacy document created before the additive fields existed (no durationWeeks)
  const legacy = await M.Program.collection.insertOne({ slug: 'legacy', title: 'Legacy Program', provider: 'Old', description: 'Legacy description text.', category: 'Cat A', level: 'Beginner', duration: '2 weeks', skills: [], isActive: true, source: 'demo', createdAt: new Date(), updatedAt: new Date() });
  P.legacyId = String(legacy.insertedId);
});

after(async () => {
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  await mongoose.disconnect();
  if (server) server.kill();
});

test('model: durationWeeks derived on create; inactive hidden from discovery', async () => {
  assert.equal(P.py.durationWeeks, 3);
  assert.equal(P.k8s.durationWeeks, 26);
  assert.equal(P.free.durationWeeks, undefined);
  const r = await get(U.alice.token, '/programs?limit=50');
  assert.equal(r.status, 200);
  assert.ok(!titles(r).includes('Retired Program'));
  assert.equal(r.body.total, 6);
});

test('discovery: unauthenticated is 401', async () => {
  assert.equal((await get(null, '/programs')).status, 401);
  assert.equal((await get(null, '/programs/mine')).status, 401);
});

test('discovery: level, duration (with legacy backfill), category, search and combinations', async () => {
  let r = await get(U.alice.token, '/programs?level=Beginner&limit=50');
  assert.deepEqual(titles(r).sort(), ['Legacy Program', 'Milestone Program', 'Python Basics', 'Self Paced Thing']);
  r = await get(U.alice.token, '/programs?level=advanced');
  assert.deepEqual(titles(r), ['Kubernetes Advanced']);
  r = await get(U.alice.token, '/programs?duration=short&limit=50');
  assert.deepEqual(titles(r).sort(), ['Legacy Program', 'Python Basics']); // legacy doc got durationWeeks backfilled
  r = await get(U.alice.token, '/programs?duration=medium&limit=50');
  assert.deepEqual(titles(r).sort(), ['Milestone Program', 'SQL Intermediate']);
  r = await get(U.alice.token, '/programs?duration=long');
  assert.deepEqual(titles(r), ['Kubernetes Advanced']);
  r = await get(U.alice.token, '/programs?category=Cat A&level=Beginner&duration=short&q=python');
  assert.deepEqual(titles(r), ['Python Basics']);
  r = await get(U.alice.token, '/programs?category=Cat B&level=Beginner');
  assert.equal(r.body.total, 0);
  assert.equal(r.body.pages, 1);
});

test('discovery: invalid filters are rejected, not ignored', async () => {
  for (const qs of ['level=Expert', 'duration=forever', 'enrollment=maybe', 'page=0', 'page=abc', 'limit=-3', 'level=Beginner&level=Advanced']) {
    const r = await get(U.alice.token, `/programs?${qs}`);
    assert.equal(r.status, 400, qs);
    assert.ok(r.body.message);
  }
});

test('discovery: pagination is stable and reports totals', async () => {
  const seen = [];
  for (let page = 1; page <= 3; page += 1) {
    const r = await get(U.alice.token, `/programs?limit=2&page=${page}`);
    assert.equal(r.body.total, 6);
    assert.equal(r.body.pages, 3);
    assert.equal(r.body.programs.length, 2);
    seen.push(...r.body.programs.map((p) => p.id));
  }
  assert.equal(new Set(seen).size, 6);
  const beyond = await get(U.alice.token, '/programs?limit=2&page=9');
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.body.programs, []);
  assert.equal(beyond.body.pages, 3);
  assert.equal((await get(U.alice.token, '/programs?limit=500')).body.programs.length, 6); // clamped to 50
});

test('enrollment contract: save, start, complete, none (existing client behaviour)', async () => {
  const id = String(P.py._id);
  let r = await put(U.alice.token, `/programs/${id}/enrollment`, { status: 'saved' });
  assert.equal(r.status, 200);
  assert.equal(r.body.enrollment.status, 'saved');
  assert.equal(r.body.enrollment.startedAt, null);
  r = await put(U.alice.token, `/programs/${id}/enrollment`, { status: 'in-progress' });
  assert.equal(r.body.enrollment.status, 'in-progress');
  assert.ok(r.body.enrollment.startedAt);
  r = await put(U.alice.token, `/programs/${id}/enrollment`, { status: 'completed' });
  assert.equal(r.body.enrollment.progress, 100);
  assert.ok(r.body.enrollment.completedAt);
  r = await get(U.alice.token, `/programs/${id}`);
  assert.equal(r.body.enrollment.status, 'completed');
  assert.equal(r.body.program.available, true);
  r = await get(U.alice.token, '/programs?enrollment=completed');
  assert.deepEqual(titles(r), ['Python Basics']);
  assert.equal(r.body.programs[0].enrollment, 'completed');
  r = await put(U.alice.token, `/programs/${id}/enrollment`, { status: 'none' });
  assert.equal(r.body.enrollment, null);
  assert.equal(await M.Enrollment.countDocuments({ user: U.alice.id }), 0);
  for (const bad of [{}, { status: 'bogus' }, { status: 5 }]) {
    assert.equal((await put(U.alice.token, `/programs/${id}/enrollment`, bad)).status, 400);
  }
  assert.equal((await put(U.alice.token, '/programs/not-an-id/enrollment', { status: 'saved' })).status, 400);
  assert.equal((await put(U.alice.token, `/programs/${new mongoose.Types.ObjectId()}/enrollment`, { status: 'saved' })).status, 404);
});

test('progress: validation, consistency and resume', async () => {
  const id = String(P.sql._id);
  const url = `/programs/${id}/enrollment`;
  for (const progress of [-1, 101, 12.5, '40', null]) {
    assert.equal((await put(U.alice.token, url, { progress })).status, 400, String(progress));
  }
  assert.equal(await M.Enrollment.countDocuments({ user: U.alice.id, program: id }), 0, 'invalid input must not create a record');
  let r = await put(U.alice.token, url, { progress: 30 });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.enrollment.status, r.body.enrollment.progress], ['in-progress', 30]);
  r = await put(U.alice.token, url, { progress: 100 });
  assert.deepEqual([r.body.enrollment.status, r.body.enrollment.progress], ['completed', 100]);
  assert.ok(r.body.enrollment.completedAt);
  r = await put(U.alice.token, url, { progress: 60 });
  assert.deepEqual([r.body.enrollment.status, r.body.enrollment.progress, r.body.enrollment.completedAt], ['in-progress', 60, null]);
  r = await put(U.alice.token, url, { status: 'completed' });
  r = await put(U.alice.token, url, { status: 'in-progress' }); // resume
  assert.deepEqual([r.body.enrollment.status, r.body.enrollment.progress], ['in-progress', 99]);
  assert.equal((await put(U.alice.token, url, { status: 'completed', progress: 40 })).status, 400);
  assert.equal((await put(U.alice.token, url, { status: 'saved', progress: 40 })).status, 400);
  assert.equal((await put(U.alice.token, url, { completedMilestones: [1] })).status, 400, 'program has no milestones');
  const doc = await M.Enrollment.findOne({ user: U.alice.id, program: id }).lean();
  assert.equal(doc.progress, 99);
  assert.equal(doc.status, 'in-progress');
});

test('milestones: progress derives from completed milestones', async () => {
  const url = `/programs/${P.ms._id}/enrollment`;
  assert.equal((await put(U.bob.token, url, { progress: 50 })).status, 400, 'manual percent rejected when milestones exist');
  assert.equal((await put(U.bob.token, url, { completedMilestones: [7] })).status, 400);
  let r = await put(U.bob.token, url, { completedMilestones: [1, 2] });
  assert.deepEqual([r.body.enrollment.status, r.body.enrollment.progress, r.body.enrollment.completedMilestones], ['in-progress', 50, [1, 2]]);
  r = await put(U.bob.token, url, { completedMilestones: [1, 2, 3, 4] });
  assert.deepEqual([r.body.enrollment.status, r.body.enrollment.progress], ['completed', 100]);
  r = await get(U.bob.token, `/programs/${P.ms._id}`);
  assert.equal(r.body.program.milestones.length, 4);
  assert.equal(r.body.enrollment.progress, 100);
  r = await put(U.bob.token, url, { completedMilestones: [1] });
  assert.deepEqual([r.body.enrollment.status, r.body.enrollment.progress], ['in-progress', 25]);
});

test('notifications: created once per real change, never for repeated identical requests', async () => {
  const id = String(P.k8s._id);
  const url = `/programs/${id}/enrollment`;
  const before = (await notifs(U.alice.id)).length;
  await put(U.alice.token, url, { status: 'saved' });
  await put(U.alice.token, url, { status: 'saved' });
  assert.equal((await notifs(U.alice.id)).length, before + 1);
  await Promise.all([put(U.alice.token, url, { status: 'in-progress' }), put(U.alice.token, url, { status: 'in-progress' }), put(U.alice.token, url, { status: 'in-progress' })]);
  assert.equal((await notifs(U.alice.id)).length, before + 2, 'concurrent identical requests notify once');
  await put(U.alice.token, url, { progress: 40 }); // progress-only change: no status change, no notification
  await put(U.alice.token, url, { progress: 40 });
  assert.equal((await notifs(U.alice.id)).length, before + 2);
  await put(U.alice.token, url, { status: 'completed' });
  await put(U.alice.token, url, { status: 'completed' });
  const all = await notifs(U.alice.id);
  assert.equal(all.length, before + 3);
  assert.ok(all.some((n) => n.title === 'Program completed' && n.link === `/programs/${id}`));
  const list = await get(U.alice.token, '/notifications');
  assert.ok(list.body.notifications.some((n) => n.type === 'program'));
  assert.equal((await notifs(U.bob.id)).filter((n) => n.link === `/programs/${id}`).length, 0, 'other users are not notified');
});

test('inactive programs: hidden from discovery, still visible/removable for enrolled users, not startable', async () => {
  const id = String(P.old._id);
  // alice has no record: 404 on detail, 409 on enroll
  assert.equal((await get(U.alice.token, `/programs/${id}`)).status, 404);
  let r = await put(U.alice.token, `/programs/${id}/enrollment`, { status: 'saved' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'PROGRAM_UNAVAILABLE');
  // existing record (created before the program was retired)
  await M.Enrollment.create({ user: U.bob.id, program: P.old._id, status: 'in-progress', progress: 20, startedAt: new Date() });
  r = await get(U.bob.token, `/programs/${id}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.program.available, false);
  r = await get(U.bob.token, '/programs/mine');
  const row = r.body.items.find((i) => i.program.title === 'Retired Program');
  assert.ok(row);
  assert.equal(row.program.available, false);
  assert.equal((await put(U.bob.token, `/programs/${id}/enrollment`, { progress: 50 })).status, 409);
  assert.equal((await put(U.bob.token, `/programs/${id}/enrollment`, { status: 'none' })).status, 200);
  assert.equal(await M.Enrollment.countDocuments({ user: U.bob.id, program: id }), 0);
  assert.ok(!titles(await get(U.bob.token, '/programs?limit=50')).includes('Retired Program'));
});

test('enrollment filters and My Programs: status filter, sort, counts, pagination', async () => {
  const c = await mkProg('Carol Test');
  await M.Enrollment.deleteMany({ user: U.alice.id });
  const t0 = Date.now();
  const mkE = (p, status, progress, mins) => M.Enrollment.collection.insertOne({
    user: new mongoose.Types.ObjectId(U.alice.id), program: p._id, status, progress, completedMilestones: [],
    createdAt: new Date(t0 - mins * 60000), updatedAt: new Date(t0 - mins * 60000),
  });
  await mkE(P.py, 'saved', 0, 30);
  await mkE(P.sql, 'in-progress', 70, 10);
  await mkE(P.k8s, 'in-progress', 20, 20);
  await mkE(P.free, 'completed', 100, 5);
  await mkE(c, 'saved', 0, 40);

  let r = await get(U.alice.token, '/programs/mine');
  assert.deepEqual(r.body.counts, { all: 5, saved: 2, 'in-progress': 2, completed: 1 });
  assert.deepEqual(r.body.items.map((i) => i.program.title), ['Self Paced Thing', 'SQL Intermediate', 'Kubernetes Advanced', 'Python Basics', 'Carol Test']);
  r = await get(U.alice.token, '/programs/mine?status=in-progress&sort=progress');
  assert.deepEqual(r.body.items.map((i) => i.program.title), ['SQL Intermediate', 'Kubernetes Advanced']);
  r = await get(U.alice.token, '/programs/mine?sort=title&status=saved');
  assert.deepEqual(r.body.items.map((i) => i.program.title), ['Carol Test', 'Python Basics']);
  r = await get(U.alice.token, '/programs/mine?limit=2&page=3');
  assert.equal(r.body.items.length, 1);
  assert.equal(r.body.pages, 3);
  r = await get(U.alice.token, '/programs/mine?q=sql');
  assert.equal(r.body.total, 1);
  for (const qs of ['status=done', 'sort=random', 'page=0']) assert.equal((await get(U.alice.token, `/programs/mine?${qs}`)).status, 400, qs);
  // other users' records never leak
  assert.equal((await get(U.bob.token, '/programs/mine')).body.items.every((i) => i.program.title !== 'Carol Test'), true);

  // discovery filters by enrollment
  r = await get(U.alice.token, '/programs?enrollment=in-progress&limit=50');
  assert.deepEqual(titles(r).sort(), ['Kubernetes Advanced', 'SQL Intermediate']);
  r = await get(U.alice.token, '/programs?enrollment=saved&limit=50');
  assert.deepEqual(titles(r).sort(), ['Carol Test', 'Python Basics']);
  r = await get(U.alice.token, '/programs?enrollment=not-started&limit=50');
  assert.ok(!titles(r).includes('SQL Intermediate'));
  assert.ok(titles(r).includes('Milestone Program'));
  r = await get(U.alice.token, '/programs?enrollment=in-progress&level=Advanced');
  assert.deepEqual(titles(r), ['Kubernetes Advanced']);
});

async function mkProg(title) {
  return mk({ slug: title.toLowerCase().replace(/\s+/g, '-'), title });
}

test('admin API: 401 unauthenticated, 403 non-admin, full CRUD for admin', async () => {
  assert.equal((await get(null, '/admin/programs')).status, 401);
  assert.equal((await post(null, '/admin/programs', {})).status, 401);
  for (const [m, u, b] of [['get', '/admin/programs'], ['get', '/admin/programs/stats'], ['post', '/admin/programs', { title: 'x' }], ['put', `/admin/programs/${P.py._id}`, { title: 'Hack' }], ['put', `/admin/programs/${P.py._id}/state`, { state: 'inactive' }]]) {
    const r = await call(U.alice.token, m.toUpperCase(), u, b);
    assert.equal(r.status, 403, `${m} ${u}`);
  }
  assert.equal((await M.Program.findById(P.py._id)).title, 'Python Basics');

  const valid = { title: 'Admin Created Course', provider: 'Acme Academy', description: 'A long enough description.', category: 'Cat Z', level: 'Intermediate', duration: '2 weeks', skills: ['Go', 'Go', 'Rust'], url: 'https://example.com/course', enrollmentInfo: 'Enrol on the provider site.', resources: [{ title: 'Syllabus', url: 'https://example.com/syllabus.pdf' }], milestones: [{ title: 'Intro' }, { title: 'Project' }] };
  let r = await post(U.admin.token, '/admin/programs', valid);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const created = r.body.program;
  assert.equal(created.slug, 'admin-created-course');
  assert.equal(created.source, 'manual');
  assert.equal(created.durationWeeks, 2);
  assert.deepEqual(created.skills, ['Go', 'Rust']);
  assert.deepEqual(created.milestones, [{ title: 'Intro', order: 1 }, { title: 'Project', order: 2 }]);
  assert.equal(created.enrollmentCounts.total, 0);
  r = await post(U.admin.token, '/admin/programs', valid);
  assert.equal(r.body.program.slug, 'admin-created-course-2', 'slug collision gets a suffix');
  r = await post(U.admin.token, '/admin/programs', { ...valid, slug: 'admin-created-course' });
  assert.equal(r.status, 409);

  // visible in discovery once active, with admin fields
  r = await get(U.alice.token, `/programs/${created.id}`);
  assert.equal(r.body.program.enrollmentInfo, 'Enrol on the provider site.');
  assert.equal(r.body.program.resources[0].url, 'https://example.com/syllabus.pdf');

  // edit
  r = await put(U.admin.token, `/admin/programs/${created.id}`, { duration: '3 months', milestones: [{ title: 'Intro', order: 1 }, { title: 'Project', order: 2 }, { title: 'Capstone' }] });
  assert.equal(r.status, 200);
  assert.equal(r.body.program.durationWeeks, 13);
  assert.deepEqual(r.body.program.milestones.map((m) => m.order), [1, 2, 3]);

  // enrollments show up in counts and stats
  await put(U.alice.token, `/programs/${created.id}/enrollment`, { status: 'in-progress' });
  r = await get(U.admin.token, `/admin/programs/${created.id}`);
  assert.deepEqual(r.body.program.enrollmentCounts, { saved: 0, inProgress: 1, completed: 0, total: 1 });
  r = await get(U.admin.token, '/admin/programs/stats');
  assert.equal(r.status, 200);
  assert.ok(r.body.enrollments.total >= 1);
  assert.ok(r.body.topPrograms.length >= 1);

  // deactivate: hidden from discovery, record preserved, roadmap-facing query excludes it
  r = await put(U.admin.token, `/admin/programs/${created.id}/state`, { state: 'inactive' });
  assert.equal(r.body.program.state, 'inactive');
  assert.ok(!(await get(U.alice.token, '/programs?limit=50')).body.programs.some((p) => p.id === created.id));
  assert.equal((await get(U.alice.token, '/programs/mine')).body.items.find((i) => i.program.id === created.id).program.available, false);
  // archive (soft) and restore
  r = await put(U.admin.token, `/admin/programs/${created.id}/state`, { state: 'archived' });
  assert.equal(r.body.program.state, 'archived');
  assert.ok(await M.Program.exists({ _id: created.id }), 'archive never deletes');
  assert.equal((await M.Program.countDocuments({ isActive: { $ne: false }, archivedAt: { $exists: false }, _id: created.id })), 0);
  r = await get(U.admin.token, '/admin/programs?state=archived');
  assert.deepEqual(r.body.programs.map((p) => p.id), [created.id]);
  r = await put(U.admin.token, `/admin/programs/${created.id}/state`, { state: 'active' });
  assert.equal(r.body.program.state, 'active');
  assert.equal(r.body.program.archivedAt, undefined);
  assert.ok((await get(U.alice.token, '/programs?limit=50')).body.programs.some((p) => p.id === created.id));
  assert.equal((await put(U.admin.token, `/admin/programs/${created.id}/state`, { state: 'weird' })).status, 400);
  assert.equal((await put(U.admin.token, `/admin/programs/${new mongoose.Types.ObjectId()}/state`, { state: 'active' })).status, 404);

  // list incl. inactive, filters and pagination
  r = await get(U.admin.token, '/admin/programs?state=inactive');
  assert.ok(r.body.programs.some((p) => p.title === 'Retired Program'));
  r = await get(U.admin.token, '/admin/programs?limit=2&page=2');
  assert.equal(r.body.programs.length, 2);
  assert.ok(r.body.pages >= 4);
  r = await get(U.admin.token, '/admin/programs?level=Advanced&q=kube');
  assert.equal(r.body.total, 1);
  assert.equal((await get(U.admin.token, '/admin/programs?state=zzz')).status, 400);
  assert.equal((await get(U.admin.token, '/admin/programs?page=0')).status, 400);

  // audit trail
  const AdminAuditLog = require('../../models/AdminAuditLog');
  const actions = (await AdminAuditLog.find({ actor: U.admin.id }).lean()).map((a) => a.action);
  for (const a of ['program.created', 'program.updated', 'program.inactive', 'program.archived', 'program.active']) assert.ok(actions.includes(a), a);
});

test('admin API: validation and URL safety', async () => {
  const base = { title: 'Valid Title', provider: 'Prov', description: 'A long enough description.', category: 'Cat' };
  const cases = [
    [{}, 'missing required fields'],
    [{ ...base, title: 'x' }, 'short title'],
    [{ ...base, level: 'Expert' }, 'bad level'],
    [{ ...base, theme: 'neon' }, 'bad theme'],
    [{ ...base, url: 'javascript:alert(1)' }, 'js url'],
    [{ ...base, url: 'ftp://example.com/x' }, 'ftp url'],
    [{ ...base, url: 'not a url' }, 'garbage url'],
    [{ ...base, resources: [{ title: 'R', url: 'javascript:alert(1)' }] }, 'js resource url'],
    [{ ...base, resources: [{ title: '', url: 'https://example.com' }] }, 'resource without title'],
    [{ ...base, resources: 'nope' }, 'resources not an array'],
    [{ ...base, milestones: [{ title: 'A', order: 1 }, { title: 'B', order: 1 }] }, 'duplicate milestone order'],
    [{ ...base, milestones: [{ title: 'A', order: 0 }] }, 'milestone order 0'],
    [{ ...base, milestones: [{ title: '' }] }, 'blank milestone'],
    [{ ...base, skills: 'sql' }, 'skills not an array'],
    [{ ...base, slug: 'Bad Slug!' }, 'bad slug'],
    [{ ...base, description: 'd'.repeat(2001) }, 'description too long'],
  ];
  for (const [body, label] of cases) {
    const r = await post(U.admin.token, '/admin/programs', body);
    assert.equal(r.status, 400, label);
    assert.ok(r.body.message);
  }
  assert.equal(await M.Program.countDocuments({ title: 'Valid Title' }), 0, 'rejected requests create nothing');
  const ok = await post(U.admin.token, '/admin/programs', { ...base, url: 'http://example.com/ok', resources: [{ title: 'R', url: 'https://example.com/r' }] });
  assert.equal(ok.status, 201);
  assert.equal((await put(U.admin.token, `/admin/programs/${ok.body.program.id}`, { url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await put(U.admin.token, `/admin/programs/${ok.body.program.id}`, {})).status, 400);
  assert.equal((await put(U.admin.token, `/admin/programs/${ok.body.program.id}`, { title: '' })).status, 400);
  assert.equal((await M.Program.findById(ok.body.program.id)).url, 'http://example.com/ok');
  assert.equal((await get(U.admin.token, '/admin/programs/not-an-id')).status, 400);
});

test('roadmap data source: archived/inactive programs are excluded by the roadmap query', async () => {
  const roadmapSrc = require('node:fs').readFileSync(path.join(SERVER_DIR, 'controllers', 'roadmapController.js'), 'utf8');
  const matches = roadmapSrc.match(/Program\.find\(\{ isActive: \{ \$ne: false \}, archivedAt: \{ \$exists: false \} \}\)/g) || [];
  assert.equal(matches.length, 2);
  const eligible = await M.Program.find({ isActive: { $ne: false }, archivedAt: { $exists: false } }).select('title').lean();
  assert.ok(!eligible.some((p) => p.title === 'Retired Program'));
});

test('legacy enrollment documents (no progress fields) stay valid', async () => {
  const legacyUser = new mongoose.Types.ObjectId(U.bob.id);
  await M.Enrollment.collection.insertOne({ user: legacyUser, program: P.py._id, status: 'completed', startedAt: new Date(), completedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
  let r = await get(U.bob.token, `/programs/${P.py._id}`);
  assert.deepEqual([r.body.enrollment.status, r.body.enrollment.progress], ['completed', 100]);
  r = await put(U.bob.token, `/programs/${P.py._id}/enrollment`, { status: 'completed' });
  assert.equal(r.status, 200);
  assert.equal(r.body.message, 'No changes');
  r = await put(U.bob.token, `/programs/${P.py._id}/enrollment`, { status: 'in-progress' });
  assert.deepEqual([r.body.enrollment.status, r.body.enrollment.progress], ['in-progress', 99]);
});
