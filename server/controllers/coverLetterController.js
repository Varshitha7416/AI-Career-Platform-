const Resume = require('../models/Resume');
const Job = require('../models/Job');
const User = require('../models/User');
const CoverLetter = require('../models/CoverLetter');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const { isValidId } = require('../middleware/validate');
const { sendAiError, buildJobInput } = require('../middleware/aiLimiter');
const { cleanResumeText } = require('../utils/resumeExtract');
const { snapshotOf } = require('./resumeController');
const { toPdfBuffer, toDocxBuffer, buildFileName } = require('../utils/coverLetterExport');

const MAX_TEXT = 12000;
const MAX_VERSIONS = 25;
const TONES = ['professional', 'confident', 'concise'];
const LENGTHS = ['standard', 'detailed'];

const jobPopulate = { path: 'job', select: 'title jobCode company', populate: { path: 'company', select: 'name' } };
const resumePopulate = { path: 'resume', select: 'name fileName fileType' };
const stripExt = (n) => String(n || '').replace(/\.[a-z0-9]+$/i, '');

const fail = (res, status, message, code) => res.status(status).json(code ? { message, code } : { message });

// ---- versions -------------------------------------------------------------

// Legacy letters only have generatedText: materialise it as version 1 before any change.
const ensureVersions = (c) => {
  if ((!c.versions || c.versions.length === 0) && c.generatedText) {
    c.versions = [{ number: 1, text: c.generatedText, source: 'ai', createdAt: c.createdAt || new Date() }];
  }
};

const pushVersion = (c, text, source) => {
  ensureVersions(c);
  const last = c.versions.length ? c.versions[c.versions.length - 1].number : 0;
  c.versions.push({ number: last + 1, text, source, createdAt: new Date() });
  while (c.versions.length > MAX_VERSIONS) c.versions.splice(1, 1); // drop oldest non-first
  c.currentText = text;
};

const effectiveText = (c) => (c.currentText ?? c.generatedText ?? '');

const latestAiText = (c) => {
  const vs = c.versions || [];
  for (let i = vs.length - 1; i >= 0; i--) {
    if (vs[i].source === 'ai' || vs[i].source === 'regeneration') return vs[i].text;
  }
  return c.generatedText ?? '';
};

// ---- DTO ------------------------------------------------------------------

const toDTO = (c, { full = false } = {}) => {
  const r = c.resume && c.resume._id ? c.resume : null;
  const j = c.job && c.job._id ? c.job : null;
  const versions = (c.versions && c.versions.length)
    ? c.versions
    : (c.generatedText ? [{ number: 1, text: c.generatedText, source: 'ai', createdAt: c.createdAt }] : []);
  const currentText = effectiveText(c);
  return {
    _id: c._id,
    resume: r ? { _id: r._id, name: r.name || stripExt(r.fileName), fileName: r.fileName, fileType: r.fileType || (/\.([a-z0-9]+)$/i.exec(r.fileName || '') || [])[1] || null } : null,
    resumeSnapshot: c.resumeSnapshot || null,
    resumeDeleted: !r,
    job: j ? { _id: j._id, title: j.title, jobCode: j.jobCode || null, company: j.company ? { _id: j.company._id, name: j.company.name } : null } : null,
    jobSnapshot: c.jobSnapshot || null,
    jobDeleted: !j && (!!c.populated('job') || !!(c.jobSnapshot && !c.jobSnapshot.manual)),
    analysis: c.analysis ? (c.analysis._id || c.analysis) : null,
    options: c.options || {},
    generatedText: c.generatedText ?? null,
    currentText,
    currentVersion: versions.length ? versions[versions.length - 1].number : 1,
    hasEdits: currentText !== latestAiText(c),
    editedAt: c.editedAt || null,
    groundingWarnings: c.groundingWarnings || [],
    needsInfo: c.needsInfo || [],
    versions: full
      ? versions.map((v) => ({ number: v.number, text: v.text, source: v.source, createdAt: v.createdAt }))
      : versions.map((v) => ({ number: v.number, source: v.source, createdAt: v.createdAt })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};

const load = (filter, { withManual = false } = {}) => {
  let q = CoverLetter.findOne(filter).populate(resumePopulate).populate(jobPopulate);
  if (withManual) q = q.select('+manualJobDescription');
  return q;
};

// ---- input validation -----------------------------------------------------

const optText = (v, max, label) => {
  if (v === undefined || v === null || v === '') return { value: undefined };
  if (typeof v !== 'string') return { error: `${label} must be text` };
  const t = v.trim();
  if (t.length > max) return { error: `${label} must be at most ${max} characters` };
  return { value: t || undefined };
};

const parseOptions = (body) => {
  const out = {};
  if (body.tone !== undefined && body.tone !== null && body.tone !== '') {
    if (!TONES.includes(body.tone)) return { error: `tone must be one of: ${TONES.join(', ')}` };
    out.tone = body.tone;
  }
  if (body.length !== undefined && body.length !== null && body.length !== '') {
    if (!LENGTHS.includes(body.length)) return { error: `length must be one of: ${LENGTHS.join(', ')}` };
    out.length = body.length;
  }
  for (const [k, max] of [['instructions', 2000], ['userFacts', 4000]]) {
    const r = optText(body[k], max, k);
    if (r.error) return { error: r.error };
    if (r.value !== undefined) out[k] = r.value;
  }
  return { options: out };
};

const insightsFrom = (analysis) => {
  if (!analysis) return null;
  const r = analysis.result;
  if (r) {
    return {
      strengths: (r.strengths || []).map((s) => s.point).filter(Boolean),
      matchingSkills: (r.matchingSkills || []).map((s) => s.skill).filter(Boolean),
      suggestions: (r.suggestions || []).map((s) => s.title).filter(Boolean),
    };
  }
  return { strengths: analysis.strengths || [], matchingSkills: [], suggestions: analysis.suggestions || [] };
};

const callAI = async (req, res, params) => {
  // Returns the AI output or null after sending the error response.
  try {
    const { generateCoverLetterWithAI } = require('../utils/ai/coverLetter');
    if (req.consumeAiCall) req.consumeAiCall();
    const out = await generateCoverLetterWithAI(params);
    const text = out && typeof out.text === 'string' ? out.text.trim() : '';
    if (!text) {
      const qs = Array.isArray(out && out.needsInfo) ? out.needsInfo.map(String).filter(Boolean).slice(0, 20) : [];
      if (qs.length) {
        res.status(422).json({
          message: 'More information is needed to write an accurate letter. Please answer the questions and try again.',
          code: 'NEEDS_INFO',
          needsInfo: qs,
        });
        return null;
      }
      fail(res, 502, 'The AI returned an unusable response. Please try again.', 'AI_BAD_RESPONSE');
      return null;
    }
    const strs = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 20) : []);
    return { text, needsInfo: strs(out.needsInfo), groundingWarnings: strs(out.groundingWarnings) };
  } catch (err) {
    if (sendAiError(res, err)) return null;
    throw err;
  }
};

