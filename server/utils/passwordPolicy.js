// Shared password policy for signup and password change (NOT applied to login, so older short-password accounts
// still sign in). 8-72 bytes (bcrypt ignores everything past 72 bytes), at least one letter and one number,
// not a very common password, must not contain the email local-part or equal the name.

const MIN_LENGTH = 8;
const MAX_BYTES = 72;

// Deliberately small: the most common passwords that satisfy "letter + number". Matched after stripping trailing
// digits/symbols, so "Password99!" is caught too.
const COMMON_BASES = new Set([
  'password', 'passw0rd', 'qwerty', 'qwertyuiop', 'qwerty123', 'letmein', 'welcome', 'iloveyou', 'admin', 'administrator',
  'abc', 'abcdef', 'abcdefgh', 'monkey', 'dragon', 'football', 'baseball', 'master', 'login', 'princess', 'sunshine',
  'shadow', 'superman', 'trustno', 'whatever', 'freedom', 'changeme', 'default', 'asdfgh', 'asdfghjkl',
  'zxcvbnm', 'hello', 'charlie', 'donald', 'welcome', 'careernest', 'career', 'user', 'test', 'testing',
]);

const baseOf = (password) => password.toLowerCase().replace(/[\d!@#$%^&*._\-+=?]+$/, '');

// Returns an error message, or null when the password is acceptable.
const checkPassword = (password, { email = '', name = '' } = {}) => {
  if (typeof password !== 'string') return 'Password must be text';
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters`;
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) return `Password is too long (maximum ${MAX_BYTES} characters)`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must include at least one letter and one number';
  const lower = password.toLowerCase();
  const base = baseOf(password);
  if (COMMON_BASES.has(lower) || COMMON_BASES.has(base) || /^(.)\1+$/.test(base) || /^(123456|12345678|0123456789)/.test(lower)) {
    return 'That password is too common. Choose something harder to guess';
  }
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 3 && lower.includes(local)) return 'Password must not contain your email name';
  const n = String(name).trim().toLowerCase();
  if (n && lower === n) return 'Password must not be the same as your name';
  return null;
};

module.exports = { checkPassword, MIN_LENGTH, MAX_BYTES };
