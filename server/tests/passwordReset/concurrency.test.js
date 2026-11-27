/*
 * Reset-link concurrency, failure-injection and abuse tests (node:test). Needs a DISPOSABLE local mongod (see harness.js):
 *
 *   RESET_TEST_MONGO=mongodb://127.0.0.1:27160 npm run test:reset
 *
 * Uses REAL separate server.js processes sharing one standalone mongod (no transactions, no replica set). Faults are injected
 * with AUTH_TEST_FAULT (utils/testFaults.js, active only when NODE_ENV=test): delays, thrown errors, lost database connection
 * and hard process crashes at precise points of the issue / consume protocol.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { create, skip, sleep, sha, GOOD_PW, GENERIC, SERVER_DIR } = require('./harness');

const h = create(Number(process.env.RESET_CONC_PORT || 5241), 'reset_conc_test');
const S = [h.base, h.base + 1, h.base + 2]; // three plain server processes
const LIM = h.base + 3; // rate limits ON
const BURST = h.base + 4; // cooldown 0, huge budget: stresses the ordering protocol
const CAPPED = h.base + 5; // cooldown 0, budget 3
let nextPort = h.base + 10;
const { coll, oid } = h;
const NEW_PW = 'Moonlight2026';

const api = (port) => (o) => h.rawCall(port, o);
const forgot = (port, email, extra) => h.forgot(port, email, extra);
const reset = (port, tok, pw, conf, extra) => h.reset(port, tok, pw, conf, extra);
const newUser = (tag, port = S[0]) => h.newUser(port, tag);
const issueLink = (u, port = S[0]) => h.issueLink(port, u);
const isLive = (raw, port = S[0]) => h.isLive(port, raw);
const passwordOk = (u, pw, port = S[0]) => h.passwordOk(port, u.email, pw);
const linksOf = async (u) => (await h.mailsFor(u.email, 'passwordReset')).map((m) => h.rawTokenOf(m));
const faultServer = async (rules, env = {}) => { const port = nextPort++; const child = await h.startServer(port, { AUTH_TEST_FAULT: JSON.stringify(rules), ...env }); return child; };
const userDoc = (u) => coll('users').findOne({ _id: oid(u.id) });

before(async () => {
  if (skip) return;
  await h.connect();
  for (const p of S) await h.startServer(p);
  await h.startServer(LIM, { AUTH_RATE_LIMIT_FORCE: 'true', AUTH_FORGOT_IP_MAX: '1000' });
  await h.startServer(BURST, { RESET_COOLDOWN_SECONDS: '0', RESET_MAX_PER_HOUR: '100000' });
  await h.startServer(CAPPED, { RESET_COOLDOWN_SECONDS: '0', RESET_MAX_PER_HOUR: '3' });
});
after(async () => { if (!skip) await h.stopAll(); });

// ============================================================================ issuance races
test('burst across 3 PROCESSES: 30 simultaneous requests -> the atomic cooldown admits exactly one; one token, one email, one usable link', { skip }, async () => {
  const u = await newUser('burst');
  const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => forgot(S[i % 3], u.email)));
  for (const r of rs) { assert.equal(r.status, 200); assert.equal(r.body.message, GENERIC); }
  await h.waitActive(u.id);
  await sleep(1000);
  const st = await h.stateOf(u.id);
  assert.equal(st.seq, 1, 'the database granted exactly one reservation');
  assert.equal(st.windowCount, 1);
  assert.equal((await h.tokensOf(u.id)).length, 1);
  const links = await linksOf(u);
  assert.equal(links.length, 1);
  assert.equal(await isLive(links[0]), true);
});

test('stress across 3 processes with NO cooldown: 30 concurrent requests -> every link records a DB seq; exactly ONE link is usable (the highest seq)', { skip }, async () => {
  const u = await newUser('stress');
  const ports = [h.base + 4]; // BURST process plus two more with the same relaxed limits
  for (let i = 0; i < 2; i += 1) { const p = nextPort++; await h.startServer(p, { RESET_COOLDOWN_SECONDS: '0', RESET_MAX_PER_HOUR: '100000' }); ports.push(p); }
  const N = 30;
  await Promise.all(Array.from({ length: N }, (_, i) => forgot(ports[i % 3], u.email)));
  // With cooldown 0 a reservation can still lose to a concurrent one whose database clock tick is a hair later, so the number
  // admitted is whatever the DATABASE counted in seq (the authority), not necessarily 30.
  const done = await h.waitFor(async () => { const st = await h.stateOf(u.id); const t = await h.tokensOf(u.id); return st && st.seq >= 10 && t.length === st.seq && t.every((x) => x.delivery !== 'accepted') ? t : null; }, { timeout: 25000 });
  assert.ok(done, 'every admitted request completed');
  await sleep(300);
  const toks = await h.tokensOf(u.id);
  const st = await h.stateOf(u.id);
  const M = st.seq;
  assert.deepEqual(toks.map((t) => t.seq), Array.from({ length: M }, (_, i) => i + 1), 'seq is a gap-free database-assigned sequence');
  assert.equal(st.active.seq, M, 'the newest reservation owns the single usable link');
  assert.equal(st.activeSeq, M);
  const links = await linksOf(u);
  assert.equal(links.length, M);
  const live = [];
  for (const l of links) if (await isLive(l)) live.push(l);
  assert.equal(live.length, 1, `${live.length} usable links`);
  assert.equal(sha(live[0]), toks[M - 1].tokenHash, 'and it is the link of the newest reservation');
  // and the usable one wins an all-at-once race for the password change
  const results = await Promise.all(links.map((l, i) => reset(S[i % 3], l, `Orchid${i}Winter77`)));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
});

for (const [name, point] of [['delayed INSERT (older request records its token after a newer one finished)', 'forgot.afterReserve'], ['delayed ACTIVATION (older request emailed first, activates last)', 'forgot.beforeActivate']]) {
  test(`forced order inversion: ${name} -> the newer link survives`, { skip }, async () => {
    const slow = await faultServer([{ point, action: 'delay', ms: 2500 }], { RESET_COOLDOWN_SECONDS: '0', RESET_MAX_PER_HOUR: '1000' });
    const u = await newUser('inv');
    assert.equal((await forgot(slow.port, u.email)).status, 200); // reserves seq 1, then stalls
    assert.ok(await h.waitFor(async () => (await h.stateOf(u.id))?.seq === 1));
    assert.equal((await forgot(BURST, u.email)).status, 200); // reserves seq 2 and finishes first
    await h.waitActive(u.id, 2);
    assert.ok(await h.waitFor(async () => { const t = await h.tokensOf(u.id); return t.length === 2 && t[0].revokedAt ? t : null; }, { timeout: 10000 }), 'the stalled older request finished and was refused');
    const [older, newer] = await h.tokensOf(u.id);
    assert.equal(older.seq, 1); assert.equal(newer.seq, 2);
    if (point === 'forgot.afterReserve') assert.ok(String(older._id) > String(newer._id), 'the insert order was inverted: the OLDER request got the NEWER ObjectId (this is what broke the previous ObjectId design)');
    assert.equal(older.activatedAt, null); assert.ok(newer.activatedAt);
    const st = await h.stateOf(u.id);
    assert.equal(st.active.seq, 2);
    const links = await linksOf(u);
    assert.equal(links.length, 2);
    const live = []; for (const l of links) if (await isLive(l)) live.push(l);
    assert.equal(live.length, 1, 'exactly one usable link');
    assert.equal((await reset(S[1], live[0], NEW_PW)).status, 200);
    await h.killServer(slow);
  });
}

test('a failed send does not invalidate the existing link; an AMBIGUOUS send (stored, then error) is treated as failed and never activates', { skip }, async () => {
  const u = await newUser('amb');
  const raw1 = await issueLink(u);
  await h.clearCooldown(u.id);
  const amb = await faultServer([{ point: 'email.afterStore', action: 'throw', name: 'MongoNetworkTimeoutError' }]);
  assert.equal((await forgot(amb.port, u.email)).status, 200);
  assert.ok(await h.waitFor(async () => (await h.tokensOf(u.id))[1]?.delivery === 'failed'));
  const t = (await h.tokensOf(u.id))[1];
  assert.equal(t.activatedAt, null);
  assert.equal((await h.mailsFor(u.email, 'passwordReset')).length, 2, 'the message WAS stored (ambiguous outcome)...');
  assert.equal(await isLive(raw1), true, '...but the previous usable link is untouched');
  assert.equal(await isLive((await linksOf(u))[0]), false, '...and the stored-but-unconfirmed link is dead');
  assert.equal((await h.stateOf(u.id)).active.seq, 1);
});

// process crashes in the middle of the issue protocol
for (const point of ['forgot.afterReserve', 'forgot.afterInsert', 'forgot.beforeSend', 'forgot.afterSend', 'forgot.beforeActivate']) {
  test(`crash at ${point}: the owner's existing link survives, nothing is left half-usable, a later request recovers`, { skip }, async () => {
    const u = await newUser('crash');
    const raw1 = await issueLink(u);
    await h.clearCooldown(u.id);
    const dying = await faultServer([{ point, action: 'crash' }]);
    await forgot(dying.port, u.email).catch(() => {}); // the response is sent first; the process then dies
    assert.ok(await h.waitFor(() => dying.out.code !== null), 'the process crashed');
    assert.equal(dying.out.code, 137);
    await sleep(300);
    assert.equal(await isLive(raw1), true, 'previous usable link intact');
    assert.equal(await h.activeCount(u.id), 1);
    const st = await h.stateOf(u.id);
    assert.equal(st.active.seq, 1, 'no new link was ever activated');
    assert.ok(new Date(st.cooldownUntil) > new Date(), 'the reservation consumed the cooldown (bounded cost of a crash)');
    const mails = await h.mailsFor(u.email, 'passwordReset');
    if (['forgot.afterReserve', 'forgot.afterInsert', 'forgot.beforeSend'].includes(point)) assert.equal(mails.length, 1, 'no email left the system');
    else { assert.equal(mails.length, 2); assert.equal(await isLive(h.rawTokenOf(mails[0])), false, 'an emailed but never activated link is dead (safe failure)'); }
    // recovery after the cooldown, from a healthy process
    await h.clearCooldown(u.id);
    assert.equal((await forgot(S[1], u.email)).status, 200);
    await h.waitActive(u.id, 2);
    const now = await h.stateOf(u.id);
    assert.ok(now.active.seq >= 2);
    const live = []; for (const l of await linksOf(u)) if (await isLive(l)) live.push(l);
    assert.equal(live.length, 1);
    assert.equal((await reset(S[2], live[0], NEW_PW)).status, 200);
  });
}

// ============================================================================ consume / compensation safety
const resetOutcome = async (rules, tag) => {
  const u = await newUser(tag);
  const raw = await issueLink(u);
  const srv = await faultServer(rules);
  const before = await userDoc(u);
  const res = await reset(srv.port, raw, NEW_PW).catch((e) => ({ status: 0, error: e }));
  return { u, raw, srv, before, res };
};
const assertDeadForever = async (u, raw, { expectNewPassword }) => {
  assert.equal(await isLive(raw), false, 'the consumed link is not usable');
  assert.equal((await reset(S[0], raw, 'Evergreen2027x')).body.code, 'INVALID_RESET_TOKEN', 'a replay gets the generic answer');
  assert.equal((await h.stateOf(u.id)).active, null);
  assert.equal(await passwordOk(u, 'Evergreen2027x'), false);
  assert.equal(await passwordOk(u, NEW_PW), expectNewPassword);
  assert.equal(await passwordOk(u, GOOD_PW), !expectNewPassword);
};

test('failure AFTER the token was consumed but BEFORE the password write: safe failure, link stays dead, password untouched', { skip }, async () => {
  const { u, raw, before, res } = await resetOutcome([{ point: 'reset.afterConsume', action: 'throw', name: 'MongoServerSelectionError' }], 'fbefore');
  assert.equal(res.status, 503); assert.equal(res.body.code, 'RESET_INTERRUPTED');
  assert.ok(!res.text.includes(raw));
  assert.equal((await userDoc(u)).password, before.password);
  assert.equal((await userDoc(u)).tokenVersion || 0, before.tokenVersion || 0);
  await assertDeadForever(u, raw, { expectNewPassword: false });
  // the way out: ask for a new link
  await h.clearCooldown(u.id);
  const raw2 = await issueLink(u);
  assert.equal((await reset(S[1], raw2, NEW_PW)).status, 200);
});

test('database connection LOST right after the consume: the write fails, the link is NOT resurrected, password untouched', { skip }, async () => {
  const { u, raw, before, res } = await resetOutcome([{ point: 'reset.afterConsume', action: 'disconnect' }], 'fdisc');
  assert.ok([503, 500].includes(res.status), `status ${res.status}`);
  assert.equal((await userDoc(u)).password, before.password);
  await assertDeadForever(u, raw, { expectNewPassword: false });
});

test('AMBIGUOUS outcome: the password write COMMITTED but the caller saw an error -> link stays dead, password + tokenVersion changed together', { skip }, async () => {
  const { u, raw, before, res } = await resetOutcome([{ point: 'reset.afterPasswordUpdate', action: 'throw', name: 'MongoNetworkTimeoutError' }], 'famb');
  assert.equal(res.status, 503); assert.equal(res.body.code, 'RESET_INTERRUPTED');
  assert.match(res.body.message, /Try logging in with your new password/);
  const after = await userDoc(u);
  assert.notEqual(after.password, before.password, 'the write did commit');
  assert.equal(after.tokenVersion, (before.tokenVersion || 0) + 1, 'tokenVersion moved in the same document operation');
  assert.ok(await h.bcrypt.compare(NEW_PW, after.password));
  assert.equal((await h.rawCall(S[0], { url: '/auth/me', token: u.token })).status, 401, 'old sessions are retired');
  await assertDeadForever(u, raw, { expectNewPassword: true });
});

test('process CRASH right after the consume: link dead, password untouched, a new link works', { skip }, async () => {
  const { u, raw, srv, before, res } = await resetOutcome([{ point: 'reset.afterConsume', action: 'crash' }], 'crc');
  assert.equal(res.status, 0, 'the caller got no response');
  assert.ok(await h.waitFor(() => srv.out.code !== null)); assert.equal(srv.out.code, 137);
  assert.equal((await userDoc(u)).password, before.password);
  await assertDeadForever(u, raw, { expectNewPassword: false });
  await h.clearCooldown(u.id);
  const raw2 = await issueLink(u);
  assert.equal((await reset(S[1], raw2, NEW_PW)).status, 200);
});

test('process CRASH right after the password write committed: link dead, new password works, tokenVersion bumped once', { skip }, async () => {
  const { u, raw, srv, before, res } = await resetOutcome([{ point: 'reset.afterPasswordUpdate', action: 'crash' }], 'crw');
  assert.equal(res.status, 0);
  assert.ok(await h.waitFor(() => srv.out.code !== null));
  assert.equal((await userDoc(u)).tokenVersion, (before.tokenVersion || 0) + 1);
  await assertDeadForever(u, raw, { expectNewPassword: true });
});

test('no code path can make a consumed link usable again (no releaseToken, nothing writes usedAt: null)', { skip }, () => {
  for (const f of ['utils/authTokens.js', 'controllers/passwordResetController.js']) {
    const src = fs.readFileSync(path.join(SERVER_DIR, f), 'utf8');
    assert.ok(!/releaseToken|unconsume/.test(src), `${f} must not contain a compensation path`);
    assert.ok(!/\$set:\s*\{[^}]*usedAt:\s*null/.test(src), `${f} must never set usedAt back to null`);
  }
});

// ============================================================================ profile password change vs reset links
test('profile password change revokes every outstanding reset link; sessions are still retired (existing behaviour intact)', { skip }, async () => {
  const u = await newUser('profrev');
  const raw = await issueLink(u);
  const bad = await h.rawCall(S[0], { method: 'PUT', url: '/auth/profile', token: u.token, body: { currentPassword: 'WrongPass123', newPassword: NEW_PW } });
  assert.equal(bad.status, 400);
  assert.equal(await isLive(raw), true, 'a FAILED password change does not revoke anything');
  const r = await h.rawCall(S[0], { method: 'PUT', url: '/auth/profile', token: u.token, body: { currentPassword: GOOD_PW, newPassword: NEW_PW } });
  assert.equal(r.status, 200);
  assert.equal(await isLive(raw), false, 'the previously issued link is dead');
  assert.equal((await reset(S[1], raw, 'Evergreen2027x')).body.code, 'INVALID_RESET_TOKEN');
  assert.equal((await h.stateOf(u.id)).active, null);
  assert.ok((await h.tokensOf(u.id))[0].revokedAt);
  assert.equal(await passwordOk(u, NEW_PW), true);
  assert.equal((await h.rawCall(S[0], { url: '/auth/me', token: u.token })).status, 401, 'old session retired');
  assert.equal((await h.rawCall(S[0], { url: '/auth/me', token: r.body.token })).status, 200, 'the new session works');
});

test('defence in depth: even if a pre-change link were somehow still active, its tokenVersion no longer matches -> refused, password untouched', { skip }, async () => {
  const u = await newUser('tvbind');
  const raw = await issueLink(u);
  const snapshot = (await h.stateOf(u.id)).active;
  const r = await h.rawCall(S[0], { method: 'PUT', url: '/auth/profile', token: u.token, body: { currentPassword: GOOD_PW, newPassword: NEW_PW } });
  assert.equal(r.status, 200);
  await coll('authrecoverystates').updateOne({ _id: `password_reset:${u.id}` }, { $set: { active: snapshot } }); // resurrect it by hand
  assert.equal((await reset(S[2], raw, 'Evergreen2027x')).body.code, 'INVALID_RESET_TOKEN');
  assert.equal(await passwordOk(u, NEW_PW), true);
  assert.equal(await passwordOk(u, 'Evergreen2027x'), false);
});

test('a link emailed by a request that was IN FLIGHT during a password change is refused (it carries the old tokenVersion)', { skip }, async () => {
  const u = await newUser('inflight');
  const slow = await faultServer([{ point: 'forgot.beforeActivate', action: 'delay', ms: 2000 }]);
  assert.equal((await forgot(slow.port, u.email)).status, 200);
  const mails = await h.waitForMail(u.email); const raw = h.rawTokenOf(mails[0]); // emailed, not yet active
  const r = await h.rawCall(S[0], { method: 'PUT', url: '/auth/profile', token: u.token, body: { currentPassword: GOOD_PW, newPassword: NEW_PW } });
  assert.equal(r.status, 200);
  await h.waitActive(u.id); // the delayed activation completes AFTER the password change
  assert.equal((await reset(S[1], raw, 'Evergreen2027x')).body.code, 'INVALID_RESET_TOKEN');
  assert.equal(await passwordOk(u, NEW_PW), true);
});

test('after a successful reset no link remains active and the used link cannot be replayed', { skip }, async () => {
  const u = await newUser('resetinflight');
  const raw = await issueLink(u);
  assert.equal((await reset(S[0], raw, NEW_PW)).status, 200);
  assert.equal(await h.activeCount(u.id), 0);
  assert.equal((await reset(S[0], raw, 'Evergreen2027x')).status, 400);
});

// ============================================================================ third-party lockout / abuse
test('lockout: an attacker hammering a victim\'s address (many networks, many requests) cannot stop the victim: one email goes out and its link works', { skip }, async () => {
  const victim = await newUser('victim', LIM);
  const rs = [];
  for (let i = 0; i < 40; i += 1) rs.push(await forgot(LIM, victim.email, { localAddress: `127.0.0.${30 + (i % 20)}` }));
  assert.ok(rs.every((r) => r.status === 200 && r.body.message === GENERIC), 'no 429 and no difference: the owner is never told "too many requests for this address"');
  await h.waitActive(victim.id);
  await sleep(500);
  assert.equal((await h.mailsFor(victim.email, 'passwordReset')).length, 1, 'bounded: ONE email despite 40 requests');
  const raw = (await linksOf(victim))[0];
  assert.equal(await isLive(raw, LIM), true, 'the link in the owner\'s mailbox works');
  assert.equal((await reset(LIM, raw, NEW_PW)).status, 200);
});

test('lockout: the cooldown is FIXED, not sliding: continuous requests cannot extend it', { skip }, async () => {
  const u = await newUser('slide');
  await issueLink(u);
  const cd = (await h.stateOf(u.id)).cooldownUntil;
  for (let i = 0; i < 15; i += 1) { await forgot(S[i % 3], u.email); await sleep(60); }
  assert.deepEqual((await h.stateOf(u.id)).cooldownUntil, cd);
  assert.equal((await h.stateOf(u.id)).seq, 1);
});

test('lockout: an exhausted hourly budget cannot strand the owner: with no usable link left they get a new one (cooldown permitting)', { skip }, async () => {
  const u = await newUser('stranded');
  await issueLink(u);
  await coll('authrecoverystates').updateOne({ _id: `password_reset:${u.id}` }, { $set: { windowCount: 5, windowStart: new Date() } }); // attacker burned the budget
  await h.expireLink(u.id); // and the owner's link has since expired
  await h.clearCooldown(u.id);
  const before = (await h.mailsFor(u.email, 'passwordReset')).length;
  const r = await forgot(S[1], u.email);
  assert.equal(r.status, 200);
  const mails = await h.waitForMail(u.email, 'passwordReset', before + 1);
  assert.ok(mails, 'the owner received a fresh link');
  await h.waitActive(u.id, 2);
  assert.equal((await reset(S[2], h.rawTokenOf(mails[0]), NEW_PW)).status, 200);
});

test('abuse bound: with the cooldown relaxed, the hourly budget (3) still caps emails while the owner has a usable link', { skip }, async () => {
  const u = await newUser('bomb');
  for (let i = 1; i <= 3; i += 1) { await forgot(CAPPED, u.email); await h.waitActive(u.id, i); } // three admitted requests, each fully delivered
  await Promise.all(Array.from({ length: 20 }, () => forgot(CAPPED, u.email))); // the owner has a usable link: the budget now holds
  await sleep(1200);
  assert.equal((await h.tokensOf(u.id)).length, 3, 'budget of 3 held');
  assert.equal((await h.mailsFor(u.email, 'passwordReset')).length, 3);
  assert.equal(await h.activeCount(u.id), 1);
});

test('indistinguishable: accepted, throttled and unknown-address requests produce byte-identical responses', { skip }, async () => {
  const u = await newUser('indist');
  const accepted = await forgot(S[0], u.email);
  const throttled = await forgot(S[1], u.email);
  const unknown = await forgot(S[2], `ghost.${process.pid}@example.com`);
  for (const r of [throttled, unknown]) {
    assert.equal(r.status, accepted.status); assert.equal(r.text, accepted.text);
    assert.equal(r.headers['content-length'], accepted.headers['content-length']);
  }
});

test('cross-process: per-account limits are SHARED through the database (3 processes together never exceed one reservation per cooldown)', { skip }, async () => {
  const u = await newUser('shared');
  await Promise.all(S.flatMap((p) => Array.from({ length: 10 }, () => forgot(p, u.email))));
  await sleep(1500);
  assert.equal((await h.stateOf(u.id)).seq, 1);
  assert.equal((await h.tokensOf(u.id)).length, 1);
});
