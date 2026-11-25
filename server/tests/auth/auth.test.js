/*
 * Auth API tests (node:test). Needs a DISPOSABLE local MongoDB that you start yourself:
 *
 *   mongod --dbpath <temp dir outside the repo> --port 27071
 *   AUTH_TEST_MONGO=mongodb://127.0.0.1:27071 npm run test:auth
 *
 * Refuses anything that is not localhost/127.0.0.1. Starts two API child processes with explicit MONGO_URI and
 * JWT_SECRET (never the .env values): one with rate limiting off (functional tests) and one with it forced on.
 * Uses its own database and drops it at the end.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const BASE = process.env.AUTH_TEST_MONGO || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('Set AUTH_TEST_MONGO to a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27071');
}
const PORT = Number(process.env.TEST_PORT || 5031);
const PORT_RL = PORT + 1;
const DB = `auth_api_test_${process.pid}`;
const URI = `${BASE.replace(/\/$/, '')}/${DB}`;
const SERVER_DIR = path.join(__dirname, '..', '..');
const SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
const GOOD_PW = 'Sunrise2025';
const servers = [];

const startServer = (port, extraEnv = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, MONGO_URI: URI, JWT_SECRET: SECRET, PORT: String(port), CLIENT_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const out = { text: '' };
  child.stderr.on('data', (d) => { out.text += d; });
  const t = setTimeout(() => reject(new Error('server did not start')), 20000);
  child.stdout.on('data', (d) => { out.text += d; if (String(d).includes('Server running')) { clearTimeout(t); resolve(); } });
  child.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  servers.push(child);
  child.out = out;
});

// Raw http so a different source address (127.0.0.x) can be used for the per-IP tests.
const rawCall = (port, { method = 'GET', url, token, body, rawBody, localAddress, headers = {} }) => new Promise((resolve, reject) => {
  const payload = rawBody !== undefined ? rawBody : (body === undefined ? undefined : JSON.stringify(body));
  const req = http.request({
    host: '127.0.0.1', port, path: `/api${url}`, method, localAddress,
    headers: { ...(payload !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  }, (res) => {
    let text = '';
    res.on('data', (d) => { text += d; });
    res.on('end', () => {
      let json = null;
      try { json = JSON.parse(text); } catch { /* not json */ }
      resolve({ status: res.statusCode, body: json, text, headers: res.headers });
    });
  });
  req.on('error', reject);
  if (payload !== undefined) req.write(payload);
  req.end();
});
const call = (opts) => rawCall(PORT, opts);
const callRl = (opts) => rawCall(PORT_RL, opts);

let seq = 0;
const email = (tag = 'u') => `${tag}${++seq}.${process.pid}@example.com`;
const signup = (over = {}, fn = call, extra = {}) => fn({ method: 'POST', url: '/auth/signup', body: { name: 'Ada Lovelace', email: email(), password: GOOD_PW, ...over }, ...extra });
const login = (e, p, fn = call, extra = {}) => fn({ method: 'POST', url: '/auth/login', body: { email: e, password: p }, ...extra });
const newUser = async (tag = 'u') => {
  const e = email(tag);
  const s = await signup({ email: e });
  assert.equal(s.status, 201, s.text);
  const l = await login(e, GOOD_PW);
  assert.equal(l.status, 200);
  return { email: e, token: l.body.token, id: l.body.user.id };
};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

before(async () => {
  await startServer(PORT);
  await startServer(PORT_RL, { AUTH_RATE_LIMIT_FORCE: 'true' });
  await mongoose.connect(URI);
});

after(async () => {
  try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
  await mongoose.disconnect();
  for (const s of servers) { s.removeAllListeners('exit'); s.kill(); }
});

const User = () => mongoose.connection.collection('users');

