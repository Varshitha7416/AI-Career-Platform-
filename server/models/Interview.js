const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  scheduledAt: { type: Date, required: true },
  durationMinutes: { type: Number, default: 60, min: 5, max: 600 },
  mode: { type: String, enum: ['video', 'phone', 'onsite'], default: 'video' },
  type: { type: String, enum: ['screening', 'technical', 'hr', 'managerial', 'final', 'other'], default: 'screening' },
  location: { type: String, maxlength: 500 },
  notes: { type: String, maxlength: 2000 },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  // When the status last changed (completed/cancelled), so later edits to notes etc. don't move activity times.
  statusChangedAt: { type: Date },
}, { timestamps: true });

interviewSchema.index({ user: 1, scheduledAt: 1 });
interviewSchema.index({ application: 1 });

module.exports = mongoose.model('Interview', interviewSchema);