// ---- handlers -------------------------------------------------------------

const generateCoverLetter = async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!isValidId(body.resumeId)) return fail(res, 400, 'A valid resumeId is required');

    const parsed = parseOptions(body);
    if (parsed.error) return fail(res, 400, parsed.error);

    const hasJobId = body.jobId !== undefined && body.jobId !== null && body.jobId !== '';
    if (hasJobId && !isValidId(body.jobId)) return fail(res, 400, 'Invalid jobId');
    if (!hasJobId && !body.manualJob) return fail(res, 400, 'Provide a jobId or a manualJob with a title and company');
    if (body.analysisId && !isValidId(body.analysisId)) return fail(res, 400, 'Invalid analysisId');

    const resume = await Resume.findOne({ _id: body.resumeId, user: req.user.id });
    if (!resume) return fail(res, 404, 'Resume not found');

    let jobDoc = null;
    let jobInput;
    let jobSnapshot;
    let manualDescription;
    if (hasJobId) {
      jobDoc = await Job.findById(body.jobId).populate('company', 'name');
      if (!jobDoc) return fail(res, 404, 'Job not found');
      jobInput = buildJobInput(jobDoc);
      jobSnapshot = { title: jobDoc.title, company: jobDoc.company?.name || '', jobCode: jobDoc.jobCode, manual: false };
    } else {
      const m = body.manualJob;
      if (typeof m !== 'object' || Array.isArray(m)) return fail(res, 400, 'manualJob must be an object');
      const title = typeof m.title === 'string' ? m.title.trim() : '';
      const company = typeof m.company === 'string' ? m.company.trim() : '';
      if (!title || !company) return fail(res, 400, 'manualJob needs a title and a company');
      if (title.length > 200 || company.length > 200) return fail(res, 400, 'manualJob title and company must be at most 200 characters');
      const d = optText(m.description, 10000, 'manualJob.description');
      if (d.error) return fail(res, 400, d.error);
      manualDescription = d.value;
      jobInput = { title, company, description: manualDescription || '', requirements: [], responsibilities: [], skills: [], preferredSkills: [], education: '', experienceLevel: undefined };
      jobSnapshot = { title, company, manual: true };
    }

    let analysis = null;
    if (body.analysisId) {
      analysis = await ResumeAnalysis.findOne({ _id: body.analysisId, user: req.user.id });
      if (!analysis) return fail(res, 404, 'Analysis not found');
      if (String(analysis.resume) !== String(resume._id)) return fail(res, 400, 'That analysis was made for a different resume. Choose the matching resume or analysis.');
      if (hasJobId && analysis.job && String(analysis.job) !== String(body.jobId)) return fail(res, 400, 'That analysis was made for a different job.');
    }
    const useAnalysis = analysis ? body.useAnalysis !== false : false;

    const user = await User.findById(req.user.id).select('name');
    const ai = await callAI(req, res, {
      resumeText: cleanResumeText(resume.resumeText),
      job: jobInput,
      candidateName: user ? user.name : '',
      tone: parsed.options.tone || 'professional',
      length: parsed.options.length || 'standard',
      instructions: parsed.options.instructions,
      userFacts: parsed.options.userFacts,
      analysisInsights: useAnalysis ? insightsFrom(analysis) : null,
      strict: false,
    });
    if (!ai) return;

    const created = await CoverLetter.create({
      user: req.user.id,
      job: jobDoc ? jobDoc._id : undefined,
      resume: resume._id,
      generatedText: ai.text,
      currentText: ai.text,
      jobSnapshot,
      resumeSnapshot: snapshotOf(resume),
      manualJobDescription: manualDescription,
      analysis: analysis ? analysis._id : undefined,
      options: { ...parsed.options, tone: parsed.options.tone || 'professional', length: parsed.options.length || 'standard', useAnalysis },
      versions: [{ number: 1, text: ai.text, source: 'ai', createdAt: new Date() }],
      groundingWarnings: ai.groundingWarnings,
      needsInfo: ai.needsInfo,
    });

    const coverLetter = await load({ _id: created._id, user: req.user.id });
    res.status(201).json({ message: 'Cover letter generated', coverLetter: toDTO(coverLetter, { full: true }) });
  } catch (error) {
    next(error);
  }
};

