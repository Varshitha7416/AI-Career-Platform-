const User = require('../models/User');
const Job = require('../models/Job');
const Company = require('../models/Company');
const { getProgramStats } = require('../utils/programs/stats');
const AdminAuditLog = require('../models/AdminAuditLog');

const formatEntry = (e) => ({
  id: e._id,
  action: e.action,
  targetType: e.targetType,
  targetId: e.targetId || null,
  summary: e.summary,
  actorName: e.actor?.name || 'Former admin',
  createdAt: e.createdAt,
});

// All numbers are computed live from the collections (no cached or fabricated values).
const getOverview = async (req, res, next) => {
  try {
    const now = new Date();
    const liveUsers = { deletedAt: { $in: [null, undefined] } };
    const open = { isActive: { $ne: false }, status: { $ne: 'closed' }, $or: [{ applicationDeadline: null }, { applicationDeadline: { $gte: now } }] };
    const [
      users, verified, jobsTotal, jobsOpen, jobsClosed, jobsInactive, jobsExpired,
      companiesTotal, companiesActive, programStats, recent,
    ] = await Promise.all([
      User.countDocuments(liveUsers),
      User.countDocuments({ ...liveUsers, emailVerified: true }),
      Job.countDocuments({}),
      Job.countDocuments(open),
      Job.countDocuments({ isActive: { $ne: false }, status: 'closed' }),
      Job.countDocuments({ isActive: false }),
      Job.countDocuments({ isActive: { $ne: false }, status: { $ne: 'closed' }, applicationDeadline: { $lt: now } }),
      Company.countDocuments({}),
      Company.countDocuments({ isActive: { $ne: false } }),
      getProgramStats({ topLimit: 0 }),
      AdminAuditLog.find().sort({ createdAt: -1, _id: -1 }).limit(10).populate('actor', 'name').lean(),
    ]);
    const { programs: ps, enrollments: en } = programStats;

    res.status(200).json({
      users: { total: users, verified, unverified: users - verified },
      jobs: { total: jobsTotal, active: jobsOpen, closed: jobsClosed, inactive: jobsInactive, expired: jobsExpired },
      companies: { total: companiesTotal, active: companiesActive, archived: companiesTotal - companiesActive },
      programs: {
        total: ps.total,
        active: ps.active,
        inactive: ps.inactive,
        archived: ps.archived,
        enrollments: { total: en.total, orphaned: en.orphaned, byStatus: { saved: en.saved, 'in-progress': en.inProgress, completed: en.completed } },
      },
      recentActivity: recent.map(formatEntry),
    });
  } catch (error) {
    next(error);
  }
};

const getActivity = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const [items, total] = await Promise.all([
      AdminAuditLog.find().sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate('actor', 'name').lean(),
      AdminAuditLog.countDocuments({}),
    ]);
    res.status(200).json({ count: items.length, total, page, pages: Math.max(Math.ceil(total / limit), 1), activity: items.map(formatEntry) });
  } catch (error) {
    next(error);
  }
};

module.exports = { getOverview, getActivity };
