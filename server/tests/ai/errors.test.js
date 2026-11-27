// MOCKED tests (no network): error classification, circuit breaker and config parsing for the dual-provider AI layer (docs/32).
const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, classifyRaw, redact } = require('../../services/ai/errors');
const { Breaker } = require('../../services/ai/breaker');
const { readConfig } = require('../../services/ai/config');

const http = (status, message = 'x') => Object.assign(new Error(message), { status });

test('classifyRaw: statuses and messages map to the right class', () => {
  const cases = [
    [http(429), 'quota'], [http(500, 'RESOURCE_EXHAUSTED: quota'), 'quota'], [new Error('Rate limit reached'), 'quota'],
    [http(401), 'auth'], [http(403), 'auth'], [http(400, '[400 ] API key not valid. Please pass a valid API key.'), 'auth'],
    [http(404), 'config'], [http(413), 'input'], [http(400), 'bad_request'], [http(422), 'bad_request'],
    [http(500), 'transient'], [http(503), 'transient'], [http(504), 'transient'], [new Error('fetch failed'), 'transient'],
    [new Error('read ECONNRESET'), 'transient'], [new Error('AI request timed out'), 'transient'], [new Error('???'), 'unknown'],
  ];
  for (const [err, want] of cases) assert.equal(classifyRaw(err), want, `${err.status} ${err.message}`);
});

test('classify: the AI_* contract codes and aiClass drive the fallback decision', () => {
  const code = (c, extra = {}) => Object.assign(new Error('m'), { code: c, ...extra });
  const rows = [
    [code('AI_QUOTA', { status: 429 }), 'quota', true],
    [code('AI_BAD_RESPONSE'), 'bad_output', true],
    [code('AI_UNAVAILABLE'), 'unconfigured', true],
    [code('AI_ERROR'), 'transient', true],
    [code('AI_ERROR', { aiClass: 'bad_request' }), 'bad_request', false],
    [code('AI_ERROR', { aiClass: 'auth' }), 'auth', true],
    [code('AI_BAD_INPUT', { status: 400 }), 'input', false],
    [code('AI_INPUT_TOO_LARGE', { status: 413 }), 'input', false],
    [code('AI_ERROR', { aiClass: 'oversize' }), 'oversize', false],
    [new Error('???'), 'transient', true],
  ];
  for (const [err, cls, fallback] of rows) {
    const c = classify(err);
    assert.equal(c.cls, cls);
    assert.equal(c.fallback, fallback, cls);
  }
});

test('redact removes configured keys, bearer tokens and ?key= values', () => {
  const env = { GEMINI_API_KEY: 'AIza-secret-gemini-123456', GROQ_API_KEY: 'gsk_secret_groq_abcdef' };
  const out = redact('oops AIza-secret-gemini-123456 and gsk_secret_groq_abcdef Bearer abcdef1234567890 https://x/y?key=ZZZ999&a=1', env);
  assert.ok(!/secret|abcdef1234567890|ZZZ999/.test(out), out);
  assert.match(out, /\[redacted\]/);
  assert.equal(redact('plain text', {}), 'plain text');
});

test('breaker: quota opens at once, honours retry-after, half-opens after the cooldown, a success closes it', () => {
  let t = 1000;
  const b = new Breaker({ threshold: 3, cooldownMs: 60000, now: () => t });
  assert.equal(b.state(), 'closed');
  b.failure('quota', 'now', { retryAfterMs: 90000 });
  assert.equal(b.state(), 'open');
  assert.equal(b.allow(), false);
  t += 89000; assert.equal(b.state(), 'open', 'retry-after (90s) is longer than the 60s default');
  t += 2000; assert.equal(b.state(), 'half-open');
  assert.equal(b.allow(), true);
  b.success();
  assert.equal(b.state(), 'closed');
});

test('breaker: transient failures open it only after the threshold; a failed probe re-opens it', () => {
  let t = 0;
  const b = new Breaker({ threshold: 3, cooldownMs: 1000, now: () => t });
  b.failure('transient', 'count'); b.failure('transient', 'count');
  assert.equal(b.state(), 'closed');
  b.failure('transient', 'count');
  assert.equal(b.state(), 'open');
  t += 1500; assert.equal(b.state(), 'half-open');
  b.failure('transient', 'count');
  assert.equal(b.state(), 'open', 'failed probe goes straight back to open');
  b.success(); b.failure('transient', 'count');
  assert.equal(b.state(), 'closed', 'a success resets the consecutive-failure count');
});

test('breaker: auth failures pause the provider for the long cooldown; bad_output / bad_request never trip it', () => {
  let t = 0;
  const b = new Breaker({ cooldownMs: 1000, longCooldownMs: 600000, now: () => t });
  b.failure('bad_output', false); b.failure('bad_request', false);
  assert.equal(b.state(), 'closed');
  b.failure('auth', 'long');
  t += 5000; assert.equal(b.state(), 'open');
  t += 600000; assert.equal(b.state(), 'half-open');
});

test('config: defaults, validation and the Groq privacy gate', () => {
  const d = readConfig({});
  assert.equal(d.primary, 'gemini');
  assert.equal(d.fallback, 'groq');
  assert.equal(d.groqPrivacyAck, false, 'forwarding to Groq is OFF until explicitly acknowledged');
  assert.equal(d.groq.model, 'openai/gpt-oss-120b');
  assert.equal(d.groq.maxInputChars, 12000, 'default input guard (docs/32)');
  assert.equal(readConfig({ GROQ_PRIVACY_ACK: 'true' }).groqPrivacyAck, true);
  assert.equal(readConfig({ GROQ_PRIVACY_ACK: 'yes' }).groqPrivacyAck, false);
  const bad = readConfig({ AI_PRIMARY_PROVIDER: 'grok', AI_FALLBACK_PROVIDER: 'xai' });
  assert.equal(bad.primary, 'gemini');
  assert.equal(bad.fallback, 'groq');
  assert.equal(bad.warnings.length, 2);
  assert.equal(readConfig({ AI_FALLBACK_PROVIDER: 'none' }).fallback, 'none');
  assert.equal(readConfig({ AI_PRIMARY_PROVIDER: 'groq', AI_FALLBACK_PROVIDER: 'groq' }).fallback, 'none', 'a provider is never its own fallback');
});
