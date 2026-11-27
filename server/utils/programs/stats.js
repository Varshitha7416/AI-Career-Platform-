const Program = require('../../models/Program');
const ProgramEnrollment = require('../../models/ProgramEnrollment');
const User = require('../../models/User');

// Single source of truth for Career Program statistics (used by GET /admin/programs/stats and GET /admin/overview).
// Program state: archived (archivedAt set) > inactive (isActive === false) > active.
// Enrollments are counted only when BOTH the program and a live (not deleted/anonymised) user still exist;
// the rest are reported separately as `orphaned` so totals never include stale rows and nothing is double counted
// (the unique (user, program) index guarantees one row per pair).
const getProgramStats = async ({ topLimit = 5 } = {}) => {
  const [stateRows, enrollRows] = await Promise.all([
    Program.aggregate([{ $group: { _id: { $cond: [{ $ifNull: ['$archivedAt', false] }, 'archived', { $cond: [{ $eq: ['$isActive', false] }, 'inactive', 'active'] }] }, n: { $sum: 1 } } }]),
    ProgramEnrollment.aggregate([
      { $lookup: { from: Program.collection.name, localField: 'program', foreignField: '_id', as: 'p', pipeline: [{ $project: { _id: 1 } }] } },
      { $lookup: { from: User.collection.name, localField: 'user', foreignField: '_id', as: 'u', pipeline: [{ $project: { deletedAt: 1 } }] } },
      { $set: { valid: { $and: [{ $gt: [{ $size: '$p' }, 0] }, { $gt: [{ $size: '$u' }, 0] }, { $eq: [{ $ifNull: [{ $first: '$u.deletedAt' }, null] }, null] }] } } },
      { $group: { _id: { valid: '$valid', status: '$status', program: '$program' }, n: { $sum: 1 } } },
    ]),
  ]);
  const programs = { total: 0, active: 0, inactive: 0, archived: 0 };
  stateRows.forEach((r) => { programs[r._id] = r.n; programs.total += r.n; });

  const enrollments = { saved: 0, inProgress: 0, completed: 0, total: 0, orphaned: 0 };
  const perProgram = new Map();
  enrollRows.forEach((r) => {
    if (!r._id.valid) { enrollments.orphaned += r.n; return; }
    const key = r._id.status === 'in-progress' ? 'inProgress' : r._id.status;
    if (key in enrollments) { enrollments[key] += r.n; enrollments.total += r.n; }
    const id = String(r._id.program);
    perProgram.set(id, (perProgram.get(id) || 0) + r.n);
  });
  const top = [...perProgram.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, topLimit);
  const titles = await Program.find({ _id: { $in: top.map(([id]) => id) } }).select('title').lean();
  const titleOf = new Map(titles.map((t) => [String(t._id), t.title]));
  return { programs, enrollments, topPrograms: top.map(([id, n]) => ({ id, title: titleOf.get(id) || 'Deleted program', enrollments: n })) };
};

module.exports = { getProgramStats };
