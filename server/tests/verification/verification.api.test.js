/*
 * Email verification API tests (node:test). Needs a DISPOSABLE local MongoDB (same harness as the password reset suite):
 *
 *   VERIFY_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:verify        (RESET_TEST_MONGO works too)
 *
 * Skipped without it. Real server.js child processes, the LOCAL OUTBOX transport (no email is ever sent), own database.
 */
if (process.env.VERIFY_TEST_MONGO && !process.env.RESET_TEST_MONGO) process.env.RESET_TEST_MONGO = process.env.VERIFY_TEST_MONGO;
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { create, skip, sha, GOOD_PW } = require('../passwordReset/harness');

const h = create(Number(process.env.VERIFY_PORT || 5171), 'verify_api_test');
const P1 = h.base; // cooldown 0, rate limits off
const P2 = P1 + 1; // default cooldown (60s)
const P3 = P1 + 2; // EMAIL_TRANSPORT=none
const P4 = P1 + 3; // hourly budget 2, cooldown 0
const { coll, oid, mailsFor, waitForMail, waitFor } = h;

const call = (o, port = P1) => h.rawCall(port, o);
const post = (url, body, token, port = P1) => h.rawCall(port, { method: 'POST', url, body, token });
const get = (url, token, port = P1) => h.rawCall(port, { method: 'GET', url, token });
const put = (url, body, token, port = P1) => h.rawCall(port, { method: 'PUT', url, body, token });
const MAIL = 'emailVerification';
const tokenOf = (mail) => { const m = /#token=([A-Za-z0-9_-]{43})$/.exec(mail.actionUrl || ''); assert.ok(m, 'link carries the token in the fragment'); return m[1]; };
const stateOf = (id) => coll('authrecoverystates').findOne({ _id: `email_verification:${id}` });
const waitActive = (id, seq = 1) => waitFor(async () => { const s = await stateOf(id); return s && s.active && s.active.seq >= seq ? s : null; });
const verify = (token, port = P1) => post('/auth/verify-email', { token }, undefined, port);

// signup -> returns { email, id, token (JWT), raw (verification token) } for the freshly signed-up (unverified) user
const signup = async (port = P1, tag = 'v') => {
  const u = await h.newUser(port, tag);
  const [mail] = await waitForMail(u.email, MAIL, 1);
  await waitActive(u.id);
  return { ...u, raw: tokenOf(mail), mail };
};
const markVerified = (id) => coll('users').updateOne({ _id: oid(id) }, { $set: { emailVerified: true, emailVerifiedAt: new Date() } });
const verifiedUser = async (port = P1, tag = 'ok') => { const u = await h.newUser(port, tag); await markVerified(u.id); return u; };

before(async () => {
  if (skip) return;
  await h.connect();
  await h.startServer(P1, { VERIFY_COOLDOWN_SECONDS: '0', RESET_COOLDOWN_SECONDS: '0' });
  await h.startServer(P2, { AUTH_RATE_LIMIT_FORCE: 'true' });
  await h.startServer(P3, { EMAIL_TRANSPORT: 'none' });
  await h.startServer(P4, { VERIFY_COOLDOWN_SECONDS: '0', VERIFY_MAX_PER_HOUR: '2' });
});
after(async () => { if (!skip) await h.stopAll(); });

// ================================================================ issue
test('signup creates an UNVERIFIED account, emails a link (token in the fragment) and stores only the hash', { skip }, async () => {
  const email = h.emailFor('sg');
  const s = await post('/auth/signup', { name: 'Ada Lovelace', email, password: GOOD_PW });
  assert.equal(s.status, 201);
  assert.equal(s.body.emailVerificationRequired, true);
  const [mail] = await waitForMail(email, MAIL);
  assert.equal(mail.subject, 'Verify your CareerNest email address');
  assert.match(mail.actionUrl, /^http:\/\/localhost:5173\/verify-email#token=/);
  const raw = tokenOf(mail);
  const user = await coll('users').findOne({ email });
  assert.ok(!user.emailVerified);
  const recs = await coll('authtokens').find({ user: user._id, purpose: 'email_verification' }).toArray();
  assert.equal(recs.length, 1);
  assert.equal(recs[0].tokenHash, sha(raw));
  assert.ok(!JSON.stringify(recs[0]).includes(raw), 'raw token is never stored');
  assert.ok(!mail.subject.includes(raw));
  const ttlH = (recs[0].expiresAt - recs[0].createdAt) / 3600000;
  assert.ok(ttlH > 23.9 && ttlH < 24.1, `24h expiry, got ${ttlH}`);
  const l = await post('/auth/login', { email, password: GOOD_PW });
  assert.equal(l.status, 200, 'unverified users can log in');
  assert.equal(l.body.user.emailVerified, false);
  const me = await get('/auth/me', l.body.token);
  assert.equal(me.body.user.emailVerified, false);
  assert.equal(me.body.user.password, undefined);
});

test('signup still succeeds when no email transport exists (verification can be requested later)', { skip }, async () => {
  const email = h.emailFor('nt');
  const s = await post('/auth/signup', { name: 'No Transport', email, password: GOOD_PW }, undefined, P3);
  assert.equal(s.status, 201);
  const l = await post('/auth/login', { email, password: GOOD_PW }, undefined, P3);
  assert.equal(l.status, 200);
  const r = await post('/auth/verification/resend', undefined, l.body.token, P3);
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'EMAIL_UNAVAILABLE');
});

// ================================================================ verify
test('verify: success sets emailVerified + emailVerifiedAt; /auth/me and login reflect it; the link cannot be reused', { skip }, async () => {
  const u = await signup();
  const r = await verify(u.raw);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.verified, true);
  const user = await coll('users').findOne({ _id: oid(u.id) });
  assert.equal(user.emailVerified, true);
  assert.ok(user.emailVerifiedAt instanceof Date);
  assert.equal((await get('/auth/me', u.token)).body.user.emailVerified, true);
  const l = await post('/auth/login', { email: u.email, password: GOOD_PW });
  assert.equal(l.body.user.emailVerified, true);
  const again = await verify(u.raw);
  assert.equal(again.status, 400);
  assert.equal(again.body.code, 'VERIFICATION_LINK_USED');
  const rec = await coll('authtokens').findOne({ tokenHash: sha(u.raw) });
  assert.ok(rec.usedAt, 'audit record marks the link used');
});

