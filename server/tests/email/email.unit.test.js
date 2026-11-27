/* Email service + token utility unit tests (node:test). No database, no network, no real email provider. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const config = require('../../services/email/config');
const { render, escapeHtml } = require('../../services/email/templates');
const { sendEmail, getTransport, isAvailable, EmailError, _setTransport } = require('../../services/email');
const outboxRoute = require('../../routes/devOutboxRoutes');
const tokens = require('../../utils/authTokens');

const SERVER_DIR = path.join(__dirname, '..', '..');

test('config: the outbox is only ever selected for NODE_ENV exactly development/test; everything else is "none" or refused', () => {
  assert.equal(config.transportName({ NODE_ENV: 'test' }), 'outbox');
  assert.equal(config.transportName({ NODE_ENV: 'development' }), 'outbox');
  for (const env of [undefined, '', 'production', 'Production', 'PRODUCTION', 'prod', 'staging', 'Test', 'Development', 'dev', ' test', 'test ']) {
    assert.equal(config.transportName({ NODE_ENV: env }), 'none', `NODE_ENV=${JSON.stringify(env)}`);
    assert.equal(config.isDevEnvironment({ NODE_ENV: env }), false, `NODE_ENV=${JSON.stringify(env)}`);
    assert.equal(config.emailPolicy({ NODE_ENV: env, EMAIL_TRANSPORT: 'outbox' }).action, 'exit', `outbox + NODE_ENV=${JSON.stringify(env)}`);
    assert.equal(config.emailPolicy({ NODE_ENV: env, DEV_OUTBOX_ENABLED: 'true' }).action, 'exit', `viewer + NODE_ENV=${JSON.stringify(env)}`);
    assert.equal(config.emailPolicy({ NODE_ENV: env }).action, 'warn');
  }
  assert.equal(config.transportName({ NODE_ENV: 'test', EMAIL_TRANSPORT: ' OUTBOX ' }), 'outbox');
  assert.equal(config.emailPolicy({ NODE_ENV: 'test' }).action, 'ok');
  assert.equal(config.emailPolicy({ NODE_ENV: 'development', DEV_OUTBOX_ENABLED: 'true' }).action, 'ok');
  assert.equal(config.emailPolicy({ NODE_ENV: 'test', EMAIL_TRANSPORT: 'none' }).action, 'ok');
  assert.equal(config.emailPolicy({ NODE_ENV: 'test', EMAIL_TRANSPORT: 'smtp-someday' }).action, 'warn');
});

test('config: the viewer flag is opt-in and exact', () => {
  assert.equal(config.devOutboxEnabled({}), false);
  for (const v of ['TRUE', 'True', '1', 'yes', ' true', 'true ', 'on', '', 'false']) assert.equal(config.devOutboxEnabled({ DEV_OUTBOX_ENABLED: v }), false, JSON.stringify(v));
  assert.equal(config.devOutboxEnabled({ DEV_OUTBOX_ENABLED: 'true' }), true);
});

test('config: base URL is a clean http(s) origin; junk falls back safely', () => {
  assert.equal(config.appBaseUrl({ APP_BASE_URL: 'https://careernest.example.com/path?x=1' }), 'https://careernest.example.com');
  assert.equal(config.appBaseUrl({ CLIENT_ORIGIN: 'http://localhost:5173,https://other.example' }), 'http://localhost:5173');
  assert.equal(config.appBaseUrl({ APP_BASE_URL: 'javascript:alert(1)', CLIENT_ORIGIN: 'http://localhost:5175' }), 'http://localhost:5175');
  assert.equal(config.appBaseUrl({}), 'http://localhost:5173');
});

test('templates: password reset renders subject, text, html and the action link; values are escaped', () => {
  const url = 'http://localhost:5173/reset-password#token=abc';
  const m = render('passwordReset', { name: '<b>Ada</b> Lovelace', resetUrl: url, expiresMinutes: 30 });
  assert.equal(m.subject, 'Reset your CareerNest password');
  assert.ok(m.text.includes(url) && m.text.includes('30 minutes') && m.text.includes('Hi <b>Ada</b>,'));
  assert.ok(m.html.includes('href="http://localhost:5173/reset-password#token=abc"'));
  assert.ok(!m.html.includes('<b>Ada</b>'), 'name must be HTML-escaped');
  assert.ok(m.html.includes('&lt;b&gt;Ada&lt;/b&gt;'));
  assert.equal(m.actionUrl, url);
});

test('templates: javascript: links never reach an href; unknown templates are rejected; password-changed notice has no link', () => {
  const m = render('passwordReset', { name: 'X', resetUrl: 'javascript:alert(1)', expiresMinutes: 5 });
  assert.ok(!/href="javascript:/i.test(m.html));
  assert.throws(() => render('nope', {}), (e) => e.code === 'EMAIL_TEMPLATE_UNKNOWN');
  const c = render('passwordChanged', { name: 'Ada Lovelace' });
  assert.match(c.subject, /password was changed/i);
  assert.equal(c.actionUrl, undefined);
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

test('sendEmail delivers through the transport interface and returns its id; recipient is normalised', async () => {
  const sent = [];
  _setTransport({ name: 'fake', send: async (msg) => { sent.push(msg); return { id: 'm1' }; } });
  try {
    const r = await sendEmail('passwordReset', '  Ada@Example.COM'.trim(), { name: 'Ada', resetUrl: 'http://localhost:5173/reset-password#token=t', expiresMinutes: 30 });
    assert.deepEqual(r, { id: 'm1', transport: 'fake', state: 'provider_accepted' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'ada@example.com');
    assert.equal(sent[0].template, 'passwordReset');
    assert.ok(sent[0].from && sent[0].subject && sent[0].text && sent[0].html && sent[0].actionUrl);
  } finally { _setTransport(null); }
});

test('sendEmail reports only the delivery state the transport can honestly claim (never "delivered" by default)', async () => {
  _setTransport({ name: 'fake', send: async () => ({ id: 'x', state: 'stored_local' }) });
  try {
    assert.equal((await sendEmail('passwordChanged', 'a@example.com', { name: 'A' })).state, 'stored_local');
  } finally { _setTransport(null); }
});

test('sendEmail failure: provider errors are mapped to a safe EmailError that never carries the provider message', async () => {
  _setTransport({ name: 'bad', send: async () => { throw new Error('SMTP 535 login failed for secret-user@provider.example'); } });
  try {
    await assert.rejects(sendEmail('passwordChanged', 'a@example.com', { name: 'A' }), (e) => e instanceof EmailError && e.code === 'EMAIL_SEND_FAILED' && !/secret-user|SMTP/.test(e.message));
  } finally { _setTransport(null); }
  await assert.rejects(sendEmail('passwordChanged', 'not-an-email', {}), (e) => e.code === 'EMAIL_BAD_RECIPIENT');
  await assert.rejects(sendEmail('passwordChanged', 'a@b.com,c@d.com', {}), (e) => e.code === 'EMAIL_BAD_RECIPIENT', 'header-injection style multi-recipient is refused');
});

test('transport selection: outside development/test never the outbox; "none" fails safely with EMAIL_NOT_CONFIGURED', async () => {
  for (const env of [undefined, 'production', 'Production', 'prod']) {
    assert.throws(() => getTransport({ NODE_ENV: env, EMAIL_TRANSPORT: 'outbox' }), (e) => e.code === 'EMAIL_OUTBOX_FORBIDDEN', String(env));
    assert.equal(getTransport({ NODE_ENV: env }).name, 'none');
    assert.equal(isAvailable({ NODE_ENV: env }), false);
  }
  assert.equal(getTransport({ NODE_ENV: 'test', EMAIL_TRANSPORT: 'outbox' }).name, 'outbox');
  assert.equal(isAvailable({ NODE_ENV: 'test' }), true);
  assert.equal(isAvailable({ NODE_ENV: 'test', EMAIL_TRANSPORT: 'none' }), false);
  await assert.rejects(sendEmail('passwordChanged', 'a@example.com', { name: 'A' }, { NODE_ENV: 'test', EMAIL_TRANSPORT: 'none' }), (e) => e.code === 'EMAIL_NOT_CONFIGURED');
  await assert.rejects(sendEmail('passwordChanged', 'a@example.com', { name: 'A' }, { NODE_ENV: 'production' }), (e) => e.code === 'EMAIL_NOT_CONFIGURED');
});

test('dev outbox access policy: opt-in flag AND NODE_ENV exactly development/test AND the outbox transport', () => {
  const ok = { NODE_ENV: 'test', DEV_OUTBOX_ENABLED: 'true' };
  assert.equal(outboxRoute.devOutboxAllowed(ok), true);
  assert.equal(outboxRoute.devOutboxAllowed({ NODE_ENV: 'development', DEV_OUTBOX_ENABLED: 'true' }), true);
  assert.equal(outboxRoute.devOutboxAllowed({ NODE_ENV: 'test' }), false, 'default is disabled');
  assert.equal(outboxRoute.devOutboxAllowed({ DEV_OUTBOX_ENABLED: 'true' }), false, 'unset NODE_ENV');
  for (const env of ['production', 'Production', 'prod', 'staging', '']) assert.equal(outboxRoute.devOutboxAllowed({ ...ok, NODE_ENV: env }), false, env);
  assert.equal(outboxRoute.devOutboxAllowed({ ...ok, EMAIL_TRANSPORT: 'none' }), false);
  assert.equal(outboxRoute.devOutboxAllowed({ ...ok, DEV_OUTBOX_ENABLED: 'TRUE' }), false);
});

test('dev outbox request checks: loopback peer, no proxy headers, Host = loopback name + this socket port', () => {
  const req = (addr, headers = {}, port = 5000, host = `localhost:${port}`) => ({ socket: { remoteAddress: addr, localPort: port }, headers: { ...(host === null ? {} : { host }), ...headers } });
  for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) assert.equal(outboxRoute.fromLocalMachine(req(a)), true);
  for (const a of ['203.0.113.9', '192.168.1.20', '::ffff:203.0.113.9', undefined]) assert.equal(outboxRoute.fromLocalMachine(req(a)), false);
  for (const hd of ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-anything', 'forwarded', 'x-real-ip', 'cf-connecting-ip', 'cf-whatever', 'true-client-ip', 'via', 'x-client-ip']) {
    assert.equal(outboxRoute.fromLocalMachine(req('127.0.0.1', { [hd]: '1' })), false, hd);
    assert.equal(outboxRoute.hasProxyHeaders({ [hd]: '1' }), true, hd);
  }
  assert.equal(outboxRoute.hasProxyHeaders({ host: 'localhost:5000', accept: '*/*' }), false);
  for (const host of ['localhost:5000', 'LOCALHOST:5000', '127.0.0.1:5000', '[::1]:5000']) assert.equal(outboxRoute.hostIsLocal(req('127.0.0.1', {}, 5000, host)), true, host);
  for (const host of [null, '', 'localhost', 'localhost:5001', 'evil.com:5000', 'localhost.evil.com:5000', 'a@localhost:5000', 'localhost:5000,evil.com', 'localhost:5000 x', '127.0.0.1:99999', 'x'.repeat(100)]) {
    assert.equal(outboxRoute.hostIsLocal(req('127.0.0.1', {}, 5000, host)), false, String(host));
  }
});

