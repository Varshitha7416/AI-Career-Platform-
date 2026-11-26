const mongoose = require('mongoose');

// One saved Skill Gap Analysis. The result is stored at creation and NEVER recomputed on read.
// Resume text is NOT stored (only a snapshot of the resume's name/type); the job description text the user
// pasted (<= 8000 chars) IS stored so the analysis stays explainable after the source changes.
// See docs/21-skill-gap-contract.md for the full contract.

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const KINDS = ['required', 'preferred', 'recommended'];
const IMPORTANCE = ['high', 'medium', 'low'];

const resumeSnapshot = new mongoose.Schema({ name: String, fileName: String, fileType: String }, { _id: false });
const jobSnapshot = new mongoose.Schema({ title: String, company: String, jobCode: String }, { _id: false });

const manualSkill = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 80 },
  key: { type: String, required: true },
  level: { type: String, enum: LEVELS }, // only when the user chose one; never inferred
}, { _id: false });

// A skill the target role needs.
const requirement = new mongoose.Schema({
  skill: { type: String, required: true },
  key: { type: String, required: true },
  kind: { type: String, enum: KINDS, required: true },
  importance: { type: String, enum: IMPORTANCE, default: 'medium' },
  source: { type: String, enum: ['job-field', 'job-text', 'ai-role'], default: 'ai-role' },
  category: { type: String, maxlength: 60 },
}, { _id: false });

const matchedItem = new mongoose.Schema({
  skill: String, key: String, kind: { type: String, enum: KINDS }, category: String,
  source: { type: String, enum: ['resume', 'manual'] },
  evidence: String, // verbatim resume snippet (resume mode only, verified against the resume text)
  level: { type: String, enum: LEVELS }, // only if the user supplied it
}, { _id: false });

const partialItem = new mongoose.Schema({
  skill: String, key: String, kind: { type: String, enum: KINDS }, importance: { type: String, enum: IMPORTANCE },
  mention: { type: String, enum: ['skills-list', 'mention'] }, // how the resume names it: only in a skills list/section, or merely mentioned
  evidence: String, reason: String, suggestion: String,
}, { _id: false });

const missingItem = new mongoose.Schema({
  skill: String, key: String, kind: { type: String, enum: KINDS }, importance: { type: String, enum: IMPORTANCE },
  priority: { type: String, enum: IMPORTANCE }, why: String, category: String,
}, { _id: false });

const additionalItem = new mongoose.Schema({ skill: String, key: String, note: String }, { _id: false });

const skillGapAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 160 },
  mode: { type: String, enum: ['resume', 'manual'], required: true },
  // 'resume-verified' = every matched skill was checked against resume text; 'manual-input' = self-reported.
  basis: { type: String, enum: ['resume-verified', 'manual-input'], required: true },
  // job = a CareerNest job; custom-jd = pasted job description; role-only = just a role name (AI-derived typical skills).
  targetKind: { type: String, enum: ['job', 'custom-jd', 'role-only'], required: true },
  targetRole: { type: String, required: true, maxlength: 120 },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  jobSnapshot: { type: jobSnapshot, default: undefined },
  jobDescriptionText: { type: String, maxlength: 8000 },
  resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
  resumeSnapshot: { type: resumeSnapshot, default: undefined },
  input: {
    manualSkills: { type: [manualSkill], default: undefined },
    experienceYears: { type: Number, min: 0, max: 60 },
    education: { type: String, maxlength: 120 },
    domain: { type: String, maxlength: 120 },
    projects: { type: String, maxlength: 2000 },
    goals: { type: String, maxlength: 1000 },
  },
  requirements: { type: [requirement], default: [] },
  result: {
    matched: { type: [matchedItem], default: [] },
    partial: { type: [partialItem], default: [] },
    missing: { type: [missingItem], default: [] },
    additional: { type: [additionalItem], default: [] },
    priorities: { high: [String], medium: [String], low: [String] }, // skill display names
    summary: { type: String, maxlength: 2000 },
    scoreExplanation: { type: String, maxlength: 1500 },
  },
  score: {
    value: { type: Number, min: 0, max: 100, required: true },
    method: { type: String, default: 'v2' },
    requiredCoverage: Number, // 0-100 or null when the target has none
    preferredCoverage: Number,
    counts: { required: Number, preferred: Number, matched: Number, partial: Number, missing: Number },
  },
  inputHash: { type: String },
  // Internal: roadmap-generation lock (see utils/roadmap/lock.js). Never returned by the API.
  roadmapLock: { type: new mongoose.Schema({ token: String, at: Date }, { _id: false }), select: false },
}, { timestamps: true });

skillGapAnalysisSchema.index({ user: 1, createdAt: -1 });
skillGapAnalysisSchema.index({ user: 1, inputHash: 1, createdAt: -1 });
skillGapAnalysisSchema.index({ user: 1, job: 1 });

module.exports = mongoose.model('SkillGapAnalysis', skillGapAnalysisSchema);
module.exports.LEVELS = LEVELS;
module.exports.KINDS = KINDS;
module.exports.IMPORTANCE = IMPORTANCE;
