// Reads the AI provider settings from the environment (server side only; nothing here is ever sent to the client).
//
//   AI_PRIMARY_PROVIDER   gemini (default) | groq
//   AI_FALLBACK_PROVIDER  groq | gemini | none          (default: groq)
//   GROQ_PRIVACY_ACK      must be exactly "true" before ANY request text is forwarded to Groq (docs/32: review Groq's data terms and
//                         publish the Privacy Policy update first). Without it the fallback stays OFF even when a key is set.
//   GROQ_API_KEY, GROQ_MODEL (default openai/gpt-oss-120b, provisional), GROQ_BASE_URL, GROQ_TIMEOUT_MS,
//   GROQ_MAX_INPUT_CHARS (default 12000: realistic job-specific prompts are 8-10K characters including the instructions)
//   AI_BREAKER_FAILURES (3), AI_BREAKER_COOLDOWN_MS (60000)
//
// Cost rule: only free-tier Groq usage is ever intended. Nothing in this code adds a payment method, buys credits or selects
// a paid model on its own; the model is whatever GROQ_MODEL names.

const PROVIDERS = ['gemini', 'groq'];

const int = (v, d, min = 1) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : d;
};

const readConfig = (env = process.env) => {
  const warnings = [];
  const pick = (name, dflt, allowNone) => {
    const raw = String(env[name] || '').trim().toLowerCase();
    if (!raw) return dflt;
    if (PROVIDERS.includes(raw) || (allowNone && raw === 'none')) return raw;
    warnings.push(`${name}="${raw}" is not recognised; using "${dflt}"`);
    return dflt;
  };
  const primary = pick('AI_PRIMARY_PROVIDER', 'gemini', false);
  let fallback = pick('AI_FALLBACK_PROVIDER', 'groq', true);
  if (fallback === primary) fallback = 'none';
  return {
    primary,
    fallback,
    groqPrivacyAck: String(env.GROQ_PRIVACY_ACK || '').trim().toLowerCase() === 'true',
    breaker: {
      threshold: int(env.AI_BREAKER_FAILURES, 3),
      cooldownMs: int(env.AI_BREAKER_COOLDOWN_MS, 60000, 1000),
    },
    groq: {
      model: String(env.GROQ_MODEL || '').trim() || 'openai/gpt-oss-120b',
      baseUrl: String(env.GROQ_BASE_URL || '').trim() || 'https://api.groq.com/openai/v1',
      timeoutMs: int(env.GROQ_TIMEOUT_MS, 30000, 1000),
      maxInputChars: int(env.GROQ_MAX_INPUT_CHARS, 12000, 500),
    },
    warnings,
  };
};

module.exports = { readConfig, PROVIDERS };
