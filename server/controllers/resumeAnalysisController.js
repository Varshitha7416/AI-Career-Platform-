const crypto = require('crypto');
const Resume = require('../models/Resume');
const Job = require('../models/Job');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const { isValidId } = require('../middleware/validate');
const { sendAiError, buildJobInput } = require('../middleware/aiLimiter');
const { cleanResumeText } = require('../utils/resumeExtract');
const { snapshotOf } = require('./resumeController');

const DISCLAIMER = 'This is a CareerNest AI-generated assessment of your resume. It is not the result of any employer\'s applicant tracking system (ATS) and does not predict hiring outcomes.';
const REUSE_WINDOW_MS = 10 * 60 * 1000;

const jobPopulate = { path: 'job', select: 'title jobCode company', populate: { path: 'company', select: 'name' } };
const resumePopulate = { path: 'resume', select: 'name fileName fileType' };

const stripExt = (n) => String(n || '').replace(/\.[a-z0-9]+$/i, '');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

const clampScore = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null;
};
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));

// Flat legacy fields mirrored from the structured result.
const flatten = (result) => ({
  missingSkills: arr(result.missingSkills).map((s) => str(s && s.skill)).filter(Boolean),
  strengths: arr(result.strengths).map((s) => str(s && s.point)).filter(Boolean),
  suggestions: arr(result.suggestions)
    .map((s) => (s && s.title ? (s.detail ? `${s.title}: ${s.detail}` : s.title) : ''))
    .filter(Boolean),
});

const toSummary = (a) => {
  const r = a.resume && a.resume._id ? a.resume : null;
  const j = a.job && a.job._id ? a.job : null;
  return {
    _id: a._id,
    type: a.type || (a.job ? 'job-specific' : 'general'),
    resume: r ? { _id: r._id, name: r.name || stripExt(r.fileName), fileName: r.fileName, fileType: r.fileType || (/\.([a-z0-9]+)$/i.exec(r.fileName || '') || [])[1] || null } : null,
    resumeSnapshot: a.resumeSnapshot || null,
    resumeDeleted: !r,
    job: j ? { _id: j._id, title: j.title, jobCode: j.jobCode || null, company: j.company ? { _id: j.company._id, name: j.company.name } : null } : null,
    jobSnapshot: a.jobSnapshot || null,
    jobDeleted: !j && (!!a.populated('job') || !!(a.jobSnapshot && !a.jobSnapshot.manual)),
    overallScore: a.overallScore ?? null,
    matchPercentage: a.matchPercentage ?? null,
    summary: a.summary || null,
    createdAt: a.createdAt,
  };
};

const toFull = (a) => ({
  ...toSummary(a),
  result: a.result || null,
  missingSkills: a.missingSkills || [],
  strengths: a.strengths || [],
  suggestions: a.suggestions || [],
});

const load = (filter) => ResumeAnalysis.findOne(filter).populate(resumePopulate).populate(jobPopulate);

