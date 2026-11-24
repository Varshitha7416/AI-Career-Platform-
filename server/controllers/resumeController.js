const Resume = require('../models/Resume');
const { PDFParse } = require('pdf-parse');

const createResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    if (req.file.size === 0) {
      return res.status(400).json({ message: 'The uploaded file is empty' });
    }
    // Magic-number check: real PDFs start with "%PDF"
    if (req.file.buffer.slice(0, 4).toString() !== '%PDF') {
      return res.status(400).json({ message: 'Invalid PDF file' });
    }

    let resumeText;
    try {
      const parser = new PDFParse({ data: req.file.buffer });
      const result = await parser.getText();
      resumeText = (result.text || '').trim();
    } catch (err) {
      console.error('PDF parse error:', err.message);
      return res.status(400).json({ message: 'Could not read this PDF. It may be corrupted or password protected.' });
    }

    if (!resumeText) {
      return res.status(400).json({ message: 'No text could be extracted. Scanned/image-only PDFs are not supported.' });
    }

    const resume = await Resume.create({
      user: req.user.id,
      fileName: req.file.originalname,
      resumeText,
    });

    res.status(201).json({ message: 'Resume uploaded', resume: { _id: resume._id, fileName: resume.fileName, createdAt: resume.createdAt } });
  } catch (error) {
    next(error);
  }
};

const getResumes = async (req, res, next) => {
  try {
    const resumes = await Resume.find({ user: req.user.id }).select('fileName createdAt').sort({ createdAt: -1 });
    res.status(200).json({ count: resumes.length, resumes });
  } catch (error) {
    next(error);
  }
};

module.exports = { createResume, getResumes };
