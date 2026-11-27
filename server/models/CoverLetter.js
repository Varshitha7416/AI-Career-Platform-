const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  text: { type: String, required: true },
  source: { type: String, enum: ['ai', 'edit', 'regeneration', 'restore'], required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

// `generatedText` stays the text of the original AI generation (legacy letters only have this).
// `currentText` is the editable text; absent on legacy docs (DTO falls back to generatedText).
const coverLetterSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }, // optional: manual jobs have none
  resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
  generatedText: { type: String },
  currentText: { type: String },
  jobSnapshot: {
    type: new mongoose.Schema({
      title: String, company: String, jobCode: String, manual: { type: Boolean, default: false },
    }, { _id: false }),
    default: undefined,
  },
  resumeSnapshot: {
    type: new mongoose.Schema({
      name: String, fileName: String, fileType: String,
    }, { _id: false }),
    default: undefined,
  },
  manualJobDescription: { type: String, select: false },
  analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'ResumeAnalysis' },
  options: {
    tone: { type: String, enum: ['professional', 'confident', 'concise'] },
    length: { type: String, enum: ['standard', 'detailed'] },
    instructions: String,
    userFacts: String,
    useAnalysis: Boolean,
  },
  versions: { type: [versionSchema], default: [] },
  editedAt: { type: Date },
  groundingWarnings: { type: [String], default: [] },
  needsInfo: { type: [String], default: [] },
}, { timestamps: true });

coverLetterSchema.index({ user: 1, createdAt: -1 });
coverLetterSchema.index({ user: 1, resume: 1 });
coverLetterSchema.index({ user: 1, job: 1 });

module.exports = mongoose.model('CoverLetter', coverLetterSchema);
