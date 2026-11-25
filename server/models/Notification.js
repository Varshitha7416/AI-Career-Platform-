const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['application', 'interview', 'referral', 'system'], default: 'system' },
  title: { type: String, required: true, maxlength: 200 },
  message: { type: String, maxlength: 500 },
  link: { type: String, maxlength: 300 },
  read: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
