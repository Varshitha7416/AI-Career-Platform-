const mongoose = require('mongoose');

// `seeker` = the person who SENDS the request, `referrer` = the provider who RECEIVES it.
// All new fields are additive; legacy documents (seeker/referrer/message/status only) keep working.
// `requested` is the legacy status; it is read as `pending` until scripts/migrateReferralStatuses.js is applied.
const STATUSES = ['pending', 'accepted', 'referred', 'declined', 'withdrawn'];

const referralSchema = new mongoose.Schema({
  seeker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String },
  status: {
    type: String,
    enum: ['requested', ...STATUSES],
    default: 'pending',
  },
  job: {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    title: { type: String },
    company: { type: String },
    jobCode: { type: String },
    applyUrl: { type: String },
    external: { type: Boolean },
    externalJobId: { type: String },
  },
  jobKey: { type: String },
  // true while the request is pending|accepted; backs the unique partial index (duplicate rule)
  active: { type: Boolean },
  resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
  // Display metadata of the attached resume (no text); present only when a snapshot exists
  resumeInfo: {
    type: new mongoose.Schema({ name: String, fileName: String, fileType: String }, { _id: false }),
  },
  // Copy of the resume text taken at send time. NEVER returned by list/detail endpoints.
  resumeSnapshot: {
    type: new mongoose.Schema({
      name: String,
      fileName: String,
      fileType: String,
      text: String,
    }, { _id: false }),
    select: false,
  },
  statusHistory: [{
    _id: false,
    status: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  }],
  respondedAt: { type: Date },
}, { timestamps: true });

referralSchema.index({ seeker: 1, createdAt: -1 });
referralSchema.index({ referrer: 1, createdAt: -1 });
// One active request per (sender, provider, job). Uses a boolean flag because it is supported on every MongoDB version.
referralSchema.index(
  { seeker: 1, referrer: 1, jobKey: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

module.exports = mongoose.model('Referral', referralSchema);
module.exports.STATUSES = STATUSES;
