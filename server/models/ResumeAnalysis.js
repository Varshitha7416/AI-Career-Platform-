const mongoose = require('mongoose');

const resumeSnapshot = new mongoose.Schema({
  name: String, fileName: String, fileType: String,
}, { _id: false });

const jobSnapshot = new mongoose.Schema({
  title: String, company: String, jobCode: String, manual: { type: Boolean, default: false },
}, { _id: false });

// Legacy flat fields (matchPercentage, missingSkills, strengths, suggestions) stay and are always filled.
// New analyses also carry `result` (structured, see docs/14) plus snapshots so history
// survives deletion of the resume or the job.
const resumeAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  type: { type: String, enum: ['general', 'job-specific'] },
  resumeSnapshot: { type: resumeSnapshot, default: undefined },
  jobSnapshot: { type: jobSnapshot, default: undefined },
  overallScore: { type: Number, min: 0, max: 100 },
  matchPercentage: { type: Number },
  summary: { type: String },
  result: { type: mongoose.Schema.Types.Mixed },
  inputHash: { type: String },
  missingSkills: { type: [String], default: [] },
  strengths: { type: [String], default: [] },
  suggestions: { type: [String], default: [] },
}, { timestamps: true });

resumeAnalysisSchema.index({ user: 1, createdAt: -1 });
resumeAnalysisSchema.index({ user: 1, resume: 1, job: 1 });
resumeAnalysisSchema.index({ user: 1, inputHash: 1, createdAt: -1 });

module.exports = mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
