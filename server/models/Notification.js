const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['application', 'interview', 'referral', 'program', 'reminder', 'support', 'system'], default: 'system' },
  title: { type: String, required: true, maxlength: 200 },
  message: { type: String, maxlength: 500 },
  link: { type: String, maxlength: 300 },
  read: { type: Boolean, default: false },
  // Optional idempotency key (reminders): a second create with the same key fails on the unique index instead of duplicating.
  dedupeKey: { type: String, maxlength: 200 },
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Notification', notificationSchema);