test('forgot-password answers 503 SERVICE_UNAVAILABLE when the database is not connected (account-independent)', async () => {
  const { forgotPassword } = require('../../controllers/passwordResetController');
  _setTransport({ name: 'fake', send: async () => ({ id: 'x', state: 'provider_accepted' }) });
  const mkRes = () => ({ code: null, json(b) { this.body = b; return this; }, status(c) { this.code = c; return this; } });
  try {
    const res = mkRes();
    await forgotPassword({ body: { email: 'a@example.com' } }, res, (e) => { throw e; });
    assert.equal(res.code, 503); assert.equal(res.body.code, 'SERVICE_UNAVAILABLE');
    const res2 = mkRes();
    await forgotPassword({ body: { email: 'someone.else@example.com' } }, res2, (e) => { throw e; });
    assert.deepEqual(res2.body, res.body);
  } finally { _setTransport(null); }
});

test('regression (full-suite 503): a brief database blip is ridden out; a real outage still answers 503', async () => {
  const { dbReady } = require('../../controllers/passwordResetController');
  assert.equal(await dbReady({ readyState: 1 }, 200), true);
  const blip = { readyState: 0 }; setTimeout(() => { blip.readyState = 1; }, 250); // driver reconnects after 250 ms
  assert.equal(await dbReady(blip, 1500), true, 'transient disconnect: no 503');
  const t0 = Date.now();
  assert.equal(await dbReady({ readyState: 0 }, 300), false, 'real outage: still reported');
  assert.ok(Date.now() - t0 < 1000, 'and the wait is bounded');
});