const analyzeResume = async (req, res, next) => {
  try {
    const { resumeId, jobId } = req.body || {};
    if (!isValidId(resumeId)) return res.status(400).json({ message: 'A valid resumeId is required' });
    if (jobId !== undefined && jobId !== null && jobId !== '' && !isValidId(jobId)) {
      return res.status(400).json({ message: 'Invalid jobId' });
    }
    const hasJob = !!jobId;

    const resume = await Resume.findOne({ _id: resumeId, user: req.user.id });
    if (!resume) return res.status(404).json({ message: 'Resume not found' });

    let job = null;
    if (hasJob) {
      job = await Job.findById(jobId).populate('company', 'name');
      if (!job) return res.status(404).json({ message: 'Job not found' });
    }

    const inputHash = sha(`${resume._id}|${job ? job._id : ''}|${sha(cleanResumeText(resume.resumeText))}|${job ? sha(buildJobInput(job).description + job.updatedAt) : ''}`);

    // Reuse an identical analysis from the last 10 minutes instead of calling the AI again.
    const existing = await load({ user: req.user.id, inputHash, createdAt: { $gte: new Date(Date.now() - REUSE_WINDOW_MS) } }).sort({ createdAt: -1 });
    if (existing) {
      return res.status(200).json({ message: 'Showing your recent identical analysis', analysis: toFull(existing), reused: true });
    }

    let ai;
    try {
      // Lazy: the AI layer is owned by another module and only needed on this path.
      const { analyzeResumeWithAI } = require('../utils/ai/resumeAnalysis');
      if (req.consumeAiCall) req.consumeAiCall();
      ai = await analyzeResumeWithAI({ resumeText: cleanResumeText(resume.resumeText), job: job ? buildJobInput(job) : null });
    } catch (err) {
      if (sendAiError(res, err)) return;
      throw err;
    }

    if (!ai || typeof ai.result !== 'object' || ai.result === null || Array.isArray(ai.result)) {
      return res.status(502).json({ message: 'The AI returned an unusable response. Please try again.', code: 'AI_BAD_RESPONSE' });
    }
    const overallScore = clampScore(ai.overallScore ?? ai.result.overallScore);
    if (overallScore === null) {
      return res.status(502).json({ message: 'The AI returned an unusable response. Please try again.', code: 'AI_BAD_RESPONSE' });
    }
    const matchPercentage = job ? clampScore(ai.matchPercentage ?? ai.result.matchPercentage) : null;

    const result = { ...ai.result, overallScore, matchPercentage, disclaimer: DISCLAIMER };
    const created = await ResumeAnalysis.create({
      user: req.user.id,
      resume: resume._id,
      job: job ? job._id : undefined,
      type: job ? 'job-specific' : 'general',
      resumeSnapshot: snapshotOf(resume),
      jobSnapshot: job ? { title: job.title, company: job.company?.name || '', jobCode: job.jobCode, manual: false } : undefined,
      overallScore,
      matchPercentage,
      summary: str(result.summary).slice(0, 2000),
      result,
      inputHash,
      ...flatten(result),
    });

    const populated = await load({ _id: created._id, user: req.user.id });
    res.status(201).json({ message: 'Analysis complete', analysis: toFull(populated) });
  } catch (error) {
    next(error);
  }
};

const getAnalyses = async (req, res, next) => {
  try {
    const { resumeId, jobId, type } = req.query;
    const and = [{ user: req.user.id }];
    if (resumeId !== undefined) {
      if (!isValidId(resumeId)) return res.status(400).json({ message: 'Invalid resumeId' });
      and.push({ resume: resumeId });
    }
    if (jobId !== undefined) {
      if (!isValidId(jobId)) return res.status(400).json({ message: 'Invalid jobId' });
      and.push({ job: jobId });
    }
    if (type !== undefined) {
      if (type === 'general') and.push({ $or: [{ type: 'general' }, { type: null, job: null }] });
      else if (type === 'job-specific') and.push({ $or: [{ type: 'job-specific' }, { type: null, job: { $ne: null } }] });
      else return res.status(400).json({ message: 'type must be general or job-specific' });
    }
    let limit = 50;
    if (req.query.limit !== undefined) {
      limit = parseInt(req.query.limit, 10);
      if (!Number.isFinite(limit) || limit < 1) return res.status(400).json({ message: 'Invalid limit' });
      limit = Math.min(limit, 100);
    }

    let page = 1;
    if (req.query.page !== undefined) {
      page = parseInt(req.query.page, 10);
      if (!Number.isFinite(page) || page < 1) return res.status(400).json({ message: 'Invalid page' });
    }

    const filter = { $and: and };
    const [analyses, total] = await Promise.all([
      ResumeAnalysis.find(filter)
        .select('-result -inputHash')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(resumePopulate)
        .populate(jobPopulate),
      ResumeAnalysis.countDocuments(filter),
    ]);

    // count/analyses are the original contract; total/page/pages are additive (pagination beyond the first page).
    res.status(200).json({ count: analyses.length, total, page, pages: Math.max(Math.ceil(total / limit), 1), analyses: analyses.map(toSummary) });
  } catch (error) {
    next(error);
  }
};

const getAnalysisById = async (req, res, next) => {
  try {
    const analysis = await load({ _id: req.params.id, user: req.user.id });
    if (!analysis) return res.status(404).json({ message: 'Analysis not found' });
    res.status(200).json({ analysis: toFull(analysis) });
  } catch (error) {
    next(error);
  }
};

const deleteAnalysis = async (req, res, next) => {
  try {
    const deleted = await ResumeAnalysis.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deleted) return res.status(404).json({ message: 'Analysis not found' });
    res.status(200).json({ message: 'Analysis deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { analyzeResume, getAnalyses, getAnalysisById, deleteAnalysis, toSummary, toFull, load };