test('verify: ten simultaneous requests with one link -> exactly one 200', { skip }, async () => {
  const u = await signup();
  const rs = await Promise.all(Array.from({ length: 10 }, () => verify(u.raw)));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.ok(rs.filter((r) => r.status !== 200).every((r) => r.status === 400));
});

test('verify: unknown, malformed and non-string tokens all get 400 INVALID_VERIFICATION_TOKEN', { skip }, async () => {
  for (const token of [crypto.randomBytes(32).toString('base64url'), 'short', '', undefined, null, 12345, { $gt: '' }, ['a'], 'x'.repeat(500)]) {
    const r = await verify(token);
    assert.equal(r.status, 400, JSON.stringify(token));
    assert.equal(r.body.code, 'INVALID_VERIFICATION_TOKEN');
  }
  assert.equal((await call({ method: 'POST', url: '/auth/verify-email', rawBody: '[]' })).status, 400);
});

test('verify: an expired link is refused with VERIFICATION_LINK_EXPIRED and does not verify', { skip }, async () => {
  const u = await signup();
  const past = new Date(Date.now() - 1000);
  await coll('authrecoverystates').updateOne({ _id: `email_verification:${u.id}` }, { $set: { 'active.expiresAt': past } });
  await coll('authtokens').updateOne({ tokenHash: sha(u.raw) }, { $set: { expiresAt: past } });
  const r = await verify(u.raw);
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'VERIFICATION_LINK_EXPIRED');
  assert.ok(!(await coll('users').findOne({ _id: oid(u.id) })).emailVerified);
});

