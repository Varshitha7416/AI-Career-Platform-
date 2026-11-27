/*
 * Forgot / reset password API tests (node:test). Needs a DISPOSABLE local MongoDB (see harness.js):
 *
 *   RESET_TEST_MONGO=mongodb://127.0.0.1:27160 npm run test:reset
 *
 * Skipped without RESET_TEST_MONGO. Real server.js child processes, the LOCAL OUTBOX transport (no email is ever sent).
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { create, skip, sleep, sha, PROD_SECRET, GOOD_PW, GENERIC } = require('./harness');

const h = create(Number(process.env.RESET_PORT || 5141), 'reset_api_test');
const P1 = h.base; // rate limits off (NODE_ENV=test)
const P2 = P1 + 1; // rate limits ON with small budgets
const P3 = P1 + 2; // EMAIL_TRANSPORT=none (globally unavailable)
const P4 = P1 + 3; // the email transport fails on every send (injected)
const { coll, oid } = h;

const call = (o) => h.rawCall(P1, o);
const callRl = (o) => h.rawCall(P2, o);
const forgot = (email, fn = call, extra = {}) => fn({ method: 'POST', url: '/auth/forgot-password', body: { email }, ...extra });
const reset = (token, password, confirmPassword = password, fn = call, extra = {}) => fn({ method: 'POST', url: '/auth/reset-password', body: { token, password, confirmPassword }, ...extra });
const newUser = (tag) => h.newUser(P1, tag);
const issueLink = (u) => h.issueLink(P1, u);
const isLive = (raw) => h.isLive(P1, raw);
const passwordOk = (email, pw) => h.passwordOk(P1, email, pw);
const { mailsFor, waitForMail, rawTokenOf, tokensOf, stateOf, waitFor } = h;

before(async () => {
  if (skip) return;
  await h.connect();
  await h.startServer(P1);
  await h.startServer(P2, { AUTH_RATE_LIMIT_FORCE: 'true', AUTH_FORGOT_IP_MAX: '6', AUTH_RESET_MAX: '3' });
  await h.startServer(P3, { EMAIL_TRANSPORT: 'none' });
  await h.startServer(P4, { AUTH_TEST_FAULT: JSON.stringify([{ point: 'email.send', action: 'throw' }]) });
});
after(async () => { if (!skip) await h.stopAll(); });

// ================================================================ forgot password
test('forgot: a registered email gets a link by (local) email; only the HASH is stored, never the raw token', { skip }, async () => {
  const u = await newUser('fp');
  const r = await forgot(u.email);
  assert.equal(r.status, 200);
  assert.equal(r.body.message, GENERIC);
  assert.ok(!/have been sent|was sent|has been sent/i.test(r.body.message), 'never claims the email was sent or delivered');
  const [mail] = await waitForMail(u.email);
  assert.equal(mail.subject, 'Reset your CareerNest password');
  const raw = rawTokenOf(mail);
  assert.match(mail.actionUrl, /^http:\/\/localhost:5173\/reset-password#token=/);
  await h.waitActive(u.id);
  const toks = await tokensOf(u.id);
  assert.equal(toks.length, 1);
  assert.equal(toks[0].tokenHash, sha(raw));
  assert.equal(toks[0].purpose, 'password_reset');
  assert.equal(toks[0].usedAt, null); assert.equal(toks[0].revokedAt, null);
  assert.equal(toks[0].delivery, 'stored_local', 'the honest delivery state: stored in the local outbox, nobody was emailed');
  assert.ok(toks[0].activatedAt);
  assert.equal(toks[0].seq, 1);
  const minutes = (new Date(toks[0].expiresAt) - new Date(toks[0].createdAt)) / 60000;
  assert.ok(minutes > 29 && minutes < 31, `expires in ${minutes} minutes`);
  assert.ok(!JSON.stringify(toks).includes(raw), 'the raw token is nowhere in the authtokens collection');
  assert.ok(!JSON.stringify(await stateOf(u.id)).includes(raw), 'nor in the recovery state');
  assert.deepEqual(Object.keys(toks[0]).sort(), ['__v', '_id', 'activatedAt', 'createdAt', 'delivery', 'expiresAt', 'purpose', 'revokedAt', 'seq', 'tokenHash', 'tokenVersion', 'usedAt', 'user']);
});

test('forgot: unknown and registered addresses get the identical public response; unknown creates no token, no state and no email', { skip }, async () => {
  const u = await newUser('same');
  const known = await forgot(u.email);
  const unknown = await forgot(`nobody.${process.pid}.${Date.now()}@example.com`);
  assert.equal(known.status, unknown.status);
  assert.deepEqual(known.body, unknown.body);
  assert.equal(known.headers['content-length'], unknown.headers['content-length']);
  assert.equal(known.headers['content-type'], unknown.headers['content-type']);
  await sleep(700);
  assert.equal((await coll('outboxemails').countDocuments({ to: { $regex: '^nobody\\.' } })), 0);
  const ids = (await coll('users').find({}).project({ _id: 1 }).toArray()).map((x) => x._id);
  assert.equal((await coll('authtokens').countDocuments({ user: { $nin: ids } })), 0);
  assert.equal((await coll('authrecoverystates').countDocuments({ user: { $nin: ids } })), 0);
});

test('forgot: invalid input is rejected without touching anything (same for every address)', { skip }, async () => {
  for (const email of ['', '   ', 'not-an-email', 'a@b', 'a b@example.com', 'x'.repeat(300) + '@example.com']) {
    const r = await forgot(email);
    assert.equal(r.status, 400, `email=${JSON.stringify(email).slice(0, 30)}`);
    assert.equal(r.body.code, 'VALIDATION_ERROR');
    assert.ok(r.body.errors.email);
  }
  for (const bad of [{ email: { $gt: '' } }, { email: ['a@example.com'] }, { email: 5 }, {}, { email: null }]) {
    assert.equal((await call({ method: 'POST', url: '/auth/forgot-password', body: bad })).status, 400);
  }
  assert.equal((await call({ method: 'POST', url: '/auth/forgot-password', rawBody: '{broken' })).status, 400);
});

test('forgot: the address is normalised exactly like login (case and surrounding spaces)', { skip }, async () => {
  const u = await newUser('norm');
  assert.equal((await forgot(`  ${u.email.toUpperCase()}  `)).status, 200);
  assert.ok(await waitForMail(u.email), 'email delivered to the normalised address');
});

test('forgot: request body size limit still applies (413)', { skip }, async () => {
  const r = await call({ method: 'POST', url: '/auth/forgot-password', rawBody: JSON.stringify({ email: 'a@example.com', pad: 'x'.repeat(20000) }) });
  assert.equal(r.status, 413);
});

test('forgot: cooldown (1/min, atomic, fixed) holds; after it the newest link wins and the older link dies', { skip }, async () => {
  const u = await newUser('multi');
  const raw1 = await issueLink(u);
  const cd1 = (await stateOf(u.id)).cooldownUntil;
  await forgot(u.email); await forgot(u.email); // inside the cooldown
  await sleep(600);
  assert.equal((await mailsFor(u.email, 'passwordReset')).length, 1, 'cooldown: still one email');
  assert.equal((await tokensOf(u.id)).length, 1, 'a throttled request creates nothing');
  assert.deepEqual((await stateOf(u.id)).cooldownUntil, cd1, 'throttled requests never extend the cooldown');
  assert.equal(await isLive(raw1), true, 'the existing link is untouched by throttled requests');
  await h.clearCooldown(u.id); // pretend a minute passed
  await forgot(u.email);
  const mails = await waitForMail(u.email, 'passwordReset', 2);
  const raw2 = rawTokenOf(mails[0]);
  await h.waitActive(u.id, 2);
  assert.notEqual(raw1, raw2);
  const toks = await tokensOf(u.id);
  assert.equal(toks.length, 2);
  assert.ok(toks[0].revokedAt, 'the previous token was revoked');
  assert.equal(toks[1].revokedAt, null);
  assert.equal(await isLive(raw1), false, 'old link is dead');
  assert.equal(await isLive(raw2), true, 'new link works');
});

test('forgot: hourly budget (5) is silent and keeps the owner\'s usable link intact', { skip }, async () => {
  const u = await newUser('cap');
  const raw = await issueLink(u);
  await coll('authrecoverystates').updateOne({ _id: `password_reset:${u.id}` }, { $set: { windowCount: 5, windowStart: new Date(), cooldownUntil: new Date(Date.now() - 1000) } });
  const r = await forgot(u.email);
  assert.equal(r.status, 200); assert.equal(r.body.message, GENERIC);
  await sleep(700);
  assert.equal((await tokensOf(u.id)).length, 1, 'no second token while the owner still has a usable link');
  assert.equal((await mailsFor(u.email)).length, 1);
  assert.equal(await isLive(raw), true, 'and the usable link was not invalidated');
});

test('forgot: simultaneous requests leave exactly ONE active link', { skip }, async () => {
  const u = await newUser('race');
  await Promise.all(Array.from({ length: 6 }, () => forgot(u.email)));
  await waitFor(async () => (await tokensOf(u.id)).length >= 1);
  await sleep(1200); // let every background delivery finish
  const toks = await tokensOf(u.id);
  assert.equal(toks.length, 1, 'the atomic cooldown admitted exactly one of the six');
  assert.equal(await h.activeCount(u.id), 1);
  assert.equal((await mailsFor(u.email, 'passwordReset')).length, 1);
});

test('forgot: a failed email send is invisible to the caller, never activates the link, keeps the old link and logs no address or token', { skip }, async () => {
  const u = await newUser('fail');
  const raw1 = await issueLink(u); // delivered normally on P1
  await h.clearCooldown(u.id);
  const r = await forgot(u.email, (o) => h.rawCall(P4, o));
  assert.equal(r.status, 200, `${r.text} | P4 log tail: ${h.servers.find((x) => x.port === P4).out.text.slice(-600)}`); assert.equal(r.body.message, GENERIC);
  await waitFor(async () => (await tokensOf(u.id)).length === 2 && (await tokensOf(u.id))[1].delivery === 'failed');
  const t = (await tokensOf(u.id))[1];
  assert.equal(t.delivery, 'failed'); assert.equal(t.deliveryCode, 'EMAIL_SEND_FAILED'); assert.equal(t.activatedAt, null);
  assert.equal((await mailsFor(u.email)).length, 1, 'no second email');
  assert.equal(await isLive(raw1), true, 'the owner\'s existing usable link survived the failed request');
  const log = h.servers.find((s) => s.port === P4).out.text;
  assert.ok(!log.includes(u.email) && !/#token=|reset-password/.test(log), 'no email address or link in the server log');
  assert.match(log, /password reset email failed: (EMAIL_SEND_FAILED|InjectedFault)/);
});

test('forgot: a globally unavailable email service answers 503 for EVERY address (it says nothing about any account) and creates nothing', { skip }, async () => {
  const u = await newUser('unavail');
  const known = await forgot(u.email, (o) => h.rawCall(P3, o));
  const unknown = await forgot(`nobody.unavail.${process.pid}@example.com`, (o) => h.rawCall(P3, o));
  assert.equal(known.status, 503); assert.equal(known.body.code, 'EMAIL_UNAVAILABLE');
  assert.deepEqual(known.body, unknown.body); assert.equal(known.status, unknown.status);
  assert.ok(!/have been sent|has been sent/i.test(known.body.message));
  assert.equal((await tokensOf(u.id)).length, 0);
  assert.equal(await stateOf(u.id), null);
});

// ================================================================ reset password
test('reset: a valid link changes the password, retires old sessions, uses the token up and revokes the rest', { skip }, async () => {
  const u = await newUser('ok');
  const raw = await issueLink(u);
  const before = await coll('users').findOne({ _id: oid(u.id) });
  const r = await reset(raw, 'Moonlight2026');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.message, 'Your password has been reset. You can now log in with your new password.');
  assert.ok(!('token' in r.body) && !r.text.includes(raw) && !/jwt|eyJ/.test(r.text), 'no token and no automatic login');
  const after = await coll('users').findOne({ _id: oid(u.id) });
  assert.notEqual(after.password, before.password);
  assert.ok(await h.bcrypt.compare('Moonlight2026', after.password));
  assert.equal(await h.bcrypt.getRounds(after.password), 12, 'existing bcrypt cost policy');
  assert.equal((after.tokenVersion || 0), (before.tokenVersion || 0) + 1);
  assert.equal(await passwordOk(u.email, GOOD_PW), false, 'old password no longer works');
  assert.equal(await passwordOk(u.email, 'Moonlight2026'), true);
  const me = await call({ url: '/auth/me', token: u.token });
  assert.equal(me.status, 401); assert.equal(me.body.code, 'INVALID_TOKEN');
  const t = (await tokensOf(u.id))[0];
  assert.ok(t.usedAt);
  assert.equal(await h.activeCount(u.id), 0);
  const notice = await waitForMail(u.email, 'passwordChanged');
  assert.match(notice[0].subject, /password was changed/i);
  assert.ok(!notice[0].text.includes(raw));
});

test('reset: an expired token is rejected with the generic answer', { skip }, async () => {
  const u = await newUser('exp'); const raw = await issueLink(u);
  await h.expireLink(u.id);
  const r = await reset(raw, 'Moonlight2026');
  assert.equal(r.status, 400); assert.equal(r.body.code, 'INVALID_RESET_TOKEN');
  assert.equal(await passwordOk(u.email, GOOD_PW), true, 'password untouched');
});

test('reset: unknown, malformed and non-string tokens all get the identical generic answer (nothing to enumerate)', { skip }, async () => {
  const u = await newUser('gen'); const live = await issueLink(u);
  await h.expireLink(u.id);
  const unknown = crypto.randomBytes(32).toString('base64url');
  const ref = await reset(unknown, 'Moonlight2026');
  assert.equal(ref.status, 400);
  const answers = [];
  for (const t of [unknown, live /* expired */, 'short', '', 'x'.repeat(500), undefined, null, 12345, { $gt: '' }, ['a'], `${unknown.slice(0, 42)}!`]) answers.push(await reset(t, 'Moonlight2026'));
  for (const a of answers) { assert.equal(a.status, 400); assert.deepEqual(a.body, ref.body); assert.equal(a.headers['content-length'], ref.headers['content-length']); }
});

