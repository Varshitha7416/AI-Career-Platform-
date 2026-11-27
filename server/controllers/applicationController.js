const Application = require('../models/Application');
const Interview = require('../models/Interview');
const Job = require('../models/Job');
const { notify } = require('../utils/notify');
const Resume = require('../models/Resume');
const CoverLetter = require('../models/CoverLetter');
const { historyOf, ensureHistory, appliedDate, STATUS_LABEL } = require('../utils/applicationHelpers');
const { CLOCK_SKEW_MS, parseDate, parseText, parseHttpUrl } = require('../utils/tracker/validate');
const { isValidId } = require('../middleware/validate');

const STATUSES = ['applied', 'interviewing', 'rejected', 'offer'];

const applyToJob = async (req, res, next) => {
  try {
    const { jobId } = req.body;
    const userId = req.user.id;

    // 'external' = the user applied through the employer's own link and is confirming it;
    // 'manual'   = the user is recording an application made somewhere else.
    const applyMethod = req.body.applyMethod === undefined ? 'manual' : req.body.applyMethod;
    if (!['external', 'manual'].includes(applyMethod)) {
      return res.status(400).json({ message: 'applyMethod must be external or manual' });
    }
    let appliedAt = new Date();
    if (req.body.appliedAt !== undefined && req.body.appliedAt !== null && req.body.appliedAt !== '') {
      appliedAt = new Date(req.body.appliedAt);
      if (Number.isNaN(appliedAt.getTime()) || appliedAt.getTime() > Date.now() + 60 * 1000) {
        return res.status(400).json({ message: 'Applied date must be a valid date that is not in the future' });
      }
    }

    const job = await Job.findById(jobId).populate('company', 'name');
    if (!job) return res.status(404).json({ message: 'Job not found or no longer available' });

    const existingApplication = await Application.findOne({ user: userId, job: jobId });
    if (existingApplication) {
      return res.status(400).json({ message: 'Already applied to this job' });
    }

    const application = await Application.create({
      user: userId, job: jobId, applyMethod, appliedAt,
      statusHistory: [{ status: 'applied', at: appliedAt }],
    });

    await notify(userId, {
      type: 'application',
      title: 'Application added',
      message: `${job.title}${job.company?.name ? ` at ${job.company.name}` : ''}`,
      link: `/applications/${application._id}`,
    });

    res.status(201).json({ message: 'Application submitted', application });
  } catch (error) {
    next(error);
  }
};

// Shared by GET /applications (token user) and GET /applications/:userId (must equal the token user).
const listForUser = async (userId, res, next) => {
  try {
    const all = await Application.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate({ path: 'job', populate: { path: 'company' } });

    // Applications whose job was deleted are hidden (job populates as null).
    const applications = all.filter((a) => a.job);

    res.status(200).json({ count: applications.length, applications });
  } catch (error) {
    next(error);
  }
};

const getApplications = async (req, res, next) => {
  if (req.params.userId !== req.user.id) {
    return res.status(403).json({ message: 'You can only view your own applications' });
  }
  return listForUser(req.user.id, res, next);
};

const getMyApplications = (req, res, next) => listForUser(req.user.id, res, next);