test('verify: a deleted account is not verified (link answers invalid)', { skip }, async () => {
  const u = await signup();
  await coll('users').updateOne({ _id: oid(u.id) }, { $set: { deletedAt: new Date() } });
  const r = await verify(u.raw);
  assert.equal(r.status, 400);
  assert.ok(!(await coll('users').findOne({ _id: oid(u.id) })).emailVerified);
});

// ================================================================ purpose confusion
test('purpose confusion: a reset token never verifies email, a verification token never resets a password', { skip }, async () => {
  const u = await signup();
  await markVerified(u.id); // irrelevant to token logic; lets us check that verify cannot be a side door either
  await coll('users').updateOne({ _id: oid(u.id) }, { $set: { emailVerified: false }, $unset: { emailVerifiedAt: '' } });
  assert.equal((await h.forgot(P1, u.email)).status, 200);
  const [resetMail] = await waitForMail(u.email, 'passwordReset');
  await h.waitActive(u.id, 1);
  const resetRaw = h.rawTokenOf(resetMail);

  const a = await verify(resetRaw);
  assert.equal(a.status, 400);
  assert.equal(a.body.code, 'INVALID_VERIFICATION_TOKEN');
  assert.ok(!(await coll('users').findOne({ _id: oid(u.id) })).emailVerified);
  assert.equal(await h.isLive(P1, resetRaw), true, 'the reset link was not consumed by the verify attempt');

  const b = await h.reset(P1, u.raw, 'Brandnew2026');
  assert.equal(b.status, 400);
  assert.equal(b.body.code, 'INVALID_RESET_TOKEN');
  assert.equal(await h.passwordOk(P1, u.email, GOOD_PW), true, 'password unchanged');
  assert.equal((await verify(u.raw)).status, 200, 'the verification link was not consumed by the reset attempt');
  assert.equal((await h.reset(P1, resetRaw, 'Brandnew2026')).status, 200, 'the reset link still works for its own purpose');
});

test('a password change does NOT invalidate the verification link (and verification does not touch sessions)', { skip }, async () => {
  const u = await signup();
  const r = await put('/auth/profile', { currentPassword: GOOD_PW, newPassword: 'Brandnew2026' }, u.token);
  assert.equal(r.status, 200);
  assert.equal((await verify(u.raw)).status, 200);
});

// ================================================================ resend
test('resend (authenticated): new link works, the previous one is superseded; verified users get alreadyVerified', { skip }, async () => {
  const u = await signup();
  const r = await post('/auth/verification/resend', undefined, u.token);
  assert.equal(r.status, 200, r.text);
  const mails = await waitForMail(u.email, MAIL, 2);
  const fresh = tokenOf(mails[0]);
  assert.notEqual(fresh, u.raw);
  await waitActive(u.id, 2);
  const old = await verify(u.raw);
  assert.equal(old.status, 400, 'superseded link is refused');
  assert.equal((await verify(fresh)).status, 200);
  const before = (await mailsFor(u.email, MAIL)).length;
  const again = await post('/auth/verification/resend', undefined, u.token);
  assert.equal(again.status, 200);
  assert.equal(again.body.alreadyVerified, true);
  assert.equal((await mailsFor(u.email, MAIL)).length, before, 'no email for an already verified account');
  assert.equal((await post('/auth/verification/resend')).status, 401, 'needs a token');
});

test('resend: cooldown answers 429 and never disturbs the existing usable link', { skip }, async () => {
  const u = await signup(P2, 'cd');
  const r = await post('/auth/verification/resend', undefined, u.token, P2);
  assert.equal(r.status, 429);
  assert.equal(r.body.code, 'VERIFICATION_THROTTLED');
  assert.ok(r.body.retryAfterSeconds >= 1);
  assert.equal((await mailsFor(u.email, MAIL)).length, 1, 'no extra email');
  assert.equal((await verify(u.raw, P2)).status, 200, 'the original link still works');
});

