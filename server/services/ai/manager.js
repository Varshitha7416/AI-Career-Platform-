// Central AI provider manager (docs/32). One user AI request = ONE logical operation: callers still call generateJSON /
// generateText exactly once (and `req.consumeAiCall()` once), and any fallback happens INSIDE this call, so a fallback can never
// be counted as a second rate-limited operation.
//
// Flow: validate input -> primary provider (its own existing retry rules) -> on a recoverable failure ONE attempt on the
// secondary provider -> otherwise the primary's error, in the unchanged AI_* contract. Never a loop.
//   - fatal for the request (bad request, bad input, oversize)  -> no fallback
//   - quota / rate limit / 5xx / timeout / network / bad JSON    -> fallback once
//   - invalid key / unknown model                                -> fallback once and the provider is paused (breaker, long cooldown)
// Circuit breakers skip a provider that keeps failing and probe it again after the cooldown (automatic recovery).
// The secondary (Groq) is OFF unless it is configured AND GROQ_PRIVACY_ACK=true (no resume text leaves for Groq before that).

const gemini = require('./providers/geminiProvider');
const groq = require('./providers/groqProvider');
const { classify, redact } = require('./errors');
const { Breaker } = require('./breaker');
const { readConfig } = require('./config');

const geminiAdapter = {
  name: 'gemini',
  isConfigured: () => gemini.isConfigured(),
  canHandle: () => true,
  model: () => gemini.getModelName(),
  generateJSON: (p, o) => gemini.generateJSON(p, o),
  generateText: (p, o) => gemini.generateText(p, o),
};
const groqAdapter = {
  name: 'groq',
  isConfigured: () => groq.isConfigured(),
  canHandle: (p) => groq.canHandle(p),
  model: () => groq.getModelName(),
  generateJSON: (p, o) => groq.generateJSON(p, o),
  generateText: (p, o) => groq.generateText(p, o),
};

