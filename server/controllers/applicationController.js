const Application = require('../models/Application');
const Job = require('../models/Job');

const STATUSES = ['applied', 'interviewing', 'rejected', 'offer'];

const applyToJob = async (req, res, next) => {
  try {
    const { jobId } = req.body;
    const userId = req.user.id;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found or no longer available' });

    const existingApplication = await Application.findOne({ user: userId, job: jobId });
    if (existingApplication) {
      return res.status(400).json({ message: 'Already applied to this job' });
    }

    const application = await Application.create({ user: userId, job: jobId });
    res.status(201).json({ message: 'Application submitted', application });
  } catch (error) {
    next(error);
  }
};

const getApplications = async (req, res, next) => {
  try {
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only view your own applications' });
    }

    const all = await Application.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate({ path: 'job', populate: { path: 'company' } });

    // Applications whose job was deleted are hidden (job populates as null).
    const applications = all.filter((a) => a.job);

    res.status(200).json({ count: applications.length, applications });
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
    const updated = await Application.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { status },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.status(200).json({ message: 'Status updated', application: updated });
  } catch (error) {
    next(error);
  }
};

const deleteApplication = async (req, res, next) => {
  try {
    const removed = await Application.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!removed) return res.status(404).json({ message: 'Application not found' });
    res.status(200).json({ message: 'Application removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { applyToJob, getApplications, updateApplicationStatus, deleteApplication };
