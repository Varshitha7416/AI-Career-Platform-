// Pure enrollment state machine for Career Programs (no DB access, unit-testable).
//   prev: null | { status, progress, completedMilestones[], startedAt, completedAt }
//   program: { milestones: [{ title, order }] }
//   body: { status?, progress?, completedMilestones? }  (status never 'none' here)
// Rules: completed => progress 100 (+ completedAt); progress > 0 => in-progress; saved => progress 0;
// with milestones, progress is derived from completed milestones, otherwise it is a manual integer 0-100.
const ENROLL_STATUSES = ['saved', 'in-progress', 'completed'];

const orderList = (program) => (program?.milestones || []).map((m) => m.order);
const pct = (done, total) => (total ? Math.round((100 * done) / total) : 0);

// Progress as shown to the user: milestone programs ignore stale orders (a milestone removed by an admin).
const effectiveEnrollment = (enrollment, program) => {
  if (!enrollment) return null;
  const orders = orderList(program);
  const out = {
    status: enrollment.status,
    progress: Number.isInteger(enrollment.progress) ? enrollment.progress : (enrollment.status === 'completed' ? 100 : 0),
    completedMilestones: [],
    startedAt: enrollment.startedAt || null,
    completedAt: enrollment.completedAt || null,
    updatedAt: enrollment.updatedAt || null,
  };
  if (orders.length) {
    out.completedMilestones = [...new Set((enrollment.completedMilestones || []).filter((o) => orders.includes(o)))].sort((a, b) => a - b);
    out.progress = enrollment.status === 'completed' ? 100 : pct(out.completedMilestones.length, orders.length);
  }
  return out;
};

const fail = (message) => ({ error: message });

const computeNext = (prev, program, body, now = new Date()) => {
  const orders = orderList(program);
  const hasMs = orders.length > 0;
  const hasStatus = body.status !== undefined;
  const hasProgress = body.progress !== undefined;
  const hasCM = body.completedMilestones !== undefined;

  if (!hasStatus && !hasProgress && !hasCM) return fail(`Status must be one of: ${[...ENROLL_STATUSES, 'none'].join(', ')}`);
  if (hasStatus && !ENROLL_STATUSES.includes(body.status)) return fail(`Status must be one of: ${[...ENROLL_STATUSES, 'none'].join(', ')}`);
  if (hasProgress) {
    if (typeof body.progress !== 'number' || !Number.isInteger(body.progress) || body.progress < 0 || body.progress > 100) {
      return fail('Progress must be a whole number between 0 and 100');
    }
    if (hasMs) return fail('This program tracks milestones; update completedMilestones instead of progress');
  }
  if (hasCM) {
    if (!hasMs) return fail('This program has no milestones');
    if (!Array.isArray(body.completedMilestones) || body.completedMilestones.some((o) => !Number.isInteger(o) || !orders.includes(o))) {
      return fail('completedMilestones must be a list of existing milestone numbers');
    }
  }

  const eff = effectiveEnrollment(prev, program);
  let progress = eff ? eff.progress : 0;
  let cm = eff ? [...eff.completedMilestones] : [];

  if (hasCM) {
    cm = [...new Set(body.completedMilestones)].sort((a, b) => a - b);
    progress = pct(cm.length, orders.length);
  } else if (hasProgress) {
    progress = body.progress;
  }
  const touched = hasProgress || hasCM;
  let status;

  if (hasStatus) {
    status = body.status;
    if (status === 'completed') {
      if (touched && progress < 100) return fail('Status completed conflicts with progress below 100');
      progress = 100;
      cm = [...orders].sort((a, b) => a - b);
    } else if (status === 'saved') {
      if (touched && progress > 0) return fail('A saved program cannot have progress; start it instead');
      progress = 0;
      cm = [];
    } else {
      if (touched && progress >= 100) return fail('Status in-progress conflicts with progress 100; use completed');
      if (!touched && progress >= 100) { // resuming a completed program: step back one unit
        if (hasMs) { cm = cm.slice(0, -1); progress = pct(cm.length, orders.length); } else progress = 99;
      }
    }
  } else {
    if (progress >= 100) status = 'completed';
    else if (touched) status = progress > 0 || cm.length || !prev ? 'in-progress' : (prev?.status === 'saved' ? 'saved' : 'in-progress');
    else status = prev?.status || 'saved';
    if (!touched && prev) status = prev.status;
  }

  const prevStarted = prev?.startedAt || null;
  const state = {
    status,
    progress,
    completedMilestones: cm,
    startedAt: status === 'saved' ? null : (prevStarted || now),
    completedAt: status === 'completed' ? (prev?.status === 'completed' && prev.completedAt ? prev.completedAt : now) : null,
  };
  return { state };
};

const sameState = (prev, state) => Boolean(prev)
  && prev.status === state.status
  && (Number.isInteger(prev.progress) ? prev.progress : (prev.status === 'completed' ? 100 : 0)) === state.progress
  && JSON.stringify([...(prev.completedMilestones || [])].sort((a, b) => a - b)) === JSON.stringify(state.completedMilestones);

module.exports = { ENROLL_STATUSES, computeNext, effectiveEnrollment, sameState, pct };