// ---------- signup ----------
test('valid signup returns 201 {message,userId} and stores a bcrypt hash, never plaintext', async () => {
  const e = email('ok');
  const r = await signup({ email: `  ${e.toUpperCase()}  `, name: '  Ada   Lovelace ', acceptTerms: true });
  assert.equal(r.status, 201);
  assert.ok(r.body.userId && r.body.message);
  assert.ok(!r.text.includes('password') || !/\$2[aby]\$/.test(r.text));
  const doc = await User().findOne({ email: e });
  assert.ok(doc, 'email stored trimmed and lower-cased');
  assert.match(doc.password, /^\$2[aby]\$12\$/);
  assert.ok(!JSON.stringify(doc).includes(GOOD_PW));
  assert.equal(doc.name, 'Ada Lovelace');
  assert.ok(doc.termsAcceptedAt instanceof Date);
  assert.equal(doc.role, 'jobseeker');
});

test('terms not accepted -> no termsAcceptedAt, and acceptTerms is optional', async () => {
  const e = email('nt');
  assert.equal((await signup({ email: e })).status, 201);
  assert.equal((await User().findOne({ email: e })).termsAcceptedAt, undefined);
});

test('each invalid field gets a field-level error with VALIDATION_ERROR', async () => {
  const cases = [
    [{ name: '' }, 'name'], [{ name: 'A' }, 'name'], [{ name: 'x'.repeat(81) }, 'name'], [{ name: '<b>hi</b>' }, 'name'], [{ name: 'Bad\u0000Name' }, 'name'],
    [{ email: '' }, 'email'], [{ email: 'not-an-email' }, 'email'], [{ email: 'a@b' }, 'email'], [{ email: 'a..b@example.com' }, 'email'],
    [{ email: `${'a'.repeat(250)}@example.com` }, 'email'], [{ email: 'a b@example.com' }, 'email'],
    [{ password: '' }, 'password'], [{ password: 'short1' }, 'password'], [{ password: 'alllettersonly' }, 'password'], [{ password: '1234567890' }, 'password'],
    [{ password: 'Password1' }, 'password'], [{ password: 'password99!' }, 'password'], [{ password: 'a1'.repeat(40) }, 'password'],
    [{ password: 'é1'.repeat(40) }, 'password'],
  ];
  for (const [over, field] of cases) {
    const r = await signup(over);
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.equal(r.body.code, 'VALIDATION_ERROR');
    assert.ok(r.body.errors[field], `${field} error for ${JSON.stringify(over).slice(0, 60)}`);
  }
  const all = await signup({ name: '', email: 'x', password: 'x' });
  assert.deepEqual(Object.keys(all.body.errors).sort(), ['email', 'name', 'password']);
});

test('password must not contain the email name or equal the name', async () => {
  const r1 = await signup({ email: `janedoe${seq}@example.com`, password: `janedoe${seq}X9` });
  assert.equal(r1.status, 400); assert.ok(r1.body.errors.password);
  const r2 = await signup({ name: 'Sunrise2025', password: 'Sunrise2025' });
  assert.equal(r2.status, 400); assert.ok(r2.body.errors.password);
  assert.equal((await signup({ password: 'aB3xY9'.repeat(12) })).status, 201); // exactly 72 bytes allowed
  assert.equal((await signup({ password: 'aB3xY9'.repeat(12) + '1' })).status, 400);
});

test('duplicate email -> 409 EMAIL_EXISTS (case-insensitive)', async () => {
  const e = email('dup');
  assert.equal((await signup({ email: e })).status, 201);
  const r = await signup({ email: e.toUpperCase() });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'EMAIL_EXISTS');
});

