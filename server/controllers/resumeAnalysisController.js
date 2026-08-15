const { GoogleGenerativeAI } = require('@google/generative-ai');
const Resume = require('../models/Resume');
const Job = require('../models/Job');
const ResumeAnalysis = require('../models/ResumeAnalysis');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const analyzeResume = async (req, res) => {
  try {
    const { userId, resumeId, jobId } = req.body;

    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    let job = null;
    if (jobId) {
      job = await Job.findById(jobId);
    }

    const prompt = `
You are a resume analysis assistant. Analyze the following resume${job ? ' against the given job description' : ''}.

Resume:
${resume.resumeText}

${job ? `Job Description:\n${job.jobDescription}\n` : ''}

Respond ONLY in valid JSON, no extra text, no markdown, in exactly this format:
{
  "matchPercentage": <number 0-100${job ? '' : ', or null if no job description was given'}>,
  "missingSkills": ["skill1", "skill2"],
  "strengths": ["strength1", "strength2"],
  "suggestions": ["suggestion1", "suggestion2"]
}
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const cleanedText = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    const analysis = await ResumeAnalysis.create({
      user: userId,
      resume: resumeId,
      job: jobId || undefined,
      matchPercentage: parsed.matchPercentage,
      missingSkills: parsed.missingSkills,
      strengths: parsed.strengths,
      suggestions: parsed.suggestions,
    });

    res.status(201).json({ message: 'Analysis complete', analysis });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { analyzeResume };