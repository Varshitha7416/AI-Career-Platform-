// Pure comparison of two saved resume analyses (docs/30). Compares only what is comparable and returns
// human-readable `notes` explaining every difference or limitation. Works on the full analysis DTO (controller toFull()).

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const hasTarget = (a) => !!((a.job && a.job.title) || (a.jobSnapshot && a.jobSnapshot.title));
const kindOf = (a) => (a.type === 'job-specific' || a.type === 'general' ? a.type : hasTarget(a) || a.job ? 'job-specific' : 'general');

const targetLabel = (a) => {
  const j = a.job && a.job.title ? { title: a.job.title, company: a.job.company && a.job.company.name } : a.jobSnapshot;
  if (!j || !j.title) return 'General analysis';
  return j.company ? `${j.title} - ${j.company}` : j.title;
};

const resumeLabel = (a) => (a.resume && (a.resume.name || a.resume.fileName))
  || (a.resumeSnapshot && (a.resumeSnapshot.name || a.resumeSnapshot.fileName)) || 'Resume';

const scoreOf = (a) => num(a.overallScore) ?? num(a.result && a.result.overallScore);

// Case-insensitive set difference that keeps the original display text.
const diffLists = (before, after) => {
  const mapOf = (l) => {
    const m = new Map();
    (l || []).forEach((x) => { const k = norm(x); if (k && !m.has(k)) m.set(k, String(x).trim()); });
    return m;
  };
  const b = mapOf(before);
  const a = mapOf(after);
  return {
    added: [...a.entries()].filter(([k]) => !b.has(k)).map(([, v]) => v),
    removed: [...b.entries()].filter(([k]) => !a.has(k)).map(([, v]) => v),
    unchanged: [...a.entries()].filter(([k]) => b.has(k)).map(([, v]) => v),
  };
};

const matchedSkills = (a) => (a.result && Array.isArray(a.result.matchingSkills)
  ? a.result.matchingSkills.map((s) => s && s.skill).filter(Boolean)
  : null);

const side = (a) => ({
  _id: a._id,
  createdAt: a.createdAt,
  type: kindOf(a),
  target: targetLabel(a),
  resume: resumeLabel(a),
  resumeDeleted: !!a.resumeDeleted,
  jobDeleted: !!a.jobDeleted,
  overallScore: scoreOf(a),
  matchPercentage: num(a.matchPercentage),
});

const sameTarget = (a, b) => {
  const ja = a.job && a.job._id ? String(a.job._id) : null;
  const jb = b.job && b.job._id ? String(b.job._id) : null;
  if (ja && jb) return ja === jb;
  return kindOf(a) === kindOf(b) && norm(targetLabel(a)) === norm(targetLabel(b));
};

// `a` is the baseline, `b` the analysis compared to it: every delta is b - a.
const compareAnalyses = (a, b) => {
  const notes = [];
  const sa = side(a);
  const sb = side(b);

  const scoreDelta = sa.overallScore !== null && sb.overallScore !== null ? sb.overallScore - sa.overallScore : null;
  if (scoreDelta === null) notes.push('At least one analysis has no readiness score, so the score change cannot be calculated.');

  let matchDelta = null;
  if (sa.matchPercentage !== null && sb.matchPercentage !== null) matchDelta = sb.matchPercentage - sa.matchPercentage;
  else if (sa.type !== sb.type) {
    notes.push(`One analysis is ${sa.type === 'general' ? 'general' : 'job-specific'} and the other is ${sb.type === 'general' ? 'general' : 'job-specific'}. A general analysis has no job match percentage, so match scores are not compared.`);
  } else notes.push('At least one analysis has no job match percentage, so the match change is not calculated.');

  const same = sameTarget(a, b);
  if (!same) notes.push(`These analyses target different things (${sa.target} vs ${sb.target}), so changes in score and skills may reflect the target rather than improvements to your resume.`);
  if (sa.resume !== sb.resume) notes.push(`Different resumes were analysed (${sa.resume} vs ${sb.resume}).`);
  if (sa.resumeDeleted || sb.resumeDeleted) notes.push('Resume no longer available for at least one of these analyses; its saved name is shown from the analysis snapshot.');
  if (sa.jobDeleted || sb.jobDeleted) notes.push('The job for at least one of these analyses is no longer available; its saved title is shown from the analysis snapshot.');

  const strengths = diffLists(a.strengths, b.strengths);
  const missing = diffLists(a.missingSkills, b.missingSkills);
  const suggestions = diffLists(a.suggestions, b.suggestions);

  const ma = matchedSkills(a);
  const mb = matchedSkills(b);
  let matched = null;
  if (ma && mb) {
    const d = diffLists(ma, mb);
    matched = { gained: d.added, lost: d.removed, unchanged: d.unchanged };
  } else notes.push('Matched-skill details are only stored for newer analyses; at least one of these is an older format, so matched skills are not compared.');

  if (!same && sa.type === 'job-specific' && sb.type === 'job-specific') notes.push('Missing skills are measured against different jobs, so resolved and new skills are not like for like.');

  return {
    a: sa,
    b: sb,
    sameTarget: same,
    sameResume: !!(a.resume && b.resume && String(a.resume._id) === String(b.resume._id)),
    scoreDelta,
    matchDelta,
    strengths: { gained: strengths.added, lost: strengths.removed, unchanged: strengths.unchanged },
    missingSkills: { resolved: missing.removed, new: missing.added, unchanged: missing.unchanged },
    matchedSkills: matched,
    suggestions: { added: suggestions.added, removed: suggestions.removed, unchanged: suggestions.unchanged },
    notes,
  };
};

module.exports = { compareAnalyses, diffLists, kindOf, targetLabel };
