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
  // ---- Tracker details (all optional, additive: older records simply lack them; docs/29) ----
  notes: { type: String, maxlength: 2000 },
  followUpAt: { type: Date },
  nextAction: {
    type: new mongoose.Schema({
      text: { type: String, maxlength: 200 },
      dueAt: { type: Date },
    }, { _id: false }),
    default: undefined,
  },
  externalUrl: { type: String, maxlength: 500 }, // http(s) only, validated in the controller
  resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
  coverLetter: { type: mongoose.Schema.Types.ObjectId, ref: 'CoverLetter' },
  // Reminder: stored as a due time; a database-backed materialiser creates the notification (utils/reminders.js).
  reminderAt: { type: Date },
  reminderNotifiedAt: { type: Date },
}, { timestamps: true });

applicationSchema.index({ user: 1, job: 1 }, { unique: true });
applicationSchema.index({ reminderAt: 1 }, { sparse: true });

module.exports = mongoose.model('Application', applicationSchema);