test('reset: a token cannot be used twice (replay after success fails and changes nothing)', { skip }, async () => {
  const u = await newUser('reuse'); const raw = await issueLink(u);
  assert.equal((await reset(raw, 'Moonlight2026')).status, 200);
  const replay = await reset(raw, 'Evergreen2027x');
  assert.equal(replay.status, 400); assert.equal(replay.body.code, 'INVALID_RESET_TOKEN');
  assert.equal(await passwordOk(u.email, 'Moonlight2026'), true);
  assert.equal(await passwordOk(u.email, 'Evergreen2027x'), false);
});

test('reset: a token of another purpose is rejected, and is left untouched', { skip }, async () => {
  const u = await newUser('purpose'); const raw = crypto.randomBytes(32).toString('base64url');
  await coll('authtokens').insertOne({ user: oid(u.id), purpose: 'email_verification', tokenHash: sha(raw), expiresAt: new Date(Date.now() + 60000), usedAt: null, revokedAt: null, createdAt: new Date() });
  const r = await reset(raw, 'Moonlight2026');
  assert.equal(r.status, 400); assert.equal(r.body.code, 'INVALID_RESET_TOKEN');
  assert.equal((await coll('authtokens').findOne({ tokenHash: sha(raw) })).usedAt, null);
  assert.equal(await passwordOk(u.email, GOOD_PW), true);
});

