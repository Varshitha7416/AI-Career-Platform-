const Program = require('../models/Program');
const ProgramEnrollment = require('../models/ProgramEnrollment');
const { escapeRegex } = require('../middleware/validate');
const { notify } = require('../utils/notify');
const { parseDurationWeeks, DURATION_BUCKETS } = require('../utils/programs/duration');
const { ENROLL_STATUSES, computeNext, effectiveEnrollment, sameState } = require('../utils/programs/progress');

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const ENROLLMENT_FILTERS = ['saved', 'in-progress', 'completed', 'not-started'];
const MINE_SORTS = ['updated', 'title', 'progress'];

const bad = (message) => Object.assign(new Error(message), { status: 400 });
// Query values must be a single string; repeated keys (?level=a&level=b) are rejected instead of silently picking one.
const one = (v, name) => {
  if (v === undefined) return '';
  if (typeof v !== 'string') throw bad(`${name} must be a single value`);
  return v.trim();
};
const positiveInt = (v, name, fallback, max) => {
  const s = one(v, name);
  if (!s) return fallback;
  if (!/^\d+$/.test(s) || Number(s) < 1) throw bad(`${name} must be a positive whole number`);
  return Math.min(Number(s), max);
};
const isAvailable = (p) => p.isActive !== false && !p.archivedAt;
const sortedMilestones = (p) => [...(p.milestones || [])].sort((a, b) => a.order - b.order).map((m) => ({ title: m.title, order: m.order }));

const publicProgram = (p) => ({ ...p, id: String(p._id), milestones: sortedMilestones(p), available: isAvailable(p) });

// Programs created before durationWeeks existed get it filled in once per process (additive, idempotent).
let backfilled = false;
const ensureDurationWeeks = async () => {
  if (backfilled) return;
  const docs = await Program.find({ durationWeeks: { $exists: false }, duration: { $type: 'string' } }).select('duration').lean();
  const ops = docs
    .map((d) => ({ w: parseDurationWeeks(d.duration), id: d._id }))
    .filter((x) => x.w)
    .map((x) => ({ updateOne: { filter: { _id: x.id }, update: { $set: { durationWeeks: x.w } } } }));
  if (ops.length) await Program.bulkWrite(ops, { timestamps: false });
  backfilled = true;
};

const listPrograms = async (req, res, next) => {
  try {
    const page = positiveInt(req.query.page, 'page', 1, 100000);
    const limit = positiveInt(req.query.limit, 'limit', 12, 50);
    const category = one(req.query.category, 'category');
    const q = one(req.query.q, 'q');
    const levelRaw = one(req.query.level, 'level');
    const duration = one(req.query.duration, 'duration').toLowerCase();
    const enrollmentFilter = one(req.query.enrollment, 'enrollment').toLowerCase();

    const level = levelRaw ? LEVELS.find((l) => l.toLowerCase() === levelRaw.toLowerCase()) : '';
    if (levelRaw && !level) throw bad(`level must be one of: ${LEVELS.join(', ')}`);
    if (duration && !DURATION_BUCKETS[duration]) throw bad(`duration must be one of: ${Object.keys(DURATION_BUCKETS).join(', ')}`);
    if (enrollmentFilter && !ENROLLMENT_FILTERS.includes(enrollmentFilter)) throw bad(`enrollment must be one of: ${ENROLLMENT_FILTERS.join(', ')}`);

    const filter = { isActive: true, archivedAt: { $exists: false } };
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (duration) {
      await ensureDurationWeeks();
      Object.assign(filter, DURATION_BUCKETS[duration]);
    }
    if (q) {
      const re = { $regex: escapeRegex(q.slice(0, 80)), $options: 'i' };
      filter.$or = [{ title: re }, { provider: re }, { description: re }, { skills: re }, { category: re }];
    }
    if (enrollmentFilter) {
      const mine = await ProgramEnrollment.find({ user: req.user.id }).select('program status').lean();
      if (enrollmentFilter === 'not-started') filter._id = { $nin: mine.map((e) => e.program) };
      else filter._id = { $in: mine.filter((e) => e.status === enrollmentFilter).map((e) => e.program) };
    }

    const [total, programs, categories] = await Promise.all([
      Program.countDocuments(filter),
      Program.find(filter).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Program.distinct('category', { isActive: true, archivedAt: { $exists: false } }),
    ]);

    const enrollments = programs.length
      ? await ProgramEnrollment.find({ user: req.user.id, program: { $in: programs.map((p) => p._id) } }).lean()
      : [];
    const byProgram = new Map(enrollments.map((e) => [String(e.program), e]));

    res.status(200).json({
      programs: programs.map((p) => {
        const e = byProgram.get(String(p._id));
        const eff = e ? effectiveEnrollment(e, p) : null;
        return { ...publicProgram(p), enrollment: e ? e.status : null, enrollmentProgress: eff ? eff.progress : null };
      }),
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
      categories: categories.sort(),
    });
  } catch (error) {
    next(error);
  }
};

const getProgram = async (req, res, next) => {
  try {
    const program = await Program.findById(req.params.id).lean();
    if (!program) return res.status(404).json({ message: 'Program not found' });
    const enrollment = await ProgramEnrollment.findOne({ user: req.user.id, program: program._id }).lean();
    // Unavailable programs are hidden from discovery, but a user who saved/enrolled can still open their record.
    if (!isAvailable(program) && !enrollment) return res.status(404).json({ message: 'Program not found' });
    res.status(200).json({
      program: publicProgram(program),
      // detail view returns the full enrollment object; list/overview only carry the status string
      enrollment: enrollment ? effectiveEnrollment(enrollment, program) : null,
    });
  } catch (error) {
    next(error);
  }
};

