/*
 * Development outbox access + environment-policy tests (node:test). Needs a DISPOSABLE local mongod (see harness.js):
 *
 *   RESET_TEST_MONGO=mongodb://127.0.0.1:27160 npm run test:reset
 *
 * Real server.js processes with different NODE_ENV / DEV_OUTBOX_ENABLED values. The outbox must be reachable only from this
 * machine, with a correct Host, no proxy headers, GET only, and the per-process key; and must not exist at all unless the
 * environment is exactly "development" or "test" AND the viewer was explicitly enabled.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { create, skip, sleep, PROD_SECRET, GENERIC, SERVER_DIR } = require('./harness');

const h = create(Number(process.env.RESET_OUTBOX_PORT || 5341), 'reset_outbox_test');
const A = h.base; // NODE_ENV=test, viewer enabled
const DEV = h.base + 1; // NODE_ENV=development, viewer enabled
const NOFLAG = h.base + 2; // NODE_ENV=test, viewer NOT enabled (default)
let nextPort = h.base + 10;
const { coll } = h;
let u; let key; let devKey; let raw;

const outbox = (port, to, { headers = {}, method = 'GET', fullPath, withKey = true, k } = {}) => h.rawCall(port, {
  method,
  fullPath: fullPath || `/api/dev/outbox?to=${encodeURIComponent(to)}`,
  headers: { ...(withKey ? { 'X-Dev-Outbox-Key': k || key } : {}), ...headers },
});
const leaked = (r) => /actionUrl|reset-password|#token=/.test(r.text);

before(async () => {
  if (skip) return;
  await h.connect();
  const a = await h.startServer(A); key = a.outboxKey;
  const d = await h.startServer(DEV, { NODE_ENV: 'development' }); devKey = d.outboxKey;
  await h.startServer(NOFLAG, { DEV_OUTBOX_ENABLED: undefined });
  u = await h.newUser(A, 'ob');
  raw = await h.issueLink(A, u);
});
after(async () => { if (!skip) await h.stopAll(); });

test('baseline: with the key, a loopback Host and no proxy headers the outbox returns the link for ONE recipient (no HTML, no listing)', { skip }, async () => {
  assert.ok(key && key.length >= 30, 'the per-process key was printed at start-up');
  const r = await outbox(A, u.email);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.count, 2, 'the signup verification email + the reset email (docs/23)');
  assert.ok(r.body.emails.some((e) => e.actionUrl.endsWith(`#token=${raw}`)));
  assert.ok(r.body.emails.every((e) => !('html' in e)));
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.equal((await outbox(A, 'someone.else@example.com')).body.count, 0);
  assert.equal((await h.rawCall(A, { fullPath: '/api/dev/outbox', headers: { 'X-Dev-Outbox-Key': key } })).status, 400, 'a recipient is mandatory: nothing can be listed');
  assert.equal((await outbox(A, 'not-an-email')).status, 400);
});

test('the access key is required, per process, and not accepted from the query string', { skip }, async () => {
  for (const r of [await outbox(A, u.email, { withKey: false }), await outbox(A, u.email, { k: 'wrong' }), await outbox(A, u.email, { k: key.slice(0, -1) }), await outbox(A, u.email, { k: `${key}x` }),
    await h.rawCall(A, { fullPath: `/api/dev/outbox?to=${encodeURIComponent(u.email)}&key=${key}` })]) {
    assert.equal(r.status, 404); assert.ok(!leaked(r));
  }
  assert.notEqual(key, devKey, 'every process has its own key');
  assert.equal((await outbox(A, u.email, { k: devKey })).status, 404, 'another process\'s key does not work');
});

test('Host manipulation: only localhost / 127.0.0.1 / [::1] WITH this server\'s own port are served (DNS rebinding)', { skip }, async () => {
  for (const host of ['evil.example.com', `evil.example.com:${A}`, 'localhost', '127.0.0.1', `localhost:${A + 1}`, `127.0.0.1:1`, `localhost.evil.com:${A}`,
    `127.0.0.1.evil.com:${A}`, `user@localhost:${A}`, `localhost:${A}@evil.com`, `localhost:${A} evil.com`, `localhost:${A},evil.com`, `0.0.0.0:${A}`, `[::2]:${A}`, `localhost:`, `:${A}`, `localhost:${A}/x`, `localhost:${A}.evil.com`]) {
    const r = await outbox(A, u.email, { headers: { Host: host } });
    assert.equal(r.status, 404, `Host=${JSON.stringify(host)} -> ${r.status}`); assert.ok(!leaked(r));
  }
  for (const host of [`localhost:${A}`, `LOCALHOST:${A}`, `127.0.0.1:${A}`, `[::1]:${A}`]) {
    assert.equal((await outbox(A, u.email, { headers: { Host: host } })).status, 200, `Host=${host}`);
  }
});

test('proxy / client-IP headers of every kind are refused, even from loopback and with the key', { skip }, async () => {
  const hdrs = { 'X-Forwarded-For': '203.0.113.9', 'X-Forwarded-For ': '127.0.0.1', 'X-Forwarded-Host': 'localhost', 'X-Forwarded-Proto': 'https', 'X-Forwarded-Port': '443', 'X-Forwarded-Server': 'x',
    'X-Real-IP': '127.0.0.1', 'CF-Connecting-IP': '127.0.0.1', 'CF-Ray': 'abc', 'CF-IPCountry': 'US', 'Forwarded': 'for=127.0.0.1;host=localhost', 'True-Client-IP': '127.0.0.1', 'X-Client-IP': '127.0.0.1',
    'X-Cluster-Client-IP': '127.0.0.1', 'Fastly-Client-IP': '127.0.0.1', 'Via': '1.1 proxy', 'X-Original-Forwarded-For': '1.2.3.4', 'X-Original-URL': '/api/dev/outbox', 'X-Rewrite-URL': '/x' };
  for (const [k, v] of Object.entries(hdrs)) {
    const r = await outbox(A, u.email, { headers: { [k.trim()]: v } });
    assert.equal(r.status, 404, `${k.trim()}: ${v}`); assert.ok(!leaked(r));
  }
});

test('browser requests are refused: Origin header, cross-site fetch metadata', { skip }, async () => {
  assert.equal((await outbox(A, u.email, { headers: { Origin: 'http://localhost:5173' } })).status, 404);
  assert.equal((await outbox(A, u.email, { headers: { Origin: 'http://evil.example' } })).status, 404);
  assert.equal((await outbox(A, u.email, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 404);
  assert.equal((await outbox(A, u.email, { headers: { 'Sec-Fetch-Site': 'same-site' } })).status, 404);
  assert.equal((await outbox(A, u.email, { headers: { 'Sec-Fetch-Site': 'none' } })).status, 200, 'typing the URL into the address bar-style navigation is fine');
});

test('only GET: HEAD (which Express would route to the GET handler), POST, PUT, DELETE, PATCH, OPTIONS are all refused', { skip }, async () => {
  for (const method of ['HEAD', 'POST', 'PUT', 'DELETE', 'PATCH']) {
    const r = await outbox(A, u.email, { method });
    assert.equal(r.status, 404, method); assert.ok(!leaked(r), method);
    assert.equal(r.text.includes('emails'), false, method);
  }
  // OPTIONS is answered by the global CORS middleware (204, empty body) before routing; it never reaches the outbox handler.
  const opt = await outbox(A, u.email, { method: 'OPTIONS' });
  assert.ok([204, 404].includes(opt.status)); assert.equal(opt.text, '');
  // no Host header at all (HTTP/1.0 over a raw socket)
  const rawStatus = await new Promise((resolve, reject) => {
    const sock = require('node:net').connect(A, '127.0.0.1', () => sock.write(`GET /api/dev/outbox?to=${encodeURIComponent(u.email)} HTTP/1.0
X-Dev-Outbox-Key: ${key}

`));
    let buf = ''; sock.on('data', (d) => { buf += d; }); sock.on('end', () => resolve(buf)); sock.on('error', reject);
  });
  assert.match(rawStatus, /^HTTP\/1\.\d (400|404)/); assert.ok(!/actionUrl/.test(rawStatus), 'a request without a Host header is refused');
});

test('path variations never bypass the guard (router-level) and never serve without the key', { skip }, async () => {
  const q = `?to=${encodeURIComponent(u.email)}`;
  const paths = ['/api/dev/outbox/', '/api/DEV/OUTBOX', '/api/dev/%6Futbox', '/api/dev//outbox', '/api//dev/outbox', '/api/dev/outbox/.', '/api/dev/outbox/..%2foutbox', '/api/dev/outbox%00', '/api/dev/outbox;x=1',
    '/api/dev/outbox%2f', '/api/dev/./outbox', '/api/dev/../dev/outbox', '/api/dev', '/api/dev/', '/api/dev/outbox/x', '/api/dev/%2e%2e/dev/outbox'];
  for (const p of paths) {
    const r = await h.rawCall(A, { fullPath: `${p}${q}` });
    assert.equal(r.status, 404, `${p} without key -> ${r.status}`); assert.ok(!leaked(r), p);
  }
  // With the key only the canonical route (and its case/slash/encoding aliases that Express itself normalises) answers.
  for (const p of ['/api/dev/outbox/', '/api/DEV/OUTBOX']) assert.equal((await h.rawCall(A, { fullPath: `${p}${q}`, headers: { 'X-Dev-Outbox-Key': key } })).status, 200, p);
  for (const p of ['/api/dev/outbox/x', '/api/dev', '/api/dev/']) assert.equal((await h.rawCall(A, { fullPath: `${p}${q}`, headers: { 'X-Dev-Outbox-Key': key } })).status, 404, p);
  // query tricks
  assert.equal((await h.rawCall(A, { fullPath: `/api/dev/outbox?to=${encodeURIComponent(u.email)}&to=other@example.com`, headers: { 'X-Dev-Outbox-Key': key } })).status, 400);
  assert.equal((await h.rawCall(A, { fullPath: '/api/dev/outbox?to[$ne]=x', headers: { 'X-Dev-Outbox-Key': key } })).status, 400);
});

test('explicit opt-in: without DEV_OUTBOX_ENABLED=true the viewer does not exist (default off), and no key is printed', { skip }, async () => {
  const child = h.servers.find((s) => s.port === NOFLAG);
  assert.ok(!child.outboxKey && !/Dev outbox viewer/.test(child.out.text));
  const nu = await h.newUser(NOFLAG, 'nf');
  await h.forgot(NOFLAG, nu.email); // mail IS stored (outbox transport) but is unreachable over HTTP
  assert.ok(await h.waitForMail(nu.email));
  for (const k of [undefined, key, 'anything']) assert.equal((await outbox(NOFLAG, nu.email, { withKey: !!k, k })).status, 404);
});

test('DEV_OUTBOX_ENABLED must be exactly "true": TRUE, 1, yes, " true", on all leave it OFF', { skip }, async () => {
  for (const v of ['TRUE', 'True', '1', 'yes', ' true', 'true ', 'on', '']) {
    const p = nextPort++;
    const c = await h.startServer(p, { DEV_OUTBOX_ENABLED: v });
    assert.ok(!c.outboxKey, `DEV_OUTBOX_ENABLED=${JSON.stringify(v)} must not enable the viewer`);
    assert.equal((await outbox(p, u.email, { k: key })).status, 404);
    await h.killServer(c);
  }
});

test('NODE_ENV=development works exactly like test (key, Host and header rules apply)', { skip }, async () => {
  assert.ok(devKey);
  const du = await h.newUser(DEV, 'dv'); await h.forgot(DEV, du.email); assert.ok(await h.waitForMail(du.email));
  assert.equal((await outbox(DEV, du.email, { k: devKey })).status, 200);
  assert.equal((await outbox(DEV, du.email, { k: devKey, headers: { 'X-Real-IP': '127.0.0.1' } })).status, 404);
  assert.equal((await outbox(DEV, du.email, { k: devKey, headers: { Host: 'evil.example:1' } })).status, 404);
});

// ---------------------------------------------------------------------------------- unexpected environment values
const ENV_VALUES = [['unset', undefined], ['empty', ''], ['Production', 'Production'], ['PRODUCTION', 'PRODUCTION'], ['prod', 'prod'], ['production', 'production'], ['staging', 'staging'], ['Test', 'Test'], ['Development', 'Development'], ['dev', 'dev'], [' test', ' test'], ['test ', 'test ']];
for (const [label, value] of ENV_VALUES) {
  test(`NODE_ENV=${label}: the outbox transport and the viewer are both refused at start-up; with nothing configured the service is simply unavailable`, { skip }, async () => {
    const secret = value === 'production' ? PROD_SECRET : undefined;
    // 1) explicit outbox transport -> refuses to start
    const bad = await h.startServer(nextPort++, { NODE_ENV: value, EMAIL_TRANSPORT: 'outbox', ...(secret ? { JWT_SECRET: secret } : {}) }, { expectExit: true });
    assert.ok(await h.waitFor(() => bad.out.code !== null, { timeout: 8000 }), 'server exited');
    assert.equal(bad.out.code, 1);
    assert.match(bad.out.text, /Refusing to start: EMAIL_TRANSPORT=outbox is a development-only transport/);
    // 2) viewer flag -> refuses to start
    const bad2 = await h.startServer(nextPort++, { NODE_ENV: value, EMAIL_TRANSPORT: 'none', DEV_OUTBOX_ENABLED: 'true', ...(secret ? { JWT_SECRET: secret } : {}) }, { expectExit: true });
    assert.ok(await h.waitFor(() => bad2.out.code !== null, { timeout: 8000 }));
    assert.equal(bad2.out.code, 1);
    assert.match(bad2.out.text, /DEV_OUTBOX_ENABLED=true requires NODE_ENV/);
    // 3) nothing configured -> starts, no outbox transport, no viewer, forgot-password answers 503 for everyone, nothing stored
    const port = nextPort++;
    const ok = await h.startServer(port, { NODE_ENV: value, DEV_OUTBOX_ENABLED: undefined, ...(secret ? { JWT_SECRET: secret } : {}) });
    const email = h.emailFor('env');
    assert.equal((await h.rawCall(port, { method: 'POST', url: '/auth/signup', body: { name: 'Env User', email, password: 'Sunrise2025' } })).status, 201);
    const f = await h.forgot(port, email);
    assert.equal(f.status, 503); assert.equal(f.body.code, 'EMAIL_UNAVAILABLE');
    assert.equal((await h.forgot(port, 'ghost@example.com')).status, 503);
    assert.equal((await outbox(port, email, { k: key })).status, 404);
    await sleep(200);
    assert.equal((await h.mailsFor(email)).length, 0, 'nothing was written to the outbox');
    const u2 = await coll('users').findOne({ email });
    assert.equal(await coll('authtokens').countDocuments({ user: u2._id, purpose: 'password_reset' }), 0);
    await h.killServer(ok);
  });
}

test('production: unavailable transport -> start-up warning, 503 for every address, no outbox route, no outbox collection use', { skip }, async () => {
  const port = nextPort++;
  const prod = await h.startServer(port, { NODE_ENV: 'production', JWT_SECRET: PROD_SECRET, DEV_OUTBOX_ENABLED: undefined });
  assert.match(prod.out.text, /EMAIL WARNING: no email transport is configured/);
  const email = h.emailFor('prod');
  assert.equal((await h.rawCall(port, { method: 'POST', url: '/auth/signup', body: { name: 'Prod User', email, password: 'Sunrise2025' } })).status, 201);
  const known = await h.forgot(port, email); const unknown = await h.forgot(port, 'nobody@example.com');
  assert.equal(known.status, 503); assert.deepEqual(known.body, unknown.body);
  assert.ok(!/have been sent|has been sent|will send/.test(known.text));
  assert.equal((await outbox(port, email, { k: key })).status, 404);
  assert.equal((await h.rawCall(port, { fullPath: '/api/dev/outbox' })).status, 404);
  await h.killServer(prod);
});

test('production: the local outbox transport and the viewer flag each stop the server from starting', { skip }, async () => {
  for (const extra of [{ EMAIL_TRANSPORT: 'outbox' }, { DEV_OUTBOX_ENABLED: 'true' }, { EMAIL_TRANSPORT: 'outbox', DEV_OUTBOX_ENABLED: 'true' }]) {
    const c = await h.startServer(nextPort++, { NODE_ENV: 'production', JWT_SECRET: PROD_SECRET, ...extra }, { expectExit: true });
    assert.ok(await h.waitFor(() => c.out.code !== null, { timeout: 8000 }));
    assert.equal(c.out.code, 1, JSON.stringify(extra));
    assert.match(c.out.text, /Refusing to start/);
  }
});

test('the OutboxEmail model is unusable (and unregistered), and the outbox transport cannot send, outside development/test', { skip }, () => {
  const run = (nodeEnv, code) => spawnSync(process.execPath, ['-e', code], { cwd: SERVER_DIR, env: { PATH: process.env.PATH, ...(nodeEnv === undefined ? {} : { NODE_ENV: nodeEnv }) }, encoding: 'utf8' });
  for (const env of [undefined, 'production', 'Production', 'prod', 'staging']) {
    const r = run(env, "const M=require('./models/OutboxEmail'); if(require('mongoose').models.OutboxEmail) process.exit(9); M.create()");
    assert.equal(r.status, 1, `NODE_ENV=${env}: requiring is safe, registers no model, but any use throws`);
    assert.match(r.stderr, /development\/test-only model/);
    const t = run(env, "require('./services/email/transports/outbox').send({to:'a@b.co'},{NODE_ENV:process.env.NODE_ENV}).then(()=>process.exit(0),e=>{console.log(e.code);process.exit(7)})");
    assert.equal(t.status, 7); assert.match(t.stdout, /EMAIL_OUTBOX_FORBIDDEN/);
  }
  for (const env of ['development', 'test']) assert.equal(run(env, "require('./models/OutboxEmail')").status, 0, `NODE_ENV=${env}`);
});

test('the generic forgot-password answer on a normal server is unchanged (sanity)', { skip }, async () => {
  assert.equal((await h.forgot(A, 'ghost@example.com')).body.message, GENERIC);
});
