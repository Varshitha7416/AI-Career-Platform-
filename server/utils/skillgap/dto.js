// DTO mappers. Accept populated documents (lean or hydrated). Resume text and the stored job description text are
// never returned (only a 500-char preview of a pasted job description in the full view).
const DISCLAIMER = 'This is a CareerNest skill-match analysis. It compares the skills listed for the target role with your resume or entries. It is not a prediction of hiring outcome and not the result of any employer system.';
const METHOD_NOTE = 'Skill-match score (v2) is computed by fixed rules, not by AI: each listed skill is weighted (required 3, preferred 1.5, recommended 0.75, times importance high 1.5 / medium 1 / low 0.6). Resume mode: skills shown in use (a project, job or achievement) count 100%, skills only listed in a skills section or mentioned without practical use count 50%, skills not in the resume 0%. Manual mode: your chosen level counts 60% / 85% / 100% (80% when no level was given). The AI only explains gaps and may suggest extra skills for the role.';

const stripExt = (n) => String(n || '').replace(/\.[a-z0-9]+$/i, '');
const obj = (d) => (d && typeof d.toObject === 'function' ? d.toObject() : d);

const roadmapPercent = (roadmap) => {
  let total = 0; let done = 0;
  for (const s of (roadmap && roadmap.stages) || []) {
    for (const t of s.tasks || []) { total += 1; if (t.status === 'completed') done += 1; }
  }
  return total ? Math.round((done / total) * 100) : 0;
};

const toSummary = (doc, roadmap) => {
  const a = obj(doc);
  const job = a.job && a.job._id ? a.job : null;
  const resume = a.resume && a.resume._id ? a.resume : null;
  const counts = (a.score && a.score.counts) || {};
  return {
    _id: a._id,
    title: a.title,
    mode: a.mode,
    basis: a.basis,
    targetKind: a.targetKind,
    targetRole: a.targetRole,
    score: { value: a.score ? a.score.value : 0, method: (a.score && a.score.method) || 'v1' },
    counts: {
      matched: counts.matched || 0, partial: counts.partial || 0, missing: counts.missing || 0,
      required: counts.required || 0, preferred: counts.preferred || 0,
    },
    job: job ? { _id: job._id, title: job.title, company: (job.company && job.company.name) || (a.jobSnapshot && a.jobSnapshot.company) || '' } : null,
    jobDeleted: a.targetKind === 'job' && !job,
    resume: resume ? { _id: resume._id, name: resume.name || stripExt(resume.fileName) } : null,
    resumeDeleted: a.mode === 'resume' && !resume,
    resumeSnapshot: a.resumeSnapshot || null,
    jobSnapshot: a.jobSnapshot || null,
    hasRoadmap: !!roadmap,
    roadmapId: roadmap ? roadmap._id : null,
    roadmapPercent: roadmap ? roadmapPercent(roadmap) : null,
    createdAt: a.createdAt,
  };
};

const toFull = (doc, roadmap) => {
  const a = obj(doc);
  const jd = a.jobDescriptionText || '';
  const input = a.input || {};
  return {
    ...toSummary(a, roadmap),
    input: {
      manualSkills: input.manualSkills || [],
      experienceYears: input.experienceYears ?? null,
      education: input.education || '',
      domain: input.domain || '',
      projects: input.projects || '',
      goals: input.goals || '',
    },
    requirements: a.requirements || [],
    result: a.result || null,
    score: a.score || null,
    jobDescriptionProvided: !!jd,
    jobDescriptionPreview: jd.slice(0, 500),
    disclaimer: DISCLAIMER,
    methodNote: METHOD_NOTE,
  };
};

module.exports = { toSummary, toFull, roadmapPercent, DISCLAIMER, METHOD_NOTE };
