// Error classification shared by every AI provider and the provider manager (docs/32).
//
// Classes (what happened) and what the manager does with each:
//   quota        429 / RESOURCE_EXHAUSTED / rate limit       -> fall back, breaker opens at once
//   transient    5xx, timeouts, network errors, unknown      -> fall back, counts towards the breaker
//   auth         401 / 403 / invalid API key                 -> fall back, provider is paused for a long cooldown (never retried in a loop)
//   config       404 (unknown model) and similar             -> fall back, provider paused like auth
//   unconfigured provider has no key                         -> fall back (the other provider may still work), not a failure
//   bad_output   the model answered, but not with usable JSON-> fall back once (decision 4), does not count towards the breaker
//   bad_request  400 / 422 malformed request                 -> NO fallback (the other provider would reject it too)
//   input        empty / oversized prompt, 413               -> NO fallback
//   oversize     prompt too big for THIS provider's limits   -> that provider is skipped, nothing counted

const CLASSES = ['quota', 'transient', 'auth', 'config', 'unconfigured', 'bad_output', 'bad_request', 'input', 'oversize'];

const RULES = {
  quota: { fallback: true, trip: 'now' },
  transient: { fallback: true, trip: 'count' },
  auth: { fallback: true, trip: 'long' },
  config: { fallback: true, trip: 'long' },
  unconfigured: { fallback: true, trip: false },
  bad_output: { fallback: true, trip: false },
  bad_request: { fallback: false, trip: false },
  input: { fallback: false, trip: false },
  oversize: { fallback: false, trip: false },
};

const statusOf = (error) => {
  const s = error && (error.status || error.statusCode || error.code);
  if (typeof s === 'number') return s;
  const m = /\[(\d{3})\b/.exec((error && error.message) || '');
  return m ? Number(m[1]) : undefined;
};

// Classifies a RAW failure (SDK / HTTP error) that has not been mapped to the AI_* contract yet.
const classifyRaw = (error) => {
  const msg = String((error && error.message) || '');
  const status = statusOf(error);
  if (/api.?key (is )?(not valid|invalid)|invalid api key|incorrect api key|permission.?denied|unauthori[sz]ed/i.test(msg) || status === 401 || status === 403) return 'auth';
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg) || (error && error.code === 'AI_QUOTA')) return 'quota';
  if (status === 413) return 'input';
  if (status === 404) return 'config';
  if (status === 400 || status === 422) return 'bad_request';
  if ((typeof status === 'number' && status >= 500) || status === 408 || /ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|timed out|socket hang up|network/i.test(msg)) return 'transient';
  return 'unknown';
};

// Classifies an error that left a provider (already in the AI_* contract, optionally carrying `aiClass`).
const classify = (error) => {
  let cls = error && error.aiClass;
  if (!cls) {
    switch (error && error.code) {
      case 'AI_BAD_INPUT':
      case 'AI_INPUT_TOO_LARGE': cls = 'input'; break;
      case 'AI_UNAVAILABLE': cls = 'unconfigured'; break;
      case 'AI_BAD_RESPONSE': cls = 'bad_output'; break;
      case 'AI_QUOTA': cls = 'quota'; break;
      case 'AI_ERROR': cls = 'transient'; break;
      default: cls = classifyRaw(error);
    }
  }
  if (cls === 'unknown') cls = 'transient'; // unknown failures are treated as temporary, never as the caller's fault
  const rule = RULES[cls] || RULES.transient;
  return { cls, fallback: rule.fallback, trip: rule.trip };
};

// Removes every configured secret from a string before it is logged or returned. Short values are ignored so that an
// empty/placeholder variable cannot blank out ordinary text.
const SECRET_ENV = ['GEMINI_API_KEY', 'GROQ_API_KEY'];
const redact = (text, env = process.env) => {
  let out = String(text == null ? '' : text);
  for (const name of SECRET_ENV) {
    const v = env[name];
    if (v && v.length >= 8) out = out.split(v).join('[redacted]');
  }
  return out.replace(/(Bearer\s+)[A-Za-z0-9._\-]{8,}/gi, '$1[redacted]').replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]');
};

module.exports = { CLASSES, RULES, statusOf, classifyRaw, classify, redact };
