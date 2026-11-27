const Interview = require('../models/Interview');
const Application = require('../models/Application');
const { isValidId } = require('../middleware/validate');
const { notify } = require('../utils/notify');
const { ensureHistory } = require('../utils/applicationHelpers');

const MODES = ['video', 'phone', 'onsite'];
const TYPES = ['screening', 'technical', 'hr', 'managerial', 'final', 'other'];
const STATUSES = ['scheduled', 'completed', 'cancelled'];
const FILTERS = ['upcoming', 'past', 'completed', 'cancelled', 'all'];
const MAX_AHEAD_MS = 3 * 365 * 86400000;
const REMINDER_OFFSETS = [15, 30, 60, 120, 1440, 2880]; // minutes before the interview
const { CLOCK_SKEW_MS, parseDate, parseText, parseHttpUrl } = require('../utils/tracker/validate');

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
  round: i.round || null,
  roundLabel: i.roundLabel || null,
  prepNotes: i.prepNotes || null,
  debrief: i.debrief || null,
  prepResources: i.prepResources || [],
  prepChecklist: i.prepChecklist || [],
  remindAt: i.remindAt || null,
  reminderOffsetMinutes: i.reminderOffsetMinutes || null,
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

  // ---- round, prep and debrief (all optional; null / '' clears)
  if (body.round !== undefined) {
    if (body.round === null || body.round === '') data.round = null;
    else {
      const n = Number(body.round);
      if (!Number.isInteger(n) || n < 1 || n > 20) errors.push('Round must be a whole number from 1 to 20');
      else data.round = n;
    }
  }
  for (const [key, label, max] of [['roundLabel', 'Round name', 80], ['prepNotes', 'Preparation notes', 4000], ['debrief', 'Interview notes', 4000]]) {
    if (body[key] !== undefined) {
      const r = parseText(body[key] === '' ? null : body[key], label, max);
      if (r.error) errors.push(r.error);
      else data[key] = r.value;
    }
  }
  if (body.prepResources !== undefined) {
    if (body.prepResources === null) data.prepResources = [];
    else if (!Array.isArray(body.prepResources) || body.prepResources.length > 10) errors.push('Preparation links must be a list of at most 10');
    else {
      const list = [];
      for (const r of body.prepResources) {
        const t = parseText(r && r.title, 'Link title', 120);
        const u = parseHttpUrl(r && r.url, 'Preparation link');
        if (t.error || !t.value) errors.push(t.error || 'Each preparation link needs a title');
        else if (u.error || !u.value) errors.push(u.error || 'Each preparation link needs a URL');
        else list.push({ title: t.value, url: u.value });
      }
      data.prepResources = list;
    }
  }
  if (body.prepChecklist !== undefined) {
    if (body.prepChecklist === null) data.prepChecklist = [];
    else if (!Array.isArray(body.prepChecklist) || body.prepChecklist.length > 20) errors.push('The checklist can have at most 20 items');
    else {
      const list = [];
      for (const c of body.prepChecklist) {
        const t = parseText(c && c.text, 'Checklist item', 200);
        if (t.error || !t.value) errors.push(t.error || 'Checklist items cannot be empty');
        else list.push({ text: t.value, done: c.done === true });
      }
      data.prepChecklist = list;
    }
  }

  // A scheduled interview must be in the future (allow 1 minute of clock skew); completed/cancelled may be in the past.
  const effective = data.status || status || 'scheduled';
  if (data.scheduledAt && effective === 'scheduled' && data.scheduledAt.getTime() < Date.now() - 60000) {
    errors.push('A scheduled interview must be in the future. Mark it as completed to record a past interview.');
  }
  return { data, errors };
}

