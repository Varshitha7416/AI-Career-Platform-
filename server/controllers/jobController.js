const Job = require('../models/Job');
const Company = require('../models/Company');
const User = require('../models/User');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const { isValidId, escapeRegex } = require('../middleware/validate');
const { CURRENCIES } = require('../utils/salary');
const { effectiveInterests } = require('../utils/roles');
const { buildRecommendations } = require('../utils/recommendationEngine');

const LEVELS = ['fresher', 'experienced'];

// Experience filter keys -> [minYears, maxYears] ranges. A job matches when its own range overlaps.
const EXPERIENCE_RANGES = {
  fresher: [0, 0],
  entry: [0, 2],
  '1-2': [1, 2],
  '2-4': [2, 4],
  '4-6': [4, 6],
  '6-10': [6, 10],
  '10+': [10, 99],
};

const csv = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

// Accepts an array or a comma/newline separated string and returns a clean list of short strings.
const toList = (v) => {
  const raw = Array.isArray(v) ? v : String(v ?? '').split(/[\n,]/);
  return [...new Set(raw.map((s) => String(s).trim()).filter(Boolean).map((s) => s.slice(0, 300)))].slice(0, 40);
};

// ---------------------------------------------------------------- validation (admin writes)
const validateJobBody = async (body, partial) => {
  const data = {};
  const errors = [];

  const str = (key, label) => {
    if (body[key] === undefined) {
      if (!partial) errors.push(`${label} is required`);
      return;
    }
    const v = String(body[key]).trim();
    if (!v) errors.push(`${label} cannot be empty`);
    else data[key] = v;
  };
  str('title', 'Title');
  str('city', 'City');
  str('jobDescription', 'Job description');

  if (body.experienceLevel === undefined) {
    if (!partial && body.experienceMinYears === undefined) errors.push('Experience level is required');
  } else if (!LEVELS.includes(body.experienceLevel)) {
    errors.push('Experience level must be fresher or experienced');
  } else {
    data.experienceLevel = body.experienceLevel;
  }

  const num = (key, label, { min = 0, max = 100000000 } = {}) => {
    if (body[key] === undefined || body[key] === null || body[key] === '') return;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < min || n > max) errors.push(`${label} must be a number between ${min} and ${max}`);
    else data[key] = n;
  };
  num('yearsRequired', 'Years required', { max: 50 });
  num('experienceMinYears', 'Minimum experience', { max: 50 });
  num('experienceMaxYears', 'Maximum experience', { max: 60 });
  num('salaryMin', 'Minimum salary');
  num('salaryMax', 'Maximum salary');
  if (data.experienceMinYears !== undefined && data.experienceMaxYears !== undefined && data.experienceMaxYears < data.experienceMinYears) {
    errors.push('Maximum experience cannot be lower than minimum experience');
  }
  if (data.salaryMin !== undefined && data.salaryMax !== undefined && data.salaryMax < data.salaryMin) {
    errors.push('Maximum salary cannot be lower than minimum salary');
  }

  const oneOf = (key, label, allowed) => {
    if (body[key] === undefined || body[key] === '') return;
    if (!allowed.includes(body[key])) errors.push(`${label} must be one of: ${allowed.join(', ')}`);
    else data[key] = body[key];
  };
  oneOf('employmentType', 'Employment type', Job.EMPLOYMENT_TYPES);
  oneOf('workMode', 'Work mode', Job.WORK_MODES);
  oneOf('salaryCurrency', 'Salary currency', CURRENCIES);
  oneOf('salaryPeriod', 'Salary period', ['year', 'month']);
  oneOf('source', 'Source', Job.SOURCES);

  if (body.country !== undefined && String(body.country).trim()) data.country = String(body.country).trim();
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  for (const key of ['skills', 'preferredSkills', 'responsibilities', 'requirements', 'education']) {
    if (body[key] !== undefined) data[key] = toList(body[key]);
  }

  if (body.applyUrl !== undefined) {
    const url = String(body.applyUrl || '').trim();
    if (!url) {
      data.applyUrl = undefined;
    } else {
      try {
        const u = new URL(url);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol');
        data.applyUrl = u.toString();
      } catch {
        errors.push('Apply URL must be a valid http(s) link');
      }
    }
  }

  if (body.company === undefined) {
    if (!partial) errors.push('Company is required');
  } else if (!isValidId(String(body.company)) || !(await Company.exists({ _id: body.company }))) {
    errors.push('Company not found');
  } else {
    data.company = body.company;
  }

  return { data, errors };
};

