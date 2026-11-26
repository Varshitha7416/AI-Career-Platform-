// Skill Gap orchestrator: requirement list -> ONE AI call (wording + extra requirements) ->
// strict validation -> deterministic classification and scoring (the AI never classifies or scores). deps.generateJSON / deps.consume are injectable.
const gemini = require('../../config/gemini');
const { clip, CAPS } = require('../ai/common');
const { buildJobFieldRequirements, mergeRequirements, weightOf } = require('./requirements');
const { classifyResume, classifyManual, computeScore } = require('./matcher');
const { buildPrompt } = require('./prompt');
const { validateAiOutput } = require('./validate');

const noRequirements = () => {
  const e = new Error('We could not determine which skills this role needs. Choose a job, or paste a job description with a few required skills, and try again.');
  e.status = 422;
  e.code = 'NO_REQUIREMENTS';
  return e;
};

const byWeight = (a, b) => weightOf(b.req) - weightOf(a.req);

const partialReason = (i) => (i.mention === 'skills-list'
  ? `${i.req.skill} is listed in your skills section, but no project, job or achievement in the resume shows how you used it.`
  : `${i.req.skill} is mentioned in your resume, but the resume does not describe practical use of it.`);

const defaultWhy = (req, mode) => (mode === 'resume'
  ? `${req.skill} is listed as ${req.kind} for this role and no sign of it was found in your resume.`
  : `${req.skill} is listed as ${req.kind} for this role and was not among the skills you entered.`);

// Job text used for grounding AI-extracted skills.
const jobTextOf = (job, jdText) => {
  const parts = [];
  if (job) {
    parts.push(job.description || '');
    for (const k of ['requirements', 'responsibilities']) parts.push((job[k] || []).join('\n'));
  }
  if (jdText) parts.push(jdText);
  return clip(parts.filter(Boolean).join('\n'), CAPS.jobDescription * 2);
};

const buildSummary = (aiSummary, score, mode, counts) => {
  if (aiSummary) return aiSummary;
  const basis = mode === 'resume' ? 'resume' : 'entered skills';
  return `Your ${basis} cover ${counts.matched} of ${counts.matched + counts.partial + counts.missing} listed skills`
    + `${counts.partial ? ` (${counts.partial} only partly)` : ''}; ${counts.missing} are not yet shown.`;
};

const scoreExplanation = (score, mode, total) => {
  const rule = mode === 'resume'
    ? 'Skills shown in use (a project, job or achievement sentence) count fully; skills you only list in a skills section, or merely mention, count half; skills not in the resume count zero.'
    : 'Skills you entered count by the level you chose (beginner 60%, intermediate 85%, advanced 100%, no level 80% of the skill\'s weight); skills you did not list count zero.';
  const cov = [
    score.requiredCoverage !== null ? `required skills ${score.requiredCoverage}%` : null,
    score.preferredCoverage !== null ? `preferred skills ${score.preferredCoverage}%` : null,
  ].filter(Boolean).join(', ');
  return `Skill-match score ${score.value}/100 across ${total} listed skills (weighted: required 3x, preferred 1.5x, recommended 0.75x; high importance 1.5x, low 0.6x). ${rule}${cov ? ` Coverage: ${cov}.` : ''} Not a prediction of hiring outcome.`.slice(0, 1500);
};

/*
 input: { mode:'resume'|'manual', targetKind, targetRole, job:{title,company,description,requirements,responsibilities,skills,preferredSkills}|null,
          jobDescriptionText, resumeText, manual:{skills:[{name,key,level?}], experienceYears, education, domain, projects, goals} }
 returns { requirements, result, score, corrections, dropped }
*/
const analyse = async (input, deps = {}) => {
  const generateJSON = deps.generateJSON || gemini.generateJSON;
  const { mode, targetKind, targetRole, job, jobDescriptionText } = input;
  const manualSkills = (input.manual && input.manual.skills) || [];

  const baseReqs = buildJobFieldRequirements(job);
  const jdText = jobTextOf(job, jobDescriptionText);

  const prompt = buildPrompt({
    mode, targetRole, jobTitle: job && job.title, company: job && job.company, jdText, baseReqs,
    resumeText: input.resumeText, manual: input.manual,
  });

  if (deps.consume) deps.consume(); // counts against the hourly AI limit only when a real call is made
  const raw = await generateJSON(prompt, { temperature: 0.2 });

  const ai = validateAiOutput(raw, { mode, resumeText: input.resumeText, jdText, baseReqs, targetKind });
  const requirements = mergeRequirements(baseReqs, ai.extraReqs);
  if (!requirements.length) throw noRequirements();

  // ---- deterministic classification ----
  const items = mode === 'resume' ? classifyResume(requirements, input.resumeText) : classifyManual(requirements, manualSkills);
  const corrections = [];
  for (const it of items) {
    const a = ai.assessments.get(it.req.key);
    if (!a) continue;
    // The AI never decides a classification (matched / partial / missing) or the score: it only supplies wording.
    if (a.status === 'missing' && it.status !== 'missing') corrections.push(it.req.key); // AI said missing, the resume shows it: ignored
    it.ai = a;
  }

  const score = computeScore(items, mode);

  const matched = items.filter((i) => i.status === 'matched').sort(byWeight).map((i) => ({
    skill: i.req.skill, key: i.req.key, kind: i.req.kind, category: (i.ai && i.ai.category) || i.req.category,
    source: mode === 'resume' ? 'resume' : 'manual',
    ...(mode === 'resume' ? { evidence: i.evidence } : {}),
    ...(mode === 'manual' && i.level ? { level: i.level } : {}),
  }));
  const partial = items.filter((i) => i.status === 'partial').sort(byWeight).map((i) => ({
    skill: i.req.skill, key: i.req.key, kind: i.req.kind, importance: i.req.importance,
    mention: i.mention || 'mention',
    evidence: i.evidence,
    // The reason is deterministic (it states what the resume does and does not show); only the suggestion may be AI wording.
    reason: partialReason(i),
    suggestion: (i.ai && i.ai.suggestion) || `Add a concrete example showing how you used ${i.req.skill}, if that is true for you.`,
  }));
  const missing = items.filter((i) => i.status === 'missing').sort(byWeight).map((i) => ({
    skill: i.req.skill, key: i.req.key, kind: i.req.kind, importance: i.req.importance,
    priority: (i.ai && i.ai.priority) || i.req.importance,
    why: (i.ai && (i.ai.why || i.ai.reason)) || defaultWhy(i.req, mode),
    category: (i.ai && i.ai.category) || i.req.category,
  }));

  let additional = ai.additional;
  if (mode === 'manual') {
    const reqKeys = new Set(requirements.map((r) => r.key));
    additional = manualSkills.filter((s) => !reqKeys.has(s.key)).slice(0, 30)
      .map((s) => ({ skill: s.name, key: s.key, note: s.level ? `Self-reported (${s.level})` : 'Self-reported' }));
  }

  const priorities = { high: [], medium: [], low: [] };
  for (const m of missing) priorities[m.priority].push(m.skill);
  for (const p of partial) priorities[p.importance].push(p.skill);
  for (const k of Object.keys(priorities)) priorities[k] = [...new Set(priorities[k])];

  const result = {
    matched, partial, missing, additional, priorities,
    summary: buildSummary(ai.summary, score, mode, score.counts),
    scoreExplanation: scoreExplanation(score, mode, requirements.length),
  };
  return { requirements, result, score, corrections, dropped: ai.dropped };
};

module.exports = { analyse, jobTextOf, scoreExplanation, noRequirements };
