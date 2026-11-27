// Gemini provider (the PRIMARY AI provider). This is the original config/gemini.js transport, retry and JSON logic, moved here
// unchanged in behaviour; config/gemini.js is now a facade over the provider manager (docs/32). The only additions are
// `aiClass` on mapped errors (so the manager can tell a bad key or bad request from a temporary failure), secret redaction in
// the log line, and isConfigured().
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { classifyRaw, redact } = require('../errors');

let client;

const getModelName = () => process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const MAX_PROMPT_CHARS = 60000; // hard cap on a single prompt (input size guard)
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_TEMPERATURE = 0.4;

const QUOTA_MESSAGE = 'The AI service has reached its usage limit. Please try again later.';

const aiError = (status, code, message) => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
};

// ---- Raw transport (the only place the SDK is touched). Replaceable for tests. ----
// Test-only stub: active ONLY when NODE_ENV==='test' and GEMINI_TEST_FIXTURE points to a JSON file
// ({"response": <object>} | {"responseText": "<raw>"} | {"error": {"status":429,"message":"..."}}).
// Optional test knobs: "delayMs" (wait before answering, to force overlapping requests) and "failFirstCalls": N
// (the first N calls overall, counted in "<file>.calls" and so shared by every process using the file, fail with 429).
// Each call appends a line to "<file>.calls" and writes the prompt to "<file>.lastprompt".
// Both conditions are required, so development, production and any normal run can never read a fixture.
const fixtureActive = (env = process.env) => env.NODE_ENV === 'test' && !!env.GEMINI_TEST_FIXTURE;

const fixtureGenerate = async (prompt) => {
  const fs = require('fs');
  const file = process.env.GEMINI_TEST_FIXTURE;
  fs.appendFileSync(`${file}.calls`, `${prompt.length}\n`);
  fs.writeFileSync(`${file}.lastprompt`, prompt);
  const fx = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (fx.delayMs) await new Promise((r) => setTimeout(r, Number(fx.delayMs)));
  const callNo = fs.readFileSync(`${file}.calls`, 'utf8').split('\n').filter(Boolean).length;
  if (fx.failFirstCalls && callNo <= Number(fx.failFirstCalls)) {
    const e = new Error('fixture: simulated quota error');
    e.status = 429;
    throw e;
  }
  if (fx.error) {
    const e = new Error(fx.error.message || 'fixture error');
    if (fx.error.status) e.status = fx.error.status;
    throw e;
  }
  return typeof fx.responseText === 'string' ? fx.responseText : JSON.stringify(fx.response);
};

const sdkGenerate = async (prompt, { json, temperature, timeoutMs }) => {
  if (fixtureActive()) return fixtureGenerate(prompt);
  client = client || new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const generationConfig = { temperature };
  if (json) generationConfig.responseMimeType = 'application/json';
  const model = client.getGenerativeModel(
    { model: getModelName(), generationConfig },
    { timeout: timeoutMs }
  );
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error('AI request timed out');
      e.status = 504;
      reject(e);
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([model.generateContent(prompt), timeout]);
    return result.response.text();
  } finally {
    clearTimeout(timer);
  }
};

let rawGenerate = sdkGenerate;
let sleepFn = (ms) => new Promise((r) => setTimeout(r, ms));

// Test hooks: stub the transport so no real API call is ever made.
const _setRawGenerate = (fn) => {
  rawGenerate = fn || sdkGenerate;
};
const _setSleep = (fn) => {
  sleepFn = fn || ((ms) => new Promise((r) => setTimeout(r, ms)));
};

// ---- Error classification ----
const statusOf = (error) => {
  const s = error && (error.status || error.statusCode || error.code);
  if (typeof s === 'number') return s;
  const m = /\[(\d{3})\b/.exec((error && error.message) || '');
  return m ? Number(m[1]) : undefined;
};

const isQuotaError = (error) => {
  const msg = String((error && error.message) || '');
  return (
    statusOf(error) === 429 ||
    /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg) ||
    (error && error.code === 'AI_QUOTA')
  );
};

const isTransient = (error) => {
  const s = statusOf(error);
  return (typeof s === 'number' && s >= 500) || /ECONNRESET|ETIMEDOUT|fetch failed|timed out/i.test(String((error && error.message) || ''));
};

