// Requirement list = what the target role needs. Built from job fields (deterministic) plus validated AI additions.
const { dedupeSkills } = require('./skills');

const KIND_W = { required: 3, preferred: 1.5, recommended: 0.75 };
const IMPORTANCE_W = { high: 1.5, medium: 1, low: 0.6 };
const MAX_REQUIREMENTS = 40;
const MAX_AI_ADDED = 12;
const MIN_EXPLICIT = 6; // below this many explicit skills, typical role skills may supplement

const weightOf = (req) => (KIND_W[req.kind] || 0) * (IMPORTANCE_W[req.importance] || 1);

// job.skills -> required, job.preferredSkills -> preferred (both source 'job-field', importance 'medium').
const buildJobFieldRequirements = (job) => {
  if (!job) return [];
  const out = [];
  const seen = new Set();
  const add = (list, kind) => {
    for (const s of dedupeSkills(list)) {
      if (seen.has(s.key) || out.length >= MAX_REQUIREMENTS) continue;
      seen.add(s.key);
      out.push({ skill: s.name, key: s.key, kind, importance: 'medium', source: 'job-field' });
    }
  };
  add(job.skills, 'required');
  add(job.preferredSkills, 'preferred');
  return out;
};

// Appends extras that are not already present (by key); base entries always win.
const mergeRequirements = (base, extras) => {
  const out = [...base];
  const seen = new Set(base.map((r) => r.key));
  for (const r of extras) {
    if (seen.has(r.key) || out.length >= MAX_REQUIREMENTS) continue;
    seen.add(r.key);
    out.push(r);
  }
  return out;
};

module.exports = { KIND_W, IMPORTANCE_W, MAX_REQUIREMENTS, MAX_AI_ADDED, MIN_EXPLICIT, weightOf, buildJobFieldRequirements, mergeRequirements };
