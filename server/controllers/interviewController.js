const Interview = require('../models/Interview');
const Application = require('../models/Application');
const { isValidId } = require('../middleware/validate');
const { notify } = require('../utils/notify');
const { ensureHistory } = require('../utils/applicationHelpers');

const MODES = ['video', 'phone', 'onsite'];
const TYPES = ['screening', 'technical', 'hr', 'managerial', 'final', 'other'];
const STATUSES = ['scheduled', 'completed', 'cancelled'];
const FILTERS = ['upcoming', 'past', 'all'];
const MAX_AHEAD_MS = 3 * 365 * 86400000;

const POPULATE = { path: 'job', select: 'title city workMode company', populate: { path: 'company', select: 'name logoUrl' } };

const shape = (i) => ({
  _id: i._id,
  scheduledAt: i.scheduledAt,
  durationMinutes: i.durationMinutes,
  mode: i.mode,
  type: i.type,
  location: i.location || null,
  notes: i.notes || null,
  status: i.status,
  application: { _id: i.application?._id || i.application, status: i.application?.status },
  job: { _id: i.job._id, title: i.job.title, city: i.job.city, workMode: i.job.workMode },
  company: i.job.company ? { _id: i.job.company._id, name: i.job.company.name, logoUrl: i.job.company.logoUrl || null } : null,
});

const fmt = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

// Validates the editable fields; returns { data, errors }.
function validateBody(body, { partial, status }) {
  const data = {};
  const errors = [];

  if (body.scheduledAt !== undefined || !partial) {
    const d = new Date(body.scheduledAt);
    if (body.scheduledAt === undefined || body.scheduledAt === null || body.scheduledAt === '' || Number.isNaN(d.getTime())) {
      errors.push('Interview date and time must be a valid date');
    } else if (d.getTime() > Date.now() + MAX_AHEAD_MS) {
      errors.push('Interview date is too far in the future');
    } else {
      data.scheduledAt = d;
    }
  }
  if (body.mode !== undefined) {
    if (!MODES.includes(body.mode)) errors.push(`Mode must be one of: ${MODES.join(', ')}`);
    else data.mode = body.mode;
  }
  if (body.type !== undefined) {
    if (!TYPES.includes(body.type)) errors.push(`Type must be one of: ${TYPES.join(', ')}`);
    else data.type = body.type;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) errors.push(`Status must be one of: ${STATUSES.join(', ')}`);
    else data.status = body.status;
  }
  if (body.durationMinutes !== undefined && body.durationMinutes !== null && body.durationMinutes !== '') {
    const n = Number(body.durationMinutes);
    if (!Number.isFinite(n) || n < 5 || n > 600) errors.push('Duration must be between 5 and 600 minutes');
    else data.durationMinutes = Math.round(n);
  }
  for (const [key, max] of [['location', 500], ['notes', 2000]]) {
    if (body[key] !== undefined) {
      if (body[key] !== null && typeof body[key] !== 'string') {
        errors.push(`${key[0].toUpperCase()}${key.slice(1)} must be text`);
        continue;
      }
      const v = String(body[key] ?? '').trim();
      if (v.length > max) errors.push(`${key[0].toUpperCase()}${key.slice(1)} must be ${max} characters or fewer`);
      else data[key] = v;
    }
  }

  // A scheduled interview must be in the future (allow 1 minute of clock skew); completed/cancelled may be in the past.
  const effective = data.status || status || 'scheduled';
  if (data.scheduledAt && effective === 'scheduled' && data.scheduledAt.getTime() < Date.now() - 60000) {
    errors.push('A scheduled interview must be in the future. Mark it as completed to record a past interview.');
  }
  return { data, errors };
}

const createInterview = async (req, res, next) => {
  try {
    const { applicationId } = req.body;
    if (!isValidId(String(applicationId))) return res.status(400).json({ message: 'A valid applicationId is required' });

    const application = await Application.findOne({ _id: applicationId, user: req.user.id }).populate({ path: 'job', select: 'title' });
    if (!application || !application.job) return res.status(404).json({ message: 'Application not found' });

    const { data, errors } = validateBody(req.body, { partial: false });
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    const interview = await Interview.create({ ...data, user: req.user.id, application: application._id, job: application.job._id });

    if (application.status === 'applied') {
      ensureHistory(application);
      application.status = 'interviewing';
      application.statusHistory.push({ status: 'interviewing', at: new Date() });
      await application.save();
    }

    await notify(req.user.id, {
      type: 'interview',
      title: 'Interview scheduled',
      message: `${application.job.title} on ${fmt(interview.scheduledAt)}`,
      link: '/interviews',
    });

    const populated = await Interview.findById(interview._id).populate(POPULATE).populate('application', 'status');
    res.status(201).json({ message: 'Interview scheduled', interview: shape(populated) });
  } catch (error) {
    next(error);
  }
};

const listInterviews = async (req, res, next) => {
  try {
    const filter = req.query.filter || 'upcoming';
    if (!FILTERS.includes(filter)) return res.status(400).json({ message: `Filter must be one of: ${FILTERS.join(', ')}` });

    const now = new Date();
    const query = { user: req.user.id };
    let sort = { scheduledAt: -1 };
    if (filter === 'upcoming') {
      query.status = 'scheduled';
      query.scheduledAt = { $gte: now };
      sort = { scheduledAt: 1 };
    } else if (filter === 'past') {
      query.$or = [{ scheduledAt: { $lt: now } }, { status: { $in: ['completed', 'cancelled'] } }];
    }

    const all = await Interview.find(query).sort(sort).populate(POPULATE).populate('application', 'status');
    const interviews = all.filter((i) => i.job).map(shape); // interviews whose job was deleted are hidden
    res.status(200).json({ count: interviews.length, interviews });
  } catch (error) {
    next(error);
  }
};

const getInterview = async (req, res, next) => {
  try {
    const i = await Interview.findOne({ _id: req.params.id, user: req.user.id }).populate(POPULATE).populate('application', 'status');
    if (!i || !i.job) return res.status(404).json({ message: 'Interview not found' });
    res.status(200).json({ interview: shape(i) });
  } catch (error) {
    next(error);
  }
};

const updateInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user.id });
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    const { data, errors } = validateBody(req.body, { partial: true, status: interview.status });
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    const rescheduled = data.scheduledAt && data.scheduledAt.getTime() !== interview.scheduledAt.getTime();
    const cancelled = data.status === 'cancelled' && interview.status !== 'cancelled';
    const previousStatus = interview.status;
    interview.set(data);
    if (data.status && data.status !== previousStatus) interview.statusChangedAt = new Date();
    await interview.save();

    const populated = await Interview.findById(interview._id).populate(POPULATE).populate('application', 'status');
    const title = populated.job?.title || 'your interview';
    if (cancelled) {
      await notify(req.user.id, { type: 'interview', title: 'Interview cancelled', message: title, link: '/interviews' });
    } else if (rescheduled) {
      await notify(req.user.id, { type: 'interview', title: 'Interview rescheduled', message: `${title} is now ${fmt(interview.scheduledAt)}`, link: '/interviews' });
    }

    if (!populated.job) return res.status(404).json({ message: 'Interview not found' });
    res.status(200).json({ message: 'Interview updated', interview: shape(populated) });
  } catch (error) {
    next(error);
  }
};

const deleteInterview = async (req, res, next) => {
  try {
    const removed = await Interview.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!removed) return res.status(404).json({ message: 'Interview not found' });
    res.status(200).json({ message: 'Interview removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createInterview, listInterviews, getInterview, updateInterview, deleteInterview };
