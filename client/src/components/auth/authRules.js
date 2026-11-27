// Client-side mirror of the server's signup validation (server/utils/passwordPolicy.js + authValidation.js).
// The server stays the source of truth; this only gives instant feedback. Keep the two in sync.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72;

const COMMON_BASES = new Set([
  'password', 'passw0rd', 'qwerty', 'qwertyuiop', 'qwerty123', 'letmein', 'welcome', 'iloveyou', 'admin', 'administrator',
  'abc', 'abcdef', 'abcdefgh', 'monkey', 'dragon', 'football', 'baseball', 'master', 'login', 'princess', 'sunshine',
  'shadow', 'superman', 'trustno', 'whatever', 'freedom', 'changeme', 'default', 'asdfgh', 'asdfghjkl',
  'zxcvbnm', 'hello', 'charlie', 'donald', 'careernest', 'career', 'user', 'test', 'testing',
]);

const baseOf = (p) => p.toLowerCase().replace(/[\d!@#$%^&*._\-+=?]+$/, '');
const byteLength = (s) => new TextEncoder().encode(s).length;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isCommonPassword(password) {
  const lower = password.toLowerCase();
  const base = baseOf(password);
  return COMMON_BASES.has(lower) || COMMON_BASES.has(base) || /^(.)\1+$/.test(base) || /^(123456|12345678|0123456789)/.test(lower);
}

function containsEmailName(password, email) {
  const local = String(email).split('@')[0].trim().toLowerCase();
  return local.length >= 3 && password.toLowerCase().includes(local);
}

// The requirement list shown under the password field. `met` is null until the user has typed something.
export function passwordChecks(password, { email = '', name = '' } = {}) {
  const has = password.length > 0;
  const n = name.trim().toLowerCase();
  return [
    { id: 'length', label: `At least ${PASSWORD_MIN} characters`, met: has && password.length >= PASSWORD_MIN && byteLength(password) <= PASSWORD_MAX_BYTES },
    { id: 'mix', label: 'A letter and a number', met: has && /[A-Za-z]/.test(password) && /[0-9]/.test(password) },
    { id: 'common', label: 'Not a common password', met: has && !isCommonPassword(password) },
    { id: 'personal', label: 'Does not contain your name or email name', met: has && !containsEmailName(password, email) && password.toLowerCase() !== n },
  ];
}

// Same messages as the server, or null when acceptable.
export function passwordError(password, ctx = {}) {
  if (!password) return 'Please enter a password.';
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (byteLength(password) > PASSWORD_MAX_BYTES) return `Password is too long (maximum ${PASSWORD_MAX_BYTES} characters).`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must include at least one letter and one number.';
  if (isCommonPassword(password)) return 'That password is too common. Choose something harder to guess.';
  if (containsEmailName(password, ctx.email || '')) return 'Password must not contain your email name.';
  const n = (ctx.name || '').trim().toLowerCase();
  if (n && password.toLowerCase() === n) return 'Password must not be the same as your name.';
  return null;
}

// 0-4 plus a label. Policy failures cap the strength at "Weak" so the meter never praises a rejected password.
export function passwordStrength(password, ctx = {}) {
  if (!password) return { score: 0, label: '' };
  const meetsPolicy = passwordError(password, ctx) === null;
  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/[0-9]/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  // 5 points = Strong, 4 = Good, otherwise Fair; a password the server would reject is always Weak.
  const score = !meetsPolicy ? 1 : points >= 5 ? 4 : points === 4 ? 3 : 2;
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] };
}

export function nameError(name) {
  const v = name.trim().replace(/\s+/g, ' ');
  if (!v) return 'Please enter your full name.';
  if (v.length < 2) return 'Name must be at least 2 characters.';
  if (v.length > 80) return 'Name must be 80 characters or fewer.';
  if (/[<>]/.test(v)) return 'Name contains characters that are not allowed.';
  return null;
}

export function emailError(email) {
  const v = email.trim();
  if (!v) return 'Please enter your email address.';
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'Please enter a valid email address.';
  return null;
}

// "5 minutes" / "1 minute" / "40 seconds"
export function formatWait(seconds) {
  const s = Math.max(1, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.ceil(m / 60);
  return `${h} hour${h === 1 ? '' : 's'}`;
}

// Turns a failed auth request into { banner, fields, code }.
export function describeAuthFailure(err, fallback) {
  const res = err?.response;
  const data = res?.data || {};
  if (!res) {
    return { banner: err?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check your connection and that the backend is running.' : fallback, fields: {}, code: 'NETWORK' };
  }
  if (res.status === 429) {
    const seconds = data.retryAfterSeconds || Number(res.headers?.['retry-after']) || 0;
    const wait = seconds ? ` Please try again in about ${formatWait(seconds)}.` : ' Please try again later.';
    return { banner: `Too many attempts.${wait}`, fields: {}, code: 'RATE_LIMITED' };
  }
  if (res.status === 401 && data.code === 'INVALID_CREDENTIALS') {
    return { banner: 'Incorrect email or password. Please check your details and try again.', fields: {}, code: 'INVALID_CREDENTIALS' };
  }
  if (res.status === 409 || data.code === 'EMAIL_EXISTS') {
    return { banner: '', fields: { email: 'An account with this email already exists.' }, code: 'EMAIL_EXISTS' };
  }
  if (res.status === 400 && data.errors && typeof data.errors === 'object') {
    return { banner: Object.keys(data.errors).length ? '' : data.message || fallback, fields: data.errors, code: 'VALIDATION_ERROR' };
  }
  if (res.status === 503 && ['EMAIL_UNAVAILABLE', 'SERVICE_UNAVAILABLE'].includes(data.code) && data.message) {
    return { banner: data.message, fields: {}, code: data.code }; // global, account-independent: safe to show verbatim
  }
  if (res.status >= 500) return { banner: 'Something went wrong on our side. Please try again in a moment.', fields: {}, code: 'SERVER' };
  return { banner: data.message || fallback, fields: {}, code: data.code || 'ERROR' };
}
