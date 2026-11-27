// MOCKED tests: the Groq adapter against an injected fetch and a local loopback HTTP server. No call ever leaves this machine.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const groq = require('../../services/ai/providers/groqProvider');

const KEY = 'gsk_TEST_KEY_NOT_REAL_0123456789';
const env = (over = {}) => ({ NODE_ENV: 'test', GROQ_API_KEY: KEY, ...over });
const res = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => { if (body === undefined) throw new Error('no body'); return body; },
});
const completion = (content) => res(200, { choices: [{ message: { content } }] }, { 'x-ratelimit-remaining-tokens': '7000', 'x-ratelimit-remaining-requests': '900' });
const use = (fn) => { const calls = []; groq._setFetch(async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return fn(calls.length); }); return calls; };
test.afterEach(() => groq._setFetch(null));

test('request shape: URL, Bearer auth, model, JSON mode, "JSON" appended when missing, temperature', async () => {
  const calls = use(() => completion('{"a":1}'));
  const out = await groq.generateJSON('Give me data', { temperature: 0.2 }, env());
  assert.deepEqual(out, { a: 1 });
  const c = calls[0];
  assert.equal(c.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(c.init.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(c.body.model, 'openai/gpt-oss-120b');
  assert.deepEqual(c.body.response_format, { type: 'json_object' });
  assert.equal(c.body.temperature, 0.2);
  assert.match(c.body.messages[0].content, /JSON/);
  assert.equal(c.body.messages.length, 1);
});

test('a prompt that already mentions JSON is sent unchanged; model and base URL are configurable', async () => {
  const calls = use(() => completion('{"a":1}'));
  await groq.generateJSON('Return JSON please', {}, env({ GROQ_MODEL: 'llama-3.3-70b-versatile', GROQ_BASE_URL: 'https://example.test/v1/' }));
  assert.equal(calls[0].body.messages[0].content, 'Return JSON please');
  assert.equal(calls[0].body.model, 'llama-3.3-70b-versatile');
  assert.equal(calls[0].url, 'https://example.test/v1/chat/completions');
});

test('generateText has no response_format and returns the raw text', async () => {
  const calls = use(() => completion('Hello there'));
  assert.equal(await groq.generateText('Say hi', {}, env()), 'Hello there');
  assert.equal(calls[0].body.response_format, undefined);
});

test('fenced / prose-wrapped JSON is recovered; rate-limit headers are noted', async () => {
  use(() => completion('Sure!\n```json\n{"b":2}\n```'));
  assert.deepEqual(await groq.generateJSON('x JSON', {}, env()), { b: 2 });
  assert.equal(groq.lastLimits.remainingTokens, 7000);
  assert.equal(groq.lastLimits.remainingRequests, 900);
});

const withFinish = (content, finish_reason, extra = {}) => res(200, { model: 'openai/gpt-oss-120b', usage: { completion_tokens: 321 }, choices: [{ message: { content }, finish_reason }], ...extra });

test('finish_reason "length" is never a success, even when the cut text still parses as JSON', async () => {
  for (const content of ['{"a":1}', '{"summary":"cut off mid-sent', '']) {
    use(() => withFinish(content, 'length'));
    await assert.rejects(groq.generateJSON('x JSON', {}, env()), (e) => e.code === 'AI_BAD_RESPONSE' && e.status === 502 && e.aiClass === 'bad_output' && e.truncated === true, JSON.stringify(content));
  }
  use(() => withFinish('A letter that was cut off', 'length'));
  await assert.rejects(groq.generateText('say hi', {}, env()), (e) => e.code === 'AI_BAD_RESPONSE' && e.aiClass === 'bad_output', 'text mode');
});

test('finish_reason "stop" (or none) still succeeds', async () => {
  use(() => withFinish('{"ok":true}', 'stop'));
  assert.deepEqual(await groq.generateJSON('x JSON', {}, env()), { ok: true });
  use(() => completion('{"ok":2}')); // no finish_reason at all
  assert.deepEqual(await groq.generateJSON('x JSON', {}, env()), { ok: 2 });
});

test('truncation diagnostic is safe: no prompt text, no response text, no API key', async () => {
  const lines = []; const orig = console.warn; console.warn = (...a) => lines.push(a.join(' '));
  try {
    use(() => withFinish('SECRET-RESPONSE-TEXT {"a":1}', 'length'));
    await assert.rejects(groq.generateJSON('PRIVATE-PROMPT-TEXT about JSON', {}, env()), (e) => e.aiClass === 'bad_output');
  } finally { console.warn = orig; }
  const text = lines.join(String.fromCharCode(10));
  assert.match(text, /truncated: finish_reason=length model=openai\/gpt-oss-120b completion_tokens=321/);
  assert.ok(!/PRIVATE-PROMPT|SECRET-RESPONSE|gsk_/.test(text), text);
});

test('HTTP errors map to the AI_* contract with the right class', async () => {
  const cases = [
    [429, 'AI_QUOTA', 429, 'quota'], [401, 'AI_ERROR', 502, 'auth'], [403, 'AI_ERROR', 502, 'auth'], [404, 'AI_ERROR', 502, 'config'],
    [413, 'AI_INPUT_TOO_LARGE', 413, 'oversize'], [400, 'AI_ERROR', 502, 'bad_request'], [422, 'AI_ERROR', 502, 'bad_request'],
    [500, 'AI_ERROR', 502, 'transient'], [502, 'AI_ERROR', 502, 'transient'], [503, 'AI_ERROR', 502, 'transient'],
  ];
  for (const [status, code, outStatus, aiClass] of cases) {
    use(() => res(status, { error: { message: 'nope' } }));
    await assert.rejects(groq.generateJSON('x JSON', {}, env()), (e) => e.code === code && e.status === outStatus && e.aiClass === aiClass, `HTTP ${status}`);
  }
});

test('429 carries retry-after (capped at 15 min) so the breaker can honour it', async () => {
  use(() => res(429, { error: { message: 'slow down' } }, { 'retry-after': '42' }));
  await assert.rejects(groq.generateJSON('x JSON', {}, env()), (e) => e.retryAfterMs === 42000);
  use(() => res(429, {}, { 'retry-after': '99999' }));
  await assert.rejects(groq.generateJSON('x JSON', {}, env()), (e) => e.retryAfterMs === 900000);
});

test('network failure and timeout are transient', async () => {
  groq._setFetch(async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(groq.generateJSON('x JSON', {}, env()), (e) => e.aiClass === 'transient' && e.code === 'AI_ERROR');
  groq._setFetch((url, init) => new Promise((_, reject) => { init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))); }));
  await assert.rejects(groq.generateJSON('x JSON', { timeoutMs: 20 }, env()), (e) => e.aiClass === 'transient' && e.status === 504);
});