test('reset: a token only ever changes ITS OWN account, whatever else the body says', { skip }, async () => {
  const a = await newUser('ownerA'); const b = await newUser('victimB'); const raw = await issueLink(a);
  const r = await call({ method: 'POST', url: '/auth/reset-password', body: { token: raw, password: 'Moonlight2026', confirmPassword: 'Moonlight2026', email: b.email, userId: b.id, user: b.id } });
  assert.equal(r.status, 200);
  assert.equal(await passwordOk(a.email, 'Moonlight2026'), true);
  assert.equal(await passwordOk(b.email, GOOD_PW), true, 'the other account is untouched');
  assert.equal((await coll('users').findOne({ _id: oid(b.id) })).tokenVersion || 0, 0);
});

test('reset: policy failures and a confirmation mismatch are rejected WITHOUT burning the link', { skip }, async () => {
  const u = await newUser('policy'); const raw = await issueLink(u);
  const local = u.email.split('@')[0];
  for (const [pw, field] of [['short1', 'password'], ['onlyletters', 'password'], ['12345678', 'password'], ['Password1', 'password'], [`${local}A1`, 'password'], ['x'.repeat(80) + '1a', 'password']]) {
    const r = await reset(raw, pw);
    assert.equal(r.status, 400, pw); assert.equal(r.body.code, 'VALIDATION_ERROR'); assert.ok(r.body.errors[field], pw);
  }
  const mism = await reset(raw, 'Moonlight2026', 'Moonlight2027');
  assert.equal(mism.status, 400); assert.equal(mism.body.errors.confirmPassword, 'Passwords do not match');
  assert.equal((await reset(raw, 'Moonlight2026', null)).body.errors.confirmPassword, 'Passwords do not match', 'a missing confirmation is a mismatch');
  assert.equal(await isLive(raw), true, 'link still valid');
  assert.equal((await reset(raw, 'Moonlight2026')).status, 200, 'and it still works with a good password');
});

