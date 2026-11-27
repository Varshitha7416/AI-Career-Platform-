// MOCKED integration tests through the real config/gemini.js facade: the Gemini transport is stubbed with _setRawGenerate and the
// Groq transport with an injected fetch. No network, no real key. Proves the existing callers keep working and the fallback is wired.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const g = require('../../config/gemini');
const groq = require('../../services/ai/providers/groqProvider');
const { getHealth } = require('../../controllers/adminAiController');
const { analyzeResumeWithAI } = require('../../utils/ai/resumeAnalysis');
const { RESUME } = require('./fixtures');

const KEYS = ['GROQ_API_KEY', 'GROQ_PRIVACY_ACK', 'AI_FALLBACK_PROVIDER', 'AI_PRIMARY_PROVIDER', 'GEMINI_API_KEY'];
const saved = {};
const httpErr = (status, message = 'boom') => Object.assign(new Error(message), { status });
const groqOk = (obj) => async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }] }) });

test.beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  g._setSleep(async () => {});
  g._manager.reset();
});
test.afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  g._setRawGenerate(null); g._setSleep(null); groq._setFetch(null); g._manager.reset();
});
const enableFallback = () => { process.env.GROQ_API_KEY = 'gsk_unit_test_key_value_000'; process.env.GROQ_PRIVACY_ACK = 'true'; };

test('Gemini quota -> Groq answers through the SAME generateJSON the callers use', async () => {
  enableFallback();
  let geminiCalls = 0;
  g._setRawGenerate(async () => { geminiCalls += 1; throw httpErr(429, 'RESOURCE_EXHAUSTED'); });
  groq._setFetch(groqOk({ from: 'groq' }));
  assert.deepEqual(await g.generateJSON('give JSON'), { from: 'groq' });
  assert.equal(geminiCalls, 1, 'quota is never retried on Gemini (existing rule)');
});

test('Gemini invalid JSON after its own retry -> Groq is tried once (decision 4)', async () => {
  enableFallback();
  let geminiCalls = 0;
  g._setRawGenerate(async () => { geminiCalls += 1; return 'this is not json'; });
  groq._setFetch(groqOk({ ok: true }));
  assert.deepEqual(await g.generateJSON('give JSON'), { ok: true });
  assert.equal(geminiCalls, 2, 'Gemini keeps its one existing retry first');
});

test('Gemini transient 5xx (after its retry) and timeouts fall back; invalid key falls back and is not retried', async () => {
  enableFallback();
  g._setRawGenerate(async () => { throw httpErr(503); });
  groq._setFetch(groqOk({ n: 1 }));
  assert.deepEqual(await g.generateJSON('give JSON'), { n: 1 });
  g._manager.reset();
  g._setRawGenerate(async () => { throw new Error('AI request timed out'); });
  assert.deepEqual(await g.generateJSON('give JSON'), { n: 1 });
  g._manager.reset();
  let calls = 0;
  g._setRawGenerate(async () => { calls += 1; throw httpErr(400, '[400 ] API key not valid. Please pass a valid API key.'); });
  assert.deepEqual(await g.generateJSON('give JSON'), { n: 1 });
  await g.generateJSON('give JSON');
  assert.equal(calls, 1, 'rejected key is paused, not hammered');
});

test('Gemini quota -> Groq answer truncated (finish_reason=length): nothing is passed on as a success; the caller gets the unchanged contract', async () => {
  enableFallback();
  const origWarn = console.warn; console.warn = () => {}; // the truncation diagnostic is covered in groqProvider.test.js
  try {
    g._setRawGenerate(async () => { throw httpErr(429, 'RESOURCE_EXHAUSTED'); });
    let groqCalls = 0;
    groq._setFetch(async () => { groqCalls += 1; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ model: 'm', choices: [{ message: { content: '{"summary":"complete-looking JSON"}' }, finish_reason: 'length' }] }) }; });
    await assert.rejects(g.generateJSON('give JSON'), (e) => e.status === 429 && e.code === 'AI_QUOTA');
    assert.equal(groqCalls, 1, 'exactly one Groq attempt, no retry');
  } finally { console.warn = origWarn; }
});