test('recovery limits: sane clamps outside tests (a typo cannot disable protection); relaxed only under NODE_ENV=test', () => {
  assert.deepEqual(tokens.limits({}), { cooldownMs: 60000, maxPerHour: 5 });
  assert.equal(tokens.limits({ RESET_COOLDOWN_SECONDS: '0' }).cooldownMs, 60000);
  assert.equal(tokens.limits({ RESET_COOLDOWN_SECONDS: '5' }).cooldownMs, 60000);
  assert.equal(tokens.limits({ RESET_MAX_PER_HOUR: '9999' }).maxPerHour, 5);
  assert.equal(tokens.limits({ NODE_ENV: 'production', RESET_COOLDOWN_SECONDS: '0' }).cooldownMs, 60000);
  assert.equal(tokens.limits({ RESET_COOLDOWN_SECONDS: '120', RESET_MAX_PER_HOUR: '3' }).cooldownMs, 120000);
  assert.deepEqual(tokens.limits({ NODE_ENV: 'test', RESET_COOLDOWN_SECONDS: '0', RESET_MAX_PER_HOUR: '1000' }), { cooldownMs: 0, maxPerHour: 1000 });
});

test('fault injection is inert outside NODE_ENV=test', () => {
  const r = spawnSync(process.execPath, ['-e', "require('./utils/testFaults').fault('reset.afterConsume').then(()=>console.log('survived'))"], {
    cwd: SERVER_DIR, encoding: 'utf8',
    env: { PATH: process.env.PATH, NODE_ENV: 'development', AUTH_TEST_FAULT: JSON.stringify([{ point: 'reset.afterConsume', action: 'crash' }]) },
  });
  assert.equal(r.status, 0); assert.match(r.stdout, /survived/);
});

