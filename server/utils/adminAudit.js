const AdminAuditLog = require('../models/AdminAuditLog');

// Records an admin action. Never throws: an audit failure must not break the action itself.
// Usage: await recordAdminAction({ actor: req.user.id, action: 'job.created', targetType: 'job', targetId: job._id, summary: 'Created job "X"' })
const recordAdminAction = async ({ actor, action, targetType, targetId, summary = '' }) => {
  try {
    await AdminAuditLog.create({
      actor,
      action: String(action).slice(0, 60),
      targetType: String(targetType).slice(0, 40),
      targetId: targetId || undefined,
      summary: String(summary || '').slice(0, 300),
    });
    return true;
  } catch (err) {
    console.error('Audit log write failed:', err.message);
    return false;
  }
};

module.exports = { recordAdminAction };
