const mongoose = require('mongoose');

// Append-only record of admin actions. `summary` is a short human sentence; never store passwords, tokens or personal data.
const adminAuditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, maxlength: 60 },
  targetType: { type: String, required: true, maxlength: 40 },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  summary: { type: String, default: '', maxlength: 300 },
}, { timestamps: { createdAt: true, updatedAt: false } });

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
