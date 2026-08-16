const Resume = require('../models/Resume');
const { PDFParse } = require('pdf-parse');

const createResume = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const parser = new PDFParse({ data: req.file.buffer });
    const result = await parser.getText();
    const resumeText = result.text;

    const resume = await Resume.create({
      user: userId,
      fileName: req.file.originalname,
      resumeText,
    });

    res.status(201).json({ message: 'Resume uploaded', resume });
  } catch (error) {
    console.error('RESUME UPLOAD ERROR:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createResume };