test('unusable output: empty content, non-JSON text and non-object JSON are AI_BAD_RESPONSE', async () => {
  for (const content of ['', '   ', 'I cannot help with that.', '42']) {
    use(() => completion(content));
    await assert.rejects(groq.generateJSON('x JSON', {}, env()), (e) => e.code === 'AI_BAD_RESPONSE' && e.aiClass === 'bad_output', JSON.stringify(content));
  }
  use(() => res(200, { choices: [] }));
  await assert.rejects(groq.generateJSON('x JSON', {}, env()), (e) => e.code === 'AI_BAD_RESPONSE');
});

test('not configured: no key means no request; an oversized prompt is never sent', async () => {
  const calls = use(() => completion('{}'));
  await assert.rejects(groq.generateJSON('x JSON', {}, { NODE_ENV: 'test' }), (e) => e.code === 'AI_UNAVAILABLE' && e.aiClass === 'unconfigured');
  assert.equal(groq.isConfigured({}), false);
  assert.equal(groq.canHandle('x'.repeat(12001), env()), false);
  assert.equal(groq.canHandle('x'.repeat(600), env({ GROQ_MAX_INPUT_CHARS: '500' })), false);
  await assert.rejects(groq.generateJSON('x'.repeat(13000), {}, env()), (e) => e.aiClass === 'oversize');
  assert.equal(calls.length, 0);
});

test('plain-http base URLs are refused except loopback under NODE_ENV=test (the key is never sent in clear text elsewhere)', async () => {
  const calls = use(() => completion('{}'));
  await assert.rejects(groq.generateJSON('x JSON', {}, env({ GROQ_BASE_URL: 'http://evil.example/v1' })), (e) => e.aiClass === 'config');
  await assert.rejects(groq.generateJSON('x JSON', {}, { ...env({ GROQ_BASE_URL: 'http://127.0.0.1:1/v1' }), NODE_ENV: 'production' }), (e) => e.aiClass === 'config');
  assert.equal(calls.length, 0);
});

test('errors and details never contain the API key, even if the provider echoes it', async () => {
  use(() => res(401, { error: { message: `Invalid API Key ${KEY}` } }));
  try { await groq.generateJSON('x JSON', {}, env()); assert.fail('should throw'); } catch (e) {
    assert.ok(!JSON.stringify({ m: e.message, d: e.detail, s: e.stack }).includes(KEY));
  }
});

test('real HTTP round trip against a local loopback server (no external network)', async () => {
  let seen;
  const server = http.createServer((req, reply) => {
    let data = '';
    req.on('data', (d) => { data += d; });
    req.on('end', () => {
      seen = { method: req.method, url: req.url, auth: req.headers.authorization, ct: req.headers['content-type'], body: JSON.parse(data) };
      reply.writeHead(200, { 'content-type': 'application/json', 'x-ratelimit-remaining-tokens': '123' });
      reply.end(JSON.stringify({ choices: [{ message: { content: '{"served":"local"}' } }] }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const out = await groq.generateJSON('please answer in JSON', {}, env({ GROQ_BASE_URL: `http://127.0.0.1:${server.address().port}/openai/v1` }));
    assert.deepEqual(out, { served: 'local' });
    assert.equal(seen.method, 'POST');
    assert.equal(seen.url, '/openai/v1/chat/completions');
    assert.equal(seen.auth, `Bearer ${KEY}`);
    assert.match(seen.ct, /application\/json/);
    assert.deepEqual(seen.body.response_format, { type: 'json_object' });
    assert.equal(groq.lastLimits.remainingTokens, 123);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