// Reminder before an interview: either reminderOffsetMinutes (one of REMINDER_OFFSETS; follows the interview when it is
// rescheduled) or an explicit remindAt. null / '' removes it. Returns { set, errors }; `set` is applied with doc.set / create.
function resolveReminder(body, existing, scheduledAt, { rescheduled = false } = {}) {
  const set = {};
  const errors = [];
  const now = Date.now();
  const blank = (v) => v === null || v === '';
  const hasOffset = body.reminderOffsetMinutes !== undefined;
  const hasAbs = body.remindAt !== undefined;
  const clear = () => { set.remindAt = null; set.reminderOffsetMinutes = null; set.reminderNotifiedAt = undefined; };
  const sched = scheduledAt.getTime();

  if (hasOffset && !blank(body.reminderOffsetMinutes)) {
    const n = Number(body.reminderOffsetMinutes);
    if (!REMINDER_OFFSETS.includes(n)) errors.push(`Reminder lead time must be one of: ${REMINDER_OFFSETS.join(', ')} minutes`);
    else if (sched - n * 60000 < now - CLOCK_SKEW_MS) errors.push('That reminder time has already passed. Choose a shorter lead time.');
    else { set.remindAt = new Date(sched - n * 60000); set.reminderOffsetMinutes = n; set.reminderNotifiedAt = undefined; }
  } else if (hasAbs && !blank(body.remindAt)) {
    const r = parseDate(body.remindAt, 'Reminder');
    if (r.error) errors.push(r.error);
    else if (r.value.getTime() >= sched) errors.push('Reminder must be before the interview');
    else if (r.value.getTime() < now - CLOCK_SKEW_MS && !(existing && existing.remindAt && existing.remindAt.getTime() === r.value.getTime())) errors.push('Reminder must be in the future');
    else if (!(existing && existing.remindAt && existing.remindAt.getTime() === r.value.getTime())) { set.remindAt = r.value; set.reminderOffsetMinutes = null; set.reminderNotifiedAt = undefined; }
  } else if (hasOffset || hasAbs) {
    clear();
  } else if (rescheduled && existing && existing.remindAt) {
    // The interview moved and the user did not touch the reminder: keep it relative to the new time when possible.
    if (existing.reminderOffsetMinutes) {
      const at = sched - existing.reminderOffsetMinutes * 60000;
      if (at >= now - CLOCK_SKEW_MS) { set.remindAt = new Date(at); set.reminderNotifiedAt = undefined; } else clear();
    } else if (existing.remindAt.getTime() >= sched || existing.remindAt.getTime() < now - CLOCK_SKEW_MS) clear();
  }
  return { set, errors };
}

const createInterview = async (req, res, next) => {
  try {
    const { applicationId } = req.body;
    if (!isValidId(String(applicationId))) return res.status(400).json({ message: 'A valid applicationId is required' });

    const application = await Application.findOne({ _id: applicationId, user: req.user.id }).populate({ path: 'job', select: 'title' });
    if (!application || !application.job) return res.status(404).json({ message: 'Application not found' });

    const { data, errors } = validateBody(req.body, { partial: false });
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    const reminder = resolveReminder(req.body, null, data.scheduledAt);
    if (reminder.errors.length) return res.status(400).json({ message: reminder.errors.join(', ') });
    const interview = await Interview.create({ ...data, ...reminder.set, user: req.user.id, application: application._id, job: application.job._id });

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
    } else if (filter === 'completed' || filter === 'cancelled') {
      query.status = filter;
    } else if (filter === 'past') {
      query.$or = [{ scheduledAt: { $lt: now } }, { status: { $in: ['completed', 'cancelled'] } }];
    }

    const all = await Interview.find(query).sort(sort).populate(POPULATE).populate('application', 'status');
    const interviews = all.filter((i) => i.job).map(shape); // interviews whose job was deleted are hidden
    // Counts for the tab badges (same definitions as the filters above).
    const base = { user: req.user.id };
    const [upcoming, completed, cancelled, total] = await Promise.all([
      Interview.countDocuments({ ...base, status: 'scheduled', scheduledAt: { $gte: now } }),
      Interview.countDocuments({ ...base, status: 'completed' }),
      Interview.countDocuments({ ...base, status: 'cancelled' }),
      Interview.countDocuments(base),
    ]);
    const past = await Interview.countDocuments({ ...base, $or: [{ scheduledAt: { $lt: now } }, { status: { $in: ['completed', 'cancelled'] } }] });
    res.status(200).json({ count: interviews.length, interviews, counts: { upcoming, past, completed, cancelled, all: total } });
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
    const restoring = data.status === 'scheduled' && interview.status !== 'scheduled';
    const reminder = resolveReminder(req.body, interview, data.scheduledAt || interview.scheduledAt, { rescheduled: rescheduled || restoring });
    if (reminder.errors.length) return res.status(400).json({ message: reminder.errors.join(', ') });
    const cancelled = data.status === 'cancelled' && interview.status !== 'cancelled';
    const previousStatus = interview.status;
    interview.set({ ...data, ...reminder.set });
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
