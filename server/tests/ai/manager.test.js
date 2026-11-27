// MOCKED tests (no network, no real provider): the provider manager's fallback, circuit breaker and secret-protection rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createManager } = require('../../services/ai/manager');

const aiErr = (status, code, aiClass, message = 'm', extra = {}) => Object.assign(new Error(message), { status, code, aiClass, ...extra });
const QUOTA = () => aiErr(429, 'AI_QUOTA', 'quota', 'The AI service has reached its usage limit. Please try again later.');
const TRANSIENT = () => aiErr(502, 'AI_ERROR', 'transient', 'The AI service is temporarily unavailable. Please try again.');
const BADJSON = () => aiErr(502, 'AI_BAD_RESPONSE', 'bad_output', 'The AI returned an unreadable response. Please try again.');
const BADREQ = () => aiErr(502, 'AI_ERROR', 'bad_request', 'The AI service is temporarily unavailable. Please try again.');
const AUTH = () => aiErr(502, 'AI_ERROR', 'auth', 'The AI service is temporarily unavailable. Please try again.');

// A scripted fake provider: `script` is a function (callNo, prompt) -> value | throws.
const fake = (name, script, { configured = true, accepts = true } = {}) => {
  const p = {
    name, calls: 0, prompts: [],
    isConfigured: () => configured,
    canHandle: () => accepts,
    model: () => `${name}-model`,
    generateJSON: async (prompt) => { p.calls += 1; p.prompts.push(prompt); return script(p.calls, prompt); },
    generateText: async (prompt) => { p.calls += 1; p.prompts.push(prompt); return script(p.calls, prompt); },
  };
  return p;
};

const ENV_ON = { AI_PRIMARY_PROVIDER: 'gemini', AI_FALLBACK_PROVIDER: 'groq', GROQ_PRIVACY_ACK: 'true' };
const build = (g, q, env = ENV_ON, extra = {}) => {
  const logs = [];
  const m = createManager({ providers: { gemini: g, groq: q }, env: () => env, log: { warn: (s) => logs.push(s), error: (s) => logs.push(s) }, ...extra });
  return { m, logs };
};

test('success on the primary never touches the secondary', async () => {
  const g = fake('gemini', () => ({ ok: 'gemini' })); const q = fake('groq', () => ({ ok: 'groq' }));
  const { m } = build(g, q);
  assert.deepEqual(await m.generateJSON('hello'), { ok: 'gemini' });
  assert.equal(g.calls, 1); assert.equal(q.calls, 0);
});

test('recoverable failures (quota, 5xx/timeout/network, bad JSON) fall back to the secondary exactly once', async () => {
  for (const make of [QUOTA, TRANSIENT, BADJSON]) {
    const g = fake('gemini', () => { throw make(); }); const q = fake('groq', () => ({ from: 'groq' }));
    const { m } = build(g, q);
    assert.deepEqual(await m.generateJSON('hello'), { from: 'groq' }, make.name);
    assert.equal(g.calls, 1); assert.equal(q.calls, 1);
  }
});

test('generateText also falls back', async () => {
  const g = fake('gemini', () => { throw QUOTA(); }); const q = fake('groq', () => 'plain text');
  const { m } = build(g, q);
  assert.equal(await m.generateText('hello'), 'plain text');
});

test('a malformed request is NOT retried on the other provider', async () => {
  const g = fake('gemini', () => { throw BADREQ(); }); const q = fake('groq', () => ({ x: 1 }));
  const { m } = build(g, q);
  await assert.rejects(m.generateJSON('hello'), (e) => e.code === 'AI_ERROR' && e.status === 502);
  assert.equal(q.calls, 0);
});

test('invalid input is rejected before any provider is called', async () => {
  const g = fake('gemini', () => ({})); const q = fake('groq', () => ({}));
  const { m } = build(g, q);
  await assert.rejects(m.generateJSON('   '), (e) => e.status === 400 && e.code === 'AI_BAD_INPUT');
  await assert.rejects(m.generateJSON('x'.repeat(60001)), (e) => e.status === 413 && e.code === 'AI_INPUT_TOO_LARGE');
  assert.equal(g.calls + q.calls, 0);
});

test('both providers failing: ONE error in the unchanged contract (the primary\'s), and the secondary is tried once only', async () => {
  const g = fake('gemini', () => { throw QUOTA(); }); const q = fake('groq', () => { throw TRANSIENT(); });
  const { m } = build(g, q);
  await assert.rejects(m.generateJSON('hello'), (e) => e.status === 429 && e.code === 'AI_QUOTA');
  assert.equal(g.calls, 1); assert.equal(q.calls, 1);
  assert.equal(m.snapshot().totals.bothFailed, 1);
});

test('primary not configured: the secondary answers; if it fails too, ITS error is reported', async () => {
  const g = fake('gemini', () => { throw aiErr(503, 'AI_UNAVAILABLE', 'unconfigured', 'AI service is not configured'); });
  let q = fake('groq', () => ({ ok: 1 }));
  assert.deepEqual(await build(g, q).m.generateJSON('hello'), { ok: 1 });
  q = fake('groq', () => { throw QUOTA(); });
  await assert.rejects(build(g, q).m.generateJSON('hello'), (e) => e.code === 'AI_QUOTA');
});

test('PRIVACY GATE: with a Groq key but no GROQ_PRIVACY_ACK, no text is ever sent to Groq', async () => {
  const g = fake('gemini', () => { throw QUOTA(); }); const q = fake('groq', () => ({ leaked: true }));
  const { m } = build(g, q, { AI_FALLBACK_PROVIDER: 'groq' });
  await assert.rejects(m.generateJSON('resume text'), (e) => e.code === 'AI_QUOTA');
  assert.equal(q.calls, 0);
  const s = m.snapshot();
  assert.equal(s.fallback.active, false);
  assert.match(s.fallback.reason, /GROQ_PRIVACY_ACK/);
});

