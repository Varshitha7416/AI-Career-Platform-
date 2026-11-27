const crypto = require('crypto');
const SkillGapAnalysis = require('../models/SkillGapAnalysis');
const LearningRoadmap = require('../models/LearningRoadmap');
const Resume = require('../models/Resume');
const Job = require('../models/Job');
require('../models/Company');
const { isValidId, escapeRegex } = require('../middleware/validate');
const { sendAiError, buildJobInput } = require('../middleware/aiLimiter');
const { cleanResumeText } = require('../utils/resumeExtract');
const { searchRoles, cleanRole, ROLE_MAX } = require('../utils/roles');
const syn = require('../utils/ai/skillSynonyms');
const { analyse } = require('../utils/skillgap/analyse');
const { dedupeSkills, LEVELS } = require('../utils/skillgap/skills');
const { toSummary, toFull } = require('../utils/skillgap/dto');

const REUSE_WINDOW_MS = 10 * 60 * 1000;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const stripExt = (n) => String(n || '').replace(/\.[a-z0-9]+$/i, '');

const jobPopulate = { path: 'job', select: 'title jobCode company', populate: { path: 'company', select: 'name' } };
const resumePopulate = { path: 'resume', select: 'name fileName fileType' };

const invalid = (res, errors) => res.status(400).json({ message: 'Please fix the highlighted fields.', code: 'VALIDATION_ERROR', errors });

// ---- field validation ----
const optText = (body, field, max, errors) => {
  const v = body[field];
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string') { errors[field] = `${field} must be text`; return ''; }
  const t = v.trim();
  if (t.length > max) errors[field] = `${field} must be at most ${max} characters`;
  return t;
};
const optYears = (v, field, errors) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 60) { errors[field] = `${field} must be a number between 0 and 60`; return undefined; }
  return n;
};
const roleField = (body, required, errors) => {
  const v = body.targetRole;
  if (v === undefined || v === null || v === '') {
    if (required) errors.targetRole = 'targetRole is required';
    return '';
  }
  if (typeof v !== 'string') { errors.targetRole = 'targetRole must be text'; return ''; }
  const role = cleanRole(v);
  if (role.length < 2 || role.length > ROLE_MAX) errors.targetRole = `targetRole must be 2-${ROLE_MAX} characters`;
  return role;
};
const optId = (v, field, errors) => {
  if (v === undefined || v === null || v === '') return null;
  if (!isValidId(v)) { errors[field] = `Invalid ${field}`; return null; }
  return v;
};

const loadJob = (id) => Job.findById(id).populate('company', 'name');

const targetFrom = (job, role, jd) => {
  if (job) {
    const ji = buildJobInput(job);
    return { targetKind: 'job', targetRole: String(job.title).slice(0, 120), job: ji, jobDescriptionText: '' };
  }
  return { targetKind: jd ? 'custom-jd' : 'role-only', targetRole: role, job: null, jobDescriptionText: jd };
};

const jobHash = (job) => (job ? sha(JSON.stringify([buildJobInput(job), job.updatedAt])) : '');

const titleFor = (t, job) => `${t.targetRole}${job && job.company && job.company.name ? ` at ${job.company.name}` : ''} - skill gap`.slice(0, 160);

const findReusable = (userId, inputHash) => SkillGapAnalysis.findOne({ user: userId, inputHash, createdAt: { $gte: new Date(Date.now() - REUSE_WINDOW_MS) } })
  .sort({ createdAt: -1 }).populate(resumePopulate).populate(jobPopulate);

const roadmapFor = (userId, analysisId) => LearningRoadmap.findOne({ user: userId, analysis: analysisId }).select('stages').lean();

const inflight = new Map();

