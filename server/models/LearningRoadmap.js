const mongoose = require('mongoose');

// Personalised learning roadmap for ONE analysis (at most one per user+analysis; regenerate replaces it).
// Progress is never stored as a number: it is always computed from the stored task statuses.
// Tasks are never auto-marked as "mastered": completing tasks does not change the analysis score.

const STATUSES = ['not-started', 'in-progress', 'completed'];

const resourceSchema = new mongoose.Schema({
  type: { type: String, enum: ['program', 'activity'], required: true },
  // type 'program' = a real Career Program from our catalogue (never invented); 'activity' = a plain practical activity (no link).
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  title: String, provider: String, url: String, duration: String,
}, { _id: false });

const taskSchema = new mongoose.Schema({
  id: { type: String, required: true }, // stable within the roadmap, e.g. "t1"
  skill: { type: String, required: true },
  skillKey: { type: String, required: true },
  title: { type: String, required: true, maxlength: 160 },
  objective: { type: String, maxlength: 500 },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  activity: { type: String, maxlength: 600 },
  estimatedHours: { type: Number, min: 1, max: 200 },
  exercise: { type: String, maxlength: 600 }, // practical exercise / mini project
  completionCriteria: { type: String, maxlength: 400 },
  resource: { type: resourceSchema, default: null },
  status: { type: String, enum: STATUSES, default: 'not-started' },
  notes: { type: String, maxlength: 1000, default: '' },
  startedAt: Date,
  completedAt: Date,
}, { _id: false });

const stageSchema = new mongoose.Schema({
  id: { type: String, required: true }, // "s1"...
  order: { type: Number, required: true },
  title: { type: String, required: true, maxlength: 120 },
  goal: { type: String, maxlength: 400 },
  tasks: { type: [taskSchema], default: [] },
}, { _id: false });

const learningRoadmapSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'SkillGapAnalysis', required: true },
  title: { type: String, required: true, maxlength: 160 },
  targetRole: { type: String, required: true, maxlength: 120 },
  weeklyHours: { type: Number, min: 1, max: 60 }, // only if the user chose a pace; null = no fixed pace
  estimateNote: { type: String, maxlength: 400 },
  stages: { type: [stageSchema], default: [] },
  // The learner's own updated rating for a skill (explicit user input only).
  skillLevels: { type: [new mongoose.Schema({
    skillKey: String, level: { type: String, enum: ['beginner', 'intermediate', 'advanced'] }, updatedAt: Date,
  }, { _id: false })], default: [] },
}, { timestamps: true });

learningRoadmapSchema.index({ user: 1, analysis: 1 }, { unique: true });
learningRoadmapSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('LearningRoadmap', learningRoadmapSchema);
module.exports.STATUSES = STATUSES;
