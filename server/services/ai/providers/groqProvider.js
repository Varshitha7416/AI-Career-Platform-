// Groq provider (the SECONDARY / fallback AI provider, FREE tier only). Plain `fetch` against Groq's documented
// OpenAI-compatible endpoint: POST {GROQ_BASE_URL}/chat/completions with `Authorization: Bearer <GROQ_API_KEY>`.
// JSON requests use response_format {type:"json_object"} (valid JSON only; the callers' existing validators check the shape).
// The API key stays on the server: it is only ever put in the Authorization header and never in an error, log or health report.
//
// A completion that ended with finish_reason "length" was cut off by the output limit, so it is never returned as a success, even
// if the cut text happens to parse: it becomes AI_BAD_RESPONSE (class bad_output) with a safe diagnostic (no prompt, no key).
//
// Errors come out in the same AI_* contract as the Gemini provider, with `aiClass` set from the HTTP status:
//   401/403 auth, 404 config, 429 quota (+retryAfterMs), 413 oversize, 400/422 bad_request, 5xx/timeout/network transient.

const { aiError, parseJsonLoose, QUOTA_MESSAGE } = require('./geminiProvider');
const { redact } = require('../errors');
const { readConfig } = require('../config');

let fetchImpl = null; // test hook; null = global fetch
const _setFetch = (fn) => { fetchImpl = fn || null; };

const lastLimits = { remainingTokens: null, remainingRequests: null, observedAt: null };

const fail = (status, code, message, aiClass, extra = {}) => {
  const e = aiError(status, code, message);
  e.aiClass = aiClass;
  Object.assign(e, extra);
  return e;
};

const isConfigured = (env = process.env) => !!String(env.GROQ_API_KEY || '').trim();

// Pre-flight: Groq's free tier has small token limits, so a prompt that is clearly too big is not sent at all.
const canHandle = (prompt, env = process.env) => String(prompt || '').length <= readConfig(env).groq.maxInputChars;

const baseUrlOk = (url, env) => {
  if (/^https:\/\//i.test(url)) return true;
  // plain http is accepted only for a local mock server under NODE_ENV=test
  return env.NODE_ENV === 'test' && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(url);
};

const retryAfterMs = (headers) => {
  const raw = headers && typeof headers.get === 'function' ? headers.get('retry-after') : null;
  const s = Number(raw);
  return Number.isFinite(s) && s > 0 ? Math.min(s, 900) * 1000 : undefined;
};

const noteLimits = (headers) => {
  if (!headers || typeof headers.get !== 'function') return;
  const t = Number(headers.get('x-ratelimit-remaining-tokens'));
  const r = Number(headers.get('x-ratelimit-remaining-requests'));
  lastLimits.remainingTokens = Number.isFinite(t) ? t : null;
  lastLimits.remainingRequests = Number.isFinite(r) ? r : null;
  lastLimits.observedAt = Date.now();
};

const buildBody = (kind, prompt, opts, cfg) => {
  let content = String(prompt);
  const body = { model: cfg.model, temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.4 };
  if (kind === 'json') {
    // Groq's JSON mode requires the word "JSON" to appear in the prompt.
    if (!/json/i.test(content)) content += '\n\nRespond with a single valid JSON object only.';
    body.response_format = { type: 'json_object' };
  }
  body.messages = [{ role: 'user', content }];
  return body;
};

const call = async (kind, prompt, opts = {}, env = process.env) => {
  if (!isConfigured(env)) throw fail(503, 'AI_UNAVAILABLE', 'AI service is not configured', 'unconfigured');
  const cfg = readConfig(env).groq;
  if (!baseUrlOk(cfg.baseUrl, env)) throw fail(503, 'AI_UNAVAILABLE', 'AI service is not configured', 'config');
  if (!canHandle(prompt, env)) throw fail(413, 'AI_INPUT_TOO_LARGE', 'The input is too large for the backup AI provider.', 'oversize');

  const timeoutMs = Math.min(opts.timeoutMs || cfg.timeoutMs, cfg.timeoutMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await (fetchImpl || fetch)(`${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${String(env.GROQ_API_KEY).trim()}` },
      body: JSON.stringify(buildBody(kind, prompt, opts, cfg)),
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = error && (error.name === 'AbortError' || controller.signal.aborted);
    throw fail(timedOut ? 504 : 502, 'AI_ERROR', 'The backup AI service is temporarily unavailable.', 'transient', { detail: redact(timedOut ? 'timed out' : error && error.message, env) });
  } finally {
    clearTimeout(timer);
  }

  noteLimits(res.headers);
  if (!res.ok) {
    const status = res.status;
    let detail = '';
    try { detail = String((await res.json())?.error?.message || ''); } catch { /* body is not JSON */ }
    detail = redact(detail, env).slice(0, 300);
    if (status === 429) throw fail(429, 'AI_QUOTA', QUOTA_MESSAGE, 'quota', { retryAfterMs: retryAfterMs(res.headers), detail });
    if (status === 401 || status === 403) throw fail(502, 'AI_ERROR', 'The backup AI service is unavailable.', 'auth', { detail });
    if (status === 404) throw fail(502, 'AI_ERROR', 'The backup AI service is unavailable.', 'config', { detail });
    if (status === 413) throw fail(413, 'AI_INPUT_TOO_LARGE', 'The input is too large for the backup AI provider.', 'oversize', { detail });
    if (status === 400 || status === 422) throw fail(502, 'AI_ERROR', 'The backup AI service rejected the request.', 'bad_request', { detail });
    throw fail(502, 'AI_ERROR', 'The backup AI service is temporarily unavailable.', 'transient', { detail });
  }

  let data;
  try { data = await res.json(); } catch { data = null; }
  const choice = data && data.choices && data.choices[0];
  if (choice && choice.finish_reason === 'length') {
    const used = data.usage && Number.isFinite(data.usage.completion_tokens) ? data.usage.completion_tokens : 'unknown';
    console.warn(`Groq response truncated: finish_reason=length model=${redact(String(data.model || cfg.model), env)} completion_tokens=${used}`);
    throw fail(502, 'AI_BAD_RESPONSE', 'The AI returned an incomplete response. Please try again.', 'bad_output', { truncated: true });
  }
  const text = choice && choice.message && choice.message.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw fail(502, 'AI_BAD_RESPONSE', 'The AI returned an unreadable response. Please try again.', 'bad_output');
  }
  if (kind !== 'json') return text;
  try {
    const parsed = parseJsonLoose(text);
    if (parsed === null || typeof parsed !== 'object') throw new SyntaxError('not an object');
    return parsed;
  } catch {
    throw fail(502, 'AI_BAD_RESPONSE', 'The AI returned an unreadable response. Please try again.', 'bad_output');
  }
};

const generateJSON = (prompt, opts, env) => call('json', prompt, opts, env);
const generateText = (prompt, opts, env) => call('text', prompt, opts, env);
const getModelName = (env = process.env) => readConfig(env).groq.model;

module.exports = { isConfigured, canHandle, generateJSON, generateText, getModelName, lastLimits, _setFetch };
