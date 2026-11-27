import { trackerFlags, FLAG_CLASS } from '../../utils/tracker';

// Small pills such as "Follow-up overdue", derived from the application's real data (see utils/tracker.js).
function TrackerFlags({ application }) {
  const flags = trackerFlags(application);
  if (!flags.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {flags.map((f) => <span key={f.key} className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${FLAG_CLASS[f.tone]}`}>{f.label}</span>)}
    </span>
  );
}

export default TrackerFlags;
