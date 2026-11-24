const Job = require('../models/Job');
const Company = require('../models/Company');
const User = require('../models/User');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const { isValidId, escapeRegex } = require('../middleware/validate');
const { CURRENCIES } = require('../utils/salary');

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
const STOP = new Set(['and', 'or', 'the', 'a', 'an', 'of', 'for', 'in', 'at', 'to', 'with', 'senior', 'junior', 'lead']);
const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1 && !STOP.has(w));

const containsSkill = (text, skill) => {
  const esc = escapeRegex(skill.toLowerCase());
  return new RegExp(`(^|[^a-z0-9+#.])${esc}($|[^a-z0-9+#])`).test(text);
};

const getRecommendedJobs = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 20);
    const user = await User.findById(req.user.id).select('seekingRole experienceYears preferredLocation preferredWorkMode preferredEmploymentType').lean();
    const resume = await Resume.findOne({ user: req.user.id }).sort({ createdAt: -1 }).select('resumeText').lean();
    const resumeText = (resume?.resumeText || '').toLowerCase();

    const jobs = await Job.find({ isActive: { $ne: false } }).populate('company').lean();
    const applied = new Set((await Application.find({ user: req.user.id }).select('job').lean()).map((a) => String(a.job)));
    const candidates = jobs.filter((j) => !applied.has(String(j._id)));

    const roleWords = words(user?.seekingRole);
    const hasRole = roleWords.length > 0;
    const hasResume = resumeText.length > 0;
    const hasPrefs = Boolean(user?.preferredLocation || user?.preferredWorkMode || user?.preferredEmploymentType || user?.experienceYears !== undefined);

    const latest = () => candidates.sort((a, b) => new Date(b.postedAt || b.createdAt) - new Date(a.postedAt || a.createdAt)).slice(0, limit);
    if (!hasRole && !hasResume && !hasPrefs) {
      return res.status(200).json({
        personalized: false,
        basis: 'latest',
        message: 'Showing the latest jobs. Add a target role and preferences in your Profile, or upload a resume, to get matched recommendations.',
        jobs: latest(),
      });
    }

    const scored = candidates.map((job) => {
      let score = 0;
      const reasons = [];

      if (hasRole) {
        const titleWords = new Set(words(job.title));
        const hits = roleWords.filter((w) => titleWords.has(w)).length;
        if (hits) {
          score += Math.round((hits / roleWords.length) * 40);
          reasons.push(hits === roleWords.length ? 'Job title matches your target role' : 'Job title partly matches your target role');
        }
      }
      if (hasResume && job.skills?.length) {
        const found = job.skills.filter((s) => containsSkill(resumeText, s));
        if (found.length) {
          score += Math.min(found.length, 5) * 8;
          reasons.push(`Skills found in your resume: ${found.slice(0, 4).join(', ')}`);
        }
      }
      const years = user?.experienceYears;
      if (years !== undefined && years !== null && job.experienceMinYears !== undefined) {
        if (years >= job.experienceMinYears && years <= (job.experienceMaxYears ?? 99)) {
          score += 10;
          reasons.push(`Fits your ${years} year${years === 1 ? '' : 's'} of experience`);
        } else if (Math.abs(years - job.experienceMinYears) <= 1 || Math.abs(years - (job.experienceMaxYears ?? years)) <= 1) {
          score += 5;
          reasons.push('Close to your experience level');
        }
      }
      if (user?.preferredLocation && job.city && job.city.toLowerCase().includes(user.preferredLocation.toLowerCase())) {
        score += 10;
        reasons.push(`Located in ${job.city}`);
      }
      if (user?.preferredWorkMode && job.workMode === user.preferredWorkMode) {
        score += 5;
        reasons.push(`${job.workMode[0].toUpperCase()}${job.workMode.slice(1)} work, as you prefer`);
      }
      if (user?.preferredEmploymentType && job.employmentType === user.preferredEmploymentType) {
        score += 5;
        reasons.push(`${job.employmentType} role, as you prefer`);
      }
      return { ...job, matchScore: Math.min(score, 100), matchReasons: reasons };
    });

    const matched = scored.filter((j) => j.matchReasons.length).sort((a, b) => b.matchScore - a.matchScore || new Date(b.postedAt) - new Date(a.postedAt)).slice(0, limit);
    if (!matched.length) {
      return res.status(200).json({
        personalized: false,
        basis: 'latest',
        message: 'No close matches for your current profile yet, so these are the latest jobs.',
        jobs: latest(),
      });
    }
    res.status(200).json({
      personalized: true,
      basis: 'profile',
      signals: { targetRole: hasRole, resumeSkills: hasResume, preferences: hasPrefs },
      message: 'Matched using your target role, resume skills and preferences (simple rule-based matching, not AI).',
      jobs: matched,
    });
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
