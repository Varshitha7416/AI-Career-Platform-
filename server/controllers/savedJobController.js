const SavedJob = require('../models/SavedJob');
const Job = require('../models/Job');

const saveJob = async (req, res, next) => {
  try {
    const { jobId } = req.body;
    const userId = req.user.id;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found or no longer available' });

    const alreadySaved = await SavedJob.findOne({ user: userId, job: jobId });
    if (alreadySaved) {
      return res.status(400).json({ message: 'Job already saved' });
    }

    const savedJob = await SavedJob.create({ user: userId, job: jobId });
    res.status(201).json({ message: 'Job saved successfully', savedJob });
  } catch (error) {
    next(error);
  }
};

const listSaved = async (req, res, next) => {
  try {
    const all = await SavedJob.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate({ path: 'job', populate: { path: 'company' } });

    // Jobs deleted since saving populate as null. Omit those entries from the response.
    // This is a pure read: GET must never modify the database. Orphaned rows are removed
    // only by the explicit maintenance script (npm run maintenance:orphan-saved-jobs).
    const savedJobs = all.filter((s) => s.job);

    res.status(200).json({ count: savedJobs.length, savedJobs });
  } catch (error) {
    next(error);
  }
};

// GET /saved-jobs/:userId (kept for compatibility): the id must equal the token user.
const getSavedJobs = (req, res, next) => {
  if (req.params.userId !== req.user.id) {
    return res.status(403).json({ message: 'You can only view your own saved jobs' });
  }
  return listSaved(req, res, next);
};

// GET /saved-jobs: always the token user.
const getMySavedJobs = (req, res, next) => listSaved(req, res, next);

const unsaveJob = async (req, res, next) => {
  try {
    // :jobId is the job's id; only the caller's own saved entry can match.
    const removed = await SavedJob.findOneAndDelete({ user: req.user.id, job: req.params.jobId });
    if (!removed) return res.status(404).json({ message: 'Saved job not found' });
    res.status(200).json({ message: 'Job removed from saved jobs' });
  } catch (error) {
    next(error);
  }
};

module.exports = { saveJob, getSavedJobs, getMySavedJobs, unsaveJob };