// Shared path for both modes: reuse -> analyse (one AI call) -> save -> respond. Nothing is saved on failure.
const run = async (req, res, { mode, t, job, inputHash, resumeDoc, manual }) => {
  const reused = await findReusable(req.user.id, inputHash);
  if (reused) {
    return res.status(200).json({ message: 'Showing your recent identical analysis', analysis: toFull(reused, await roadmapFor(req.user.id, reused._id)), reused: true });
  }

  const flightKey = `${req.user.id}:${inputHash}`;
  if (inflight.has(flightKey)) {
    // An identical request is already running: wait for it, then reuse its saved result.
    try { await inflight.get(flightKey); } catch { /* the first request reports its own error */ }
    const again = await findReusable(req.user.id, inputHash);
    if (again) return res.status(200).json({ message: 'Showing your recent identical analysis', analysis: toFull(again, null), reused: true });
  }

  const work = (async () => {
    const out = await analyse({
      mode, targetKind: t.targetKind, targetRole: t.targetRole, job: t.job, jobDescriptionText: t.jobDescriptionText,
      resumeText: resumeDoc ? cleanResumeText(resumeDoc.resumeText) : '', manual,
    }, { consume: req.consumeAiCall });

    const doc = {
      user: req.user.id,
      title: titleFor(t, job),
      mode,
      basis: mode === 'resume' ? 'resume-verified' : 'manual-input',
      targetKind: t.targetKind,
      targetRole: t.targetRole,
      requirements: out.requirements,
      result: out.result,
      score: out.score,
      inputHash,
    };
    if (job) {
      doc.job = job._id;
      doc.jobSnapshot = { title: job.title, company: (job.company && job.company.name) || '', jobCode: job.jobCode };
    }
    if (t.jobDescriptionText) doc.jobDescriptionText = t.jobDescriptionText.slice(0, 8000);
    if (resumeDoc) {
      doc.resume = resumeDoc._id;
      doc.resumeSnapshot = { name: resumeDoc.name || stripExt(resumeDoc.fileName), fileName: resumeDoc.fileName, fileType: resumeDoc.fileType };
    }
    doc.input = mode === 'manual'
      ? { manualSkills: manual.skills.map((s) => ({ name: s.name, key: s.key, level: s.level })), experienceYears: manual.experienceYears, education: manual.education, domain: manual.domain, projects: manual.projects, goals: manual.goals }
      : { experienceYears: manual && manual.experienceYears };
    return SkillGapAnalysis.create(doc);
  })();
  inflight.set(flightKey, work);
  let created;
  try {
    created = await work;
  } catch (err) {
    if (err && err.code === 'NO_REQUIREMENTS') return res.status(422).json({ message: err.message, code: 'NO_REQUIREMENTS' });
    if (sendAiError(res, err)) return undefined;
    throw err;
  } finally {
    inflight.delete(flightKey);
  }
  const populated = await SkillGapAnalysis.findOne({ _id: created._id, user: req.user.id }).populate(resumePopulate).populate(jobPopulate);
  return res.status(201).json({ message: 'Skill gap analysis complete', analysis: toFull(populated, null) });
};

// ---- handlers ----
const getRoles = (req, res) => {
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 15;
  const roles = searchRoles(typeof req.query.q === 'string' ? req.query.q.slice(0, 80) : '', Math.min(limit, 40));
  res.status(200).json({ count: roles.length, roles });
};

const getSkills = async (req, res, next) => {
  try {
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 20;
    limit = Math.min(limit, 50);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
    const norm = syn.norm(q);

    const names = syn.GROUPS.map((g) => g[0]);
    let jobSkills = [];
    const pipeline = [{ $match: { isActive: { $ne: false } } }, { $unwind: '$skills' }];
    if (q) pipeline.push({ $match: { skills: { $regex: escapeRegex(q), $options: 'i' } } });
    pipeline.push({ $group: { _id: '$skills', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 100 });
    try { jobSkills = (await Job.aggregate(pipeline)).map((s) => s._id); } catch { jobSkills = []; }

    const seen = new Set();
    const out = [];
    for (const raw of [...names, ...jobSkills]) {
      const name = syn.canonicalName(raw);
      const key = syn.canonicalKey(raw);
      if (!name || seen.has(key)) continue;
      if (norm) {
        const hay = [name, ...(syn.GROUPS.find((g) => syn.canonicalKey(g[0]) === key) || [])].map((x) => syn.norm(x));
        if (!hay.some((h) => h.includes(norm))) continue;
      }
      seen.add(key);
      out.push({ name, key, rank: norm && syn.norm(name).startsWith(norm) ? 0 : 1 });
    }
    out.sort((a, b) => a.rank - b.rank);
    const skills = out.slice(0, limit).map(({ name, key }) => ({ name, key }));
    res.status(200).json({ count: skills.length, skills });
  } catch (error) { next(error); }
};

const analyzeFromResume = async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const errors = {};
    if (!isValidId(body.resumeId)) errors.resumeId = 'A valid resumeId is required';
    const jobId = optId(body.jobId, 'jobId', errors);
    const role = roleField(body, !jobId, errors);
    const jd = jobId ? '' : optText(body, 'jobDescription', 8000, errors);
    const exp = optYears(body.experience, 'experience', errors);
    if (Object.keys(errors).length) return invalid(res, errors);

    const resume = await Resume.findOne({ _id: body.resumeId, user: req.user.id });
    if (!resume) return res.status(404).json({ message: 'Resume not found' });
    let job = null;
    if (jobId) {
      job = await loadJob(jobId);
      if (!job) return res.status(404).json({ message: 'Job not found' });
    }
    const t = targetFrom(job, role, jd);
    const text = cleanResumeText(resume.resumeText);
    const inputHash = sha(['resume', resume._id, sha(text), jobId || '', jobHash(job), t.targetRole.toLowerCase(), sha(jd), exp ?? ''].join('|'));
    return await run(req, res, { mode: 'resume', t, job, inputHash, resumeDoc: resume, manual: exp !== undefined ? { skills: [], experienceYears: exp } : null });
  } catch (error) { next(error); }
};

