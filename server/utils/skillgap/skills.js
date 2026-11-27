// Skill normalisation + dedupe. Identity = skillSynonyms.canonicalKey; display = canonicalName.
// Unknown (custom) skills are kept as typed (whitespace collapsed); the key is "s:<lowercased name>".
const { canonicalKey, canonicalName } = require('../ai/skillSynonyms');

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const RANK = { beginner: 1, intermediate: 2, advanced: 3 };
const NAME_MAX = 80;

const cleanName = (raw) => String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

const asLevel = (v) => {
  const s = String(v || '').toLowerCase().trim();
  return LEVELS.includes(s) ? s : undefined;
};

// list: strings or {name, level?}. Returns [{name, key, level?}] in first-seen order; aliases/duplicates merged,
// keeping the highest EXPLICIT level (a level is never invented).
const dedupeSkills = (list) => {
  const out = [];
  const byKey = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    const raw = item && typeof item === 'object' ? item.name : item;
    const name = cleanName(raw);
    if (!name) continue;
    const key = canonicalKey(name);
    const level = item && typeof item === 'object' ? asLevel(item.level) : undefined;
    const existing = byKey.get(key);
    if (existing) {
      if (level && (!existing.level || RANK[level] > RANK[existing.level])) existing.level = level;
      continue;
    }
    const entry = { name: canonicalName(name), key };
    if (level) entry.level = level;
    byKey.set(key, entry);
    out.push(entry);
  }
  return out;
};

module.exports = { LEVELS, RANK, NAME_MAX, cleanName, asLevel, dedupeSkills };