test('fallback disabled (none) or secondary without a key: behaves exactly like the old single-provider code', async () => {
  const g = fake('gemini', () => { throw QUOTA(); }); const q = fake('groq', () => ({ ok: 1 }), { configured: false });
  await assert.rejects(build(g, q).m.generateJSON('hello'), (e) => e.code === 'AI_QUOTA');
  const q2 = fake('groq', () => ({ ok: 1 }));
  await assert.rejects(build(g, q2, { ...ENV_ON, AI_FALLBACK_PROVIDER: 'none' }).m.generateJSON('hello'), (e) => e.code === 'AI_QUOTA');
  assert.equal(q.calls + q2.calls, 0);
});

test('a prompt too large for the secondary is not sent there; the primary error is returned', async () => {
  const g = fake('gemini', () => { throw QUOTA(); }); const q = fake('groq', () => ({ ok: 1 }), { accepts: false });
  await assert.rejects(build(g, q).m.generateJSON('hello'), (e) => e.code === 'AI_QUOTA');
  assert.equal(q.calls, 0);
});

test('quota opens the primary breaker: later requests skip it; after the cooldown one probe closes it again (auto recovery)', async () => {
  let t = 1000;
  let geminiHealthy = false;
  const g = fake('gemini', () => { if (!geminiHealthy) throw QUOTA(); return { from: 'gemini' }; });
  const q = fake('groq', () => ({ from: 'groq' }));
  const { m } = build(g, q, ENV_ON, { now: () => t });
  assert.deepEqual(await m.generateJSON('a'), { from: 'groq' });
  assert.equal(g.calls, 1);
  assert.equal(m.snapshot().providers[0].state, 'open');
  assert.deepEqual(await m.generateJSON('b'), { from: 'groq' });
  assert.deepEqual(await m.generateJSON('c'), { from: 'groq' });
  assert.equal(g.calls, 1, 'the open breaker kept Gemini untouched');
  assert.equal(m.snapshot().totals.primarySkippedByBreaker, 2);
  t += 61000;
  geminiHealthy = true;
  assert.equal(m.snapshot().providers[0].state, 'half-open');
  assert.deepEqual(await m.generateJSON('d'), { from: 'gemini' }, 'probe succeeded: Gemini is primary again');
  assert.equal(m.snapshot().providers[0].state, 'closed');
});

test('an invalid key falls back once and pauses that provider instead of looping', async () => {
  const g = fake('gemini', () => { throw AUTH(); }); const q = fake('groq', () => ({ ok: 1 }));
  const { m } = build(g, q);
  assert.deepEqual(await m.generateJSON('a'), { ok: 1 });
  assert.deepEqual(await m.generateJSON('b'), { ok: 1 });
  assert.equal(g.calls, 1, 'not retried against a rejected key');
  assert.equal(m.snapshot().providers[0].state, 'open');
});

test('breaker open on BOTH providers still tries the primary rather than failing without a call', async () => {
  let t = 0;
  const g = fake('gemini', () => { throw QUOTA(); }); const q = fake('groq', () => { throw QUOTA(); });
  const { m } = build(g, q, ENV_ON, { now: () => t });
  await assert.rejects(m.generateJSON('a'));
  const before = g.calls;
  await assert.rejects(m.generateJSON('b'));
  assert.equal(g.calls, before + 1);
});

test('rate-limit rule: the manager never touches req.consumeAiCall, so one user request is one limited operation even with fallback', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../services/ai/manager.js'), 'utf8').split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith('//')).join(' ');
  assert.ok(!/consumeAiCall|aiLimiter/.test(src));
  // callers consume once per generateJSON call; the manager performs the fallback inside that single call
});

test('SECRETS: keys never appear in logs, health output or thrown errors', async () => {
  const GEM = 'AIzaSyGEMINI-SECRET-KEY-0123456789'; const GRQ = 'gsk_GROQ_SECRET_KEY_0123456789';
  const env = { ...ENV_ON, GEMINI_API_KEY: GEM, GROQ_API_KEY: GRQ };
  const g = fake('gemini', () => { throw aiErr(429, 'AI_QUOTA', 'quota', `quota hit for key ${GEM} at https://x/?key=${GEM}`); });
  const q = fake('groq', () => { throw aiErr(502, 'AI_ERROR', 'transient', `Bearer ${GRQ} rejected`); });
  const { m, logs } = build(g, q, env);
  let thrown;
  try { await m.generateJSON('hello'); } catch (e) { thrown = e; }
  const everything = JSON.stringify({ logs, health: m.snapshot(), startup: m.startupSummary() });
  assert.ok(!everything.includes(GEM) && !everything.includes(GRQ), everything);
  assert.ok(thrown);
});

test('health snapshot: shape, roles, models and passive-only notice', async () => {
  const g = fake('gemini', () => { throw QUOTA(); }); const q = fake('groq', () => ({ ok: 1 }));
  const { m } = build(g, q);
  await m.generateJSON('x');
  const s = m.snapshot();
  assert.equal(s.fallback.active, true);
  assert.deepEqual(s.providers.map((p) => [p.provider, p.role, p.model]), [['gemini', 'primary', 'gemini-model'], ['groq', 'secondary', 'groq-model']]);
  assert.equal(s.providers[0].lastErrorClass, 'quota');
  assert.equal(s.providers[1].successes, 1);
  assert.match(s.mode, /no AI calls/);
  assert.match(m.startupSummary(), /gemini primary/);
  m.reset();
  assert.equal(m.snapshot().totals.requests, 0);
});