const getCoverLetters = async (req, res, next) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.resumeId !== undefined) {
      if (!isValidId(req.query.resumeId)) return fail(res, 400, 'Invalid resumeId');
      filter.resume = req.query.resumeId;
    }
    if (req.query.jobId !== undefined) {
      if (!isValidId(req.query.jobId)) return fail(res, 400, 'Invalid jobId');
      filter.job = req.query.jobId;
    }
    let limit = 50;
    if (req.query.limit !== undefined) {
      limit = parseInt(req.query.limit, 10);
      if (!Number.isFinite(limit) || limit < 1) return fail(res, 400, 'Invalid limit');
      limit = Math.min(limit, 100);
    }
    const all = await CoverLetter.find(filter).sort({ createdAt: -1 }).limit(limit)
      .populate(resumePopulate).populate(jobPopulate);
    res.status(200).json({ count: all.length, coverLetters: all.map((c) => toDTO(c)) });
  } catch (error) {
    next(error);
  }
};

const getCoverLetterById = async (req, res, next) => {
  try {
    const c = await load({ _id: req.params.id, user: req.user.id });
    if (!c) return fail(res, 404, 'Cover letter not found');
    res.status(200).json({ coverLetter: toDTO(c, { full: true }) });
  } catch (error) {
    next(error);
  }
};

const updateCoverLetter = async (req, res, next) => {
  try {
    const text = req.body && req.body.text;
    if (typeof text !== 'string' || !text.trim()) return fail(res, 400, 'Cover letter text cannot be empty');
    if (text.length > MAX_TEXT) return fail(res, 400, `Cover letter must be at most ${MAX_TEXT} characters`);

    const c = await load({ _id: req.params.id, user: req.user.id });
    if (!c) return fail(res, 404, 'Cover letter not found');

    if (text !== effectiveText(c)) {
      pushVersion(c, text, 'edit');
      c.editedAt = new Date();
      await c.save();
    }
    res.status(200).json({ message: 'Cover letter saved', coverLetter: toDTO(c, { full: true }) });
  } catch (error) {
    next(error);
  }
};