test('non-string / NoSQL-operator payloads are rejected on signup and login', async () => {
  for (const over of [{ email: { $gt: '' } }, { email: ['a@b.com'] }, { password: { $ne: 1 } }, { name: { $gt: '' } }, { name: 123 }, { password: 12345678 }]) {
    const r = await signup(over);
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.equal(r.body.code, 'VALIDATION_ERROR');
  }
  const u = await newUser('nosql');
  for (const body of [{ email: { $gt: '' }, password: { $gt: '' } }, { email: u.email, password: { $ne: 'x' } }, { email: [u.email], password: GOOD_PW }, { email: { $regex: '.*' }, password: GOOD_PW }]) {
    const r = await call({ method: 'POST', url: '/auth/login', body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.body.token, undefined);
  }
  assert.equal((await call({ method: 'POST', url: '/auth/signup', rawBody: '[]' })).status, 400);
});

test('mass assignment on signup is ignored (role, isReferrer, _id, tokenVersion, ADMIN)', async () => {
  const e = email('mass');
  const r = await signup({ email: e, role: 'admin', isReferrer: true, _id: '507f1f77bcf86cd799439011', tokenVersion: 99, termsAcceptedAt: '2000-01-01' });
  assert.equal(r.status, 201);
  assert.notEqual(r.body.userId, '507f1f77bcf86cd799439011');
  const doc = await User().findOne({ email: e });
  assert.equal(doc.role, 'jobseeker');
  assert.ok(!doc.isReferrer);
  assert.ok(!doc.tokenVersion);
  assert.equal(doc.termsAcceptedAt, undefined);
});

// ---------- login ----------
test('valid login returns token + user without password', async () => {
  const e = email('login');
  await signup({ email: e });
  const r = await login(e.toUpperCase(), GOOD_PW);
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  assert.equal(r.body.user.email, e);
  assert.ok(!('password' in r.body.user));
  assert.ok(!/\$2[aby]\$/.test(r.text));
  const decoded = jwt.decode(r.body.token, { complete: true });
  assert.equal(decoded.header.alg, 'HS256');
  assert.equal(decoded.payload.tv, 0);
});

test('wrong password and unknown email give identical 401', async () => {
  const u = await newUser('wp');
  const a = await login(u.email, 'WrongPass123');
  const b = await login(email('ghost'), 'WrongPass123');
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.deepEqual(a.body, b.body);
  assert.equal(a.body.code, 'INVALID_CREDENTIALS');
  assert.equal(a.body.message, 'Invalid email or password');
});

test('login with missing credentials -> 400', async () => {
  for (const body of [{}, { email: 'a@b.com' }, { password: 'x' }, { email: '', password: '' }]) {
    const r = await call({ method: 'POST', url: '/auth/login', body });
    assert.equal(r.status, 400);
  }
  assert.equal((await call({ method: 'POST', url: '/auth/login' })).status, 400); // no body at all
});

test('login is not subject to the new password policy (legacy short password still logs in)', async () => {
  const e = email('legacy');
  const bcrypt = require('bcryptjs');
  await User().insertOne({ name: 'Legacy User', email: e, password: await bcrypt.hash('abc123', 10), role: 'jobseeker', createdAt: new Date(), updatedAt: new Date() });
  const r = await login(e, 'abc123');
  assert.equal(r.status, 200);
});

// ---------- tokens ----------
test('/me: valid token ok; missing/invalid/malformed rejected', async () => {
  const u = await newUser('me');
  const ok = await call({ url: '/auth/me', token: u.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.email, u.email);
  assert.ok(!('password' in ok.body.user));
  const none = await call({ url: '/auth/me' });
  assert.equal(none.status, 401); assert.equal(none.body.code, 'NO_TOKEN');
  const bad = await call({ url: '/auth/me', token: 'garbage.token.here' });
  assert.equal(bad.status, 401); assert.equal(bad.body.code, 'INVALID_TOKEN');
  const scheme = await call({ url: '/auth/me', headers: { Authorization: `Basic ${u.token}` } });
  assert.equal(scheme.status, 401);
});

test('/me: expired, tampered, wrong-secret, alg none and wrong-algorithm tokens rejected', async () => {
  const u = await newUser('tok');
  const expired = jwt.sign({ userId: u.id, tv: 0 }, SECRET, { algorithm: 'HS256', expiresIn: -10 });
  const r1 = await call({ url: '/auth/me', token: expired });
  assert.equal(r1.status, 401); assert.equal(r1.body.code, 'TOKEN_EXPIRED');

  const [h, p, s] = u.token.split('.');
  const tamperedPayload = b64({ ...JSON.parse(Buffer.from(p, 'base64url')), userId: '507f1f77bcf86cd799439011' });
  assert.equal((await call({ url: '/auth/me', token: `${h}.${tamperedPayload}.${s}` })).status, 401);
  assert.equal((await call({ url: '/auth/me', token: jwt.sign({ userId: u.id }, 'some-other-secret-of-sufficient-length-xx') })).status, 401);

  const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: u.id, tv: 0 })}.`;
  assert.equal((await call({ url: '/auth/me', token: none })).status, 401);
  const hs512 = jwt.sign({ userId: u.id, tv: 0 }, SECRET, { algorithm: 'HS512' });
  assert.equal((await call({ url: '/auth/me', token: hs512 })).status, 401);

  // payload userId of the wrong shape must be a 401, not a 500
  for (const userId of [{ $ne: null }, 'not-an-id', 12]) {
    const r = await call({ url: '/auth/me', token: jwt.sign({ userId }, SECRET, { algorithm: 'HS256' }) });
    assert.equal(r.status, 401, JSON.stringify(userId));
  }
});

test('legacy token without tv still works', async () => {
  const u = await newUser('leg');
  const legacy = jwt.sign({ userId: u.id }, SECRET, { expiresIn: '7d' });
  assert.equal((await call({ url: '/auth/me', token: legacy })).status, 200);
});

test('protected routes require a token and accept a valid one', async () => {
  const u = await newUser('prot');
  for (const url of ['/saved-jobs', '/applications', '/dashboard/overview', '/notifications']) {
    assert.equal((await call({ url })).status, 401, url);
  }
  assert.equal((await call({ url: '/saved-jobs', token: u.token })).status, 200);
  assert.equal((await call({ url: '/applications', token: u.token })).status, 200);
});

// ---------- profile ----------
test('profile: mass assignment attempts are ignored', async () => {
  const u = await newUser('prof');
  const r = await call({ method: 'PUT', url: '/auth/profile', token: u.token, body: { seekingRole: 'Engineer', role: 'admin', email: 'evil@example.com', tokenVersion: 50, _id: '507f1f77bcf86cd799439011', password: 'x', termsAcceptedAt: '2000-01-01' } });
  assert.equal(r.status, 200);
  const doc = await User().findOne({ _id: new mongoose.Types.ObjectId(u.id) });
  assert.equal(doc.role, 'jobseeker');
  assert.equal(doc.email, u.email);
  assert.ok(!doc.tokenVersion);
  assert.equal(doc.seekingRole, 'Engineer');
  assert.equal(await mongoose.connection.collection('users').countDocuments({ _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011') }), 0);
  assert.equal((await call({ url: '/auth/me', token: u.token })).status, 200); // password field not changed
  assert.equal((await login(u.email, GOOD_PW)).status, 200);
});

test('profile: wrong types rejected, isReferrer must be boolean', async () => {
  const u = await newUser('ptype');
  for (const body of [{ name: { $gt: '' } }, { seekingRole: ['x'] }, { isReferrer: 'false' }, { currentCompany: 'x'.repeat(101) }, { name: 'A' }]) {
    assert.equal((await call({ method: 'PUT', url: '/auth/profile', token: u.token, body })).status, 400, JSON.stringify(body));
  }
});

test('password change: policy, wrong current, same password, revokes old token, new token works', async () => {
  const u = await newUser('pw');
  const put = (body, token = u.token) => call({ method: 'PUT', url: '/auth/profile', token, body });

  const weak = await put({ currentPassword: GOOD_PW, newPassword: 'short1' });
  assert.equal(weak.status, 400); assert.equal(weak.body.code, 'VALIDATION_ERROR'); assert.ok(weak.body.errors.newPassword);
  assert.equal((await put({ currentPassword: GOOD_PW, newPassword: 'onlyletters' })).status, 400);
  assert.equal((await put({ currentPassword: GOOD_PW, newPassword: 'Password123' })).status, 400);

  const wrong = await put({ currentPassword: 'NotMyPassword1', newPassword: 'Brand-new-pass7' });
  assert.equal(wrong.status, 400); assert.equal(wrong.body.code, 'INVALID_CURRENT_PASSWORD');
  assert.equal((await put({ newPassword: 'Brand-new-pass7' })).status, 400); // current password required

  const same = await put({ currentPassword: GOOD_PW, newPassword: GOOD_PW });
  assert.equal(same.status, 400); assert.ok(same.body.errors.newPassword);

  const ok = await put({ currentPassword: GOOD_PW, newPassword: 'Brand-new-pass7' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.ok(!('password' in ok.body.user));
  assert.equal(jwt.decode(ok.body.token).tv, 1);

  assert.equal((await call({ url: '/auth/me', token: u.token })).status, 401, 'old token revoked');
  assert.equal((await call({ url: '/auth/me', token: ok.body.token })).status, 200, 'new token works');
  assert.equal((await login(u.email, GOOD_PW)).status, 401);
  assert.equal((await login(u.email, 'Brand-new-pass7')).status, 200);
});

// ---------- transport / errors ----------
test('oversize auth body -> 413 with no stack trace', async () => {
  const r = await call({ method: 'POST', url: '/auth/signup', body: { name: 'x'.repeat(20000), email: 'a@b.com', password: GOOD_PW } });
  assert.equal(r.status, 413);
  assert.ok(!/at .*\.js/.test(r.text));
});

test('malformed JSON and unknown routes give clean errors without internals', async () => {
  const bad = await call({ method: 'POST', url: '/auth/login', rawBody: '{"email": ' });
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.body), ['message']);
  const nf = await call({ url: '/does-not-exist' });
  assert.equal(nf.status, 404);
  for (const r of [bad, nf]) {
    assert.ok(!/node_modules|\.js:\d+|stack|mongoose|MongoServerError/i.test(r.text), r.text);
  }
});

test('helmet security headers present, x-powered-by absent', async () => {
  const r = await call({ url: '/auth/me' });
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.ok(r.headers['strict-transport-security']);
  assert.ok(r.headers['x-frame-options'] || /frame-ancestors/.test(r.headers['content-security-policy'] || ''));
  assert.ok(r.headers['content-security-policy']);
  assert.equal(r.headers['x-powered-by'], undefined);
});

// ---------- JWT secret check ----------
test('JWT secret policy: weak warns in dev, exits in production, strong ok', () => {
  const { assessJwtSecret, jwtSecretPolicy } = require('../../utils/jwtConfig');
  assert.equal(assessJwtSecret('change-me').weak, true);
  assert.equal(assessJwtSecret('short').weak, true);
  assert.equal(assessJwtSecret('').weak, true);
  assert.equal(assessJwtSecret('x'.repeat(31)).weak, true);
  assert.equal(assessJwtSecret('a-random-looking-secret-0123456789abcdef').weak, false);
  assert.equal(jwtSecretPolicy('change-me', { NODE_ENV: 'development' }).action, 'warn');
  assert.equal(jwtSecretPolicy('change-me', {}).action, 'warn');
  assert.equal(jwtSecretPolicy('change-me', { NODE_ENV: 'production' }).action, 'exit');
  assert.equal(jwtSecretPolicy('x'.repeat(40) + 'Qz9', { NODE_ENV: 'production' }).action, 'ok');
  assert.ok(!JSON.stringify(jwtSecretPolicy('change-me', {})).includes('change-me'));
});

test('startup: weak JWT_SECRET in production refuses to start; in development it only warns', async () => {
  const run = (env) => new Promise((resolve) => {
    const c = spawn(process.execPath, ['server.js'], { cwd: SERVER_DIR, env: { ...process.env, MONGO_URI: URI, JWT_SECRET: 'change-me', PORT: String(PORT + 5), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    c.stdout.on('data', (d) => { out += d; if (/Server running/.test(out)) { c.kill(); resolve({ started: true, out }); } });
    c.stderr.on('data', (d) => { out += d; });
    c.on('exit', () => resolve({ started: false, out }));
    setTimeout(() => { c.kill(); resolve({ started: false, out, timeout: true }); }, 15000);
  });
  const prod = await run({ NODE_ENV: 'production' });
  assert.equal(prod.started, false);
  assert.match(prod.out, /Refusing to start in production/);
  assert.ok(!prod.out.includes('change-me'));
  const dev = await run({ NODE_ENV: 'development' });
  assert.equal(dev.started, true);
  assert.match(dev.out, /SECURITY WARNING/);
});

// ---------- rate limiting (separate server with limits forced on) ----------
test('login: 10 failed attempts per email are allowed, the 11th is 429 with Retry-After; other email/IP not blocked', async () => {
  const u = await (async () => {
    const e = email('rl');
    assert.equal((await signup({ email: e }, callRl)).status, 201);
    return e;
  })();
  for (let i = 0; i < 10; i++) {
    assert.equal((await login(u, 'WrongPass123', callRl, { localAddress: `127.0.0.${10 + i}` })).status, 401, `attempt ${i + 1}`);
  }
  // 11th failure from yet another IP is blocked by the per-email limiter
  const blocked = await login(u, 'WrongPass123', callRl, { localAddress: '127.0.0.30' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, 'RATE_LIMITED');
  assert.ok(blocked.body.retryAfterSeconds > 0);
  assert.equal(Number(blocked.headers['retry-after']), blocked.body.retryAfterSeconds);
  // a different email from a different IP is unaffected
  const other = email('rl-other');
  assert.equal((await signup({ email: other }, callRl, { localAddress: '127.0.0.31' })).status, 201);
  assert.equal((await login(other, GOOD_PW, callRl, { localAddress: '127.0.0.31' })).status, 200);
});

test('login: per-IP limit blocks one IP across many emails, other IPs unaffected', async () => {
  const ip = '127.0.0.50';
  for (let i = 0; i < 10; i++) assert.equal((await login(email('x'), 'WrongPass123', callRl, { localAddress: ip })).status, 401);
  const blocked = await login(email('x'), 'WrongPass123', callRl, { localAddress: ip });
  assert.equal(blocked.status, 429);
  assert.equal((await login(email('x'), 'WrongPass123', callRl, { localAddress: '127.0.0.51' })).status, 401);
});

test('login: successful logins do not consume the failed-attempt budget', async () => {
  const e = email('rls');
  const ip = '127.0.0.60';
  assert.equal((await signup({ email: e }, callRl)).status, 201);
  for (let i = 0; i < 15; i++) assert.equal((await login(e, GOOD_PW, callRl, { localAddress: ip })).status, 200, `success ${i + 1}`);
  for (let i = 0; i < 9; i++) assert.equal((await login(e, 'WrongPass123', callRl, { localAddress: ip })).status, 401);
  assert.equal((await login(e, GOOD_PW, callRl, { localAddress: ip })).status, 200);
});

test('signup: 6th signup from one IP is 429, another IP is fine', async () => {
  const ip = '127.0.0.70';
  for (let i = 0; i < 5; i++) assert.equal((await signup({}, callRl, { localAddress: ip })).status, 201);
  const blocked = await rawCall(PORT_RL, { method: 'POST', url: '/auth/signup', body: { name: 'Ada Lovelace', email: email(), password: GOOD_PW }, localAddress: ip });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, 'RATE_LIMITED');
  assert.ok(blocked.headers['retry-after']);
  const okOther = await rawCall(PORT_RL, { method: 'POST', url: '/auth/signup', body: { name: 'Ada Lovelace', email: email(), password: GOOD_PW }, localAddress: '127.0.0.71' });
  assert.equal(okOther.status, 201);
});

test('X-Forwarded-For cannot be used to dodge the per-IP limit (trust proxy off)', async () => {
  const ip = '127.0.0.80';
  for (let i = 0; i < 10; i++) await login(email('xff'), 'WrongPass123', callRl, { localAddress: ip, headers: { 'X-Forwarded-For': `9.9.9.${i}` } });
  const r = await login(email('xff'), 'WrongPass123', callRl, { localAddress: ip, headers: { 'X-Forwarded-For': '1.2.3.4' } });
  assert.equal(r.status, 429);
});
