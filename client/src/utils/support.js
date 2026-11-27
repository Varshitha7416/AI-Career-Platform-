// Shared support/contact constants (keep in sync with server/models/ContactMessage.js).
export const CATEGORIES = [
  { value: 'account', label: 'Account and login' },
  { value: 'jobs', label: 'Jobs and search' },
  { value: 'applications', label: 'Applications and interviews' },
  { value: 'ai-features', label: 'AI features (resume, cover letter, skill gap)' },
  { value: 'referrals', label: 'Referrals' },
  { value: 'bug', label: 'Report a bug' },
  { value: 'feedback', label: 'Feedback or suggestion' },
  { value: 'other', label: 'Something else' },
];
export const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || 'Something else';

export const STATUSES = ['open', 'in-progress', 'resolved', 'closed'];
export const statusLabel = (s) => ({ open: 'Open', 'in-progress': 'In progress', resolved: 'Resolved', closed: 'Closed' }[s] || s);
export const STATUS_STYLES = {
  open: 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-700',
};

// Honest wording: only a provider-confirmed state may say "delivered"; 'stored_local' means saved on this server only.
export const deliveryLabel = (d) => ({
  not_requested: 'No email requested',
  stored_local: 'Email stored locally (development outbox), not delivered',
  provider_accepted: 'Email handed to the mail provider (delivery not confirmed)',
  delivered: 'Email delivered (provider confirmed)',
  failed: 'Email could not be sent',
  unavailable: 'Email is not available (no mail service configured)',
}[d] || 'Email status unknown');

export const formatDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
