/*
 * Contact / support management API tests (node:test). Needs a LOCAL disposable MongoDB:
 *
 *   CONTACT_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:contact
 *
 * Refuses anything that is not localhost/127.0.0.1. Starts the API as a child process with explicit MONGO_URI and JWT_SECRET
 * (never the .env values), uses its own database and drops it at the end.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

const BASE = process.env.CONTACT_TEST_MONGO || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('Set CONTACT_TEST_MONGO to a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27017');
}
const PORT = Number(process.env.TEST_PORT || 5220);
const DB = `careernest_b2a2_contact_${process.pid}`;
const URI = `${BASE.replace(/\/$/, '')}/${DB}`;
const API = `http://127.0.0.1:${PORT}/api`;
const SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
const PW = 'Sunrise2025';
let server;

const call = async (token, method, url, body) => {
  const res = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await res.text();
  let json = null;
  try { json = JSON.parse(raw); } catch { /* not json */ }
  return { status: res.status, body: json, raw };
};
const get = (t, u) => call(t, 'GET', u);
const post = (t, u, b) => call(t, 'POST', u, b);
const put = (t, u, b) => call(t, 'PUT', u, b);
const col = (n) => mongoose.connection.collection(n);

let seq = 0;
const newUser = async (tag, { verified = true, admin = false } = {}) => {
  const email = `${tag}${++seq}.${process.pid}@example.com`;
  const s = await post(null, '/auth/signup', { name: `Tester ${tag}`, email, password: PW });
  assert.equal(s.status, 201, s.raw);
  const l = await post(null, '/auth/login', { email, password: PW });
  assert.equal(l.status, 200);
  const $set = { emailVerified: verified };
  if (admin) $set.role = 'admin';
  await col('users').updateOne({ email }, { $set });
  // re-login so a role change is reflected in the token (role is read from the DB per request anyway)
  const l2 = await post(null, '/auth/login', { email, password: PW });
  return { email, token: l2.body.token, id: l2.body.user.id, oid: new mongoose.Types.ObjectId(l2.body.user.id) };
};

let admin;
let admin2;
let alice;
let bob;
before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, MONGO_URI: URI, JWT_SECRET: SECRET, PORT: String(PORT), CLIENT_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test', EMAIL_TRANSPORT: 'outbox' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 25000);
    server.stdout.on('data', (d) => { if (String(d).includes('Server running')) { clearTimeout(t); resolve(); } });
    server.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  });
  await mongoose.connect(URI);
  admin = await newUser('adm', { admin: true });
  admin2 = await newUser('adm2', { admin: true });
  alice = await newUser('alice');
  bob = await newUser('bob');
});

after(async () => {
  if (server) server.kill();
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  await mongoose.disconnect();
});

const submit = (u, over = {}) => post(u.token, '/contact', { category: 'bug', subject: 'Cannot save a job', message: 'Clicking save does nothing on the job page.', ...over });
let n = 0;
const uniq = (u, over = {}) => submit(u, { subject: `Subject number ${++n}`, message: `Message body number ${n} with enough text`, ...over });

// ----------------------------------------------------------------- user form
test('create: validation, enum, types and trimming', async () => {
  const bad = [
    { subject: 'ab', message: 'long enough message' },
    { subject: 'Valid subject', message: 'short' },
    { subject: 'x'.repeat(121), message: 'long enough message' },
    { subject: 'Valid subject', message: 'm'.repeat(2001) },
    { subject: 'Valid subject', message: 'long enough message', category: 'nonsense' },
    { subject: 'Valid subject', message: 'long enough message', category: 5 },
    { subject: ['a'], message: 'long enough message' },
    { subject: { $ne: 1 }, message: 'long enough message' },
    { subject: 'Valid subject', message: 12345678901 },
    {},
  ];
  for (const b of bad) assert.equal((await post(alice.token, '/contact', b)).status, 400, JSON.stringify(b));
  const ok = await post(alice.token, '/contact', { subject: '  Padded subject  ', message: '  A padded message body here  ' });
  assert.equal(ok.status, 201, ok.raw);
  assert.equal(ok.body.ticket.subject, 'Padded subject');
  assert.equal(ok.body.ticket.category, 'other'); // default
  assert.equal(ok.body.ticket.status, 'open');
});

