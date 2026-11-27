// Pure comparison of two saved analyses (older = baseline, newer = latest).
const { canonicalKey } = require('../ai/skillSynonyms');

const keyOf = (i) => i.key || canonicalKey(i.skill);
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const idOf = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);

const sameTargetOf = (a, b) => {
  const ja = idOf(a.job); const jb = idOf(b.job);
  if (ja || jb) return !!ja && ja === jb;
  return norm(a.targetRole) === norm(b.targetRole);
};

const compareAnalyses = (x, y) => {
  // oldest first
  const [a, b] = new Date(x.createdAt) <= new Date(y.createdAt) ? [x, y] : [y, x];
  const same = sameTargetOf(a, b);
  const notes = [];
  let warning = null;
  const res = { a, b, sameTarget: same, comparable: true, warning, scoreDelta: null, newlySkills: [], stillMissing: [], resolvedMissing: [], needsImprovement: [], notes };

  if (!same) {
    res.warning = 'These analyses are for different targets (role or job), so their scores and skill lists are not directly comparable. Showing them side by side only.';
    notes.push('Skill-by-skill changes are not shown because the targets differ.');
  } else {
    const r = (t) => t.result || {};
    const aMatched = new Set((r(a).matched || []).map(keyOf));
    const aMissing = new Map((r(a).missing || []).map((m) => [keyOf(m), m]));
    const bMatched = (r(b).matched || []);
    const bMatchedKeys = new Set(bMatched.map(keyOf));
    res.newlySkills = bMatched.filter((m) => !aMatched.has(keyOf(m))).map((m) => ({ skill: m.skill }));
    res.resolvedMissing = [...aMissing.entries()].filter(([key]) => bMatchedKeys.has(key)).map(([, m]) => ({ skill: m.skill }));
    res.stillMissing = (r(b).missing || []).filter((m) => aMissing.has(keyOf(m))).map((m) => ({ skill: m.skill, priority: m.priority || m.importance || 'medium' }));
    res.needsImprovement = (r(b).partial || []).map((p) => ({ skill: p.skill }));
    const sa = a.score && a.score.value; const sb = b.score && b.score.value;
    res.scoreDelta = typeof sa === 'number' && typeof sb === 'number' ? sb - sa : null;
    if (a.targetKind !== b.targetKind || (a.requirements || []).length !== (b.requirements || []).length) {
      notes.push('The two analyses used different requirement lists, so some of the difference may come from the requirements rather than from your skills.');
    }
  }
  if (a.basis !== b.basis) {
    notes.push('The analyses use different bases (resume-verified vs self-reported skills), so scores are not like-for-like.');
  }
  const ma = (a.score && a.score.method) || 'v1'; const mb = (b.score && b.score.method) || 'v1';
  if (ma !== mb && a.basis === 'resume-verified' && b.basis === 'resume-verified') {
    notes.push('These analyses used different resume rules: the older one counted a skill that was only listed as matched, the newer one counts it as partial. Part of the score difference may come from that rule change rather than from your skills.');
  }
  if (String(a._id) === String(b._id)) notes.push('You selected the same analysis twice.');
  res.warning = res.warning || null;
  return res;
};

module.exports = { compareAnalyses, sameTargetOf };
