/*
 * Shared helpers for the password-reset suites. Needs a DISPOSABLE local MongoDB:
 *
 *   mongod --dbpath <temp dir outside the repo> --port 27160
 *   RESET_TEST_MONGO=mongodb://127.0.0.1:27160 npm run test:reset
 *
 * Refuses anything that is not localhost. Spawns real server.js child processes (never .env values) with the LOCAL OUTBOX
 * transport (no email is ever sent). Every test file gets its own database, dropped at the end.
 */
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const BASE = process.env.RESET_TEST_MONGO || '';
const enabled = !!BASE;
if (enabled && !/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) throw new Error('RESET_TEST_MONGO must be a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27160');
const skip = enabled ? false : 'set RESET_TEST_MONGO to run the password reset tests';

const SERVER_DIR = path.join(__dirname, '..', '..');
const SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
const PROD_SECRET = 'prod-like-random-secret-0123456789abcdefghijklmnop';
const GOOD_PW = 'Sunrise2025';
const GENERIC = 'If an account exists for this email address, we will send password reset instructions shortly.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const create = (basePort, dbTag) => {
  const DB = `${dbTag}_${process.pid}`;
  const URI = `${BASE.replace(/\/$/, '')}/${DB}`;
  const servers = [];
  let mongoose; let bcrypt; let seq = 0;

  const startServer = (port, extraEnv = {}, { expectExit = false } = {}) => new Promise((resolve, reject) => {
    const env = { ...process.env, MONGO_URI: URI, JWT_SECRET: SECRET, PORT: String(port), CLIENT_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test', DEV_OUTBOX_ENABLED: 'true', ...extraEnv };
    for (const k of Object.keys(env)) if (env[k] === undefined || env[k] === null) delete env[k];
    const child = spawn(process.execPath, ['server.js'], { cwd: SERVER_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = { text: '', code: null };
    const collect = (d) => { out.text += d; };
    child.stderr.on('data', collect);
    const t = setTimeout(() => reject(new Error(`server on port ${port} did not start within 20s (exitCode=${child.exitCode}); output so far: ${out.text.slice(-1200)}`)), 20000);
    child.stdout.on('data', (d) => {
      out.text += d;
      const k = /X-Dev-Outbox-Key: (\S+)/.exec(out.text);
      if (k) child.outboxKey = k[1];
      if (!expectExit && out.text.includes('MongoDB connected') && out.text.includes('Server running')) { clearTimeout(t); resolve(child); }
    });
    child.on('exit', (c) => { out.code = c; clearTimeout(t); if (expectExit) resolve(child); });
    child.out = out; child.port = port;
    servers.push(child);
    if (!expectExit) child.on('exit', (c) => { if (!child.expectedExit) reject(new Error(`server exited ${c}: ${out.text.slice(0, 300)}`)); });
  });

  const rawCall = (port, { method = 'GET', url, token, body, rawBody, localAddress, headers = {}, fullPath }) => new Promise((resolve, reject) => {
    const payload = rawBody !== undefined ? rawBody : (body === undefined ? undefined : JSON.stringify(body));
    const req = http.request({
      host: '127.0.0.1', port, path: fullPath || `/api${url}`, method, localAddress,
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

  const emailFor = (tag = 'u') => `${tag}${++seq}.${process.pid}@example.com`.toLowerCase();
  const coll = (n) => mongoose.connection.collection(n);
  const oid = (s) => new mongoose.Types.ObjectId(s);

  const forgot = (port, email, extra = {}) => rawCall(port, { method: 'POST', url: '/auth/forgot-password', body: { email }, ...extra });
  const reset = (port, token, password, confirmPassword = password, extra = {}) => rawCall(port, { method: 'POST', url: '/auth/reset-password', body: { token, password, confirmPassword }, ...extra });

  const newUser = async (port, tag = 'u') => {
    const email = emailFor(tag);
    const s = await rawCall(port, { method: 'POST', url: '/auth/signup', body: { name: 'Ada Lovelace', email, password: GOOD_PW } });
    assert.equal(s.status, 201, s.text);
    const l = await rawCall(port, { method: 'POST', url: '/auth/login', body: { email, password: GOOD_PW } });
    assert.equal(l.status, 200);
    return { email, token: l.body.token, id: l.body.user.id };
  };

  const waitFor = async (fn, { timeout = 8000, every = 40 } = {}) => {
    const end = Date.now() + timeout;
    for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) return null; await sleep(every); }
  };
  // Default template 'passwordReset': signup now also emails a verification link (docs/23), which these suites must not count.
  const mailsFor = (email, template = 'passwordReset') => coll('outboxemails').find({ to: email, ...(template ? { template } : {}) }).sort({ createdAt: -1 }).toArray();
  const waitForMail = (email, template = 'passwordReset', n = 1) => waitFor(async () => { const m = await mailsFor(email, template); return m.length >= n ? m : null; });
  const rawTokenOf = (mail) => { const m = /#token=([A-Za-z0-9_-]{43})$/.exec(mail.actionUrl || ''); assert.ok(m, 'reset link carries the token in the URL fragment'); return m[1]; };

  const stateOf = (userId) => coll('authrecoverystates').findOne({ _id: `password_reset:${userId}` });
  const tokensOf = (userId) => coll('authtokens').find({ user: oid(userId), purpose: 'password_reset' }).sort({ seq: 1, _id: 1 }).toArray();
  // The emailed link only becomes usable once activation finished (a few ms after the email was stored).
  const waitActive = (userId, atLeastSeq = 1) => waitFor(async () => { const s = await stateOf(userId); return s && s.active && s.active.seq >= atLeastSeq ? s : null; });
  const clearCooldown = (userId) => coll('authrecoverystates').updateOne({ _id: `password_reset:${userId}` }, { $set: { cooldownUntil: new Date(Date.now() - 1000) } });
  const expireLink = (userId) => coll('authrecoverystates').updateOne({ _id: `password_reset:${userId}` }, { $set: { 'active.expiresAt': new Date(Date.now() - 1000) } });

  // forgot -> read the emailed link from the local outbox, once it is usable
  const issueLink = async (port, u) => {
    const before = (await mailsFor(u.email, 'passwordReset')).length;
    const r = await forgot(port, u.email); assert.equal(r.status, 200);
    const mails = await waitForMail(u.email, 'passwordReset', before + 1);
    assert.ok(mails, 'reset email appeared');
    const s = await waitActive(u.id, 1);
    assert.ok(s, 'link was activated');
    return rawTokenOf(mails[0]);
  };
  // A valid token + a deliberately rejected password reveals validity WITHOUT consuming the token.
  const isLive = async (port, raw) => (await reset(port, raw, 'x', 'y')).body.code === 'VALIDATION_ERROR';
  const passwordOk = async (port, email, password) => (await rawCall(port, { method: 'POST', url: '/auth/login', body: { email, password } })).status === 200;
  const activeCount = async (userId) => { const s = await stateOf(userId); return s && s.active ? 1 : 0; };

  const connect = async () => { mongoose = require('mongoose'); bcrypt = require('bcryptjs'); await mongoose.connect(URI); return { mongoose, bcrypt }; };
  const stopAll = async ({ drop = true } = {}) => {
    for (const s of servers) { s.expectedExit = true; s.removeAllListeners('exit'); try { s.kill(); } catch { /* gone */ } }
    if (!mongoose) return;
    if (drop) { try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ } }
    await mongoose.disconnect();
  };
  const killServer = (child) => new Promise((resolve) => { child.expectedExit = true; if (child.out.code !== null) return resolve(); child.once('exit', resolve); try { child.kill(); } catch { resolve(); } });

  return {
    DB, URI, servers, startServer, rawCall, emailFor, coll, oid, forgot, reset, newUser, waitFor, mailsFor, waitForMail, rawTokenOf,
    stateOf, tokensOf, waitActive, clearCooldown, expireLink, issueLink, isLive, passwordOk, activeCount, connect, stopAll, killServer,
    get mongoose() { return mongoose; }, get bcrypt() { return bcrypt; }, base: basePort,
  };
};

module.exports = { create, enabled, skip, sleep, sha, SECRET, PROD_SECRET, GOOD_PW, GENERIC, SERVER_DIR };
