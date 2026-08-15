const Job = require('../models/Job');

const createJob = async (req, res) => {
  try {
    const { title, company, city, jobDescription, experienceLevel, yearsRequired } = req.body;

    const newJob = await Job.create({
      title,
      company,
      city,
      jobDescription,
      experienceLevel,
      yearsRequired,
    });

    res.status(201).json({ message: 'Job created successfully', job: newJob });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


const getJobs = async (req, res) => {
  try {
    const { title, city, experienceLevel } = req.query;

    const filter = {};

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }
    if (experienceLevel) {
      filter.experienceLevel = experienceLevel;
    }

    const jobs = await Job.find(filter).sort({ createdAt: -1 });

    res.status(200).json({ count: jobs.length, jobs });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateJob = async (req, res) => {
  try {
    const updatedJob = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedJob) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.status(200).json({ message: 'Job updated successfully', job: updatedJob });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteJob = async (req, res) => {
  try {
    const deletedJob = await Job.findByIdAndDelete(req.params.id);

    if (!deletedJob) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.status(200).json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createJob, getJobs, updateJob, deleteJob };

