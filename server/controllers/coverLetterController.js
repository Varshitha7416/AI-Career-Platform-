const { GoogleGenerativeAI } = require('@google/generative-ai');
const Resume = require('../models/Resume');
const Job = require('../models/Job');
const CoverLetter = require('../models/CoverLetter');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateCoverLetter = async (req, res) => {
  try {
    const { userId, resumeId, jobId } = req.body;

    const resume = await Resume.findById(resumeId);
    const job = await Job.findById(jobId);

    if (!resume || !job) {
      return res.status(404).json({ message: 'Resume or Job not found' });
    }

    const prompt = `
Write a professional, concise cover letter (under 300 words) for the following job application.

Candidate Resume:
${resume.resumeText}

Job Title: ${job.title}
Company: ${job.company}
Job Description:
${job.jobDescription}

Write only the cover letter text, no extra commentary, no markdown formatting, no placeholders like [Your Name] — use the candidate's actual details from the resume where possible.
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const result = await model.generateContent(prompt);
    const generatedText = result.response.text().trim();

    const coverLetter = await CoverLetter.create({
      user: userId,
      job: jobId,
      resume: resumeId,
      generatedText,
    });

    res.status(201).json({ message: 'Cover letter generated', coverLetter });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { generateCoverLetter };