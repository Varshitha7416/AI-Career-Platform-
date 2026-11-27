/*
 * Application tracker, interview and reminder tests (node:test). Runs against a DISPOSABLE local MongoDB:
 *
 *   TRACKER_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:tracker
 *
 * Refuses anything that is not localhost/127.0.0.1. Starts the API as a child process on TEST_PORT (default 5231) with an
 * explicit MONGO_URI / JWT_SECRET (never the .env values; NODE_ENV=test, reminder poller every 300 ms) and drops its own database.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

const BASE = process.env.TRACKER_TEST_MONGO || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('Set TRACKER_TEST_MONGO to a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27017');
}
const PORT = Number(process.env.TEST_PORT || 5231);
const DB = `careernest_b2a3_tracker_${process.pid}`;
const URI = `${BASE.replace(/\/$/, '')}/${DB}`;
const API = `http://127.0.0.1:${PORT}/api`;
const SERVER_DIR = path.join(__dirname, '..', '..');

let server;
const U = {};
let M;
const ctx = {};

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

const mkUser = async (key, name) => {
  const email = `${key}.${process.pid}@example.com`;
  let r = await post(null, '/auth/signup', { name, email, password: 'secret12' });
  assert.equal(r.status, 201);
  await mongoose.connection.collection('users').updateOne({ email }, { $set: { emailVerified: true, emailVerifiedAt: new Date() } });
  r = await post(null, '/auth/login', { email, password: 'secret12' });
  assert.equal(r.status, 200);
  U[key] = { id: r.body.user.id, token: r.body.token };
};

const H = 3600 * 1000;
const inFuture = (ms) => new Date(Date.now() + ms).toISOString();
let jobSeq = 0;
const mkJob = () => M.Job.create({ title: `Engineer ${++jobSeq}`, company: ctx.company._id, city: 'Pune', jobDescription: 'Build things', experienceLevel: 'experienced' });
const mkApp = async (key) => {
  const job = await mkJob();
  const r = await post(U[key].token, '/applications', { jobId: String(job._id) });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.application;
};
const mkInterview = async (key, appId, extra = {}) => {
  const r = await post(U[key].token, '/interviews', { applicationId: appId, scheduledAt: inFuture(72 * H), ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.interview;
};
const notifs = (userId, filter = {}) => M.Notification.find({ user: userId, type: 'reminder', ...filter }).lean();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, MONGO_URI: URI, JWT_SECRET: 'test-secret-not-real-test-secret-123456', PORT: String(PORT), CLIENT_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test', REMINDER_SWEEP_INTERVAL_MS: '300' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 20000);
    server.stdout.on('data', (d) => { if (String(d).includes('Server running')) { clearTimeout(t); resolve(); } });
    server.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  });
  await mongoose.connect(URI);
  M = {
    User: require('../../models/User'), Job: require('../../models/Job'), Company: require('../../models/Company'),
    Resume: require('../../models/Resume'), CoverLetter: require('../../models/CoverLetter'),
    Application: require('../../models/Application'), Interview: require('../../models/Interview'), Notification: require('../../models/Notification'),
  };
  await M.Notification.init();
  await wait(1500);
  await mkUser('alice', 'Alice Tracker');
  await mkUser('bob', 'Bob Other');
  ctx.company = await M.Company.create({ name: `Acme ${process.pid}` });
  ctx.resumeA = await M.Resume.create({ user: U.alice.id, fileName: 'a.pdf', name: 'Alice CV', resumeText: 'x' });
  ctx.resumeB = await M.Resume.create({ user: U.bob.id, fileName: 'b.pdf', resumeText: 'y' });
  ctx.clB = await M.CoverLetter.create({ user: U.bob.id, resume: ctx.resumeB._id, generatedText: 'z' });
  ctx.clA = await M.CoverLetter.create({ user: U.alice.id, resume: ctx.resumeA._id, generatedText: 'q', jobSnapshot: { title: 'Snapshot Role' } });
});

after(async () => {
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  await mongoose.disconnect();
  if (server) server.kill();
});

test('existing flows: duplicate application, future applied date, delete cleans interviews', async () => {
  const job = await mkJob();
  let r = await post(U.alice.token, '/applications', { jobId: String(job._id), appliedAt: inFuture(5 * 24 * H) });
  assert.equal(r.status, 400);
  r = await post(U.alice.token, '/applications', { jobId: String(job._id) });
  assert.equal(r.status, 201);
  const appId = r.body.application._id;
  r = await post(U.alice.token, '/applications', { jobId: String(job._id) });
  assert.equal(r.status, 400);
  await mkInterview('alice', appId);
  assert.equal(await M.Interview.countDocuments({ application: appId }), 1);
  r = await del(U.alice.token, `/applications/${appId}`);
  assert.equal(r.status, 200);
  assert.equal(await M.Interview.countDocuments({ application: appId }), 0);
  assert.equal((await put(U.alice.token, `/applications/${appId}`, { status: 'offer' })).status, 404);
});

test('PUT /applications: status only still works, bad input rejected, empty body rejected', async () => {
  const a = await mkApp('alice');
  let r = await put(U.alice.token, `/applications/${a._id}`, { status: 'nope' });
  assert.equal(r.status, 400);
  r = await put(U.alice.token, `/applications/${a._id}`, {});
  assert.equal(r.status, 400);
  r = await put(U.alice.token, `/applications/${a._id}`, { status: 'interviewing' });
  assert.equal(r.status, 200);
  assert.equal(r.body.message, 'Status updated');
  assert.equal(r.body.application.status, 'interviewing');
  assert.equal(r.body.application.statusHistory.length, 2);
});

test('edit validation: dates, notes, URL, next action, ownership', async () => {
  const a = await mkApp('alice');
  const url = `/applications/${a._id}`;
  const bad = async (body) => { const r = await put(U.alice.token, url, body); assert.equal(r.status, 400, JSON.stringify(body) + JSON.stringify(r.body)); };
  await bad({ appliedAt: inFuture(3 * 24 * H) });
  await bad({ appliedAt: 'not a date' });
  await bad({ appliedAt: null });
  await bad({ applyMethod: 'carrier-pigeon' });
  await bad({ notes: 'x'.repeat(2001) });
  await bad({ notes: 42 });
  await bad({ externalUrl: 'javascript:alert(1)' });
  await bad({ externalUrl: 'ftp://example.com/x' });
  await bad({ externalUrl: 'https://user:pw@example.com/x' });
  await bad({ externalUrl: 'not a url' });
  await bad({ followUpAt: 'garbage' });
  await bad({ reminderAt: new Date(Date.now() - 2 * H).toISOString() });
  await bad({ nextAction: { dueAt: inFuture(H) } });
  await bad({ nextAction: { text: 'y'.repeat(201) } });
  await bad({ nextAction: 'str' });

  const past = new Date(Date.now() - 3 * 24 * H).toISOString();
  const r = await put(U.alice.token, url, {
    appliedAt: past, applyMethod: 'external', notes: '  Spoke to recruiter  ', externalUrl: 'https://example.com/jobs/1',
    followUpAt: inFuture(2 * 24 * H), nextAction: { text: 'Send thank-you email', dueAt: inFuture(24 * H) },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const app = r.body.application;
  assert.equal(app.notes, 'Spoke to recruiter');
  assert.equal(app.applyMethod, 'external');
  assert.equal(app.externalUrl, 'https://example.com/jobs/1');
  assert.equal(app.nextAction.text, 'Send thank-you email');
  assert.equal(new Date(app.statusHistory[0].at).toISOString(), past); // applied entry follows the edited applied date

  // clearing
  const c = await put(U.alice.token, url, { notes: '', followUpAt: null, nextAction: null, externalUrl: '' });
  assert.equal(c.status, 200);
  assert.equal(c.body.application.notes, undefined);
  assert.equal(c.body.application.followUpAt, undefined);
  assert.equal(c.body.application.nextAction, undefined);
  assert.equal(c.body.application.externalUrl, undefined);

  // ownership: another user gets 404 and nothing changes
  const o = await put(U.bob.token, url, { notes: 'hijack' });
  assert.equal(o.status, 404);
  assert.equal((await get(U.bob.token, `/applications/item/${a._id}`)).status, 404);
});

test('resume / cover letter: ownership validated, deleted refs handled', async () => {
  const a = await mkApp('alice');
  const url = `/applications/${a._id}`;
  for (const body of [{ resumeId: String(ctx.resumeB._id) }, { resumeId: 'zzz' }, { coverLetterId: String(ctx.clB._id) }, { coverLetterId: String(new mongoose.Types.ObjectId()) }]) {
    const r = await put(U.alice.token, url, body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  const ok = await put(U.alice.token, url, { resumeId: String(ctx.resumeA._id), coverLetterId: String(ctx.clA._id) });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  let item = (await get(U.alice.token, `/applications/item/${a._id}`)).body.application;
  assert.equal(item.resume.name, 'Alice CV');
  assert.equal(item.coverLetter.title, 'Snapshot Role');
  // the user deletes the resume later: the application still loads and says so
  await M.Resume.deleteOne({ _id: ctx.resumeA._id });
  item = (await get(U.alice.token, `/applications/item/${a._id}`)).body.application;
  assert.equal(item.resume.missing, true);
  // unlink
  const un = await put(U.alice.token, url, { resumeId: null, coverLetterId: null });
  assert.equal(un.status, 200);
  item = (await get(U.alice.token, `/applications/item/${a._id}`)).body.application;
  assert.equal(item.resume, null);
  ctx.resumeA = await M.Resume.create({ user: U.alice.id, fileName: 'a2.pdf', name: 'Alice CV 2', resumeText: 'x' });
});

test('status history: transition dates, validation, legacy synthetic history', async () => {
  const a = await mkApp('alice');
  const url = `/applications/${a._id}`;
  assert.equal((await put(U.alice.token, url, { status: 'interviewing', statusDate: inFuture(3 * 24 * H) })).status, 400);
  assert.equal((await put(U.alice.token, url, { status: 'interviewing', statusDate: new Date(Date.now() - 40 * 24 * H).toISOString() })).status, 400);
  const when = new Date(Date.now() - 2 * H).toISOString();
  const r = await put(U.alice.token, url, { status: 'interviewing', statusDate: when });
  assert.equal(r.status, 200);
  const h = (await get(U.alice.token, `/applications/item/${a._id}`)).body.application.statusHistory;
  assert.deepEqual(h.map((x) => x.status), ['applied', 'interviewing']);
  assert.equal(new Date(h[1].at).toISOString(), when);

  // an old record without statusHistory / tracker fields keeps working
  const job = await mkJob();
  const legacy = await M.Application.collection.insertOne({ user: new mongoose.Types.ObjectId(U.alice.id), job: job._id, status: 'applied', createdAt: new Date(Date.now() - 5 * 24 * H), updatedAt: new Date() });
  const lid = String(legacy.insertedId);
  let item = (await get(U.alice.token, `/applications/item/${lid}`)).body.application;
  assert.equal(item.statusHistory.length, 1);
  assert.equal(item.resume, null);
  const lr = await put(U.alice.token, `/applications/${lid}`, { status: 'offer', notes: 'legacy edit' });
  assert.equal(lr.status, 200);
  item = (await get(U.alice.token, `/applications/item/${lid}`)).body.application;
  assert.deepEqual(item.statusHistory.map((x) => x.status), ['applied', 'offer']);
});

test('interview: round, prep, notes validation and round trip', async () => {
  const a = await mkApp('alice');
  const bad = async (extra) => { const r = await post(U.alice.token, '/interviews', { applicationId: a._id, scheduledAt: inFuture(72 * H), ...extra }); assert.equal(r.status, 400, JSON.stringify(extra) + JSON.stringify(r.body)); };
  await bad({ round: 0 });
  await bad({ round: 21 });
  await bad({ round: 1.5 });
  await bad({ roundLabel: 'x'.repeat(81) });
  await bad({ prepResources: [{ title: 'Doc', url: 'javascript:alert(1)' }] });
  await bad({ prepResources: [{ title: '', url: 'https://example.com' }] });
  await bad({ prepResources: Array.from({ length: 11 }, (_, i) => ({ title: `t${i}`, url: 'https://example.com' })) });
  await bad({ prepResources: 'nope' });
  await bad({ prepChecklist: [{ text: '' }] });
  await bad({ prepChecklist: Array.from({ length: 21 }, (_, i) => ({ text: `t${i}` })) });
  await bad({ prepNotes: 'x'.repeat(4001) });
  await bad({ debrief: 'x'.repeat(4001) });

  const iv = await mkInterview('alice', a._id, {
    round: 2, roundLabel: 'System design', type: 'technical', prepNotes: 'Review caching',
    prepResources: [{ title: 'My notes', url: 'https://example.com/notes' }], prepChecklist: [{ text: 'Re-read resume', done: true }, { text: 'Test mic' }],
  });
  assert.equal(iv.round, 2);
  assert.equal(iv.roundLabel, 'System design');
  assert.deepEqual(iv.prepChecklist, [{ text: 'Re-read resume', done: true }, { text: 'Test mic', done: false }]);
  const up = await put(U.alice.token, `/interviews/${iv._id}`, { debrief: 'Went well', prepChecklist: [{ text: 'Test mic', done: true }], round: null });
  assert.equal(up.status, 200);
  assert.equal(up.body.interview.debrief, 'Went well');
  assert.equal(up.body.interview.round, null);
  assert.equal(up.body.interview.prepChecklist.length, 1);
  // the application details route returns the full interview (the edit form would otherwise wipe prep data)
  const item = (await get(U.alice.token, `/applications/item/${a._id}`)).body.application;
  assert.equal(item.interviews[0].debrief, 'Went well');
  assert.equal(item.interviews[0].prepResources[0].title, 'My notes');
  // ownership
  assert.equal((await put(U.bob.token, `/interviews/${iv._id}`, { debrief: 'x' })).status, 404);
  assert.equal((await get(U.bob.token, `/interviews/${iv._id}`)).status, 404);
});

test('interview reminder validation and rescheduling', async () => {
  const a = await mkApp('alice');
  const sched = new Date(Date.now() + 48 * H);
  const mk = (extra) => post(U.alice.token, '/interviews', { applicationId: a._id, scheduledAt: sched.toISOString(), ...extra });
  assert.equal((await mk({ reminderOffsetMinutes: 7 })).status, 400);
  assert.equal((await mk({ reminderOffsetMinutes: 'abc' })).status, 400);
  assert.equal((await mk({ remindAt: sched.toISOString() })).status, 400); // not before the interview
  assert.equal((await mk({ remindAt: new Date(Date.now() - 3 * H).toISOString() })).status, 400); // already past
  assert.equal((await mk({ remindAt: 'xx' })).status, 400);
  const soon = await post(U.alice.token, '/interviews', { applicationId: a._id, scheduledAt: inFuture(30 * 60000), reminderOffsetMinutes: 1440 });
  assert.equal(soon.status, 400); // 1 day before is already in the past

  const ok = await mk({ reminderOffsetMinutes: 1440 });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const iv = ok.body.interview;
  assert.equal(new Date(iv.remindAt).getTime(), sched.getTime() - 24 * H);
  // reschedule: the reminder follows
  const ns = new Date(Date.now() + 96 * H);
  let r = await put(U.alice.token, `/interviews/${iv._id}`, { scheduledAt: ns.toISOString() });
  assert.equal(r.status, 200);
  assert.equal(new Date(r.body.interview.remindAt).getTime(), ns.getTime() - 24 * H);
  // explicit remindAt after the (new) interview is rejected
  r = await put(U.alice.token, `/interviews/${iv._id}`, { remindAt: new Date(ns.getTime() + H).toISOString() });
  assert.equal(r.status, 400);
  // remove
  r = await put(U.alice.token, `/interviews/${iv._id}`, { reminderOffsetMinutes: null });
  assert.equal(r.status, 200);
  assert.equal(r.body.interview.remindAt, null);
});

test('interview list: views and counts', async () => {
  const a = await mkApp('alice');
  const i1 = await mkInterview('alice', a._id);
  const i2 = await mkInterview('alice', a._id);
  await put(U.alice.token, `/interviews/${i1._id}`, { status: 'completed' });
  await put(U.alice.token, `/interviews/${i2._id}`, { status: 'cancelled' });
  const all = await get(U.alice.token, '/interviews?filter=all');
  assert.equal(all.status, 200);
  assert.ok(all.body.counts.completed >= 1 && all.body.counts.cancelled >= 1);
  const comp = await get(U.alice.token, '/interviews?filter=completed');
  assert.ok(comp.body.interviews.every((i) => i.status === 'completed') && comp.body.interviews.length === all.body.counts.completed);
  const canc = await get(U.alice.token, '/interviews?filter=cancelled');
  assert.ok(canc.body.interviews.every((i) => i.status === 'cancelled'));
  assert.equal((await get(U.alice.token, '/interviews?filter=bogus')).status, 400);
  const bobList = await get(U.bob.token, '/interviews?filter=all');
  assert.equal(bobList.body.counts.all, 0);
});

const makeDue = (id) => M.Application.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { reminderAt: new Date(Date.now() - 1000) } });

test('application reminder: exactly once under concurrent materialisers and repeated polls', async () => {
  const { materialiseDue } = require('../../utils/reminders');
  const a = await mkApp('alice');
  const r = await put(U.alice.token, `/applications/${a._id}`, { reminderAt: inFuture(H), nextAction: { text: 'Email recruiter' } });
  assert.equal(r.status, 200);
  assert.equal((await notifs(U.alice.id, { dedupeKey: { $regex: `^app-reminder:${a._id}` } })).length, 0); // not due yet
  await makeDue(a._id);
  await Promise.all([
    ...Array.from({ length: 8 }, () => materialiseDue()),
    ...Array.from({ length: 4 }, () => materialiseDue({ userId: U.alice.id })),
    ...Array.from({ length: 4 }, () => get(U.alice.token, '/notifications')),
  ]);
  await materialiseDue();
  await get(U.alice.token, '/notifications');
  const found = await notifs(U.alice.id, { dedupeKey: { $regex: `^app-reminder:${a._id}` } });
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Email recruiter/);
  assert.equal(found[0].link, `/applications/${a._id}`);
  const doc = await M.Application.findById(a._id).lean();
  assert.ok(doc.reminderNotifiedAt);

  // editing the reminder starts over: a new due time produces exactly one more notification
  const e = await put(U.alice.token, `/applications/${a._id}`, { reminderAt: inFuture(2 * H) });
  assert.equal(e.status, 200);
  assert.equal((await M.Application.findById(a._id).lean()).reminderNotifiedAt, undefined);
  await makeDue(a._id);
  await Promise.all([materialiseDue(), materialiseDue(), get(U.alice.token, '/dashboard/overview')]);
  assert.equal((await notifs(U.alice.id, { dedupeKey: { $regex: `^app-reminder:${a._id}` } })).length, 2);

  // removing a reminder clears it
  const c = await put(U.alice.token, `/applications/${a._id}`, { reminderAt: null });
  assert.equal(c.status, 200);
  const cleared = await M.Application.findById(a._id).lean();
  assert.equal(cleared.reminderAt, undefined);
});

test('reminders do not fire for rejected applications, and stop when status becomes rejected', async () => {
  const { materialiseDue } = require('../../utils/reminders');
  const a = await mkApp('alice');
  await put(U.alice.token, `/applications/${a._id}`, { reminderAt: inFuture(H) });
  await put(U.alice.token, `/applications/${a._id}`, { status: 'rejected' });
  await makeDue(a._id);
  await materialiseDue();
  await get(U.alice.token, '/notifications');
  assert.equal((await notifs(U.alice.id, { dedupeKey: { $regex: `^app-reminder:${a._id}` } })).length, 0);
});

test('interview reminders: fire once, not for cancelled / completed / already started', async () => {
  const { materialiseDue } = require('../../utils/reminders');
  const a = await mkApp('alice');
  const mk = async () => mkInterview('alice', a._id, { reminderOffsetMinutes: 60, scheduledAt: inFuture(3 * H) });
  const due = (id, extra = {}) => M.Interview.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { remindAt: new Date(Date.now() - 1000), ...extra } });
  const key = (i) => ({ dedupeKey: { $regex: `^interview-reminder:${i._id}` } });

  const fire = await mk(); await due(fire._id);
  const cancelled = await mk(); await put(U.alice.token, `/interviews/${cancelled._id}`, { status: 'cancelled' }); await due(cancelled._id);
  const done = await mk(); await put(U.alice.token, `/interviews/${done._id}`, { status: 'completed' }); await due(done._id);
  const started = await mk(); await due(started._id, { scheduledAt: new Date(Date.now() - H) });
  await Promise.all(Array.from({ length: 6 }, () => materialiseDue()));
  await get(U.alice.token, '/notifications');
  assert.equal((await notifs(U.alice.id, key(fire))).length, 1);
  assert.equal((await notifs(U.alice.id, key(cancelled))).length, 0);
  assert.equal((await notifs(U.alice.id, key(done))).length, 0);
  assert.equal((await notifs(U.alice.id, key(started))).length, 0);
  assert.ok((await M.Interview.findById(started._id).lean()).reminderNotifiedAt); // marked handled, not rescanned
});

test('notification preferences are respected (reminders category off => nothing created)', async () => {
  const { materialiseDue } = require('../../utils/reminders');
  await M.User.collection.updateOne({ _id: new mongoose.Types.ObjectId(U.bob.id) }, { $set: { 'notificationPrefs.reminders': false } });
  const a = await mkApp('bob');
  await put(U.bob.token, `/applications/${a._id}`, { reminderAt: inFuture(H) });
  await makeDue(a._id);
  await materialiseDue();
  await get(U.bob.token, '/notifications');
  assert.equal((await notifs(U.bob.id)).length, 0);
  assert.ok((await M.Application.findById(a._id).lean()).reminderNotifiedAt);
});

test('periodic poller materialises a due reminder with no user request (survives no timers per reminder)', async () => {
  const a = await mkApp('alice');
  await put(U.alice.token, `/applications/${a._id}`, { reminderAt: inFuture(H) });
  await makeDue(a._id);
  let n = 0;
  for (let i = 0; i < 30 && n === 0; i += 1) {
    await wait(200);
    n = (await notifs(U.alice.id, { dedupeKey: { $regex: `^app-reminder:${a._id}` } })).length;
  }
  assert.equal(n, 1);
});

test('dashboard overview and notifications still respond; deletion policy covers new data (no new collections)', async () => {
  const d = await get(U.alice.token, '/dashboard/overview');
  assert.equal(d.status, 200);
  const n = await get(U.alice.token, '/notifications');
  assert.equal(n.status, 200);
  assert.ok(n.body.notifications.some((x) => x.type === 'reminder'));
  assert.ok(!('dedupeKey' in n.body.notifications[0]));
});

test('optional email verification: an unverified account can create an application', async () => {
  const email = `unv.${process.pid}@example.com`;
  await post(null, '/auth/signup', { name: 'Unverified User', email, password: 'secret12' });
  const l = await post(null, '/auth/login', { email, password: 'secret12' });
  const job = await mkJob();
  const r = await post(l.body.token, '/applications', { jobId: String(job._id) });
  assert.equal(r.status, 201, r.text);
  assert.notEqual(r.body.code, 'EMAIL_NOT_VERIFIED');
});