// Converts any failure into the contract's error shape.
const mapError = (error) => {
  if (error && error.code && String(error.code).startsWith('AI_')) return error;
  const aiClass = classifyRaw(error);
  if (isQuotaError(error)) {
    const e = aiError(429, 'AI_QUOTA', QUOTA_MESSAGE);
    e.aiClass = 'quota';
    return e;
  }
  const e = aiError(502, 'AI_ERROR', 'The AI service is temporarily unavailable. Please try again.');
  e.aiClass = aiClass;
  return e;
};

// ---- JSON parsing ----
const stripFences = (text) => {
  let t = String(text || '').trim();
  const fence = /^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/.exec(t);
  if (fence) t = fence[1].trim();
  else t = t.replace(/^```(?:json|JSON)?/, '').replace(/```$/, '').trim();
  return t;
};

// Strips fences / surrounding prose and parses. Returns the value or throws SyntaxError.
const parseJsonLoose = (text) => {
  const t = stripFences(text);
  try {
    return JSON.parse(t);
  } catch (e) {
    const start = t.search(/[{[]/);
    if (start === -1) throw e;
    const open = t[start];
    const close = open === '{' ? '}' : ']';
    const end = t.lastIndexOf(close);
    if (end <= start) throw e;
    return JSON.parse(t.slice(start, end + 1));
  }
};

const prepare = (prompt, opts = {}) => {
  if (!process.env.GEMINI_API_KEY && rawGenerate === sdkGenerate) {
    throw aiError(503, 'AI_UNAVAILABLE', 'AI service is not configured');
  }
  const text = String(prompt || '');
  if (!text.trim()) throw aiError(400, 'AI_BAD_INPUT', 'Empty prompt');
  if (text.length > (opts.maxPromptChars || MAX_PROMPT_CHARS)) {
    throw aiError(413, 'AI_INPUT_TOO_LARGE', 'The input is too large for AI processing.');
  }
  return {
    text,
    callOpts: {
      temperature: typeof opts.temperature === 'number' ? opts.temperature : DEFAULT_TEMPERATURE,
      timeoutMs: opts.timeoutMs || DEFAULT_TIMEOUT_MS,
    },
  };
};

// One call, with a single retry for transient failures only (never quota).
const callWithRetry = async (text, callOpts) => {
  try {
    return await rawGenerate(text, callOpts);
  } catch (error) {
    if (isQuotaError(error) || !isTransient(error)) throw mapError(error);
    await sleepFn(400);
    try {
      return await rawGenerate(text, callOpts);
    } catch (error2) {
      throw mapError(error2);
    }
  }
};

// Backwards compatible: generateText(prompt) still works.
const generateText = async (prompt, opts = {}) => {
  const { text, callOpts } = prepare(prompt, opts);
  try {
    return await callWithRetry(text, { ...callOpts, json: false });
  } catch (error) {
    if (!(error.code || '').startsWith('AI_')) console.error('Gemini error:', redact(error.message));
    throw mapError(error);
  }
};

// JSON mode. One retry in total for transient errors OR unparseable output; never for quota.
const generateJSON = async (prompt, opts = {}) => {
  const { text, callOpts } = prepare(prompt, opts);
  const jsonOpts = { ...callOpts, json: true };
  let lastWasBadJson = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let raw;
    try {
      raw = await rawGenerate(text, jsonOpts);
    } catch (error) {
      if (isQuotaError(error)) throw mapError(error);
      if (attempt === 0 && isTransient(error)) {
        await sleepFn(400);
        continue;
      }
      throw mapError(error);
    }
    try {
      const parsed = parseJsonLoose(raw);
      if (parsed === null || typeof parsed !== 'object') throw new SyntaxError('not an object');
      return parsed;
    } catch {
      lastWasBadJson = true;
      if (attempt === 1) break;
    }
  }
  throw aiError(
    502,
    lastWasBadJson ? 'AI_BAD_RESPONSE' : 'AI_ERROR',
    lastWasBadJson
      ? 'The AI returned an unreadable response. Please try again.'
      : 'The AI service is temporarily unavailable. Please try again.'
  );
};

// True when a real call could be made: a key, the test fixture, or a stubbed transport.
const isConfigured = () => !!process.env.GEMINI_API_KEY || fixtureActive() || rawGenerate !== sdkGenerate;

module.exports = {
  isConfigured,
  getModelName,
  generateText,
  generateJSON,
  parseJsonLoose,
  stripFences,
  aiError,
  MAX_PROMPT_CHARS,
  QUOTA_MESSAGE,
  _setRawGenerate,
  _fixtureActive: fixtureActive,
  _setSleep,
};
