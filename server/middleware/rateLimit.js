const { rateLimit } = require('express-rate-limit');

// In-memory limiters (per process; reset on restart; not shared between instances).
// Behind a reverse proxy set TRUST_PROXY (number of proxy hops) so req.ip is the real client address; without it
// every client would share the proxy's address.
//
// NODE_ENV=test disables them (so the other API suites can create many accounts from one address) unless
// AUTH_RATE_LIMIT_FORCE=true. They are always on in development and production.
const disabled = () => process.env.NODE_ENV === 'test' && process.env.AUTH_RATE_LIMIT_FORCE !== 'true';

const intEnv = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const makeHandler = (message) => (req, res) => {
  const resetTime = req.rateLimit?.resetTime;
  const retryAfterSeconds = Math.max(1, Math.ceil(((resetTime ? resetTime.getTime() : Date.now() + 1000) - Date.now()) / 1000));
  res.set('Retry-After', String(retryAfterSeconds));
  res.status(429).json({ message, code: 'RATE_LIMITED', retryAfterSeconds });
};

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: disabled,
};

// Failed logins only: successful (status < 400) responses do not consume the budget.
const loginMax = () => intEnv('AUTH_LOGIN_MAX_FAILS', 10);
const loginWindow = () => intEnv('AUTH_LOGIN_WINDOW_MINUTES', 15) * 60 * 1000;

const loginByIp = rateLimit({
  ...base,
  windowMs: loginWindow(),
  limit: loginMax(),
  skipSuccessfulRequests: true,
  handler: makeHandler('Too many failed login attempts. Please wait before trying again.'),
});

const loginByEmail = rateLimit({
  ...base,
  windowMs: loginWindow(),
  limit: loginMax(),
  skipSuccessfulRequests: true,
  // Keyed by the submitted email; requests without a usable email are not counted here (the per-IP limiter still applies).
  keyGenerator: (req) => `email:${String(req.body.email).trim().toLowerCase().slice(0, 254)}`,
  skip: (req) => disabled() || typeof req.body?.email !== 'string' || !req.body.email.trim(),
  handler: makeHandler('Too many failed login attempts for this account. Please wait before trying again.'),
  validate: { ip: false },
});

const signupByIp = rateLimit({
  ...base,
  windowMs: intEnv('AUTH_SIGNUP_WINDOW_MINUTES', 60) * 60 * 1000,
  limit: intEnv('AUTH_SIGNUP_MAX', 5),
  handler: makeHandler('Too many accounts created from this network. Please try again later.'),
});

// Guards the current-password check on a password change against guessing with a stolen token. Only requests that
// actually try to change the password are counted, and only failures.
const passwordChange = rateLimit({
  ...base,
  windowMs: loginWindow(),
  limit: loginMax(),
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `user:${req.user?.id}`,
  skip: (req) => disabled() || !req.body?.newPassword,
  handler: makeHandler('Too many failed password change attempts. Please wait before trying again.'),
  validate: { ip: false },
});

module.exports = { loginByIp, loginByEmail, signupByIp, passwordChange };
