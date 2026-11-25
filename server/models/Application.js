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
  // No schema default on purpose: a default would be applied when OLD documents (created before this field
  // existed) are loaded and would show "now" as their applied date. The controller sets it explicitly on create;
  // readers fall back to createdAt.
  appliedAt: {
    type: Date,
  },
  applyMethod: {
    type: String,
    enum: ['external', 'manual'],
    default: 'manual',
  },
  // Status timeline. Older records may have none; responses derive a synthetic first entry (no migration needed).
  statusHistory: {
    type: [{
      _id: false,
      status: { type: String, enum: ['applied', 'interviewing', 'rejected', 'offer'] },
      at: { type: Date, default: Date.now },
    }],
    default: undefined,
  },
}, { timestamps: true });

applicationSchema.index({ user: 1, job: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);