test('create: identity comes from the token, client-supplied identity is ignored', async () => {
  const r = await uniq(alice, { name: 'Mallory', email: 'mallory@evil.example', user: String(bob.id), status: 'resolved', assignee: String(bob.id), internalNotes: [{ text: 'x' }] });
  assert.equal(r.status, 201);
  const doc = await col('contactmessages').findOne({ _id: new mongoose.Types.ObjectId(r.body.ticket.id) });
  assert.equal(String(doc.user), alice.id);
  assert.equal(doc.email, alice.email);
  assert.equal(doc.name, 'Tester alice');
  assert.equal(doc.status, 'open');
  assert.equal(doc.assignee, null);
  assert.equal((doc.internalNotes || []).length, 0);
});

test('create: auth required, unverified email allowed (optional verification), duplicates refused, rate limit', async () => {
  assert.equal((await post(null, '/contact', { subject: 'Valid subject', message: 'long enough message' })).status, 401);
  const unverified = await newUser('unv', { verified: false });
  const r = await submit(unverified);
  assert.equal(r.status, 201, 'optional email verification: an unverified user can contact support');

  const carol = await newUser('carol');
  const first = await submit(carol);
  assert.equal(first.status, 201);
  const dup = await submit(carol, { subject: ' cannot SAVE a job ' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.code, 'DUPLICATE_SUBMISSION');
  for (let i = 0; i < 4; i += 1) assert.equal((await uniq(carol)).status, 201);
  assert.equal((await uniq(carol)).status, 429); // 5 per hour
});

// ----------------------------------------------------------------- history
test('history: own list with pagination, own detail, other users get 404, no internal data', async () => {
  const dave = await newUser('dave');
  const ids = [];
  for (let i = 0; i < 3; i += 1) ids.push((await uniq(dave)).body.ticket.id);
  const l1 = await get(dave.token, '/contact?limit=2&page=1');
  assert.equal(l1.status, 200);
  assert.equal(l1.body.total, 3);
  assert.equal(l1.body.pages, 2);
  assert.equal(l1.body.messages.length, 2);
  assert.equal(l1.body.messages[0].id, ids[2]); // newest first
  assert.equal((await get(dave.token, '/contact?limit=2&page=2')).body.messages.length, 1);
  assert.ok(!l1.raw.includes('internalNotes') && !l1.raw.includes(dave.email));

  const other = await get(bob.token, `/contact/${ids[0]}`);
  assert.equal(other.status, 404);
  assert.equal((await get(bob.token, '/contact')).body.messages.every((m) => !ids.includes(m.id)), true);
  assert.equal((await get(dave.token, '/contact/not-an-id')).status, 400);
  assert.equal((await get(dave.token, `/contact/${new mongoose.Types.ObjectId()}`)).status, 404);
  assert.equal((await get(null, '/contact')).status, 401);
  const mine = await get(dave.token, `/contact/${ids[0]}`);
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.ticket.responses, []);
});

// ----------------------------------------------------------------- admin authz
test('admin support endpoints: 401 without token, 403 for non-admins', async () => {
  const t = (await uniq(alice)).body.ticket.id;
  const calls = [['GET', '/admin/support'], ['GET', '/admin/support/counts'], ['GET', `/admin/support/${t}`], ['PUT', `/admin/support/${t}/status`, { status: 'resolved' }],
    ['PUT', `/admin/support/${t}/assignee`, { assignee: null }], ['POST', `/admin/support/${t}/notes`, { text: 'x' }], ['POST', `/admin/support/${t}/responses`, { text: 'x' }]];
  for (const [m, u, b] of calls) {
    assert.equal((await call(null, m, u, b)).status, 401, `${m} ${u}`);
    assert.equal((await call(alice.token, m, u, b)).status, 403, `${m} ${u}`);
  }
  // nothing changed by the rejected calls
  const doc = await col('contactmessages').findOne({ _id: new mongoose.Types.ObjectId(t) });
  assert.equal(doc.status, 'open');
  assert.equal((doc.responses || []).length, 0);
  assert.equal((await get(admin.token, '/admin/support/zzz')).status, 400);
  assert.equal((await get(admin.token, `/admin/support/${new mongoose.Types.ObjectId()}`)).status, 404);
});

