const jwt = require('jsonwebtoken');

const ALGORITHM = 'HS256';
const EXPIRES_IN = '7d';
const PLACEHOLDERS = ['change-me', 'changeme', 'secret', 'your-secret', 'your_secret', 'jwt_secret', 'jwtsecret', 'password', 'test', 'default'];

// Judges JWT_SECRET strength without ever returning or logging the secret itself.
// weak => shorter than 32 characters or an obvious placeholder.
const assessJwtSecret = (secret) => {
  const s = String(secret || '');
  if (!s) return { weak: true, reason: 'JWT_SECRET is empty' };
  const lower = s.toLowerCase();
  if (PLACEHOLDERS.some((p) => lower === p || lower.startsWith(`${p}-`) || lower.startsWith(`${p}_`) || lower.includes('change-me') || lower.includes('changeme'))) {
    return { weak: true, reason: 'JWT_SECRET looks like a placeholder' };
  }
  if (s.length < 32) return { weak: true, reason: 'JWT_SECRET is shorter than 32 characters' };
  return { weak: false, reason: 'ok' };
};

// Startup decision: { action: 'ok' | 'warn' | 'exit', reason }.
const jwtSecretPolicy = (secret, env = process.env) => {
  const a = assessJwtSecret(secret);
  if (!a.weak) return { action: 'ok', reason: a.reason };
  return { action: env.NODE_ENV === 'production' ? 'exit' : 'warn', reason: a.reason };
};

const signToken = (user) => jwt.sign(
  { userId: user._id, tv: user.tokenVersion || 0 },
  process.env.JWT_SECRET,
  { algorithm: ALGORITHM, expiresIn: EXPIRES_IN },
);

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGORITHM] });

module.exports = { assessJwtSecret, jwtSecretPolicy, signToken, verifyToken, ALGORITHM };