const createManager = ({ providers = { gemini: geminiAdapter, groq: groqAdapter }, env = () => process.env, now = Date.now, log = console } = {}) => {
  const cfg0 = () => readConfig(env());
  const breakers = {};
  const stats = { requests: 0, fallbackAttempts: 0, fallbackSuccesses: 0, bothFailed: 0, skippedPrimary: 0, byProvider: {} };
  const ensure = (name) => {
    if (!breakers[name]) {
      const c = cfg0().breaker;
      breakers[name] = new Breaker({ threshold: c.threshold, cooldownMs: c.cooldownMs, now });
    }
    if (!stats.byProvider[name]) stats.byProvider[name] = { success: 0, failure: 0 };
    return breakers[name];
  };

  const say = (level, msg) => { try { log[level](redact(msg, env())); } catch { /* logging must never break a request */ } };

  // Is the secondary usable at all right now? Returns { provider } or { reason }.
  const secondaryStatus = (cfg) => {
    if (cfg.fallback === 'none') return { reason: 'disabled (AI_FALLBACK_PROVIDER=none)' };
    const p = providers[cfg.fallback];
    if (!p) return { reason: 'unknown provider' };
    if (!p.isConfigured()) return { reason: 'not configured (no API key)' };
    if (cfg.fallback === 'groq' && !cfg.groqPrivacyAck) return { reason: 'blocked: GROQ_PRIVACY_ACK is not "true" (privacy review pending, no text is sent to Groq)' };
    return { provider: p };
  };

  const attempt = async (provider, kind, prompt, opts) => {
    const b = ensure(provider.name);
    try {
      const out = await (kind === 'json' ? provider.generateJSON(prompt, opts) : provider.generateText(prompt, opts));
      b.success();
      stats.byProvider[provider.name].success += 1;
      return out;
    } catch (error) {
      const c = classify(error);
      if (c.cls !== 'oversize' && c.cls !== 'input' && c.cls !== 'unconfigured') stats.byProvider[provider.name].failure += 1;
      b.failure(c.cls, c.trip, { retryAfterMs: error && error.retryAfterMs, error });
      say('warn', `AI provider ${provider.name} failed: class=${c.cls} status=${error && error.status} code=${error && error.code} breaker=${b.state()}`);
      throw error;
    }
  };

  const validate = (prompt, opts) => {
    const text = String(prompt || '');
    if (!text.trim()) throw gemini.aiError(400, 'AI_BAD_INPUT', 'Empty prompt');
    if (text.length > ((opts && opts.maxPromptChars) || gemini.MAX_PROMPT_CHARS)) {
      throw gemini.aiError(413, 'AI_INPUT_TOO_LARGE', 'The input is too large for AI processing.');
    }
  };

  const run = async (kind, prompt, opts = {}) => {
    validate(prompt, opts);
    const cfg = cfg0();
    stats.requests += 1;
    const primary = providers[cfg.primary];
    const sec = secondaryStatus(cfg);
    const pb = ensure(primary.name);
    const sb = sec.provider ? ensure(sec.provider.name) : null;

    let primaryErr = null;
    let primaryCls = null;
    let tryPrimary = true;
    if (!pb.allow() && sec.provider && sb.allow() && sec.provider.canHandle(prompt)) {
      // the primary is cooling down after repeated failures: go straight to the secondary
      tryPrimary = false;
      stats.skippedPrimary += 1;
      primaryErr = Object.assign(new Error(pb.lastError ? pb.lastError.message : 'The AI service is temporarily unavailable. Please try again.'), {
        status: (pb.lastError && pb.lastError.status) || 502,
        code: (pb.lastError && pb.lastError.code) || 'AI_ERROR',
      });
      primaryCls = pb.lastErrorClass || 'transient';
    }

    if (tryPrimary) {
      try {
        return await attempt(primary, kind, prompt, opts);
      } catch (error) {
        primaryErr = error;
        const c = classify(error);
        primaryCls = c.cls;
        if (!c.fallback || !sec.provider) throw error;
      }
    }

    // ---- exactly one attempt on the secondary ----
    if (!sec.provider || !sb.allow() || !sec.provider.canHandle(prompt)) {
      throw primaryErr;
    }
    stats.fallbackAttempts += 1;
    say('warn', `AI fallback: ${primary.name} -> ${sec.provider.name} (primary failure class=${primaryCls})`);
    try {
      const out = await attempt(sec.provider, kind, prompt, opts);
      stats.fallbackSuccesses += 1;
      return out;
    } catch (error2) {
      stats.bothFailed += 1;
      // The caller sees the primary's error (unchanged contract), except when the primary had no key at all.
      throw primaryCls === 'unconfigured' ? error2 : primaryErr;
    }
  };

  const snapshot = () => {
    const cfg = cfg0();
    const sec = secondaryStatus(cfg);
    const row = (name, role) => {
      const p = providers[name];
      const b = ensure(name);
      return {
        provider: name,
        role,
        configured: p.isConfigured(),
        model: p.model(),
        state: b.state(),
        consecutiveFailures: b.failures,
        openUntil: b.opened && b.openUntil ? new Date(b.openUntil).toISOString() : null,
        lastErrorClass: b.lastErrorClass,
        lastSuccessAt: b.lastSuccessAt ? new Date(b.lastSuccessAt).toISOString() : null,
        lastFailureAt: b.lastFailureAt ? new Date(b.lastFailureAt).toISOString() : null,
        successes: stats.byProvider[name].success,
        failures: stats.byProvider[name].failure,
      };
    };
    const rows = [row(cfg.primary, 'primary')];
    if (cfg.fallback !== 'none') rows.push(row(cfg.fallback, 'secondary'));
    return {
      checkedAt: new Date(now()).toISOString(),
      mode: 'passive (derived from real traffic; no AI calls are made by this check)',
      fallback: { active: Boolean(sec.provider), reason: sec.provider ? 'active' : sec.reason },
      providers: rows,
      totals: { requests: stats.requests, fallbackAttempts: stats.fallbackAttempts, fallbackSuccesses: stats.fallbackSuccesses, bothFailed: stats.bothFailed, primarySkippedByBreaker: stats.skippedPrimary },
      warnings: cfg.warnings,
    };
  };

  const startupSummary = () => {
    const s = snapshot();
    const parts = s.providers.map((p) => `${p.provider} ${p.role} (${p.configured ? 'key set' : 'no key'})`);
    return `AI providers: ${parts.join(', ')}. Fallback: ${s.fallback.active ? 'active' : `off - ${s.fallback.reason}`}.`;
  };

  const reset = () => {
    for (const k of Object.keys(breakers)) delete breakers[k];
    for (const k of Object.keys(stats.byProvider)) delete stats.byProvider[k];
    Object.assign(stats, { requests: 0, fallbackAttempts: 0, fallbackSuccesses: 0, bothFailed: 0, skippedPrimary: 0 });
  };

  return {
    generateJSON: (prompt, opts) => run('json', prompt, opts),
    generateText: (prompt, opts) => run('text', prompt, opts),
    snapshot,
    startupSummary,
    reset,
    _breakers: breakers,
  };
};

const defaultManager = createManager();

module.exports = { createManager, defaultManager, geminiAdapter, groqAdapter };