test('reset: 8 simultaneous requests with one link -> exactly one succeeds, tokenVersion bumps once', { skip }, async () => {
  const u = await newUser('conc'); const raw = await issueLink(u);
  const pws = Array.from({ length: 8 }, (_, i) => `Winter${i}Orchid77`);
  const results = await Promise.all(pws.map((p) => reset(raw, p)));
  const winners = results.map((r, i) => ({ r, p: pws[i] })).filter((x) => x.r.status === 200);
  assert.equal(winners.length, 1, `statuses: ${results.map((r) => r.status).join(',')}`);
  for (const r of results.filter((x) => x.status !== 200)) assert.equal(r.body.code, 'INVALID_RESET_TOKEN');
  assert.equal(await passwordOk(u.email, winners[0].p), true);
  for (const p of pws.filter((x) => x !== winners[0].p)) assert.equal(await passwordOk(u.email, p), false);
  assert.equal((await coll('users').findOne({ _id: oid(u.id) })).tokenVersion, 1);
});

test('reset: a link superseded by a newer request is dead; the newer one works', { skip }, async () => {
  const u = await newUser('super'); const raw1 = await issueLink(u);
  await h.clearCooldown(u.id);
  await forgot(u.email); const mails = await waitForMail(u.email, 'passwordReset', 2); const raw2 = rawTokenOf(mails[0]);
  await h.waitActive(u.id, 2);
  assert.equal((await reset(raw1, 'Moonlight2026')).status, 400);
  assert.equal((await reset(raw2, 'Moonlight2026')).status, 200);
});