// ----------------------------------------------------------------- list / filters / search
test('admin list: filters, search (regex-safe), sort, pagination, counts, unread', async () => {
  const erin = await newUser('erin');
  await submit(erin, { category: 'jobs', subject: 'Zebra widget broken', message: 'The zebra widget (v1.0) fails [badly]' });
  await submit(erin, { category: 'referrals', subject: 'Referral question', message: 'How do referrals work for me here' });
  const all = await get(admin.token, '/admin/support?limit=50');
  assert.equal(all.status, 200);
  assert.ok(all.body.total >= 2);

  const byCat = await get(admin.token, '/admin/support?category=jobs&q=zebra');
  assert.equal(byCat.body.total, 1);
  assert.equal(byCat.body.messages[0].subject, 'Zebra widget broken');
  assert.equal(byCat.body.messages[0].user.email, erin.email);
  assert.equal(byCat.body.messages[0].unread, true);

  assert.equal((await get(admin.token, `/admin/support?q=${encodeURIComponent('(v1.0) fails [badly]')}`)).body.total, 1); // regex chars are literal
  assert.equal((await get(admin.token, `/admin/support?q=${encodeURIComponent('.*')}`)).body.total, 0);
  assert.equal((await get(admin.token, `/admin/support?q=${encodeURIComponent(erin.email)}`)).body.total, 2); // by user email
  assert.equal((await get(admin.token, '/admin/support?q=Tester%20erin')).body.total, 2); // by user name
  assert.equal((await get(admin.token, '/admin/support?status=resolved&q=zebra')).body.total, 0);
  assert.equal((await get(admin.token, '/admin/support?status=bogus')).status, 400);
  assert.equal((await get(admin.token, '/admin/support?category=bogus')).status, 400);
  assert.equal((await get(admin.token, '/admin/support?sort=bogus')).status, 400);
  assert.equal((await get(admin.token, '/admin/support?q=a&q=b')).status, 400);

  const asc = await get(admin.token, `/admin/support?q=${encodeURIComponent(erin.email)}&sort=oldest`);
  assert.equal(asc.body.messages[0].subject, 'Zebra widget broken');
  const p1 = await get(admin.token, '/admin/support?limit=1&page=1');
  assert.equal(p1.body.count, 1);
  assert.ok(p1.body.pages >= 2);

  const c1 = await get(admin.token, '/admin/support/counts');
  assert.equal(c1.status, 200);
  assert.ok(c1.body.open >= 2 && c1.body.unread >= 1);
  const id = byCat.body.messages[0].id;
  await get(admin.token, `/admin/support/${id}`); // viewing marks it read
  assert.equal((await get(admin.token, '/admin/support?q=zebra')).body.messages[0].unread, false);
  assert.equal((await get(admin.token, '/admin/support/counts')).body.unread, c1.body.unread - 1);
});

// ----------------------------------------------------------------- transitions
test('status transitions are validated and audited', async () => {
  const id = (await uniq(alice)).body.ticket.id;
  const set = (s) => put(admin.token, `/admin/support/${id}/status`, { status: s });
  assert.equal((await set('bogus')).status, 400);
  assert.equal((await put(admin.token, `/admin/support/${id}/status`, {})).status, 400);
  assert.equal((await set('open')).status, 409); // same state is not a transition
  assert.equal((await set('in-progress')).status, 200);
  assert.equal((await set('resolved')).status, 200);
  assert.equal((await set('open')).status, 200); // reopen from resolved
  assert.equal((await set('closed')).status, 200);
  const dead = await set('open');
  assert.equal(dead.status, 409);
  assert.equal(dead.body.code, 'INVALID_TRANSITION');
  assert.equal((await set('in-progress')).status, 409);
  const logs = await col('adminauditlogs').find({ targetType: 'support', targetId: new mongoose.Types.ObjectId(id), action: 'support.status' }).toArray();
  assert.equal(logs.length, 4);
  for (const l of logs) assert.ok(!l.summary.includes('@') && !l.summary.includes('Tester'));
  // the user sees the status and got a notification for resolved/closed
  const mine = await get(alice.token, `/contact/${id}`);
  assert.equal(mine.body.ticket.status, 'closed');
  const notes = await get(alice.token, '/notifications');
  assert.ok(notes.body.notifications.some((x) => x.type === 'support' && x.link === `/contact/history/${id}`));
});

