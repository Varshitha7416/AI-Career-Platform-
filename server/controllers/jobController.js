const Job = require('../models/Job');
const Company = require('../models/Company');
const { isValidId, escapeRegex } = require('../middleware/validate');

const LEVELS = ['fresher', 'experienced'];

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
    if (!partial) errors.push('Experience level is required');
  } else if (!LEVELS.includes(body.experienceLevel)) {
    errors.push('Experience level must be fresher or experienced');
  } else {
    data.experienceLevel = body.experienceLevel;
  }

  if (body.yearsRequired !== undefined) {
    const n = Number(body.yearsRequired);
    if (!Number.isFinite(n) || n < 0 || n > 50) errors.push('Years required must be between 0 and 50');
    else data.yearsRequired = n;
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

const createJob = async (req, res, next) => {
  try {
    const { data, errors } = await validateJobBody(req.body, false);
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    const job = await Job.create({ ...data, postedBy: req.user.id });
    res.status(201).json({ message: 'Job created successfully', job });
  } catch (error) {
    next(error);
  }
};

const getJobs = async (req, res, next) => {
  try {
    const { title, city, experienceLevel } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const filter = {};
    if (title) filter.title = { $regex: escapeRegex(title), $options: 'i' };
    if (city) filter.city = { $regex: escapeRegex(city), $options: 'i' };
    if (experienceLevel) {
      if (!LEVELS.includes(experienceLevel)) {
        return res.status(400).json({ message: 'Experience level must be fresher or experienced' });
      }
      filter.experienceLevel = experienceLevel;
    }

    const [total, jobs] = await Promise.all([
      Job.countDocuments(filter),
      Job.find(filter)
        .populate('company')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.status(200).json({
      count: jobs.length,
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
      jobs,
    });
  } catch (error) {
    next(error);
  }
};

const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate('company');
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.status(200).json({ job });
  } catch (error) {
    next(error);
  }
};

const updateJob = async (req, res, next) => {
  try {
    const { data, errors } = await validateJobBody(req.body, true);
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    const job = await Job.findByIdAndUpdate(req.params.id, data, { returnDocument: 'after', runValidators: true });
    if (!job) return res.status(404).json({ message: 'Job not found' });

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

module.exports = { createJob, getJobs, getJobById, updateJob, deleteJob };