// ---------------------------------------------------------------- search
// Every whitespace separated word must match at least one searchable field (AND of ORs).
const buildSearch = async (query) => {
  const and = [{ isActive: { $ne: false } }];
  const relevanceParts = [];

  const tokens = String(query.q || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  for (const token of tokens) {
    const re = { $regex: escapeRegex(token), $options: 'i' };
    const companyIds = (await Company.find({ name: re }).select('_id').lean()).map((c) => c._id);
    and.push({
      $or: [
        { title: re }, { skills: re }, { preferredSkills: re }, { city: re }, { jobCode: re },
        { workMode: re }, { employmentType: re }, { country: re },
        ...(companyIds.length ? [{ company: { $in: companyIds } }] : []),
      ],
    });
    const esc = escapeRegex(token);
    relevanceParts.push(
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$title', ''] }, regex: esc, options: 'i' } }, 5, 0] },
      { $cond: [{ $anyElementTrue: { $map: { input: { $ifNull: ['$skills', []] }, as: 's', in: { $regexMatch: { input: '$$s', regex: esc, options: 'i' } } } } }, 3, 0] },
      { $cond: [{ $in: ['$company', companyIds] }, 2, 0] },
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$city', ''] }, regex: esc, options: 'i' } }, 1, 0] },
    );
  }

  if (query.title) and.push({ title: { $regex: escapeRegex(query.title), $options: 'i' } });
  if (query.city) and.push({ city: { $regex: escapeRegex(query.city), $options: 'i' } });
  if (query.country) and.push({ country: { $regex: `^${escapeRegex(query.country)}$`, $options: 'i' } });

  if (query.experienceLevel) {
    if (!LEVELS.includes(query.experienceLevel)) return { error: 'Experience level must be fresher or experienced' };
    and.push({ experienceLevel: query.experienceLevel });
  }
  if (query.experience) {
    const range = EXPERIENCE_RANGES[query.experience];
    if (!range) return { error: `Experience must be one of: ${Object.keys(EXPERIENCE_RANGES).join(', ')}` };
    and.push({ experienceMinYears: { $lte: range[1] } }, { experienceMaxYears: { $gte: range[0] } });
  }

  const types = csv(query.employmentType);
  if (types.length) {
    if (types.some((t) => !Job.EMPLOYMENT_TYPES.includes(t))) return { error: `Employment type must be one of: ${Job.EMPLOYMENT_TYPES.join(', ')}` };
    and.push({ employmentType: { $in: types } });
  }
  const modes = csv(query.workMode);
  if (modes.length) {
    if (modes.some((m) => !Job.WORK_MODES.includes(m))) return { error: `Work mode must be one of: ${Job.WORK_MODES.join(', ')}` };
    and.push({ workMode: { $in: modes } });
  }
  if (query.minSalaryLpa !== undefined && query.minSalaryLpa !== '') {
    const lpa = Number(query.minSalaryLpa);
    if (!Number.isFinite(lpa) || lpa < 0 || lpa > 1000) return { error: 'Minimum salary must be a number of lakhs per annum (0-1000)' };
    if (lpa > 0) and.push({ salaryMaxInr: { $gte: lpa * 100000 } });
  }

  return { match: { $and: and }, relevance: relevanceParts.length ? { $add: relevanceParts } : null };
};

const SORTS = ['relevance', 'newest', 'salary-high', 'salary-low', 'experience-low'];

const getJobs = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const sortKey = req.query.sort || 'relevance';
    if (!SORTS.includes(sortKey)) return res.status(400).json({ message: `Sort must be one of: ${SORTS.join(', ')}` });

    const built = await buildSearch(req.query);
    if (built.error) return res.status(400).json({ message: built.error });

    const pipeline = [{ $match: built.match }];
    let sort;
    if (sortKey === 'relevance' && built.relevance) {
      pipeline.push({ $addFields: { _rel: built.relevance } });
      sort = { _rel: -1, postedAt: -1, _id: 1 };
    } else if (sortKey === 'salary-high') sort = { salaryMaxInr: -1, postedAt: -1, _id: 1 };
    else if (sortKey === 'salary-low') sort = { salaryMaxInr: 1, postedAt: -1, _id: 1 };
    else if (sortKey === 'experience-low') sort = { experienceMinYears: 1, postedAt: -1, _id: 1 };
    else sort = { postedAt: -1, _id: 1 };
    pipeline.push({ $sort: sort });
    pipeline.push({
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $unset: '_rel' },
          { $lookup: { from: Company.collection.name, localField: 'company', foreignField: '_id', as: 'company' } },
          { $set: { company: { $first: '$company' } } },
        ],
        total: [{ $count: 'n' }],
      },
    });

    const [out] = await Job.aggregate(pipeline);
    const total = out.total[0]?.n || 0;
    res.status(200).json({
      count: out.items.length,
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
      jobs: out.items,
    });
  } catch (error) {
    next(error);
  }
};

