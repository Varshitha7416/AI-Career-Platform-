const Job = require('../models/Job');
const Company = require('../models/Company');
const { validateJobBody } = require('./jobController');
const { isValidId, escapeRegex } = require('../middleware/validate');
const { availabilityOf } = require('../utils/jobVisibility');
const { recordAdminAction } = require('../utils/adminAudit');

const STATUSES = ['all', 'active', 'inactive', 'closed', 'expired'];

// Admin list: includes inactive, closed and expired jobs (the public /api/jobs hides them).
const statusFilter = (status, now) => {
  switch (status) {
    case 'active': return { isActive: { $ne: false }, status: { $ne: 'closed' }, $or: [{ applicationDeadline: null }, { applicationDeadline: { $gte: now } }] };
    case 'inactive': return { isActive: false };
    case 'closed': return { isActive: { $ne: false }, status: 'closed' };
    case 'expired': return { isActive: { $ne: false }, status: { $ne: 'closed' }, applicationDeadline: { $lt: now } };
    default: return {};
  }
};

const withAvailability = (job) => {
  const o = typeof job.toObject === 'function' ? job.toObject() : job;
  return { ...o, availability: availabilityOf(o) };
};

const listJobs = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const status = req.query.status || 'all';
    if (!STATUSES.includes(status)) return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });

    const and = [statusFilter(status, new Date())];
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q) {
      const re = { $regex: escapeRegex(q), $options: 'i' };
      const companyIds = (await Company.find({ name: re }).select('_id').lean()).map((c) => c._id);
      and.push({ $or: [{ title: re }, { jobCode: re }, { category: re }, ...(companyIds.length ? [{ company: { $in: companyIds } }] : [])] });
    }
    if (req.query.company) {
      if (!isValidId(String(req.query.company))) return res.status(400).json({ message: 'Invalid company' });
      and.push({ company: req.query.company });
    }
    if (req.query.city) and.push({ city: { $regex: escapeRegex(String(req.query.city).trim()), $options: 'i' } });
    if (req.query.category) and.push({ category: { $regex: `^${escapeRegex(String(req.query.category).trim())}$`, $options: 'i' } });

    const filter = { $and: and };
    const [jobs, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('company', 'name logoUrl isActive').lean(),
      Job.countDocuments(filter),
    ]);
    res.status(200).json({ count: jobs.length, total, page, pages: Math.max(Math.ceil(total / limit), 1), jobs: jobs.map(withAvailability) });
  } catch (error) {
    next(error);
  }
};

const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate('company', 'name logoUrl isActive');
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.status(200).json({ job: withAvailability(job) });
  } catch (error) {
    next(error);
  }
};

const createJob = async (req, res, next) => {
  try {
    const body = { ...(req.body || {}) };
    delete body.source; // always 'manual' for admin-created jobs
    const { data, errors } = await validateJobBody(body, false);
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });
    const job = await Job.create({ ...data, source: 'manual', postedBy: req.user.id });
    await recordAdminAction({ actor: req.user.id, action: 'job.created', targetType: 'job', targetId: job._id, summary: `Created job "${job.title}" (${job.jobCode})` });
    await job.populate('company', 'name logoUrl isActive');
    res.status(201).json({ message: 'Job created successfully', job: withAvailability(job) });
  } catch (error) {
    next(error);
  }
};

const updateJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    const body = { ...(req.body || {}) };
    delete body.source;
    delete body.isActive; // lifecycle changes go through activate / deactivate / close / reopen
    const { data, errors } = await validateJobBody(body, true, { currentCompany: job.company, currentDeadline: job.applicationDeadline });
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });
    job.set(data);
    await job.save();
    await recordAdminAction({ actor: req.user.id, action: 'job.updated', targetType: 'job', targetId: job._id, summary: `Updated job "${job.title}" (${job.jobCode})` });
    await job.populate('company', 'name logoUrl isActive');
    res.status(200).json({ message: 'Job updated successfully', job: withAvailability(job) });
  } catch (error) {
    next(error);
  }
};

const ACTIONS = {
  activate: { audit: 'job.activated', verb: 'Activated', apply: (j) => { j.isActive = true; } },
  deactivate: { audit: 'job.deactivated', verb: 'Deactivated', apply: (j) => { j.isActive = false; } },
  close: { audit: 'job.closed', verb: 'Closed', apply: (j) => { j.status = 'closed'; j.closedAt = new Date(); } },
  reopen: { audit: 'job.reopened', verb: 'Reopened', apply: (j) => { j.status = 'open'; j.closedAt = undefined; } },
};

const lifecycle = (name) => async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    const action = ACTIONS[name];
    action.apply(job);
    await job.save();
    await recordAdminAction({ actor: req.user.id, action: action.audit, targetType: 'job', targetId: job._id, summary: `${action.verb} job "${job.title}" (${job.jobCode})` });
    await job.populate('company', 'name logoUrl isActive');
    res.status(200).json({ message: `Job ${action.verb.toLowerCase()}`, job: withAvailability(job) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listJobs, getJob, createJob, updateJob,
  activateJob: lifecycle('activate'), deactivateJob: lifecycle('deactivate'), closeJob: lifecycle('close'), reopenJob: lifecycle('reopen'),
};