const analyzeManual = async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const errors = {};
    const jobId = optId(body.jobId, 'jobId', errors);
    const role = roleField(body, !jobId, errors);
    const jd = jobId ? '' : optText(body, 'jobDescription', 8000, errors);
    const experienceYears = optYears(body.experienceYears, 'experienceYears', errors);
    const education = optText(body, 'education', 120, errors);
    const domain = optText(body, 'domain', 120, errors);
    const projects = optText(body, 'projects', 2000, errors);
    const goals = optText(body, 'goals', 1000, errors);

    let skills = [];
    if (!Array.isArray(body.skills) || body.skills.length < 1 || body.skills.length > 60) {
      errors.skills = 'skills must be a list of 1 to 60 entries';
    } else {
      for (const s of body.skills) {
        const name = s && typeof s === 'object' ? s.name : s;
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) { errors.skills = 'every skill needs a name of at most 80 characters'; break; }
        if (s && typeof s === 'object' && s.level !== undefined && s.level !== null && s.level !== '' && !LEVELS.includes(s.level)) { errors.skills = `level must be one of ${LEVELS.join(', ')}`; break; }
      }
      if (!errors.skills) skills = dedupeSkills(body.skills);
    }
    if (Object.keys(errors).length) return invalid(res, errors);

    let job = null;
    if (jobId) {
      job = await loadJob(jobId);
      if (!job) return res.status(404).json({ message: 'Job not found' });
    }
    const t = targetFrom(job, role, jd);
    const manual = { skills, experienceYears, education, domain, projects, goals };
    const inputHash = sha(['manual', jobId || '', jobHash(job), t.targetRole.toLowerCase(), sha(jd),
      skills.map((s) => `${s.key}:${s.level || ''}`).sort().join(','), experienceYears ?? '', education, domain, sha(projects), sha(goals)].join('|'));
    return await run(req, res, { mode: 'manual', t, job, inputHash, resumeDoc: null, manual });
  } catch (error) { next(error); }
};

const listAnalyses = async (req, res, next) => {
  try {
    const q = req.query;
    let page = 1; let limit = 10;
    if (q.page !== undefined) { page = parseInt(q.page, 10); if (!Number.isFinite(page) || page < 1) return res.status(400).json({ message: 'Invalid page' }); }
    if (q.limit !== undefined) { limit = parseInt(q.limit, 10); if (!Number.isFinite(limit) || limit < 1) return res.status(400).json({ message: 'Invalid limit' }); limit = Math.min(limit, 50); }
    const filter = { user: req.user.id };
    if (q.mode !== undefined) {
      if (!['resume', 'manual'].includes(q.mode)) return res.status(400).json({ message: 'mode must be resume or manual' });
      filter.mode = q.mode;
    }
    if (q.targetRole !== undefined && typeof q.targetRole === 'string' && q.targetRole.trim()) {
      filter.targetRole = { $regex: escapeRegex(cleanRole(q.targetRole).slice(0, ROLE_MAX)), $options: 'i' };
    }
    const [total, docs] = await Promise.all([
      SkillGapAnalysis.countDocuments(filter),
      SkillGapAnalysis.find(filter).select('-requirements -result -jobDescriptionText -inputHash -input')
        .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate(resumePopulate).populate(jobPopulate).lean(),
    ]);
    const roadmaps = docs.length
      ? await LearningRoadmap.find({ user: req.user.id, analysis: { $in: docs.map((d) => d._id) } }).select('analysis stages').lean()
      : [];
    const byAnalysis = new Map(roadmaps.map((r) => [String(r.analysis), r]));
    res.status(200).json({
      count: docs.length, total, page, pages: Math.max(1, Math.ceil(total / limit)),
      analyses: docs.map((d) => toSummary(d, byAnalysis.get(String(d._id)))),
    });
  } catch (error) { next(error); }
};

const getAnalysis = async (req, res, next) => {
  try {
    const doc = await SkillGapAnalysis.findOne({ _id: req.params.id, user: req.user.id }).populate(resumePopulate).populate(jobPopulate);
    if (!doc) return res.status(404).json({ message: 'Analysis not found' });
    res.status(200).json({ analysis: toFull(doc, await roadmapFor(req.user.id, doc._id)) });
  } catch (error) { next(error); }
};

const deleteAnalysis = async (req, res, next) => {
  try {
    const deleted = await SkillGapAnalysis.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deleted) return res.status(404).json({ message: 'Analysis not found' });
    const r = await LearningRoadmap.deleteMany({ user: req.user.id, analysis: deleted._id });
    res.status(200).json({ message: 'Analysis deleted', roadmapDeleted: r.deletedCount > 0 });
  } catch (error) { next(error); }
};

module.exports = { getRoles, getSkills, analyzeFromResume, analyzeManual, listAnalyses, getAnalysis, deleteAnalysis };
