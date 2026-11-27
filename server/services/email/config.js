// Email configuration policy. Pure functions over an env object so they are easy to test.
//
//   EMAIL_TRANSPORT   'outbox'   local development outbox (stores emails in MongoDB). ONLY when NODE_ENV is exactly
//                                 'development' or 'test'; any other value (unset, 'Production', 'prod', ...) refuses it.
//                     'none'     explicitly no transport: sending fails safely with EMAIL_NOT_CONFIGURED
//                     (a real provider will be added in Phase 5 as another named transport)
//                     default: 'outbox' when NODE_ENV is development/test, otherwise 'none'
//   DEV_OUTBOX_ENABLED  must be exactly 'true' to mount the outbox VIEWER (default: disabled)
//   EMAIL_FROM        sender shown in emails (default: a local-only placeholder)
//   APP_BASE_URL      base URL used in links inside emails (default: first CLIENT_ORIGIN, else http://localhost:5173)
//
// No credentials of any kind live in this file or in the source tree.

const isProduction = (env = process.env) => env.NODE_ENV === 'production';

// Allow-list, not deny-list: only these exact (case-sensitive) values may use development-only features. An unset NODE_ENV,
// 'Production', 'prod', 'staging' or a typo is treated as NOT development.
const DEV_ENVS = ['development', 'test'];
const isDevEnvironment = (env = process.env) => typeof env.NODE_ENV === 'string' && DEV_ENVS.includes(env.NODE_ENV);

const transportName = (env = process.env) => {
  const raw = String(env.EMAIL_TRANSPORT || '').trim().toLowerCase();
  if (raw) return raw;
  return isDevEnvironment(env) ? 'outbox' : 'none';
};

// The outbox VIEWER is opt-in: exactly 'true' (case-sensitive, no trimming).
const devOutboxEnabled = (env = process.env) => env.DEV_OUTBOX_ENABLED === 'true';

// Startup decision, same shape as jwtSecretPolicy: { action: 'ok' | 'warn' | 'exit', reason }.
const emailPolicy = (env = process.env) => {
  const name = transportName(env);
  if (name === 'outbox' && !isDevEnvironment(env)) {
    return { action: 'exit', reason: 'EMAIL_TRANSPORT=outbox is a development-only transport and requires NODE_ENV to be exactly "development" or "test"' };
  }
  if (devOutboxEnabled(env) && !isDevEnvironment(env)) {
    return { action: 'exit', reason: 'DEV_OUTBOX_ENABLED=true requires NODE_ENV to be exactly "development" or "test"' };
  }
  if (name === 'none') {
    return { action: isDevEnvironment(env) ? 'ok' : 'warn', reason: 'no email transport is configured: password reset requests are answered with 503 until one is' };
  }
  if (name !== 'outbox') {
    return { action: 'warn', reason: `unknown EMAIL_TRANSPORT "${name}": email delivery is disabled` };
  }
  return { action: 'ok', reason: 'local development outbox' };
};

const fromAddress = (env = process.env) => String(env.EMAIL_FROM || 'CareerNest <no-reply@careernest.local>').slice(0, 200);

// Absolute http(s) base URL without a trailing slash. Falls back to the first allowed client origin.
const appBaseUrl = (env = process.env) => {
  const candidates = [env.APP_BASE_URL, String(env.CLIENT_ORIGIN || '').split(',')[0], 'http://localhost:5173'];
  for (const c of candidates) {
    const v = String(c || '').trim();
    if (!v) continue;
    try {
      const u = new URL(v);
      if (u.protocol === 'http:' || u.protocol === 'https:') return `${u.protocol}//${u.host}`;
    } catch { /* try the next candidate */ }
  }
  return 'http://localhost:5173';
};

module.exports = { isProduction, isDevEnvironment, devOutboxEnabled, transportName, emailPolicy, fromAddress, appBaseUrl };