// One application with its job, status timeline, interviews, and the resume / cover letter it used (own applications only).
// A resume or cover letter that was deleted since is reported as { missing: true } instead of failing.
const getApplicationItem = async (req, res, next) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, user: req.user.id })
      .populate({ path: 'job', populate: { path: 'company' } });
    if (!application || !application.job) return res.status(404).json({ message: 'Application not found' });

    const [interviews, resume, coverLetter] = await Promise.all([
      Interview.find({ application: application._id, user: req.user.id })
        .sort({ scheduledAt: -1 })
        .select('scheduledAt durationMinutes mode type location notes status round roundLabel prepNotes debrief prepResources prepChecklist remindAt reminderOffsetMinutes')
        .lean(),
      application.resume ? Resume.findOne({ _id: application.resume, user: req.user.id }).select('name fileName').lean() : null,
      application.coverLetter ? CoverLetter.findOne({ _id: application.coverLetter, user: req.user.id }).select('jobSnapshot job createdAt').populate('job', 'title').lean() : null,
    ]);

    res.status(200).json({
      application: {
        ...application.toObject(),
        statusHistory: historyOf(application),
        interviews,
        resume: application.resume ? (resume ? { _id: resume._id, name: resume.name || resume.fileName } : { _id: application.resume, missing: true }) : null,
        coverLetter: application.coverLetter
          ? (coverLetter ? { _id: coverLetter._id, title: coverLetter.jobSnapshot?.title || coverLetter.job?.title || 'Cover letter', createdAt: coverLetter.createdAt } : { _id: application.coverLetter, missing: true })
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Validates the editable tracker fields. Returns { set, unset, errors }. Only keys present in the body are touched;
// null / '' clears an optional field.
async function validateEdit(body, application, userId) {
  const set = {};
  const unset = [];
  const errors = [];
  const take = (r, field) => {
    if (r.error) errors.push(r.error);
    else if (r.value === null) unset.push(field);
    else set[field] = r.value;
  };

  if (body.applyMethod !== undefined) {
    if (!['external', 'manual'].includes(body.applyMethod)) errors.push('applyMethod must be external or manual');
    else set.applyMethod = body.applyMethod;
  }
  if (body.appliedAt !== undefined) {
    const r = parseDate(body.appliedAt, 'Applied date');
    if (r.error) errors.push(r.error);
    else if (r.value === null) errors.push('Applied date cannot be cleared');
    else if (r.value.getTime() > Date.now() + CLOCK_SKEW_MS) errors.push('Applied date must be a valid date that is not in the future');
    else set.appliedAt = r.value;
  }
  if (body.notes !== undefined) take(parseText(body.notes, 'Notes', 2000), 'notes');
  if (body.externalUrl !== undefined) take(parseHttpUrl(body.externalUrl, 'Job link'), 'externalUrl');
  if (body.followUpAt !== undefined) take(parseDate(body.followUpAt, 'Follow-up date'), 'followUpAt');

  if (body.reminderAt !== undefined) {
    const r = parseDate(body.reminderAt, 'Reminder');
    if (r.error) errors.push(r.error);
    else if (r.value === null) {
      unset.push('reminderAt', 'reminderNotifiedAt');
    } else {
      const same = application.reminderAt && application.reminderAt.getTime() === r.value.getTime();
      if (!same && r.value.getTime() < Date.now() - CLOCK_SKEW_MS) errors.push('Reminder must be in the future');
      else if (!same) { set.reminderAt = r.value; unset.push('reminderNotifiedAt'); } // an edited reminder starts over
    }
  }

  if (body.nextAction !== undefined) {
    if (body.nextAction === null) unset.push('nextAction');
    else if (typeof body.nextAction !== 'object' || Array.isArray(body.nextAction)) errors.push('Next action must be an object with text and dueAt');
    else {
      const t = parseText(body.nextAction.text === undefined ? null : body.nextAction.text, 'Next action', 200);
      const d = body.nextAction.dueAt === undefined ? { value: null } : parseDate(body.nextAction.dueAt, 'Next action due date');
      if (t.error) errors.push(t.error);
      if (d.error) errors.push(d.error);
      if (!t.error && !d.error) {
        if (!t.value && !d.value) unset.push('nextAction');
        else if (!t.value) errors.push('Describe the next action');
        else set.nextAction = { text: t.value, ...(d.value ? { dueAt: d.value } : {}) };
      }
    }
  }

  // The resume / cover letter must belong to the caller. Anything else is the same 400 as a missing one (no existence leak).
  if (body.resumeId !== undefined) {
    if (body.resumeId === null || body.resumeId === '') unset.push('resume');
    else if (!isValidId(String(body.resumeId)) || !(await Resume.exists({ _id: body.resumeId, user: userId }))) errors.push('Resume not found');
    else set.resume = body.resumeId;
  }
  if (body.coverLetterId !== undefined) {
    if (body.coverLetterId === null || body.coverLetterId === '') unset.push('coverLetter');
    else if (!isValidId(String(body.coverLetterId)) || !(await CoverLetter.exists({ _id: body.coverLetterId, user: userId }))) errors.push('Cover letter not found');
    else set.coverLetter = body.coverLetterId;
  }
  return { set, unset, errors };
}

const EDIT_KEYS = ['applyMethod', 'appliedAt', 'notes', 'externalUrl', 'followUpAt', 'reminderAt', 'nextAction', 'resumeId', 'coverLetterId'];

// PUT /applications/:id: {status?, statusDate?} and/or tracker edits. Policy (docs/29): editing your own tracker data is
// low risk, so like the original status change it does not need a verified email (and, under the optional-verification policy, neither does creating one).
const updateApplicationStatus = async (req, res, next) => {
  try {
    const body = req.body || {};
    const hasStatus = body.status !== undefined;
    const hasEdits = EDIT_KEYS.some((k) => body[k] !== undefined);
    if (!hasStatus && !hasEdits) {
      return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });
    }
    let status;
    if (hasStatus) {
      status = String(body.status || '').toLowerCase();
      if (!STATUSES.includes(status)) return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });
    }

    // Filtering by user guarantees users can only change their own applications.
    const application = await Application.findOne({ _id: req.params.id, user: req.user.id })
      .populate({ path: 'job', select: 'title company', populate: { path: 'company', select: 'name' } });
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const { set, unset, errors } = await validateEdit(body, application, req.user.id);

    // A status change may carry the date it actually happened (default: now). Not in the future, not before the applied date.
    let statusDate = new Date();
    if (body.statusDate !== undefined && body.statusDate !== null && body.statusDate !== '') {
      const r = parseDate(body.statusDate, 'Status date');
      const applied = set.appliedAt || appliedDate(application);
      if (r.error) errors.push(r.error);
      else if (r.value.getTime() > Date.now() + CLOCK_SKEW_MS) errors.push('Status date cannot be in the future');
      else if (r.value.getTime() < new Date(applied).getTime() - 24 * 3600 * 1000) errors.push('Status date cannot be before the applied date');
      else statusDate = r.value;
    }
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    application.set(set);
    unset.forEach((f) => application.set(f, undefined));

    let statusChanged = false;
    if (hasStatus && application.status !== status) {
      ensureHistory(application);
      application.status = status;
      application.statusHistory.push({ status, at: statusDate });
      statusChanged = true;
    }
    // Editing the applied date also moves the first ("applied") history entry, so the timeline stays consistent.
    if (set.appliedAt && application.statusHistory && application.statusHistory.length && application.statusHistory[0].status === 'applied') {
      application.statusHistory[0].at = set.appliedAt;
    }
    await application.save();

    if (statusChanged) {
      await notify(req.user.id, {
        type: 'application',
        title: 'Application status updated',
        message: `${application.job?.title || 'Your application'}${application.job?.company?.name ? ` at ${application.job.company.name}` : ''} is now ${STATUS_LABEL[status] || status}`,
        link: `/applications/${application._id}`,
      });
    }

    res.status(200).json({
      message: hasStatus && !hasEdits ? 'Status updated' : 'Application updated',
      application: { ...application.toObject(), statusHistory: historyOf(application) },
    });
  } catch (error) {
    next(error);
  }
};

const deleteApplication = async (req, res, next) => {
  try {
    const removed = await Application.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!removed) return res.status(404).json({ message: 'Application not found' });
    // The user's interviews for a removed application would be orphaned, so remove those too.
    await Interview.deleteMany({ application: removed._id, user: req.user.id });
    res.status(200).json({ message: 'Application removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { applyToJob, getApplications, getMyApplications, getApplicationItem, updateApplicationStatus, deleteApplication };
