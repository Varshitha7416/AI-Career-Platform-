const SavedJob = require('../models/SavedJob');

const saveJob = async (req, res) => {
  try {
    const { userId, jobId } = req.body;

    const alreadySaved = await SavedJob.findOne({ user: userId, job: jobId });
    if (alreadySaved) {
      return res.status(400).json({ message: 'Job already saved' });
    }

    const savedJob = await SavedJob.create({ user: userId, job: jobId });
    res.status(201).json({ message: 'Job saved successfully', savedJob });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getSavedJobs = async (req, res) => {
  try {
    const { userId } = req.params;

    const savedJobs = await SavedJob.find({ user: userId }).populate('job');

    res.status(200).json({ count: savedJobs.length, savedJobs });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { saveJob, getSavedJobs };