const myPrograms = async (req, res, next) => {
  try {
    const status = one(req.query.status, 'status').toLowerCase() || 'all';
    const sort = one(req.query.sort, 'sort').toLowerCase() || 'updated';
    const q = one(req.query.q, 'q').toLowerCase();
    const page = positiveInt(req.query.page, 'page', 1, 100000);
    const limit = positiveInt(req.query.limit, 'limit', 12, 50);
    if (status !== 'all' && !ENROLL_STATUSES.includes(status)) throw bad(`status must be one of: all, ${ENROLL_STATUSES.join(', ')}`);
    if (!MINE_SORTS.includes(sort)) throw bad(`sort must be one of: ${MINE_SORTS.join(', ')}`);

    const enrollments = await ProgramEnrollment.find({ user: req.user.id }).populate('program').lean();
    const rows = enrollments.filter((e) => e.program).map((e) => ({
      program: publicProgram(e.program),
      enrollment: effectiveEnrollment(e, e.program),
    }));
    const counts = { all: rows.length, saved: 0, 'in-progress': 0, completed: 0 };
    rows.forEach((r) => { counts[r.enrollment.status] += 1; });

    let list = rows;
    if (status !== 'all') list = list.filter((r) => r.enrollment.status === status);
    if (q) list = list.filter((r) => `${r.program.title} ${r.program.provider}`.toLowerCase().includes(q));
    const byTitle = (a, b) => a.program.title.localeCompare(b.program.title);
    if (sort === 'title') list.sort(byTitle);
    else if (sort === 'progress') list.sort((a, b) => b.enrollment.progress - a.enrollment.progress || byTitle(a, b));
    else list.sort((a, b) => new Date(b.enrollment.updatedAt) - new Date(a.enrollment.updatedAt) || byTitle(a, b));

    const total = list.length;
    res.status(200).json({
      items: list.slice((page - 1) * limit, page * limit),
      counts,
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    next(error);
  }
};

const notifyChange = (userId, program, prevStatus, state) => {
  const link = `/programs/${program._id}`;
  if (state.status === 'completed') return notify(userId, { type: 'program', title: 'Program completed', message: `You completed "${program.title}". Great work!`, link });
  if (state.status === 'in-progress') {
    const verb = prevStatus === 'completed' ? 'resumed' : 'started';
    return notify(userId, { type: 'program', title: `Program ${verb}`, message: `You ${verb} "${program.title}".`, link });
  }
  return notify(userId, { type: 'program', title: 'Program saved', message: `"${program.title}" is saved to your programs.`, link });
};

const setEnrollment = async (req, res, next) => {
  try {
    const body = req.body || {};
    const status = body.status === undefined ? undefined : String(body.status);
    if (status !== undefined && status !== 'none' && !ENROLL_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${[...ENROLL_STATUSES, 'none'].join(', ')}` });
    }
    const program = await Program.findById(req.params.id).lean();
    if (!program) return res.status(404).json({ message: 'Program not found' });

    const userId = req.user.id;
    if (status === 'none') {
      await ProgramEnrollment.deleteOne({ user: userId, program: program._id });
      return res.status(200).json({ message: 'Removed from your programs', enrollment: null });
    }
    if (!isAvailable(program)) {
      return res.status(409).json({ message: 'This program is no longer available', code: 'PROGRAM_UNAVAILABLE' });
    }

    const input = { status, progress: body.progress, completedMilestones: body.completedMilestones };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const prev = await ProgramEnrollment.findOne({ user: userId, program: program._id }).lean();
      const result = computeNext(prev, program, input);
      if (result.error) return res.status(400).json({ message: result.error });
      const { state } = result;

      if (prev && sameState(prev, state)) {
        return res.status(200).json({ message: 'No changes', enrollment: effectiveEnrollment(prev, program) });
      }
      if (!prev) {
        const insert = { ...state };
        if (!insert.startedAt) delete insert.startedAt;
        if (!insert.completedAt) delete insert.completedAt;
        const r = await ProgramEnrollment.updateOne({ user: userId, program: program._id }, { $setOnInsert: insert }, { upsert: true });
        if (r.upsertedCount !== 1) continue; // another request created it first: recompute against it
        await notifyChange(userId, program, null, state);
      } else {
        const update = { $set: { status: state.status, progress: state.progress, completedMilestones: state.completedMilestones } };
        const unset = {};
        if (state.startedAt) update.$set.startedAt = state.startedAt; else unset.startedAt = '';
        if (state.completedAt) update.$set.completedAt = state.completedAt; else unset.completedAt = '';
        update.$unset = unset;
        // compare-and-set on the previous state: only the request that wins the transition notifies
        const r = await ProgramEnrollment.updateOne({ _id: prev._id, status: prev.status, progress: prev.progress, updatedAt: prev.updatedAt }, update);
        if (r.modifiedCount !== 1) continue;
        if (prev.status !== state.status) await notifyChange(userId, program, prev.status, state);
      }
      const doc = await ProgramEnrollment.findOne({ user: userId, program: program._id }).lean();
      return res.status(200).json({ message: 'Program updated', enrollment: effectiveEnrollment(doc, program) });
    }
    return res.status(409).json({ message: 'Your enrollment was changed by another request. Please try again.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { listPrograms, getProgram, setEnrollment, myPrograms, LEVELS, isAvailable, publicProgram };