// ----------------------------------------------------------------- assignee / notes / responses
test('assignee: must be an active admin; audited', async () => {
  const id = (await uniq(alice)).body.ticket.id;
  const url = `/admin/support/${id}/assignee`;
  assert.equal((await put(admin.token, url, { assignee: 'nope' })).status, 400);
  assert.equal((await put(admin.token, url, { assignee: bob.id })).status, 400); // not an admin
  assert.equal((await put(admin.token, url, { assignee: String(new mongoose.Types.ObjectId()) })).status, 400);
  const ok = await put(admin.token, url, { assignee: admin2.id });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.ticket.assignee.id, admin2.id);
  assert.equal((await get(admin.token, `/admin/support?assignee=${admin2.id}`)).body.messages.some((m) => m.id === id), true);
  assert.equal((await get(admin.token, '/admin/support?assignee=unassigned')).body.messages.some((m) => m.id === id), false);
  assert.equal((await put(admin.token, url, { assignee: null })).body.ticket.assignee, null);
  assert.ok(await col('adminauditlogs').findOne({ action: 'support.assign', targetId: new mongoose.Types.ObjectId(id) }));
});

test('internal notes never reach users, email or the export; responses do', async () => {
  const frank = await newUser('frank');
  const id = (await uniq(frank)).body.ticket.id;
  assert.equal((await post(admin.token, `/admin/support/${id}/notes`, { text: '' })).status, 400);
  assert.equal((await post(admin.token, `/admin/support/${id}/notes`, { text: 5 })).status, 400);
  assert.equal((await post(admin.token, `/admin/support/${id}/notes`, { text: 'n'.repeat(2001) })).status, 400);
  const note = await post(admin.token, `/admin/support/${id}/notes`, { text: 'SECRET-INTERNAL-NOTE looks like a known bug' });
  assert.equal(note.status, 201);
  assert.equal(note.body.ticket.internalNotes.length, 1);

  assert.equal((await post(admin.token, `/admin/support/${id}/responses`, { text: '   ' })).status, 400);
  assert.equal((await post(admin.token, `/admin/support/${id}/responses`, { text: 'r'.repeat(4001) })).status, 400);
  const resp = await post(admin.token, `/admin/support/${id}/responses`, { text: 'PUBLIC-REPLY we have fixed this' });
  assert.equal(resp.status, 201, resp.raw);
  assert.equal(resp.body.ticket.status, 'in-progress'); // first reply moves open -> in-progress

  const detail = await get(frank.token, `/contact/${id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.ticket.responses.length, 1);
  assert.equal(detail.body.ticket.responses[0].text, 'PUBLIC-REPLY we have fixed this');
  assert.equal(detail.body.ticket.responses[0].from, 'CareerNest Support');
  const list = await get(frank.token, '/contact');
  assert.equal(list.body.messages[0].latestResponse.text, 'PUBLIC-REPLY we have fixed this');
  for (const r of [detail, list, await get(frank.token, '/notifications')]) {
    assert.ok(!r.raw.includes('SECRET-INTERNAL-NOTE'), 'internal note leaked');
    assert.ok(!r.raw.includes(admin.id) && !r.raw.includes(admin.email), 'admin identity leaked');
  }
  const exp = await get(frank.token, '/account/export');
  if (exp.status === 200) {
    assert.ok(!exp.raw.includes('SECRET-INTERNAL-NOTE') && !exp.raw.includes(admin.id));
    assert.ok(exp.raw.includes('PUBLIC-REPLY'));
  }
  // admin sees both
  const a = await get(admin.token, `/admin/support/${id}`);
  assert.equal(a.body.ticket.internalNotes[0].text.startsWith('SECRET'), true);
  assert.equal(a.body.ticket.responses.length, 1);
  // audit entries without personal data or text
  const logs = await col('adminauditlogs').find({ targetType: 'support', targetId: new mongoose.Types.ObjectId(id) }).toArray();
  assert.deepEqual(logs.map((l) => l.action).sort(), ['support.note', 'support.respond']);
  for (const l of logs) assert.ok(!l.summary.includes('SECRET') && !l.summary.includes('PUBLIC') && !l.summary.includes('@'));
});

test('response: notification + honest email delivery state; closed tickets refuse replies', async () => {
  const gina = await newUser('gina');
  const id = (await uniq(gina)).body.ticket.id;
  await post(admin.token, `/admin/support/${id}/notes`, { text: 'INTERNAL-ONLY-XYZ' });
  const r = await post(admin.token, `/admin/support/${id}/responses`, { text: 'Hello from support' });
  assert.equal(r.status, 201);
  // Dev outbox only stores the message locally: the state must say so, never "delivered".
  assert.equal(r.body.emailDelivery, 'stored_local');
  assert.equal(r.body.ticket.responses[0].emailDelivery, 'stored_local');
  const out = await col('outboxemails').find({ to: gina.email, template: 'supportReply' }).toArray();
  assert.equal(out.length, 1);
  assert.ok(out[0].text.includes('Hello from support'));
  assert.ok(!out[0].text.includes('INTERNAL-ONLY-XYZ') && !out[0].html.includes('INTERNAL-ONLY-XYZ'));
  const notes = await get(gina.token, '/notifications');
  const n = notes.body.notifications.find((x) => x.type === 'support');
  assert.ok(n);
  assert.equal(n.link, `/contact/history/${id}`);
  assert.ok(!notes.raw.includes('Hello from support')); // the notification does not copy the reply text

  const noEmail = await post(admin.token, `/admin/support/${id}/responses`, { text: 'Second reply, no email', sendEmail: false });
  assert.equal(noEmail.body.emailDelivery, 'not_requested');
  assert.equal(await col('outboxemails').countDocuments({ to: gina.email, template: 'supportReply' }), 1);

  await put(admin.token, `/admin/support/${id}/status`, { status: 'closed' });
  const closed = await post(admin.token, `/admin/support/${id}/responses`, { text: 'Too late' });
  assert.equal(closed.status, 409);
  assert.equal(closed.body.code, 'CLOSED');
});

// ----------------------------------------------------------------- notification preference
test('support notifications honour the user preference when the key exists', async () => {
  const hank = await newUser('hank');
  const pref = await put(hank.token, '/auth/profile', { notificationPrefs: { support: false } });
  const id = (await uniq(hank)).body.ticket.id;
  await post(admin.token, `/admin/support/${id}/responses`, { text: 'Reply for hank', sendEmail: false });
  const stored = (await get(hank.token, `/contact/${id}`)).body.ticket;
  assert.equal(stored.responses.length, 1); // the in-app reply is always stored, whatever the preference
  const notes = await get(hank.token, '/notifications');
  if (pref.status === 200 && (await col('users').findOne({ _id: hank.oid })).notificationPrefs?.support === false) {
    assert.ok(!notes.body.notifications.some((x) => x.type === 'support'));
  }
});

// ----------------------------------------------------------------- account deletion
test('account deletion anonymizes support history instead of deleting it', async () => {
  const ivy = await newUser('ivy');
  const id = (await submit(ivy, { subject: 'Private IVY subject', message: 'Private IVY message body text' })).body.ticket.id;
  await post(admin.token, `/admin/support/${id}/responses`, { text: 'Admin answer stays', sendEmail: false });
  await post(admin.token, `/admin/support/${id}/notes`, { text: 'Admin note stays' });
  const del = await post(ivy.token, '/account/delete', { password: PW, confirmation: 'DELETE' });
  assert.equal(del.status, 200, del.raw);
  const doc = await col('contactmessages').findOne({ _id: new mongoose.Types.ObjectId(id) });
  assert.ok(doc, 'ticket must be preserved');
  assert.ok(doc.anonymizedAt);
  assert.equal(doc.subject, '[removed at user request]');
  assert.equal(doc.message, '[removed at user request]');
  assert.equal(doc.name, '');
  assert.equal(doc.email, '');
  assert.equal(doc.category, 'bug');
  assert.equal(doc.responses[0].text, 'Admin answer stays');
  assert.equal(doc.internalNotes[0].text, 'Admin note stays');
  const a = await get(admin.token, `/admin/support/${id}`);
  assert.equal(a.status, 200);
  assert.equal(a.body.ticket.user.name, 'Deleted user');
  assert.ok(!a.raw.includes('IVY') && !a.raw.includes(ivy.email));
  assert.equal((await get(admin.token, '/admin/support?q=IVY')).body.total, 0);
  const reply = await post(admin.token, `/admin/support/${id}/responses`, { text: 'no one to read this' });
  assert.equal(reply.status, 409);
  assert.equal(reply.body.code, 'ANONYMIZED');
});
