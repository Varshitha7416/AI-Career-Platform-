// STUB-BASED tests: the Gemini transport is replaced with a fake. These prove request
// construction, JSON handling, retry rules and error mapping. They do NOT test real AI output.
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../../config/gemini');

const reset = () => {
  g._setRawGenerate(null);
  g._setSleep(null);
};
const stub = (fn) => {
  const calls = [];
  g._setRawGenerate(async (prompt, opts) => {
    calls.push({ prompt, opts });
    return fn(calls.length, prompt, opts);
  });
  g._setSleep(async () => {});
  return calls;
};
const httpErr = (status, message = 'boom') => Object.assign(new Error(message), { status });

test.afterEach(reset);

test('generateJSON requests JSON mode with temperature and returns parsed object', async () => {
  const calls = stub(() => '{"a":1}');
  const out = await g.generateJSON('hello', { temperature: 0.1 });
  assert.deepEqual(out, { a: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.json, true);
  assert.equal(calls[0].opts.temperature, 0.1);
  assert.ok(calls[0].opts.timeoutMs > 0);
});

test('generateText stays backwards compatible (prompt only, plain mode)', async () => {
  const calls = stub(() => 'plain text');
  assert.equal(await g.generateText('hi'), 'plain text');
  assert.equal(calls[0].opts.json, false);
});

test('fenced JSON is stripped', async () => {
  stub(() => '```json\n{"ok":true}\n```');
  assert.deepEqual(await g.generateJSON('x'), { ok: true });
});

test('JSON wrapped in prose is recovered', async () => {
  stub(() => 'Here you go:\n{"ok":true}\nHope that helps');
  assert.deepEqual(await g.generateJSON('x'), { ok: true });
});

test('malformed JSON is retried once, then succeeds', async () => {
  const calls = stub((n) => (n === 1 ? '{"a": ' : '{"a": 2}'));
  assert.deepEqual(await g.generateJSON('x'), { a: 2 });
  assert.equal(calls.length, 2);
});

test('truncated/partial JSON twice -> 502 AI_BAD_RESPONSE after exactly one retry', async () => {
  const calls = stub(() => '{"summary": "cut off');
  await assert.rejects(g.generateJSON('x'), (e) => e.status === 502 && e.code === 'AI_BAD_RESPONSE');
  assert.equal(calls.length, 2);
});

test('quota (HTTP 429) -> 429 AI_QUOTA and is never retried', async () => {
  const calls = stub(() => {
    throw httpErr(429, '[429 Too Many Requests] quota exceeded');
  });
  await assert.rejects(g.generateJSON('x'), (e) => e.status === 429 && e.code === 'AI_QUOTA');
  assert.equal(calls.length, 1);
});

test('RESOURCE_EXHAUSTED message without a status is treated as quota', async () => {
  const calls = stub(() => {
    throw new Error('RESOURCE_EXHAUSTED: You exceeded your current quota');
  });
  await assert.rejects(g.generateText('x'), (e) => e.status === 429 && e.code === 'AI_QUOTA');
  assert.equal(calls.length, 1);
});

test('transient 5xx is retried once and can succeed', async () => {
  const calls = stub((n) => {
    if (n === 1) throw httpErr(503);
    return '{"ok":1}';
  });
  assert.deepEqual(await g.generateJSON('x'), { ok: 1 });
  assert.equal(calls.length, 2);
});

test('persistent 5xx -> 502 AI_ERROR after one retry', async () => {
  const calls = stub(() => {
    throw httpErr(500);
  });
  await assert.rejects(g.generateJSON('x'), (e) => e.status === 502 && e.code === 'AI_ERROR');
  assert.equal(calls.length, 2);
});

test('non-transient 4xx -> 502 AI_ERROR without retry', async () => {
  const calls = stub(() => {
    throw httpErr(400, 'bad request');
  });
  await assert.rejects(g.generateText('x'), (e) => e.status === 502 && e.code === 'AI_ERROR');
  assert.equal(calls.length, 1);
});

test('not configured (no key, real transport) -> 503 AI_UNAVAILABLE', async () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    g._setRawGenerate(null);
    await assert.rejects(g.generateJSON('x'), (e) => e.status === 503 && e.code === 'AI_UNAVAILABLE');
    await assert.rejects(g.generateText('x'), (e) => e.status === 503 && e.code === 'AI_UNAVAILABLE');
  } finally {
    if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
  }
});

test('oversized prompt is rejected before any call', async () => {
  const calls = stub(() => '{}');
  await assert.rejects(g.generateJSON('x'.repeat(g.MAX_PROMPT_CHARS + 1)), (e) => e.status === 413);
  assert.equal(calls.length, 0);
});