// Values used to populate the filter controls (cities, types, ...). Counts only active jobs.
const getJobMeta = async (req, res, next) => {
  try {
    const active = { isActive: { $ne: false } };
    const [cities, types, modes, topSkills, salary, total, companies] = await Promise.all([
      Job.aggregate([{ $match: active }, { $group: { _id: '$city', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
      Job.aggregate([{ $match: active }, { $group: { _id: '$employmentType', count: { $sum: 1 } } }]),
      Job.aggregate([{ $match: active }, { $group: { _id: '$workMode', count: { $sum: 1 } } }]),
      Job.aggregate([{ $match: active }, { $unwind: '$skills' }, { $group: { _id: '$skills', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 20 }]),
      Job.aggregate([{ $match: { ...active, salaryMaxInr: { $gt: 0 } } }, { $group: { _id: null, max: { $max: '$salaryMaxInr' } } }]),
      Job.countDocuments(active),
      Job.distinct('company', active),
    ]);
    res.status(200).json({
      total,
      companies: companies.length,
      cities: cities.filter((c) => c._id).map((c) => ({ name: c._id, count: c.count })),
      employmentTypes: types.filter((t) => t._id).map((t) => ({ name: t._id, count: t.count })),
      workModes: modes.filter((m) => m._id).map((m) => ({ name: m._id, count: m.count })),
      topSkills: topSkills.map((s) => ({ name: s._id, count: s.count })),
      experienceRanges: Object.keys(EXPERIENCE_RANGES),
      maxSalaryInr: salary[0]?.max || 0,
      sorts: SORTS,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------- recommendations (rule based, NOT AI)
// One group per career interest (scored with that role's resume, default-resume fallback, else profile skills), plus
// the merged top-level list. Computed per request on purpose (no cache), so role/resume/profile edits apply at once.
const getRecommendedJobs = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 20);
    const user = await User.findById(req.user.id).select('seekingRole careerInterests primaryRole skills experienceYears preferredLocation preferredWorkMode preferredEmploymentType').lean();
    const resumes = await Resume.find({ user: req.user.id }).select('name fileName isDefault targetRoleKey resumeText createdAt').lean();
    const { interests, primaryKey } = effectiveInterests(user || {});

    const jobs = await Job.find({ isActive: { $ne: false } }).populate('company').lean();
    const applied = new Set((await Application.find({ user: req.user.id }).select('job').lean()).map((a) => String(a.job)));
    const candidates = jobs.filter((j) => !applied.has(String(j._id)));

    res.status(200).json(buildRecommendations({ user: user || {}, interests, primaryKey, resumes, candidates, limit }));
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------- single job + admin writes
const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate('company');
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.status(200).json({ job });
  } catch (error) {
    next(error);
  }
};

const createJob = async (req, res, next) => {
  try {
    const { data, errors } = await validateJobBody(req.body, false);
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    const job = await Job.create({ source: 'manual', ...data, postedBy: req.user.id });
    res.status(201).json({ message: 'Job created successfully', job });
  } catch (error) {
    next(error);
  }
};

const updateJob = async (req, res, next) => {
  try {
    const { data, errors } = await validateJobBody(req.body, true);
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    // Load + save (instead of findByIdAndUpdate) so derived fields such as salaryMaxInr are recomputed.
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    job.set(data);
    await job.save();

    res.status(200).json({ message: 'Job updated successfully', job });
  } catch (error) {
    next(error);
  }
};

const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.status(200).json({ message: 'Job deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createJob, getJobs, getJobMeta, getRecommendedJobs, getJobById, updateJob, deleteJob };