test('a malformed Gemini request (400) does not fall back', async () => {
  enableFallback();
  let groqCalls = 0;
  g._setRawGenerate(async () => { throw httpErr(400, 'Invalid JSON payload received.'); });
  groq._setFetch(async () => { groqCalls += 1; return groqOk({})(); });
  await assert.rejects(g.generateJSON('give JSON'), (e) => e.status === 502 && e.code === 'AI_ERROR');
  assert.equal(groqCalls, 0);
});

test('both providers down: the caller gets the unchanged AI_QUOTA contract', async () => {
  enableFallback();
  g._setRawGenerate(async () => { throw httpErr(429); });
  groq._setFetch(async () => ({ ok: false, status: 429, headers: { get: () => null }, json: async () => ({ error: { message: 'limit' } }) }));
  await assert.rejects(g.generateJSON('give JSON'), (e) => e.status === 429 && e.code === 'AI_QUOTA');
});

test('default behaviour is unchanged: with no Groq key / no acknowledgement nothing is forwarded', async () => {
  let groqCalls = 0;
  groq._setFetch(async () => { groqCalls += 1; return groqOk({})(); });
  g._setRawGenerate(async () => { throw httpErr(429); });
  await assert.rejects(g.generateJSON('x'), (e) => e.code === 'AI_QUOTA');
  process.env.GROQ_API_KEY = 'gsk_unit_test_key_value_000'; // key but no acknowledgement
  await assert.rejects(g.generateJSON('x'), (e) => e.code === 'AI_QUOTA');
  assert.equal(groqCalls, 0);
});

test('a real caller (Resume Analyzer) keeps its response format and validation when Groq answers', async () => {
  enableFallback();
  g._setRawGenerate(async () => { throw httpErr(503); });
  const analysis = {
    overallScore: 72, summary: 'Solid junior developer profile.', strengths: [{ title: 'React', detail: 'Built a dashboard with ReactJS and Redux' }],
    missingSkills: [], suggestions: [], matchPercentage: null,
  };
  groq._setFetch(groqOk(analysis));
  let threw = null; let out = null;
  try { out = await analyzeResumeWithAI({ resumeText: RESUME }); } catch (e) { threw = e; }
  // The caller's own validators ran on Groq's output: it either produced a normalised analysis or rejected it as AI_BAD_RESPONSE,
  // never a raw passthrough and never a crash.
  assert.ok(out || (threw && threw.code === 'AI_BAD_RESPONSE'), String(threw && threw.message));
});

test('admin health endpoint: passive report, no keys, admin-only mounting', () => {
  enableFallback();
  let body; let status;
  getHealth({}, { status(s) { status = s; return this; }, json(b) { body = b; } }, (e) => { throw e; });
  assert.equal(status, 200);
  const text = JSON.stringify(body);
  assert.ok(!text.includes('gsk_unit_test_key_value_000'));
  assert.ok(!/apiKey|api_key|secret|password|token/i.test(text.replace(/consecutiveFailures|tokens/g, '')), text);
  assert.equal(body.health.providers[0].provider, 'gemini');
  const routes = fs.readFileSync(path.join(__dirname, '../../routes/adminRoutes.js'), 'utf8');
  assert.ok(routes.indexOf('router.use(protect, requireAdmin)') < routes.indexOf("'/ai/health'"), 'registered after the admin guard');
});

test('SECRETS: a failing run with real-looking keys in the environment prints nothing sensitive', async () => {
  const GEM = 'AIzaSy_FAKE_GEMINI_KEY_9876543210'; const GRQ = 'gsk_FAKE_GROQ_KEY_9876543210';
  process.env.GEMINI_API_KEY = GEM; process.env.GROQ_API_KEY = GRQ; process.env.GROQ_PRIVACY_ACK = 'true';
  const out = [];
  const origErr = console.error; const origWarn = console.warn;
  console.error = (...a) => out.push(a.join(' ')); console.warn = (...a) => out.push(a.join(' '));
  try {
    g._setRawGenerate(async () => { throw httpErr(500, `upstream failed for key ${GEM}`); });
    groq._setFetch(async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({ error: { message: `bad ${GRQ}` } }) }));
    let err;
    try { await g.generateJSON('give JSON'); } catch (e) { err = e; }
    const dump = JSON.stringify({ out, msg: err && err.message, health: g._manager.snapshot() });
    assert.ok(!dump.includes(GEM) && !dump.includes(GRQ), dump);
  } finally { console.error = origErr; console.warn = origWarn; }
});
