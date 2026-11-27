/*
 * Account management API tests (node:test): export, logout-all, deletion/anonymization. Needs a LOCAL disposable MongoDB:
 *
 *   ACCOUNT_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:account
 *
 * Refuses anything that is not localhost/127.0.0.1. Starts the API as child processes with explicit MONGO_URI/JWT_SECRET (never
 * the .env values), uses its own database (careernest_a4_*) and drops it at the end.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

const BASE = process.env.ACCOUNT_TEST_MONGO || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('Set ACCOUNT_TEST_MONGO to a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27017');
}
process.env.NODE_ENV = 'test';
const PORT = Number(process.env.TEST_PORT || 5204);
const PORT2 = PORT + 1;
const DB = `careernest_a4_account_${process.pid}`;
const URI = `${BASE.replace(/\/$/, '')}/${DB}`;
const api = (port) => `http://127.0.0.1:${port}/api`;
const SERVER_DIR = path.join(__dirname, '..', '..');
const SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
const PW = 'Sunrise2025';
const servers = [];

const startServer = async (port, extra = {}) => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, MONGO_URI: URI, JWT_SECRET: SECRET, PORT: String(port), CLIENT_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test', ...extra },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  servers.push(child);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 25000);
    child.stdout.on('data', (d) => { if (String(d).includes('Server running')) { clearTimeout(t); resolve(); } });
    child.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  });
  return child;
};

const callOn = (port) => async (token, method, url, body) => {
  const res = await fetch(api(port) + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text, headers: res.headers };
};
const call = callOn(PORT);

let seq = 0;
const newUser = async (tag = 'u', c = call) => {
  const email = `${tag}${++seq}.${process.pid}@example.com`;
  assert.equal((await c(null, 'POST', '/auth/signup', { name: `Person ${tag}${seq}`, email, password: PW })).status, 201);
  const l = await c(null, 'POST', '/auth/login', { email, password: PW });
  assert.equal(l.status, 200);
  return { email, token: l.body.token, id: l.body.user.id, oid: new mongoose.Types.ObjectId(l.body.user.id), name: l.body.user.name };
};
const col = (n) => mongoose.connection.collection(n);
const oid = (s) => new mongoose.Types.ObjectId(s);

let company;
let job;
before(async () => {
  await startServer(PORT);
  await mongoose.connect(URI);
  company = (await col('companies').insertOne({ name: 'Acme Test Co', industry: 'Tech' })).insertedId;
  job = (await col('jobs').insertOne({ title: 'Frontend Developer', company, city: 'Pune', jobDescription: 'Test', experienceLevel: 'experienced', isActive: true, source: 'demo', jobCode: 'CN-000001' })).insertedId;
});

after(async () => {
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  await mongoose.disconnect();
  for (const s of servers) { s.removeAllListeners('exit'); s.kill(); }
});

// Fills every user-owned collection for one user with rows that carry `tag` text.
const seedAll = async (u, tag) => {
  const now = new Date();
  const base = { user: u.oid, createdAt: now, updatedAt: now };
  const resume = (await col('resumes').insertOne({ ...base, fileName: `${tag}.pdf`, resumeText: `RESUME TEXT ${tag}`, name: tag })).insertedId;
  const app = (await col('applications').insertOne({ ...base, job, status: 'applied', appliedAt: now, statusHistory: [{ status: 'applied', at: now }] })).insertedId;
  await col('savedjobs').insertOne({ ...base, job });
  await col('resumeanalyses').insertOne({ ...base, resume, summary: `ANALYSIS ${tag}` });
  await col('coverletters').insertOne({ ...base, resume, generatedText: `LETTER ${tag}`, currentText: `LETTER ${tag}` });
  const gap = (await col('skillgapanalyses').insertOne({ ...base, title: `GAP ${tag}`, mode: 'manual', targetKind: 'role-only', targetRole: 'Dev', basis: 'manual-input', score: { value: 50 } })).insertedId;
  await col('learningroadmaps').insertOne({ ...base, analysis: gap, title: `ROADMAP ${tag}`, targetRole: 'Dev', stages: [] });
  await col('notifications').insertOne({ ...base, title: `NOTE ${tag}`, type: 'system', read: false });
  await col('interviews').insertOne({ ...base, application: app, job, scheduledAt: now, status: 'scheduled', notes: `INTERVIEW ${tag}` });
  const program = (await col('programs').insertOne({ slug: `p-${tag}-${process.pid}`, title: 'Prog', provider: 'Prov' })).insertedId;
  await col('programenrollments').insertOne({ ...base, program, status: 'in-progress' });
  await col('contactmessages').insertOne({ ...base, name: u.name, email: u.email, subject: `SUBJECT ${tag}`, message: `CONTACT MESSAGE ${tag}` });
  await col('authtokens').insertOne({ ...base, purpose: 'password_reset', tokenHash: `hash-${tag}-${u.id}`, expiresAt: new Date(Date.now() + 3600000) });
  await col('authrecoverystates').insertOne({ _id: `password_reset:${u.id}`, user: u.oid, purpose: 'password_reset', seq: 1, activeSeq: 1, active: { tokenId: new mongoose.Types.ObjectId(), hash: `hash-${tag}-${u.id}`, expiresAt: new Date(Date.now() + 3600000), tokenVersion: 0, seq: 1 } });
  await col('outboxemails').insertOne({ to: u.email, from: 'x@y.z', subject: 's', text: 't', html: 'h', template: 'reset', createdAt: now });
  return { resume, app };
};
const COLLECTIONS = ['resumes', 'applications', 'savedjobs', 'resumeanalyses', 'coverletters', 'skillgapanalyses', 'learningroadmaps', 'notifications', 'interviews', 'programenrollments', 'contactmessages', 'authtokens', 'authrecoverystates'];
const countFor = async (u) => {
  const out = {};
  // contact messages are anonymized (kept), not deleted: only rows still holding the user's own words count as remaining
  for (const c of COLLECTIONS) out[c] = await col(c).countDocuments(c === 'contactmessages' ? { user: u.oid, anonymizedAt: null } : { user: u.oid });
  out.outbox = await col('outboxemails').countDocuments({ to: u.email });
  return out;
};

// ---------------------------------------------------------------- policy completeness
test('every schema path referencing User has a deletion policy', () => {
  const { unmappedModels, findUserRefs, POLICY } = require('../../utils/account/policy');
  assert.deepEqual(unmappedModels(), []);
  const refs = findUserRefs();
  assert.ok(refs.length >= 15, `expected many User refs, got ${refs.length}`);
  for (const r of refs) assert.ok(POLICY[r.model], `${r.model}.${r.path}`);
});

// ---------------------------------------------------------------- auth required
test('all account endpoints require a valid token', async () => {
  for (const [m, u, b] of [['GET', '/account/export'], ['POST', '/account/logout-all', {}], ['POST', '/account/delete', { password: PW, confirmation: 'DELETE' }]]) {
    const r = await call(null, m, u, b);
    assert.equal(r.status, 401, `${m} ${u}`);
    assert.equal(r.body.code, 'NO_TOKEN');
    assert.equal((await call('garbage', m, u, b)).body.code, 'INVALID_TOKEN');
  }
});

// ---------------------------------------------------------------- logout everywhere
test('logout-all rejects every older token, a fresh login works, tokenVersion is incremented', async () => {
  const u = await newUser('lo');
  const second = (await call(null, 'POST', '/auth/login', { email: u.email, password: PW })).body.token;
  const before = (await col('users').findOne({ _id: u.oid })).tokenVersion || 0;
  assert.equal((await call(u.token, 'GET', '/auth/me')).status, 200);
  assert.equal((await call(second, 'GET', '/auth/me')).status, 200);

  const r = await call(u.token, 'POST', '/account/logout-all', {});
  assert.equal(r.status, 200);
  assert.equal((await col('users').findOne({ _id: u.oid })).tokenVersion, before + 1);
  for (const t of [u.token, second]) {
    const me = await call(t, 'GET', '/auth/me');
    assert.equal(me.status, 401);
    assert.equal(me.body.code, 'INVALID_TOKEN');
  }
  const again = await call(null, 'POST', '/auth/login', { email: u.email, password: PW });
  assert.equal(again.status, 200);
  assert.equal((await call(again.body.token, 'GET', '/auth/me')).status, 200);
  // a concurrent burst bumps once per request, never loses an increment
  await Promise.all([1, 2, 3].map(() => call(again.body.token, 'POST', '/account/logout-all', {})));
  const v = (await col('users').findOne({ _id: u.oid })).tokenVersion;
  assert.ok(v >= before + 2 && v <= before + 4);
});

// ---------------------------------------------------------------- export
test('export contains the user data, metadata and a dated filename', async () => {
  const a = await newUser('exa');
  await seedAll(a, 'AAA');
  await call(a.token, 'PUT', '/auth/profile', { phone: '+91 98765 43210', headline: 'HEADLINE-A', skills: [{ name: 'React', level: 'advanced' }] });
  const r = await call(a.token, 'GET', '/account/export');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /attachment; filename="careernest-data-export-\d{4}-\d{2}-\d{2}\.json"/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const d = r.body;
  assert.equal(d.meta.schemaVersion, 1);
  assert.ok(!Number.isNaN(Date.parse(d.meta.generatedAt)));
  assert.equal(d.profile.email, a.email);
  assert.equal(d.profile.headline, 'HEADLINE-A');
  assert.equal(d.profile.skills[0].name, 'React');
  assert.equal(d.resumes[0].resumeText, 'RESUME TEXT AAA');
  assert.equal(d.applications[0].job.title, 'Frontend Developer');
  assert.equal(d.applications[0].statusHistory[0].status, 'applied');
  assert.equal(d.savedJobs[0].job.company, 'Acme Test Co');
  assert.equal(d.coverLetters[0].currentText, 'LETTER AAA');
  assert.equal(d.skillGapAnalyses[0].title, 'GAP AAA');
  assert.equal(d.learningRoadmaps[0].title, 'ROADMAP AAA');
  assert.equal(d.notifications[0].title, 'NOTE AAA');
  assert.equal(d.interviews[0].notes, 'INTERVIEW AAA');
  assert.equal(d.programEnrollments[0].program.title, 'Prog');
  assert.equal(d.contactMessages[0].message, 'CONTACT MESSAGE AAA');
  assert.equal(d.settings.notificationPreferences.applications, true);
  for (const [k, n] of Object.entries(d.meta.counts)) assert.ok(n >= 0, k);
});

test('export never contains secrets, other users data, or counterparty contact details', async () => {
  const a = await newUser('pa');
  const b = await newUser('pb');
  await seedAll(a, 'ALPHA-A');
  await seedAll(b, 'BRAVO-B');
  await col('users').updateOne({ _id: b.oid }, { $set: { currentCompany: 'BravoCorp', currentCompanyRole: 'Lead', phone: '+1 555 0100', bio: 'BIO-BRAVO-B' } });
  await col('users').updateOne({ _id: a.oid }, { $set: { currentCompany: 'AlphaCorp' } });
  const now = new Date();
  // A -> B (A sent), B -> A (A received)
  await col('referrals').insertOne({ seeker: a.oid, referrer: b.oid, message: 'MSG-FROM-A', status: 'pending', active: true, jobKey: 'k1', job: { title: 'Dev', company: 'BravoCorp' }, resumeInfo: { name: 'A resume', fileName: 'a.pdf', fileType: 'pdf' }, resumeSnapshot: { text: 'SNAPSHOT-A-TEXT' }, statusHistory: [{ status: 'pending', at: now }], createdAt: now, updatedAt: now });
  await col('referrals').insertOne({ seeker: b.oid, referrer: a.oid, message: 'MSG-FROM-B-PRIVATE', status: 'pending', active: true, jobKey: 'k2', resumeInfo: { name: 'B resume', fileName: 'b.pdf', fileType: 'pdf' }, resumeSnapshot: { text: 'SNAPSHOT-B-TEXT' }, statusHistory: [{ status: 'pending', at: now }], createdAt: now, updatedAt: now });

  const r = await call(a.token, 'GET', '/account/export');
  assert.equal(r.status, 200);
  const text = r.text;
  for (const forbidden of ['BRAVO-B', 'MSG-FROM-B-PRIVATE', 'SNAPSHOT-B-TEXT', 'SNAPSHOT-A-TEXT', b.email, b.id, 'BIO-BRAVO-B', '+1 555 0100', 'tokenVersion', 'tokenHash', 'hash-ALPHA', '"password"', '$2a$', '$2b$', 'roadmapLock', 'inputHash']) {
    assert.ok(!text.includes(forbidden), `export leaked ${forbidden}`);
  }
  assert.ok(text.includes('ALPHA-A'));
  assert.equal(r.body.referrals.length, 2);
  const sent = r.body.referrals.find((x) => x.direction === 'sent');
  const received = r.body.referrals.find((x) => x.direction === 'received');
  assert.equal(sent.message, 'MSG-FROM-A');
  assert.deepEqual(Object.keys(sent.counterparty).sort(), ['company', 'name', 'role']);
  assert.equal(received.message, undefined);
  assert.equal(received.counterparty.name, b.name);
  assert.equal(r.body.profile.role, undefined);
  // and symmetric: B's export has none of A
  const rb = await call(b.token, 'GET', '/account/export');
  for (const forbidden of ['ALPHA-A', 'MSG-FROM-A', a.email, a.id]) assert.ok(!rb.text.includes(forbidden), `B export leaked ${forbidden}`);
});

// ---------------------------------------------------------------- deletion
test('deletion needs the typed confirmation and the right password; nothing changes on rejection', async () => {
  const u = await newUser('dr');
  await seedAll(u, 'KEEP');
  const before = await countFor(u);
  for (const body of [undefined, {}, { password: PW }, { password: PW, confirmation: 'delete' }, { password: PW, confirmation: 'yes' }]) {
    const r = await call(u.token, 'POST', '/account/delete', body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.body.code, 'CONFIRMATION_REQUIRED');
  }
  for (const pw of [undefined, '', 'WrongPass123', { $ne: '' }]) {
    const r = await call(u.token, 'POST', '/account/delete', { password: pw, confirmation: 'DELETE' });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'INVALID_PASSWORD');
  }
  assert.deepEqual(await countFor(u), before);
  const doc = await col('users').findOne({ _id: u.oid });
  assert.equal(doc.deletedAt ?? null, null);
  assert.equal(doc.email, u.email);
  assert.equal((await call(u.token, 'GET', '/auth/me')).status, 200);
});

test('deletion anonymizes the user, removes owned data, keeps counterparties usable, blocks token and login, frees the email', async () => {
  const a = await newUser('da');
  const b = await newUser('db'); // counterparty
  await seedAll(a, 'DEL-A');
  await seedAll(b, 'KEEP-B');
  await call(a.token, 'PUT', '/auth/profile', { phone: '+91 90000 11111', bio: 'secret bio', location: 'Pune', headline: 'H', skills: [{ name: 'Go' }], isReferrer: true, currentCompany: 'DelCorp', linkedinUrl: 'https://linkedin.com/in/x' });
  const now = new Date();
  const ins = async (doc) => (await col('referrals').insertOne({ statusHistory: [{ status: doc.status, at: now }], createdAt: now, updatedAt: now, ...doc })).insertedId;
  const aSeeker = await ins({ seeker: a.oid, referrer: b.oid, message: 'A-WROTE-THIS', status: 'pending', active: true, jobKey: 'x1', resumeInfo: { name: 'n', fileName: 'f.pdf', fileType: 'pdf' }, resumeSnapshot: { text: 'A-SNAPSHOT' } });
  const aSeekerDone = await ins({ seeker: a.oid, referrer: b.oid, message: 'A-OLD-MESSAGE', status: 'referred', active: false, jobKey: 'x2' });
  const aReferrer = await ins({ seeker: b.oid, referrer: a.oid, message: 'B-WROTE-THIS', status: 'accepted', active: true, jobKey: 'x3', resumeInfo: { name: 'bn', fileName: 'b.pdf', fileType: 'pdf' }, resumeSnapshot: { text: 'B-SNAPSHOT' } });
  const reset = await call(null, 'POST', '/auth/forgot-password', { email: a.email });
  assert.ok([200, 202, 503].includes(reset.status));

  // second device
  const second = (await call(null, 'POST', '/auth/login', { email: a.email, password: PW })).body.token;
  const bBefore = await countFor(b);

  const r = await call(a.token, 'POST', '/account/delete', { password: PW, confirmation: 'DELETE' });
  assert.equal(r.status, 200, r.text);

  // User document
  const doc = await col('users').findOne({ _id: a.oid });
  assert.equal(doc.name, 'Deleted user');
  assert.equal(doc.email, `deleted+${a.id}@deleted.invalid`);
  assert.ok(!String(doc.password).startsWith('$2'));
  assert.equal(doc.role, 'jobseeker');
  assert.ok(doc.deletedAt);
  assert.ok(doc.deletionCompletedAt);
  assert.ok(doc.tokenVersion >= 1);
  assert.equal(doc.isReferrer, false);
  for (const f of ['phone', 'bio', 'location', 'headline', 'skills', 'currentCompany', 'linkedinUrl', 'seekingRole', 'careerInterests', 'education', 'experiences', 'domains', 'termsAcceptedAt', 'referralCompanies']) {
    assert.ok(doc[f] === undefined || doc[f] === null || (Array.isArray(doc[f]) && doc[f].length === 0), `${f} not wiped`);
  }
  assert.deepEqual(doc.notificationPrefs, { applications: false, interviews: false, referrals: false, programs: false, reminders: false, support: false });
  assert.ok(!JSON.stringify(doc).includes(a.email));

  // Owned collections are empty
  const after = await countFor(a);
  for (const [k, n] of Object.entries(after)) assert.equal(n, 0, k);
  // Support history is preserved but anonymized (docs/28): placeholder text, no identity snapshot
  const cm = await col('contactmessages').findOne({ user: a.oid });
  assert.ok(cm.anonymizedAt);
  assert.equal(cm.subject, '[removed at user request]');
  assert.equal(cm.message, '[removed at user request]');
  assert.equal(cm.name, '');
  assert.equal(cm.email, '');

  // Referrals: deleted side's content removed, open requests closed, counterparty record intact
  const s1 = await col('referrals').findOne({ _id: aSeeker });
  assert.equal(s1.status, 'withdrawn');
  assert.equal(s1.active, false);
  assert.equal(s1.message, '');
  assert.equal(s1.resumeSnapshot, undefined);
  assert.equal(s1.resumeInfo, undefined);
  assert.equal((await col('referrals').findOne({ _id: aSeekerDone })).message, '');
  const r3 = await col('referrals').findOne({ _id: aReferrer });
  assert.equal(r3.status, 'declined');
  assert.equal(r3.active, false);
  assert.equal(r3.message, 'B-WROTE-THIS'); // the counterparty's own words and resume copy stay with the counterparty
  assert.equal(r3.resumeSnapshot.text, 'B-SNAPSHOT');
  const mine = await call(b.token, 'GET', '/referrals/mine');
  assert.equal(mine.status, 200);
  assert.ok(!mine.text.includes(a.email) && !mine.text.includes('DelCorp'));
  const incoming = await call(b.token, 'GET', '/referrals/incoming');
  assert.equal(incoming.status, 200);
  assert.ok(!incoming.text.includes('A-WROTE-THIS') && !incoming.text.includes('A-OLD-MESSAGE') && !incoming.text.includes('A-SNAPSHOT'));
  assert.ok(incoming.text.includes('Deleted user') || mine.text.includes('Deleted user'));

  // Counterparty data untouched
  assert.deepEqual(await countFor(b), bBefore);
  assert.equal((await call(b.token, 'GET', '/auth/me')).status, 200);
  // The deleted user is no longer discoverable as a referrer
  const find = await call(b.token, 'GET', '/referrals/find?company=DelCorp');
  assert.ok(!find.text.includes(a.id));

  // Tokens and login
  for (const t of [a.token, second]) {
    const me = await call(t, 'GET', '/auth/me');
    assert.equal(me.status, 401);
    assert.equal(me.body.code, 'INVALID_TOKEN');
    assert.equal((await call(t, 'GET', '/account/export')).status, 401);
    assert.equal((await call(t, 'POST', '/account/delete', { password: PW, confirmation: 'DELETE' })).status, 401);
  }
  const bad = await call(null, 'POST', '/auth/login', { email: `nobody.${process.pid}@example.com`, password: PW });
  for (const email of [a.email, doc.email]) {
    const l = await call(null, 'POST', '/auth/login', { email, password: PW });
    assert.equal(l.status, 401);
    assert.deepEqual(l.body, bad.body); // identical to an unknown account
  }
  assert.equal((await call(null, 'POST', '/auth/forgot-password', { email: doc.email })).status, (await call(null, 'POST', '/auth/forgot-password', { email: `nobody.${process.pid}@example.com` })).status);
  assert.equal(await col('authtokens').countDocuments({ user: a.oid }), 0);

  // The original email can be used for a brand-new account, which has none of the old data
  const again = await call(null, 'POST', '/auth/signup', { name: 'New Person', email: a.email, password: PW });
  assert.equal(again.status, 201);
  const login = await call(null, 'POST', '/auth/login', { email: a.email, password: PW });
  assert.equal(login.status, 200);
  assert.notEqual(login.body.user.id, a.id);
  const exp = await call(login.body.token, 'GET', '/account/export');
  assert.equal(exp.body.applications.length, 0);
  assert.ok(!exp.text.includes('DEL-A'));
});

test('last admin cannot delete the account; with a second admin the first can, then the second is last', async () => {
  const a1 = await newUser('ad');
  const a2 = await newUser('ad');
  await col('users').updateMany({ _id: { $in: [a1.oid, a2.oid] } }, { $set: { role: 'admin' } });
  // other admins from earlier tests do not exist (none are promoted), but make sure only these two count
  await col('users').updateMany({ _id: { $nin: [a1.oid, a2.oid] }, role: 'admin' }, { $set: { role: 'jobseeker' } });

  const first = await call(a1.token, 'POST', '/account/delete', { password: PW, confirmation: 'DELETE' });
  assert.equal(first.status, 200, first.text);
  const doc = await col('users').findOne({ _id: a1.oid });
  assert.equal(doc.role, 'jobseeker');
  const last = await call(a2.token, 'POST', '/account/delete', { password: PW, confirmation: 'DELETE' });
  assert.equal(last.status, 409);
  assert.equal(last.body.code, 'LAST_ADMIN');
  const still = await col('users').findOne({ _id: a2.oid });
  assert.equal(still.role, 'admin');
  assert.equal(still.deletedAt ?? null, null);
  assert.equal((await call(a2.token, 'GET', '/auth/me')).status, 200);
});

test('two admins deleting at the same moment never leave zero admins', async () => {
  const x = await newUser('race');
  const y = await newUser('race');
  await col('users').updateMany({ role: 'admin' }, { $set: { role: 'jobseeker' } });
  await col('users').updateMany({ _id: { $in: [x.oid, y.oid] } }, { $set: { role: 'admin' } });
  const rs = await Promise.all([x, y].map((u) => call(u.token, 'POST', '/account/delete', { password: PW, confirmation: 'DELETE' })));
  const codes = rs.map((r) => r.status).sort();
  assert.ok(codes.includes(200), JSON.stringify(rs.map((r) => r.body)));
  assert.equal(await col('users').countDocuments({ role: 'admin', deletedAt: null }), 1);
});

test('referral deletion cleanup stays idempotent when re-run, and reports nothing pending', async () => {
  const { completePendingDeletions, runCleanup } = require('../../utils/account/deletion');
  const u = await newUser('idem');
  await seedAll(u, 'IDEM');
  assert.equal((await call(u.token, 'POST', '/account/delete', { password: PW, confirmation: 'DELETE' })).status, 200);
  assert.equal(await runCleanup(u.id), true);
  assert.equal(await runCleanup(u.id), true);
  const r = await completePendingDeletions({ graceMs: 0 });
  assert.equal(r.failed, 0);
  assert.equal(r.found, 0);
});

// ---------------------------------------------------------------- partial failure
test('a failure mid-cleanup is reported as incomplete (never success), the account stays locked, and the sweep finishes it', async () => {
  const c2 = callOn(PORT2);
  await startServer(PORT2, {
    AUTH_TEST_FAULT: JSON.stringify([{ point: 'account.cleanup.Notification', action: 'throw', times: 1 }]),
    ACCOUNT_SWEEP_INTERVAL_MS: '400',
    ACCOUNT_SWEEP_GRACE_MS: '0',
  });
  const u = await newUser('pf', c2);
  const other = await newUser('pfo', c2);
  await seedAll(u, 'PARTIAL');
  await seedAll(other, 'OTHER-PARTIAL');
  const r = await c2(u.token, 'POST', '/account/delete', { password: PW, confirmation: 'DELETE' });
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'DELETION_INCOMPLETE');
  assert.notEqual(r.body.message, 'Your account has been deleted.');
  // already locked out even though cleanup is unfinished
  const doc = await col('users').findOne({ _id: u.oid });
  assert.ok(doc.deletedAt);
  assert.equal(doc.name, 'Deleted user');
  assert.equal((await c2(u.token, 'GET', '/auth/me')).status, 401);
  assert.equal((await c2(null, 'POST', '/auth/login', { email: u.email, password: PW })).status, 401);

  // the background sweep (400 ms interval in test mode) completes the cleanup without any user action
  const deadline = Date.now() + 15000;
  let done = false;
  while (Date.now() < deadline) {
    const d = await col('users').findOne({ _id: u.oid });
    if (d.deletionCompletedAt) { done = true; break; }
    await new Promise((res) => setTimeout(res, 250));
  }
  assert.ok(done, 'sweep did not finish the deletion');
  for (const [k, n] of Object.entries(await countFor(u))) assert.equal(n, 0, k);
  assert.equal(await col('notifications').countDocuments({ user: other.oid }), 1); // another account is untouched
});
