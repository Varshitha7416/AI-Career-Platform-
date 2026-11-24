const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
  },
  status: {
    type: String,
    enum: ['applied', 'interviewing', 'rejected', 'offer'],
    default: 'applied',
  },
  // When the user says they applied, and how it was done (external employer link or tracked manually).
  appliedAt: {
    type: Date,
    default: Date.now,
  },
  applyMethod: {
    type: String,
    enum: ['external', 'manual'],
    default: 'manual',
  },
}, { timestamps: true });

applicationSchema.index({ user: 1, job: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);