// Shared labels and helpers for the Skill Gap Analysis UI (plain JS).
export { aiErrorMessage, formatDate, formatDateTime } from '../resume/resumeUtils';

export const MAX_SKILLS = 60;

export const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const STATUSES = [
  { value: 'not-started', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

export const PRIORITY_STYLE = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-mint text-primary',
};

export const levelLabel = (v) => LEVELS.find((l) => l.value === v)?.label || '';
export const basisLabel = (basis) => (basis === 'resume-verified' ? 'Resume-verified' : 'Manual input');
export const kindLabel = (k) => (k === 'required' ? 'Required' : k === 'preferred' ? 'Preferred' : k === 'recommended' ? 'Recommended' : '');

export function targetKindLabel(kind) {
  if (kind === 'job') return 'CareerNest job';
  if (kind === 'custom-jd') return 'Job description based';
  return 'Role only';
}

export function targetKindHint(kind) {
  if (kind === 'job') return 'Skills come from the job listing.';
  if (kind === 'custom-jd') return 'Skills were read from the job description you pasted.';
  return 'No job description: typical skills for this role were suggested by AI, not taken from a real posting.';
}

export function resumeLabel(a) {
  if (a.resume?.name) return a.resume.name;
  if (a.resumeSnapshot?.name) return `${a.resumeSnapshot.name}${a.resumeDeleted ? ' (resume deleted, snapshot kept)' : ''}`;
  return '';
}

export function jobLabelOf(a) {
  const j = a.job || a.jobSnapshot;
  if (!j?.title) return '';
  const company = typeof j.company === 'object' ? j.company?.name : j.company;
  const base = company ? `${j.title} - ${company}` : j.title;
  return a.jobDeleted ? `${base} (job removed, snapshot kept)` : base;
}

export const hoursLabel = (h) => (typeof h === 'number' ? `${Math.round(h * 10) / 10} h` : '');

export const FIELD = 'w-full border border-sage/60 rounded-lg px-3 py-2 text-sm';
export const CARD = 'bg-white rounded-2xl border border-sage/30 shadow-sm p-5';
export const BTN_PRIMARY = 'focus-ring inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-primary-dark transition disabled:opacity-50';
export const BTN_GHOST = 'focus-ring inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm text-primary border border-sage/60 hover:bg-mint transition disabled:opacity-50';
