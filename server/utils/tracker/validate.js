// Small validators shared by the application tracker and interview endpoints (docs/29).
const CLOCK_SKEW_MS = 60 * 1000;
const MAX_AHEAD_MS = 3 * 365 * 86400000;

const isBlank = (v) => v === undefined || v === null || v === '';

// Parses a date; returns { value: Date|null, error?: string }. `null`/'' means "clear".
function parseDate(v, label) {
  if (v === null || v === '') return { value: null };
  if (typeof v !== 'string' && typeof v !== 'number') return { error: `${label} must be a valid date` };
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return { error: `${label} must be a valid date` };
  if (d.getTime() > Date.now() + MAX_AHEAD_MS) return { error: `${label} is too far in the future` };
  return { value: d };
}

// Text with a length limit; null/'' clears. Returns { value: string|null } or { error }.
function parseText(v, label, max) {
  if (v === null) return { value: null };
  if (typeof v !== 'string') return { error: `${label} must be text` };
  const t = v.trim();
  if (t.length > max) return { error: `${label} must be ${max} characters or fewer` };
  return { value: t || null };
}

// http(s) only, parsed with URL (no javascript:, data:, etc.), max length, no credentials.
function parseHttpUrl(v, label, max = 500) {
  if (v === null || v === '') return { value: null };
  if (typeof v !== 'string') return { error: `${label} must be a link` };
  const t = v.trim();
  if (!t) return { value: null };
  if (t.length > max) return { error: `${label} must be ${max} characters or fewer` };
  let u;
  try { u = new URL(t); } catch { return { error: `${label} must be a valid http(s) link` }; }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return { error: `${label} must be a valid http(s) link` };
  return { value: t };
}

module.exports = { CLOCK_SKEW_MS, MAX_AHEAD_MS, isBlank, parseDate, parseText, parseHttpUrl };
