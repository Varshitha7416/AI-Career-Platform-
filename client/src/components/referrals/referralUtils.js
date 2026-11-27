// Pure helpers for the Referrals feature (no React).

export const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'referred', label: 'Referred' },
  { value: 'declined', label: 'Declined' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

// Legacy "requested" records are shown as Pending.
export const normalizeStatus = (s) => (s === 'requested' ? 'pending' : s);

export const STATUS_GUIDE = [
  { status: 'pending', meaning: 'Waiting for the recipient to respond' },
  { status: 'accepted', meaning: 'The employee agrees to help' },
  { status: 'referred', meaning: 'Candidate submitted through the company' },
  { status: 'declined', meaning: 'The employee declines the request' },
  { status: 'withdrawn', meaning: 'The candidate withdraws the request' },
];

// action name (server allowedActions) -> target status + UI copy
export const ACTIONS = {
  accept: { status: 'accepted', label: 'Accept request', done: 'Request accepted.' },
  decline: { status: 'declined', label: 'Decline request', done: 'Request declined.', danger: true },
  withdraw: { status: 'withdrawn', label: 'Withdraw request', done: 'Request withdrawn.', danger: true },
  'mark-referred': { status: 'referred', label: 'Mark as referred', done: 'Marked as referred.' },
};

// SummaryDTO has no allowedActions, so derive them from the lifecycle (the server still enforces it).
export function actionsFor(direction, rawStatus) {
  const status = normalizeStatus(rawStatus);
  if (direction === 'received') {
    if (status === 'pending') return ['accept', 'decline'];
    if (status === 'accepted') return ['mark-referred', 'decline'];
    return [];
  }
  if (status === 'pending') return ['withdraw'];
  return [];
}

export const isHttpUrl = (u) => {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Where "View Job" should go: CareerNest job page, external link, or nowhere.
export function jobLink(job) {
  if (!job) return null;
  if (job.jobId) return { to: `/jobs/${job.jobId}` };
  if (job.applyUrl && isHttpUrl(job.applyUrl)) return { href: job.applyUrl };
  return null;
}

export const jobTitleLine = (job) => {
  if (!job || (!job.title && !job.company)) return 'Job details not recorded';
  return [job.company, job.title].filter(Boolean).join(' — ');
};

export const resumeLabel = (resume) => resume?.name || resume?.fileName || '';
