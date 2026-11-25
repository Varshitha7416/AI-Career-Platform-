const mongoose = require('mongoose');

const programEnrollmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  status: { type: String, enum: ['saved', 'in-progress', 'completed'], default: 'saved' },
  startedAt: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true });

programEnrollmentSchema.index({ user: 1, program: 1 }, { unique: true });

module.exports = mongoose.model('ProgramEnrollment', programEnrollmentSchema);
