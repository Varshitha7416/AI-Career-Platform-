// Formatting + label helpers shared by the Applications / Interviews / Programs / Settings pages.
import axiosClient from '../api/axiosClient';
import { getUser } from './auth';

// ---- application status (API values: applied | interviewing | offer | rejected)
export const STATUS_META = {
  applied: { label: 'In Progress', cls: 'bg-mint text-primary' },
  interviewing: { label: 'Interview', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200' },
  offer: { label: 'Offer', cls: 'bg-green-100 text-green-900 dark:bg-green-400/15 dark:text-green-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-200' },
};
export const STATUS_OPTIONS = ['applied', 'interviewing', 'offer', 'rejected'];
export const statusLabel = (s) => STATUS_META[s]?.label || s;

// ---- interviews
export const INTERVIEW_MODES = { video: 'Video call', phone: 'Phone call', onsite: 'On-site' };
export const INTERVIEW_TYPES = {
  screening: 'Screening',
  technical: 'Technical',
  hr: 'HR round',
  managerial: 'Managerial',
  final: 'Final round',
  other: 'Other',
};
export const INTERVIEW_STATUS_META = {
  scheduled: { label: 'Scheduled', cls: 'bg-mint text-primary' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-900 dark:bg-green-400/15 dark:text-green-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-200' },
};

// ---- dates
export function formatDate(d, opts) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, opts || { day: 'numeric', month: 'short', year: 'numeric' });
}
export function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export function formatDateTime(d) {
  if (!d) return '';
  return `${formatDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${formatTime(d)}`;
}
const pad = (n) => String(n).padStart(2, '0');
// ISO -> value for <input type="datetime-local"> (local time)
export function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 24 * 3600 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : '');

export function isLikelyUrl(s) {
  return /^https?:\/\//i.test(String(s || '').trim());
}

// ---- data helpers that tolerate the token-user alias routes not being deployed yet
export async function fetchApplications() {
  try {
    const res = await axiosClient.get('/applications');
    return res.data.applications || [];
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 400) {
      const res = await axiosClient.get(`/applications/${getUser()?.id}`);
      return res.data.applications || [];
    }
    throw err;
  }
}

export async function fetchSavedJobs() {
  try {
    const res = await axiosClient.get('/saved-jobs');
    return res.data.savedJobs || [];
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 400) {
      const res = await axiosClient.get(`/saved-jobs/${getUser()?.id}`);
      return res.data.savedJobs || [];
    }
    throw err;
  }
}

// ---- program visuals (theme key from the API)
// Decorative card headers keep the fixed CareerNest palette in BOTH light and dark mode (semantic tokens would
// invert in dark mode and lose contrast), so these use inline palette colours on purpose.
export const PROGRAM_THEMES = {
  forest: { background: '#163832', color: '#DAF1DE' },
  moss: { background: '#235347', color: '#DAF1DE' },
  sage: { background: '#8EB69B', color: '#051F20' },
  mint: { background: '#DAF1DE', color: '#163832' },
};
export const ENROLLMENT_META = {
  saved: { label: 'Saved', cls: 'bg-mint text-primary' },
  'in-progress': { label: 'In progress', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-900 dark:bg-green-400/15 dark:text-green-200' },
};

// Destructive outline button colours (readable in both themes).
export const DANGER_OUTLINE = 'border-red-300 text-red-700 hover:bg-red-50'; // the dark theme remaps the red-* tokens, so no dark: overrides here

// Filled destructive button: fixed colours (the remapped red tokens would turn light in dark mode).
export const DANGER_FILLED_STYLE = { background: '#B42318', borderColor: '#B42318', color: '#FFFFFF' };
