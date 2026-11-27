// Builds contract "Summary" DTOs for analyses with a constant number of queries (no N+1).
// Same shape as utils/skillgap/dto.js toSummary (contract section 5), built with a constant number of queries. A test in
// tests/skillgap/skillgap.api.test.js asserts both builders return identical objects, so they cannot drift apart.
const Job = require('../../models/Job');
const Resume = require('../../models/Resume');
const LearningRoadmap = require('../../models/LearningRoadmap');
const { roadmapProgress } = require('./progress');

const stripExt = (n) => String(n || '').replace(/\.[a-z0-9]+$/i, '');
const idStr = (v) => (v ? String(v) : null);

// analyses: lean SkillGapAnalysis docs. roadmaps (optional): already loaded lean roadmaps for these analyses.
const summarize = async (analyses, userId, roadmaps) => {
  if (!analyses.length) return [];
  const jobIds = [...new Set(analyses.map((a) => idStr(a.job)).filter(Boolean))];
  const resumeIds = [...new Set(analyses.map((a) => idStr(a.resume)).filter(Boolean))];
  const [jobs, resumes, rms] = await Promise.all([
    jobIds.length ? Job.find({ _id: { $in: jobIds } }).select('title company').populate('company', 'name').lean() : [],
    resumeIds.length ? Resume.find({ _id: { $in: resumeIds }, user: userId }).select('name fileName').lean() : [],
    roadmaps || LearningRoadmap.find({ user: userId, analysis: { $in: analyses.map((a) => a._id) } }).lean(),
  ]);
  const jobById = new Map(jobs.map((j) => [String(j._id), j]));
  const resumeById = new Map(resumes.map((r) => [String(r._id), r]));
  const roadmapByAnalysis = new Map(rms.map((r) => [String(r.analysis), r]));

  return analyses.map((a) => {
    const j = a.job ? jobById.get(String(a.job)) : null;
    const r = a.resume ? resumeById.get(String(a.resume)) : null;
    const rm = roadmapByAnalysis.get(String(a._id));
    const c = (a.score && a.score.counts) || {};
    return {
      _id: a._id, title: a.title, mode: a.mode, basis: a.basis, targetKind: a.targetKind, targetRole: a.targetRole,
      score: { value: a.score ? a.score.value : 0, method: (a.score && a.score.method) || 'v1' },
      counts: { matched: c.matched || 0, partial: c.partial || 0, missing: c.missing || 0, required: c.required || 0, preferred: c.preferred || 0 },
      job: j ? { _id: j._id, title: j.title, company: (j.company && j.company.name) || (a.jobSnapshot && a.jobSnapshot.company) || '' } : null,
      jobDeleted: a.targetKind === 'job' && !j,
      resume: r ? { _id: r._id, name: r.name || stripExt(r.fileName) } : null,
      resumeDeleted: a.mode === 'resume' && !r,
      resumeSnapshot: a.resumeSnapshot || null,
      jobSnapshot: a.jobSnapshot || null,
      hasRoadmap: !!rm,
      roadmapId: rm ? rm._id : null,
      roadmapPercent: rm ? roadmapProgress(rm).percent : null,
      createdAt: a.createdAt,
    };
  });
};

module.exports = { summarize };
