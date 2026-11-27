import { STATUS_STYLES, statusLabel } from '../utils/support';

function StatusPill({ status }) {
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'}`}>{statusLabel(status)}</span>;
}

export default StatusPill;
