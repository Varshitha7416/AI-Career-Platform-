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
  // ---- Preparation, round details, debrief and reminder (all optional, additive; docs/29) ----
  round: { type: Number, min: 1, max: 20 },
  roundLabel: { type: String, maxlength: 80 },
  prepNotes: { type: String, maxlength: 4000 },
  debrief: { type: String, maxlength: 4000 }, // notes written during/after the interview
  prepResources: {
    type: [{ _id: false, title: { type: String, maxlength: 120 }, url: { type: String, maxlength: 500 } }],
    default: undefined,
  },
  prepChecklist: {
    type: [{ _id: false, text: { type: String, maxlength: 200 }, done: { type: Boolean, default: false } }],
    default: undefined,
  },
  remindAt: { type: Date },
  reminderOffsetMinutes: { type: Number }, // when set, remindAt follows scheduledAt on reschedule
  reminderNotifiedAt: { type: Date },
}, { timestamps: true });

interviewSchema.index({ user: 1, scheduledAt: 1 });
interviewSchema.index({ application: 1 });
interviewSchema.index({ remindAt: 1 }, { sparse: true });

module.exports = mongoose.model('Interview', interviewSchema);
