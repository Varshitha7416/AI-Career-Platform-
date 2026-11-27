// Matches real Career Programs (the Program collection) to skill keys. Never invents programs.
const { canonicalKey } = require('../ai/skillSynonyms');

const LEVEL_RANK = { Beginner: 0, Intermediate: 1, Advanced: 2 };

const programKeys = (program) => new Set((program.skills || []).map((s) => canonicalKey(s)));

// programs: plain objects with skills[]. Returns Map(skillKey -> [program...]) best first.
// partialKeys: skills the learner already partly shows prefer deeper programs; brand-new skills prefer beginner ones.
const indexByKey = (programs, skillKeys, partialKeys = new Set()) => {
  const withKeys = programs.map((p) => ({ p, keys: programKeys(p) }));
  const out = new Map();
  skillKeys.forEach((key) => {
    const hits = withKeys.filter((x) => x.keys.has(key)).map((x) => x.p);
    hits.sort((a, b) => {
      const d = (LEVEL_RANK[a.level] ?? 0) - (LEVEL_RANK[b.level] ?? 0);
      return (partialKeys.has(key) ? -d : d) || String(a.title).localeCompare(String(b.title));
    });
    out.set(key, hits);
  });
  return out;
};

const toResource = (p) => ({
  type: 'program', program: p._id, title: p.title, provider: p.provider, url: p.url || undefined, duration: p.duration || undefined,
});

// Resource for a task: a catalogue program or null (never AI text, never a made-up link).
const resourceFor = (hits) => (hits && hits.length ? toResource(hits[0]) : null);

module.exports = { indexByKey, resourceFor, toResource, programKeys };
