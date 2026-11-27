import { statusLabel, formatDateTime } from '../../utils/dashboard';

// Vertical timeline of an application's statusHistory ([{status, at}]), newest last.
function StatusTimeline({ history = [], fallbackAt }) {
  const items = history.length ? history : [{ status: 'applied', at: fallbackAt }];
  return (
    <ol className="relative border-l-2 border-sage/40 ml-2 space-y-5">
      {items.map((h, i) => {
        const last = i === items.length - 1;
        return (
          <li key={`${h.status}-${h.at}-${i}`} className="pl-5 relative">
            <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${last ? 'bg-accent border-accent' : 'bg-white border-sage'}`} />
            <p className={`text-sm ${last ? 'font-semibold text-ink' : 'text-ink/80'}`}>{statusLabel(h.status)}</p>
            <p className="text-xs text-ink/60">{formatDateTime(h.at)}</p>
          </li>
        );
      })}
    </ol>
  );
}

export default StatusTimeline;
