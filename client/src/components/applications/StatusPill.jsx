import { STATUS_META } from '../../utils/dashboard';

// Application status pill using the dashboard wording (applied -> "In Progress").
function StatusPill({ status, className = '' }) {
  const meta = STATUS_META[status] || { label: status, cls: 'bg-sage/30 text-primary' };
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${meta.cls} ${className}`}>
      {meta.label}
    </span>
  );
}

export default StatusPill;
