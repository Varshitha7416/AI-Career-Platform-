const Resume = require('../models/Resume');
const Job = require('../models/Job');
const CoverLetter = require('../models/CoverLetter');
const { generateText } = require('../config/gemini');

const generateCoverLetter = async (req, res, next) => {
  try {
    const { resumeId, jobId } = req.body;

    const resume = await Resume.findOne({ _id: resumeId, user: req.user.id });
    const job = await Job.findById(jobId).populate('company');

    if (!resume || !job) {
      return res.status(404).json({ message: 'Resume or Job not found' });
    }

    const prompt = `
Write a professional, concise cover letter (under 300 words) for the following job application.

Candidate Resume:
${resume.resumeText}

Job Title: ${job.title}
Company: ${job.company?.name || 'the company'}
Location: ${job.city}
Job Description:
${job.jobDescription}

Write only the cover letter text, no extra commentary, no markdown formatting, no placeholders like [Your Name] — use the candidate's actual details from the resume where possible.
`;

    const generatedText = (await generateText(prompt)).trim();
    if (!generatedText) {
      return res.status(502).json({ message: 'The AI returned an empty response. Please try again.' });
    }

    const created = await CoverLetter.create({
      user: req.user.id,
      job: job._id,
      resume: resume._id,
      generatedText,
    });

    const coverLetter = await CoverLetter.findById(created._id).populate({
      path: 'job',
      select: 'title company',
      populate: { path: 'company', select: 'name' },
    });

    res.status(201).json({ message: 'Cover letter generated', coverLetter });
  } catch (error) {
    next(error);
  }
};

const getCoverLetters = async (req, res, next) => {
  try {
    const all = await CoverLetter.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({ path: 'job', select: 'title company', populate: { path: 'company', select: 'name' } });

    res.status(200).json({ count: all.length, coverLetters: all });
  } catch (error) {
    next(error);
  }
};

const getCoverLetterById = async (req, res, next) => {
  try {
    const coverLetter = await CoverLetter.findOne({ _id: req.params.id, user: req.user.id })
      .populate({ path: 'job', select: 'title company', populate: { path: 'company', select: 'name' } });
    if (!coverLetter) return res.status(404).json({ message: 'Cover letter not found' });
    res.status(200).json({ coverLetter });
  } catch (error) {
    next(error);
  }
};

module.exports = { generateCoverLetter, getCoverLetters, getCoverLetterById };
