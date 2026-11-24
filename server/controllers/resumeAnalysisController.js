const Resume = require('../models/Resume');
const Job = require('../models/Job');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const { generateText } = require('../config/gemini');

const asStringArray = (v) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);

const analyzeResume = async (req, res, next) => {
  try {
    const { resumeId, jobId } = req.body;

    const resume = await Resume.findOne({ _id: resumeId, user: req.user.id });
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    let job = null;
    if (jobId) {
      job = await Job.findById(jobId);
      if (!job) return res.status(404).json({ message: 'Job not found' });
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

    const responseText = await generateText(prompt);

    let parsed;
    try {
      const cleaned = responseText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ message: 'The AI returned an unreadable response. Please try again.' });
    }

    let match = parsed.matchPercentage;
    match = job && Number.isFinite(Number(match)) ? Math.min(100, Math.max(0, Math.round(Number(match)))) : null;

    const analysis = await ResumeAnalysis.create({
      user: req.user.id,
      resume: resume._id,
      job: job ? job._id : undefined,
      matchPercentage: match,
      missingSkills: asStringArray(parsed.missingSkills),
      strengths: asStringArray(parsed.strengths),
      suggestions: asStringArray(parsed.suggestions),
    });

    const populated = await ResumeAnalysis.findById(analysis._id).populate('resume', 'fileName').populate({ path: 'job', select: 'title company', populate: { path: 'company', select: 'name' } });

    res.status(201).json({ message: 'Analysis complete', analysis: populated });
  } catch (error) {
    next(error);
  }
};

const getAnalyses = async (req, res, next) => {
  try {
    const analyses = await ResumeAnalysis.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('resume', 'fileName')
      .populate({ path: 'job', select: 'title company', populate: { path: 'company', select: 'name' } });

    res.status(200).json({ count: analyses.length, analyses });
  } catch (error) {
    next(error);
  }
};

const getAnalysisById = async (req, res, next) => {
  try {
    const analysis = await ResumeAnalysis.findOne({ _id: req.params.id, user: req.user.id })
      .populate('resume', 'fileName')
      .populate({ path: 'job', select: 'title company', populate: { path: 'company', select: 'name' } });
    if (!analysis) return res.status(404).json({ message: 'Analysis not found' });
    res.status(200).json({ analysis });
  } catch (error) {
    next(error);
  }
};

module.exports = { analyzeResume, getAnalyses, getAnalysisById };
