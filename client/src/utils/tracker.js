import { toLocalInput } from './dashboard';

// Lead times offered for interview reminders (must match REMINDER_OFFSETS on the server).
export const REMINDER_OFFSETS = [
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
];

const pad = (n) => String(n).padStart(2, '0');
// ISO -> value for <input type="date"> (local date); '' when empty
export function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// <input type="date"> value -> ISO at local midday (so timezone shifts never change the calendar day); null when empty
export const fromDateInput = (v) => (v ? new Date(`${v}T12:00:00`).toISOString() : null);
export const fromDateTimeInput = (v) => (v ? new Date(v).toISOString() : null);
export const toDateTimeInput = (iso) => (iso ? toLocalInput(iso) : '');

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const OPEN = ['applied', 'interviewing'];
const STALE_DAYS = 14;

/**
 * Indicators for an application, computed only from its real stored data.
 * Returns [{ key, label, tone }] with tone 'danger' | 'warn' | 'info'.
 */
export function trackerFlags(app, now = Date.now()) {
  const flags = [];
  if (!app) return flags;
  const open = OPEN.includes(app.status);
  const today = startOfToday();
  if (open && app.followUpAt) {
    const t = new Date(app.followUpAt).getTime();
    if (t < today) flags.push({ key: 'followup-overdue', label: 'Follow-up overdue', tone: 'danger' });
    else if (t < today + 2 * 86400000) flags.push({ key: 'followup-soon', label: 'Follow-up due soon', tone: 'warn' });
  }
  if (open && app.nextAction?.dueAt && new Date(app.nextAction.dueAt).getTime() < today) {
    flags.push({ key: 'action-overdue', label: 'Next action overdue', tone: 'danger' });
  }
  if (open && app.reminderAt && !app.reminderNotifiedAt && new Date(app.reminderAt).getTime() > now) {
    flags.push({ key: 'reminder', label: 'Reminder set', tone: 'info' });
  }
  if (open && !flags.length && app.status === 'applied') {
    const last = new Date(app.updatedAt || app.createdAt).getTime();
    if (now - last > STALE_DAYS * 86400000) flags.push({ key: 'stale', label: `No update in ${STALE_DAYS}+ days`, tone: 'warn' });
  }
  return flags;
}

export const FLAG_CLASS = {
  danger: 'bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-200',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
  info: 'bg-mint text-primary',
};
