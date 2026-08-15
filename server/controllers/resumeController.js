const Resume = require('../models/Resume');

const createResume = async (req, res) => {
  try {
    const { userId, fileName, resumeText } = req.body;

    const resume = await Resume.create({
      user: userId,
      fileName,
      resumeText,
    });

    res.status(201).json({ message: 'Resume saved', resume });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createResume };