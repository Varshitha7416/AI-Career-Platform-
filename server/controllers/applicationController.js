const Application = require('../models/Application');
const Interview = require('../models/Interview');
const Job = require('../models/Job');
const { notify } = require('../utils/notify');
const { historyOf, ensureHistory, STATUS_LABEL } = require('../utils/applicationHelpers');

const STATUSES = ['applied', 'interviewing', 'rejected', 'offer'];

const applyToJob = async (req, res, next) => {
  try {
    const { jobId } = req.body;
    const userId = req.user.id;

    // 'external' = the user applied through the employer's own link and is confirming it;
    // 'manual'   = the user is recording an application made somewhere else.
    const applyMethod = req.body.applyMethod === undefined ? 'manual' : req.body.applyMethod;
    if (!['external', 'manual'].includes(applyMethod)) {
      return res.status(400).json({ message: 'applyMethod must be external or manual' });
    }
    let appliedAt = new Date();
    if (req.body.appliedAt !== undefined && req.body.appliedAt !== null && req.body.appliedAt !== '') {
      appliedAt = new Date(req.body.appliedAt);
      if (Number.isNaN(appliedAt.getTime()) || appliedAt.getTime() > Date.now() + 60 * 1000) {
        return res.status(400).json({ message: 'Applied date must be a valid date that is not in the future' });
      }
    }

    const job = await Job.findById(jobId).populate('company', 'name');
    if (!job) return res.status(404).json({ message: 'Job not found or no longer available' });

    const existingApplication = await Application.findOne({ user: userId, job: jobId });
    if (existingApplication) {
      return res.status(400).json({ message: 'Already applied to this job' });
    }

    const application = await Application.create({
      user: userId, job: jobId, applyMethod, appliedAt,
      statusHistory: [{ status: 'applied', at: appliedAt }],
    });

    await notify(userId, {
      type: 'application',
      title: 'Application added',
      message: `${job.title}${job.company?.name ? ` at ${job.company.name}` : ''}`,
      link: `/applications/${application._id}`,
    });

    res.status(201).json({ message: 'Application submitted', application });
  } catch (error) {
    next(error);
  }
};

// Shared by GET /applications (token user) and GET /applications/:userId (must equal the token user).
const listForUser = async (userId, res, next) => {
  try {
    const all = await Application.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate({ path: 'job', populate: { path: 'company' } });

    // Applications whose job was deleted are hidden (job populates as null).
    const applications = all.filter((a) => a.job);

    res.status(200).json({ count: applications.length, applications });
  } catch (error) {
    next(error);
  }
};

const getApplications = async (req, res, next) => {
  if (req.params.userId !== req.user.id) {
    return res.status(403).json({ message: 'You can only view your own applications' });
  }
  return listForUser(req.user.id, res, next);
};

const getMyApplications = (req, res, next) => listForUser(req.user.id, res, next);

// One application with its job, status timeline and interviews (own applications only).
const getApplicationItem = async (req, res, next) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, user: req.user.id })
      .populate({ path: 'job', populate: { path: 'company' } });
    if (!application || !application.job) return res.status(404).json({ message: 'Application not found' });

    const interviews = await Interview.find({ application: application._id, user: req.user.id })
      .sort({ scheduledAt: -1 })
      .select('scheduledAt durationMinutes mode type location notes status')
      .lean();

    res.status(200).json({
      application: { ...application.toObject(), statusHistory: historyOf(application), interviews },
    });
  } catch (error) {
    next(error);
  }
};

const updateApplicationStatus = async (req, res, next) => {
  try {
    const status = String(req.body.status || '').toLowerCase();
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });
    }

    // Filtering by user guarantees users can only change their own applications.
    const application = await Application.findOne({ _id: req.params.id, user: req.user.id })
      .populate({ path: 'job', select: 'title company', populate: { path: 'company', select: 'name' } });
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.status !== status) {
      ensureHistory(application);
      application.status = status;
      application.statusHistory.push({ status, at: new Date() });
      await application.save();

      await notify(req.user.id, {
        type: 'application',
        title: 'Application status updated',
        message: `${application.job?.title || 'Your application'}${application.job?.company?.name ? ` at ${application.job.company.name}` : ''} is now ${STATUS_LABEL[status] || status}`,
        link: `/applications/${application._id}`,
      });
    }

    res.status(200).json({ message: 'Status updated', application });
  } catch (error) {
    next(error);
  }
};

const deleteApplication = async (req, res, next) => {
  try {
    const removed = await Application.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!removed) return res.status(404).json({ message: 'Application not found' });
    // The user's interviews for a removed application would be orphaned, so remove those too.
    await Interview.deleteMany({ application: removed._id, user: req.user.id });
    res.status(200).json({ message: 'Application removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { applyToJob, getApplications, getMyApplications, getApplicationItem, updateApplicationStatus, deleteApplication };
