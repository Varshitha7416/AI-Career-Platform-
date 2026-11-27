const { checkPassword } = require('./passwordPolicy');

const NAME_MIN = 2;
const NAME_MAX = 80;
const EMAIL_MAX = 254;

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const hasControlChars = (s) => /[\u0000-\u001f\u007f]/.test(s);

const normalizeEmail = (v) => v.trim().toLowerCase();
const normalizeName = (v) => v.trim().replace(/\s+/g, ' ');

// Each validator returns { value } or { error }. Non-strings (objects, arrays, numbers) are always rejected.
const validateName = (raw) => {
  if (typeof raw !== 'string') return { error: 'Name is required' };
  const value = normalizeName(raw);
  if (value.length < NAME_MIN) return { error: `Name must be at least ${NAME_MIN} characters` };
  if (value.length > NAME_MAX) return { error: `Name must be ${NAME_MAX} characters or fewer` };
  if (hasControlChars(value) || /[<>]/.test(value)) return { error: 'Name contains characters that are not allowed' };
  return { value };
};

const validateEmail = (raw) => {
  if (typeof raw !== 'string') return { error: 'Email is required' };
  const value = normalizeEmail(raw);
  if (!value) return { error: 'Email is required' };
  if (value.length > EMAIL_MAX) return { error: `Email must be ${EMAIL_MAX} characters or fewer` };
  const [local] = value.split('@');
  if (!EMAIL_RE.test(value) || local.length > 64 || value.includes('..') || local.startsWith('.') || local.endsWith('.')) {
    return { error: 'Please enter a valid email address' };
  }
  return { value };
};

const validatePassword = (raw, ctx) => {
  if (typeof raw !== 'string' || raw === '') return { error: 'Password is required' };
  const error = checkPassword(raw, ctx);
  return error ? { error } : { value: raw };
};

module.exports = { validateName, validateEmail, validatePassword, normalizeEmail, EMAIL_MAX, NAME_MAX };
