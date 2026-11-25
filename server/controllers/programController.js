const Program = require('../models/Program');
const ProgramEnrollment = require('../models/ProgramEnrollment');
const { escapeRegex } = require('../middleware/validate');

const ENROLL_STATUSES = ['saved', 'in-progress', 'completed'];

const withId = (p, enrollment) => ({ ...p, id: String(p._id), enrollment });

const listPrograms = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);

    const filter = { isActive: true };
    if (req.query.category) filter.category = String(req.query.category);
    const q = String(req.query.q || '').trim();
    if (q) {
      const re = { $regex: escapeRegex(q.slice(0, 80)), $options: 'i' };
      filter.$or = [{ title: re }, { provider: re }, { description: re }, { skills: re }, { category: re }];
    }

    const [total, programs, categories] = await Promise.all([
      Program.countDocuments(filter),
      Program.find(filter).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Program.distinct('category', { isActive: true }),
    ]);

    const enrollments = programs.length
      ? await ProgramEnrollment.find({ user: req.user.id, program: { $in: programs.map((p) => p._id) } }).select('program status').lean()
      : [];
    const statusByProgram = new Map(enrollments.map((e) => [String(e.program), e.status]));

    res.status(200).json({
      programs: programs.map((p) => withId(p, statusByProgram.get(String(p._id)) || null)),
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
    const program = await Program.findOne({ _id: req.params.id, isActive: true }).lean();
    if (!program) return res.status(404).json({ message: 'Program not found' });
    const enrollment = await ProgramEnrollment.findOne({ user: req.user.id, program: program._id }).select('status startedAt completedAt').lean();
    res.status(200).json({
      program: { ...program, id: String(program._id) },
      // detail view returns the full enrollment object; list/overview only carry the status string
      enrollment: enrollment ? { status: enrollment.status, startedAt: enrollment.startedAt || null, completedAt: enrollment.completedAt || null } : null,
    });
  } catch (error) {
    next(error);
  }
};

const setEnrollment = async (req, res, next) => {
  try {
    const status = String(req.body.status || '');
    if (status !== 'none' && !ENROLL_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${[...ENROLL_STATUSES, 'none'].join(', ')}` });
    }
    const program = await Program.findOne({ _id: req.params.id, isActive: true }).select('_id');
    if (!program) return res.status(404).json({ message: 'Program not found' });

    if (status === 'none') {
      await ProgramEnrollment.deleteOne({ user: req.user.id, program: program._id });
      return res.status(200).json({ message: 'Removed from your programs', enrollment: null });
    }

    const doc = (await ProgramEnrollment.findOne({ user: req.user.id, program: program._id })) || new ProgramEnrollment({ user: req.user.id, program: program._id });
    doc.status = status;
    if (status === 'in-progress') {
      doc.startedAt = doc.startedAt || new Date();
      doc.completedAt = undefined;
    } else if (status === 'completed') {
      doc.startedAt = doc.startedAt || new Date();
      doc.completedAt = new Date();
    } else {
      doc.startedAt = undefined;
      doc.completedAt = undefined;
    }
    await doc.save();
    res.status(200).json({ message: 'Program updated', enrollment: { status: doc.status, startedAt: doc.startedAt || null, completedAt: doc.completedAt || null } });
  } catch (error) {
    next(error);
  }
};

module.exports = { listPrograms, getProgram, setEnrollment };
