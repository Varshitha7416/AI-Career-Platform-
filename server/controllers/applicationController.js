const Application = require('../models/Application');

const applyToJob = async (req, res) => {
  try {
    const { userId, jobId } = req.body;

    const existingApplication = await Application.findOne({ user: userId, job: jobId });
    if (existingApplication) {
      return res.status(400).json({ message: 'Already applied to this job' });
    }

    const application = await Application.create({ user: userId, job: jobId });
    res.status(201).json({ message: 'Application submitted', application });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getApplications = async (req, res) => {
  try {
    const { userId } = req.params;

    const applications = await Application.find({ user: userId }).populate('job');

    res.status(200).json({ count: applications.length, applications });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const updatedApplication = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedApplication) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.status(200).json({ message: 'Status updated', application: updatedApplication });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { applyToJob, getApplications, updateApplicationStatus };