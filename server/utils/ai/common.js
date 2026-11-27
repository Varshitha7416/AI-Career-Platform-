const crypto = require('crypto');

// ---- Size caps (input) ----
const CAPS = {
  resumeText: 30000,
  jobDescription: 8000,
  jobListItem: 300,
  jobListItems: 40,
  instructions: 1500,
  userFacts: 3000,
};

const clip = (value, max) => String(value == null ? '' : value).slice(0, max);

// ---- Untrusted-data delimiting ----
// Each block gets a random per-call tag; any look-alike marker inside the data is neutralised so the
// data can never close its own block.
const newNonce = () => crypto.randomBytes(6).toString('hex').toUpperCase();

const neutralise = (text) => String(text || '').replace(/<<<|>>>/g, '< < <').replace(/\u0000/g, '');

const delimit = (label, nonce, text) =>
  `<<<BEGIN_${label}_${nonce}>>>\n${neutralise(text)}\n<<<END_${label}_${nonce}>>>`;

// ---- Normalisation / evidence verification ----
const normText = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .replace(/(?<![a-z0-9])\.|\.(?![a-z0-9])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokens = (s) => normText(s).split(' ').filter(Boolean);

const bigrams = (toks) => {
  const out = new Set();
  for (let i = 0; i < toks.length - 1; i += 1) out.add(`${toks[i]} ${toks[i + 1]}`);
  return out;
};

// True when `quote` really appears in `resumeText` (normalised substring, or >= 85% bigram overlap
// to tolerate line-wrapping / bullet differences). Very short quotes must match exactly.
const evidenceVerified = (quote, resumeText, preNorm) => {
  const q = normText(quote);
  if (!q || q.length < 3) return false;
  const hay = preNorm || normText(resumeText);
  if (hay.includes(q)) return true;
  const qt = q.split(' ');
  if (qt.length < 4) return false;
  const hayBigrams = bigrams(hay.split(' '));
  const qb = [...bigrams(qt)];
  const hit = qb.filter((b) => hayBigrams.has(b)).length;
  return hit / qb.length >= 0.85;
};

// ---- Field coercion helpers ----
const str = (v, max) => clip(typeof v === 'string' ? v : v == null ? '' : String(v), max).trim();
const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const clampScore = (v) => {
  const n = num(v);
  return n === null ? null : Math.max(0, Math.min(100, Math.round(n)));
};
const oneOf = (v, allowed, fallback) => {
  const s = String(v || '').toLowerCase().trim();
  return allowed.includes(s) ? s : fallback;
};
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const strList = (v, maxItems, maxLen) =>
  arr(v, maxItems)
    .map((x) => str(x, maxLen))
    .filter(Boolean);

// Numbers (incl. percentages / decimals) mentioned in a text, as a Set of strings like "40", "3.5".
const numbersIn = (text) => {
  const out = new Set();
  const re = /\d[\d,]*(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(String(text || '')))) out.add(m[0].replace(/,/g, ''));
  return out;
};

module.exports = {
  CAPS,
  clip,
  newNonce,
  neutralise,
  delimit,
  normText,
  evidenceVerified,
  str,
  num,
  clampScore,
  oneOf,
  arr,
  strList,
  numbersIn,
};
