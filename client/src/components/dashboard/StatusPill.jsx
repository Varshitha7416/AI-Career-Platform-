import { statusLabel } from './format';

// Arbitrary-value colours on purpose: the theme remaps Tailwind's named palette in dark mode,
// and these status colours must stay legible and consistent in both themes.
const AMBER = 'bg-[#fef3c7] text-[#92400e] dark:bg-[#fbbf24]/20 dark:text-[#fcd34d]';
const GREEN = 'bg-[#d1fae5] text-[#065f46] dark:bg-[#34d399]/20 dark:text-[#6ee7b7]';
const RED = 'bg-[#fee2e2] text-[#b91c1c] dark:bg-[#f87171]/20 dark:text-[#fca5a5]';
const TEAL = 'bg-[#ccfbf1] text-[#115e59] dark:bg-[#2dd4bf]/20 dark:text-[#5eead4]';

const STYLES = {
  applied: 'bg-mint text-primary',
  interviewing: AMBER,
  offer: GREEN,
  rejected: RED,
  requested: AMBER,
  pending: AMBER,
  withdrawn: 'bg-[#e5e7eb] text-[#374151] dark:bg-[#9ca3af]/20 dark:text-[#d1d5db]',
  accepted: GREEN,
  declined: RED,
  referred: TEAL,
  scheduled: AMBER,
  completed: GREEN,
  cancelled: RED,
};

// Compact status pill with human labels ("applied" is shown as "In progress").
function StatusPill({ status, className = '' }) {
  if (!status) return null;
  return (
    <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${STYLES[status] || 'bg-mint text-primary'} ${className}`}>
      {statusLabel(status)}
    </span>
  );
}

export default StatusPill;
