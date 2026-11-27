// Shared harness for the resumeHistory suite: starts the API as a child process against a DISPOSABLE local MongoDB.
// RESUME_HISTORY_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:resume-history
// Never uses .env values; refuses anything that is not localhost/127.0.0.1.
const { spawn } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

// Spawned test servers must never reach a real AI provider. Empty values (not deleted) also stop server.js's dotenv from
// loading real keys out of server/.env, and with no key and no fallback every AI call fails locally with 503 AI_UNAVAILABLE.
const AI_LOCKDOWN = { GEMINI_API_KEY: '', GROQ_API_KEY: '', GROQ_PRIVACY_ACK: 'false', AI_FALLBACK_PROVIDER: 'none' };

const BASE = process.env.RESUME_HISTORY_TEST_MONGO || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE)) {
  throw new Error('Set RESUME_HISTORY_TEST_MONGO to a LOCAL disposable mongod, e.g. mongodb://127.0.0.1:27017');
}
const SERVER_DIR = path.join(__dirname, '..', '..');

const startServer = async ({ port, dbName, env = {} }) => {
  const uri = `${BASE.replace(/\/$/, '')}/${dbName}`;
  const api = `http://127.0.0.1:${port}/api`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, MONGO_URI: uri, JWT_SECRET: 'test-secret-not-real', PORT: String(port), CLIENT_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test', ...AI_LOCKDOWN, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 25000);
    child.stdout.on('data', (d) => { if (String(d).includes('Server running')) { clearTimeout(t); resolve(); } });
    child.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  });
  await mongoose.connect(uri);

  const call = async (token, method, url, body, raw) => {
    const res = await fetch(api + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (raw) return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, headers: res.headers, body: json };
  };

  const mkUser = async (key, { verified = true, role } = {}) => {
    const email = `${key}.${process.pid}@example.com`;
    let r = await call(null, 'POST', '/auth/signup', { name: `User ${key}`, email, password: 'secret12' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const User = require('../../models/User');
    const upd = {};
    if (verified) { upd.emailVerified = true; upd.emailVerifiedAt = new Date(); }
    if (role) upd.role = role;
    if (Object.keys(upd).length) await User.updateOne({ email }, { $set: upd });
    r = await call(null, 'POST', '/auth/login', { email, password: 'secret12' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { id: r.body.user.id || r.body.user._id, token: r.body.token, email };
  };

  const stop = async () => {
    try { await mongoose.connection.dropDatabase(); } catch { /* ignore */ }
    await mongoose.disconnect();
    child.kill();
  };
  return { call, mkUser, stop, uri, api };
};

module.exports = { startServer, BASE, SERVER_DIR };
