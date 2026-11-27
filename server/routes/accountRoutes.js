const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const { exportData, logoutAll, removeAccount } = require('../controllers/accountController');

const router = express.Router();

// Per-user, per-process limiters. Disabled under NODE_ENV=test unless AUTH_RATE_LIMIT_FORCE=true (same rule as middleware/rateLimit.js).
const off = () => process.env.NODE_ENV === 'test' && process.env.AUTH_RATE_LIMIT_FORCE !== 'true';
const int = (name, fallback) => { const n = Number(process.env[name]); return Number.isInteger(n) && n > 0 ? n : fallback; };
const limited = (message) => (req, res) => {
  const t = req.rateLimit && req.rateLimit.resetTime;
  const retryAfterSeconds = Math.max(1, Math.ceil(((t ? t.getTime() : Date.now() + 1000) - Date.now()) / 1000));
  res.set('Retry-After', String(retryAfterSeconds));
  res.status(429).json({ message, code: 'RATE_LIMITED', retryAfterSeconds });
};
const perUser = { standardHeaders: 'draft-7', legacyHeaders: false, skip: off, keyGenerator: (req) => `user:${req.user && req.user.id}`, validate: { ip: false } };

const exportLimiter = rateLimit({ ...perUser, windowMs: 60 * 60 * 1000, limit: int('ACCOUNT_EXPORT_MAX_PER_HOUR', 5), handler: limited('You can export your data a few times per hour. Please try again later.') });
// Only failed attempts (wrong password / confirmation) count, which stops password guessing with a stolen token.
const deleteLimiter = rateLimit({ ...perUser, windowMs: 15 * 60 * 1000, limit: int('ACCOUNT_DELETE_MAX_FAILS', 5), skipSuccessfulRequests: true, handler: limited('Too many failed attempts. Please wait before trying again.') });
const logoutLimiter = rateLimit({ ...perUser, windowMs: 15 * 60 * 1000, limit: 20, handler: limited('Too many requests. Please wait before trying again.') });

router.use(protect);
router.get('/export', exportLimiter, exportData);
router.post('/logout-all', logoutLimiter, logoutAll);
router.post('/delete', deleteLimiter, removeAccount);

module.exports = router;
