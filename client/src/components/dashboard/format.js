// Pure helpers for the Dashboard components (no React).

export function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// "just now", "5 minutes ago", "3 hours ago", "Yesterday", "4 days ago", or a short date.
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return '';
  const diff = now - new Date(iso).getTime();
  if (diff < 0) return formatDate(iso);
  if (diff < MIN) return 'Just now';
  if (diff < HOUR) { const m = Math.floor(diff / MIN); return `${m} minute${m === 1 ? '' : 's'} ago`; }
  if (diff < DAY) { const h = Math.floor(diff / HOUR); return `${h} hour${h === 1 ? '' : 's'} ago`; }
  if (diff < 2 * DAY) return 'Yesterday';
  if (diff < 14 * DAY) return `${Math.floor(diff / DAY)} days ago`;
  return formatDate(iso);
}

export function formatDate(iso, withYear = true) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
}

export function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function dayParts(iso) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
  };
}

export const STATUS_LABEL = {
  applied: 'In progress',
  interviewing: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  requested: 'Pending',
  pending: 'Pending',
  withdrawn: 'Withdrawn',
  accepted: 'Accepted',
  declined: 'Declined',
  referred: 'Referred',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// Label for any status: mapped words first, otherwise Title Case (never a raw lowercase word).
export const statusLabel = (status) => {
  if (!status) return '';
  if (STATUS_LABEL[status]) return STATUS_LABEL[status];
  return String(status).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const MODE_LABEL = { video: 'Video call', phone: 'Phone call', onsite: 'On-site' };
export const INTERVIEW_TYPE_LABEL = { screening: 'Screening', technical: 'Technical', hr: 'HR round', managerial: 'Managerial', final: 'Final round', other: 'Interview' };

export const pluralize = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const clampPercent = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export const workModeLabel = (m) => (m ? `${m[0].toUpperCase()}${m.slice(1)}` : '');

export function locationOf(job) {
  if (!job) return '';
  if (job.city === 'Remote') return `Remote, ${job.country || 'India'}`;
  return [job.city, job.country].filter(Boolean).join(', ');
}