test('reset: a link whose account no longer exists gets the same generic answer', { skip }, async () => {
  const u = await newUser('gone'); const raw = await issueLink(u);
  await coll('users').deleteOne({ _id: oid(u.id) });
  const r = await reset(raw, 'Moonlight2026');
  assert.equal(r.status, 400); assert.equal(r.body.code, 'INVALID_RESET_TOKEN');
});

test('reset: password changes through the profile still revoke older sessions (existing behaviour intact)', { skip }, async () => {
  const u = await newUser('prof');
  const r = await call({ method: 'PUT', url: '/auth/profile', token: u.token, body: { currentPassword: GOOD_PW, newPassword: 'Moonlight2026' } });
  assert.equal(r.status, 200);
  assert.equal((await call({ url: '/auth/me', token: u.token })).status, 401);
  assert.equal((await call({ url: '/auth/me', token: r.body.token })).status, 200);
});

// ================================================================ rate limiting (server with limits ON, tiny budgets)
test('rate limit: there is NO per-email 429: hammering an address from many networks never blocks the owner (registered or not)', { skip }, async () => {
  const known = await newUser('rlk');
  const unknownEmail = `rl.unknown.${process.pid}@example.com`;
  const run = async (email, ips) => { const out = []; for (const ip of ips) out.push(await forgot(email, callRl, { localAddress: ip })); return out; };
  const ips = ['127.0.0.21', '127.0.0.22', '127.0.0.23', '127.0.0.24', '127.0.0.25'];
  const a = await run(known.email, ips); const b = await run(unknownEmail, ips);
  assert.deepEqual(a.map((r) => r.status), [200, 200, 200, 200, 200], `${a[0].text} | P2 log: ${h.servers.find((x) => x.port === P2).out.text.slice(-500)}`);
  assert.deepEqual(b.map((r) => r.status), [200, 200, 200, 200, 200]);
  for (let i = 1; i < a.length; i += 1) assert.deepEqual(a[i].body, b[i].body, 'known and unknown stay indistinguishable');
  assert.equal((await mailsFor(known.email, 'passwordReset')).length > 0 || !!(await waitForMail(known.email)), true, 'the owner still got their link');
});

test('rate limit: forgot-password per IP (6/window) across different addresses still answers 429 to everyone alike', { skip }, async () => {
  const statuses = [];
  for (let i = 0; i < 8; i += 1) statuses.push((await forgot(`ip.${i}.${process.pid}@example.com`, callRl, { localAddress: '127.0.0.13' })).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 429, 429]);
});

test('rate limit: reset-password attempts per IP (3/window) stop token guessing', { skip }, async () => {
  const guess = () => crypto.randomBytes(32).toString('base64url');
  const statuses = [];
  for (let i = 0; i < 5; i += 1) statuses.push((await reset(guess(), 'Moonlight2026', undefined, callRl, { localAddress: '127.0.0.14' })).status);
  assert.deepEqual(statuses, [400, 400, 400, 429, 429]);
});

test('logs: across every test above, the default server never logged an address or a reset link', { skip }, async () => {
  const log = h.servers[0].out.text;
  assert.ok(!/#token=|reset-password/.test(log));
  assert.ok(!/@example\.com/.test(log));
});