test('tokens: 256-bit URL-safe, unique, hashed with SHA-256; the hash is not the token; shape validation rejects junk', () => {
  const a = tokens.newRawToken(); const b = tokens.newRawToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
  assert.equal(tokens.hashToken(a), tokens.hashToken(a));
  assert.match(tokens.hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(tokens.hashToken(a), a);
  assert.equal(tokens.looksLikeToken(a), true);
  for (const bad of [undefined, null, 5, {}, [], '', 'short', 'x'.repeat(42), 'x'.repeat(44), `${a.slice(0, 42)}!`, { $gt: '' }]) assert.equal(tokens.looksLikeToken(bad), false);
});

test('tokens: lifetime is configurable only within a sane range (default 30 minutes)', () => {
  assert.equal(tokens.ttlMinutes({}), 30);
  assert.equal(tokens.ttlMinutes({ RESET_TOKEN_TTL_MINUTES: '15' }), 15);
  assert.equal(tokens.ttlMinutes({ RESET_TOKEN_TTL_MINUTES: '1' }), 30); // too short -> default
  assert.equal(tokens.ttlMinutes({ RESET_TOKEN_TTL_MINUTES: '999999' }), 30); // absurdly long -> default
  assert.equal(tokens.ttlMinutes({ RESET_TOKEN_TTL_MINUTES: 'abc' }), 30);
});

test('tokenVersion filter treats a missing version as 0, like the auth middleware', () => {
  assert.deepEqual(tokens.tokenVersionFilter(0), { $in: [0, null] });
  assert.deepEqual(tokens.tokenVersionFilter(undefined), { $in: [0, null] });
  assert.equal(tokens.tokenVersionFilter(3), 3);
});