test('resend: hourly budget (2/h) throttles, but never locks out an owner who has no usable link left', { skip }, async () => {
  const u = await signup(P4, 'bd'); // reservation 1
  assert.equal((await post('/auth/verification/resend', undefined, u.token, P4)).status, 200); // 2
  await waitActive(u.id, 2);
  const r = await post('/auth/verification/resend', undefined, u.token, P4); // 3 -> over budget while a link is usable
  assert.equal(r.status, 429);
  await coll('authrecoverystates').updateOne({ _id: `email_verification:${u.id}` }, { $set: { 'active.expiresAt': new Date(Date.now() - 1000) } });
  assert.equal((await post('/auth/verification/resend', undefined, u.token, P4)).status, 200, 'no usable link -> owner can always get one');
});

// ================================================================ unauthenticated request (enumeration safety)
test('public request: identical answer for unknown, unverified and verified addresses; mail only for the unverified one', { skip }, async () => {
  const unverified = await h.newUser(P1, 'pu'); await waitForMail(unverified.email, MAIL);
  const verified = await verifiedUser(P1, 'pv');
  await waitForMail(verified.email, MAIL); // the signup mail (sent before it was marked verified)
  const ghost = h.emailFor('ghost');
  const rs = [];
  for (const email of [unverified.email, verified.email, ghost, unverified.email.toUpperCase()]) rs.push(await post('/auth/verification/request', { email }));
  for (const r of rs) { assert.equal(r.status, 200); assert.deepEqual(r.body, rs[0].body); }
  await waitFor(async () => (await mailsFor(unverified.email, MAIL)).length >= 2);
  assert.equal((await mailsFor(verified.email, MAIL)).length, 1, 'no NEW mail for a verified account');
  assert.equal((await mailsFor(ghost, MAIL)).length, 0);
  assert.ok(!/sent|exists for/i.test(rs[0].body.message.replace(/If an unverified account exists/, '')), 'no claim that mail was sent');
  const bad = await post('/auth/verification/request', { email: 'nope' });
  assert.equal(bad.status, 400);
  assert.equal((await post('/auth/verification/request', { email: { $ne: '' } })).status, 400);
});

test('public request: throttled repeats look exactly like accepted ones (no per-email 429), and global outage is account-independent', { skip }, async () => {
  const u = await h.newUser(P2, 'pt'); await waitForMail(u.email, MAIL);
  const a = await post('/auth/verification/request', { email: u.email }, undefined, P2);
  const b = await post('/auth/verification/request', { email: u.email }, undefined, P2);
  const c = await post('/auth/verification/request', { email: h.emailFor('who') }, undefined, P2);
  assert.deepEqual([a.status, b.status, c.status], [200, 200, 200]);
  assert.deepEqual(a.body, c.body);
  await h.rawCall(P2, { method: 'GET', url: '/jobs' });
  assert.equal((await mailsFor(u.email, MAIL)).length, 1, 'cooldown held: only the signup mail exists');
  const down = await post('/auth/verification/request', { email: u.email }, undefined, P3);
  assert.equal(down.status, 503);
  assert.equal((await post('/auth/verification/request', { email: h.emailFor('x') }, undefined, P3)).status, 503, 'same for unknown addresses');
});