const regenerateCoverLetter = async (req, res, next) => {
  try {
    const body = req.body || {};
    const c = await load({ _id: req.params.id, user: req.user.id }, { withManual: true });
    if (!c) return fail(res, 404, 'Cover letter not found');

    const dto = toDTO(c);
    if (dto.hasEdits && body.force !== true) {
      return fail(res, 409, 'This letter has edits that regeneration would replace. Your current text stays in the version history. Regenerate anyway?', 'HAS_EDITS');
    }

    const parsed = parseOptions(body);
    if (parsed.error) return fail(res, 400, parsed.error);

    // Resume: explicit override, else the letter's own resume (must still exist).
    let resume;
    if (body.resumeId !== undefined && body.resumeId !== null && body.resumeId !== '') {
      if (!isValidId(body.resumeId)) return fail(res, 400, 'Invalid resumeId');
      resume = await Resume.findOne({ _id: body.resumeId, user: req.user.id });
      if (!resume) return fail(res, 404, 'Resume not found');
    } else {
      resume = await Resume.findOne({ _id: c.resume && c.resume._id ? c.resume._id : c.resume, user: req.user.id });
      if (!resume) return fail(res, 409, 'The resume used for this letter was deleted. Choose another resume to regenerate.', 'RESUME_MISSING');
    }

    let jobInput;
    if (c.job && c.job._id) {
      const jobDoc = await Job.findById(c.job._id).populate('company', 'name');
      jobInput = jobDoc ? buildJobInput(jobDoc) : null;
    }
    if (!jobInput) {
      const s = c.jobSnapshot;
      if (!s || !s.title) return fail(res, 409, 'The job for this letter no longer exists.', 'JOB_MISSING');
      jobInput = { title: s.title, company: s.company || '', description: c.manualJobDescription || '', requirements: [], responsibilities: [], skills: [], preferredSkills: [], education: '', experienceLevel: undefined };
    }

    const opts = { ...(c.options ? JSON.parse(JSON.stringify(c.options)) : {}), ...parsed.options };

    let insights = null;
    if (c.analysis && opts.useAnalysis !== false) {
      const a = await ResumeAnalysis.findOne({ _id: c.analysis, user: req.user.id });
      insights = insightsFrom(a);
    }

    const user = await User.findById(req.user.id).select('name');
    const ai = await callAI(req, res, {
      resumeText: cleanResumeText(resume.resumeText),
      job: jobInput,
      candidateName: user ? user.name : '',
      tone: opts.tone || 'professional',
      length: opts.length || 'standard',
      instructions: opts.instructions,
      userFacts: opts.userFacts,
      analysisInsights: insights,
      strict: false,
    });
    if (!ai) return;

    // Keep the previous current text in history even if it somehow is not a version yet.
    ensureVersions(c);
    const prev = effectiveText(c);
    if (prev && !c.versions.some((v) => v.text === prev)) pushVersion(c, prev, 'edit');
    pushVersion(c, ai.text, 'regeneration');
    c.options = opts;
    c.groundingWarnings = ai.groundingWarnings;
    c.needsInfo = ai.needsInfo;
    if (String(resume._id) !== String(c.resume && c.resume._id ? c.resume._id : c.resume)) {
      c.resume = resume._id;
      c.resumeSnapshot = snapshotOf(resume);
    }
    await c.save();

    const fresh = await load({ _id: c._id, user: req.user.id });
    res.status(200).json({ message: 'Cover letter regenerated', coverLetter: toDTO(fresh, { full: true }) });
  } catch (error) {
    next(error);
  }
};

const restoreVersion = async (req, res, next) => {
  try {
    const n = Number(req.body && req.body.versionNumber);
    if (!Number.isInteger(n) || n < 1) return fail(res, 400, 'A valid versionNumber is required');

    const c = await load({ _id: req.params.id, user: req.user.id });
    if (!c) return fail(res, 404, 'Cover letter not found');
    ensureVersions(c);
    const version = c.versions.find((v) => v.number === n);
    if (!version) return fail(res, 404, 'Version not found');

    if (version.text !== effectiveText(c)) {
      const text = version.text;
      pushVersion(c, text, 'restore');
      await c.save();
    }
    res.status(200).json({ message: 'Version restored', coverLetter: toDTO(c, { full: true }) });
  } catch (error) {
    next(error);
  }
};

const downloadCoverLetter = async (req, res, next) => {
  try {
    const format = String(req.query.format || '').toLowerCase();
    if (!['pdf', 'docx'].includes(format)) return fail(res, 400, 'format must be pdf or docx');

    const c = await load({ _id: req.params.id, user: req.user.id });
    if (!c) return fail(res, 404, 'Cover letter not found');
    const text = effectiveText(c);
    if (!text.trim()) return fail(res, 400, 'This cover letter is empty');

    const title = (c.job && c.job.title) || (c.jobSnapshot && c.jobSnapshot.title) || '';
    const company = (c.job && c.job.company && c.job.company.name) || (c.jobSnapshot && c.jobSnapshot.company) || '';
    const fileName = buildFileName(company, title, format);

    const buffer = format === 'pdf' ? await toPdfBuffer(text) : await toDocxBuffer(text);
    res.setHeader('Content-Type', format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

const deleteCoverLetter = async (req, res, next) => {
  try {
    const deleted = await CoverLetter.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deleted) return fail(res, 404, 'Cover letter not found');
    res.status(200).json({ message: 'Cover letter deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateCoverLetter, getCoverLetters, getCoverLetterById, updateCoverLetter,
  regenerateCoverLetter, restoreVersion, downloadCoverLetter, deleteCoverLetter,
};
