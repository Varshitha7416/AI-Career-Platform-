const mongoose = require('mongoose');

// One record per upload. Raw files are never stored, only the extracted text.
// New fields are additive: legacy documents (fileName + resumeText only) keep working;
// the DTO derives name/fileType for them.
const resumeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true },
  resumeText: { type: String, required: true },
  name: { type: String, trim: true, maxlength: 100 },
  fileType: { type: String, enum: ['pdf', 'docx', 'txt'] },
  fileSize: { type: Number, min: 0 },
  isDefault: { type: Boolean, default: false },
  // Optional career interest this resume is assigned to (one resume per role). null/missing = unassigned (all legacy resumes).
  targetRole: { type: String, maxlength: 80, default: null },
  targetRoleKey: { type: String, maxlength: 80, default: null },
}, { timestamps: true });

resumeSchema.index({ user: 1, createdAt: -1 });
resumeSchema.index({ user: 1, targetRoleKey: 1 });

module.exports = mongoose.model('Resume', resumeSchema);