// ================================================================ policy / gating
test('policy (optional verification): unverified users reach every normal feature; nothing answers 403 EMAIL_NOT_VERIFIED', { skip }, async () => {
  const u = await h.newUser(P1, 'gate');
  const okReads = ['/jobs', '/jobs/meta', '/saved-jobs', '/applications', '/interviews', '/notifications', '/dashboard/overview', '/programs', '/resumes', '/referrals/find?company=x', '/skill-gap/roles', '/auth/me', '/resume-analysis', '/cover-letters', '/referrals/mine'];
  for (const url of okReads) { const r = await get(url, u.token); assert.ok(r.status === 200, `${url} -> ${r.status}`); }
  assert.equal((await put('/auth/profile', { headline: 'Hello' }, u.token)).status, 200);
  assert.equal((await post('/saved-jobs', { jobId: '507f1f77bcf86cd799439011' }, u.token)).status !== 403, true, 'saving jobs is not gated');
  const oid1 = '507f1f77bcf86cd799439011';
  const gated = [
    ['POST', '/applications', { jobId: oid1 }], ['POST', '/interviews', {}], ['PUT', `/interviews/${oid1}`, {}],
    ['POST', '/referrals', {}], ['PUT', `/referrals/${oid1}`, { status: 'accepted' }], ['PUT', `/referrals/${oid1}/status`, { status: 'accepted' }], ['GET', `/referrals/${oid1}/resume`],
    ['POST', '/resume-analysis', {}], ['POST', '/cover-letters', {}], ['POST', `/cover-letters/${oid1}/regenerate`, {}],
    ['POST', '/skill-gap/resume', {}], ['POST', '/skill-gap/manual', {}], ['POST', `/skill-gap/${oid1}/roadmap`, {}], ['POST', '/contact', { subject: 'Hi', message: 'Hello there' }],
  ];
  // Optional verification: these calls get past any email gate while unverified (they may fail later on validation, a missing
  // record or a missing AI key, but never with 403 EMAIL_NOT_VERIFIED).
  for (const [method, url, body] of gated) {
    const r = await call({ method, url, body, token: u.token });
    assert.notEqual(r.body && r.body.code, 'EMAIL_NOT_VERIFIED', `${method} ${url} -> ${r.status} ${r.text}`);
  }
  // and verifying changes nothing about access
  await markVerified(u.id);
  for (const [method, url, body] of gated) {
    const r = await call({ method, url, body, token: u.token });
    assert.notEqual(r.status, 403, `${method} ${url} still 403 after verification`);
    assert.notEqual(r.body && r.body.code, 'EMAIL_NOT_VERIFIED');
  }
});

test('policy: the flag comes from the database, not the token (verifying takes effect immediately on the SAME session)', { skip }, async () => {
  const u = await signup();
  assert.equal((await get('/auth/me', u.token)).body.user.emailVerified, false);
  assert.equal((await verify(u.raw)).status, 200);
  assert.equal((await get('/auth/me', u.token)).body.user.emailVerified, true);
});

test('policy: signup / profile cannot grant admin or flip emailVerified', { skip }, async () => {
  const email = h.emailFor('evil');
  const s = await post('/auth/signup', { name: 'Evil Eve', email, password: GOOD_PW, role: 'admin', emailVerified: true, emailVerifiedAt: '2000-01-01', deletedAt: null });
  assert.equal(s.status, 201);
  const l = await post('/auth/login', { email, password: GOOD_PW });
  assert.equal(l.body.user.role, 'jobseeker');
  assert.equal(l.body.user.emailVerified, false);
  const p = await put('/auth/profile', { role: 'admin', emailVerified: true, emailVerifiedAt: '2000-01-01' }, l.body.token);
  assert.equal(p.status, 200);
  const user = await coll('users').findOne({ email });
  assert.equal(user.role, 'jobseeker');
  assert.ok(!user.emailVerified);
  assert.equal((await post('/jobs', { title: 'x' }, l.body.token)).status, 403);
});

test('ADMIN_EMAIL no longer promotes anyone (signup or login)', { skip }, async () => {
  const email = h.emailFor('adm');
  await h.startServer(P1 + 4, { ADMIN_EMAIL: email });
  const s = await post('/auth/signup', { name: 'Would Be Admin', email, password: GOOD_PW }, undefined, P1 + 4);
  assert.equal(s.status, 201);
  const l = await post('/auth/login', { email, password: GOOD_PW }, undefined, P1 + 4);
  assert.equal(l.body.user.role, 'jobseeker');
  assert.equal((await coll('users').findOne({ email })).role, 'jobseeker');
});
