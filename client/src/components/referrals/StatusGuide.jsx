import StatusPill from '../dashboard/StatusPill';
import { InfoIcon } from '../Icons';
import { STATUS_GUIDE } from './referralUtils';

function StatusGuide() {
  return (
    <section aria-labelledby="status-guide" className="bg-white rounded-2xl border border-sage/30 shadow-sm p-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
      <div>
        <h2 id="status-guide" className="font-display text-lg font-bold text-primary inline-flex items-center gap-2">
          Referral Status Guide <InfoIcon size={16} className="text-ink/50" />
        </h2>
        <p className="text-xs text-ink/65 mt-1">Understand what each status means</p>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {STATUS_GUIDE.map((g) => (
          <li key={g.status} className="min-w-0">
            <StatusPill status={g.status} />
            <p className="text-xs text-ink/70 mt-1.5">{g.meaning}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default StatusGuide;
