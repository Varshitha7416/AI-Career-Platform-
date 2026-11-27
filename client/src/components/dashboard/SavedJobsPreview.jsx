import { Link } from 'react-router-dom';
import SectionCard from './SectionCard';
import CompanyLogo from '../CompanyLogo';
import { BookmarkFilled, PinIcon } from './DashIcons';
import { locationOf, workModeLabel } from './format';

function SavedJobsPreview({ items, className = '' }) {
  return (
    <SectionCard id="saved-heading" title="Saved Jobs" viewAll={{ to: '/saved-jobs' }} className={className}>
      {items.length === 0 ? (
        <div className="text-center py-6">
          <span className="mx-auto w-12 h-12 rounded-2xl bg-mint text-primary flex items-center justify-center"><BookmarkFilled size={22} /></span>
          <p className="font-medium text-ink mt-3">No saved jobs yet</p>
          <p className="text-sm text-ink/60 mt-1">Tap the bookmark on any job to keep it here for later.</p>
          <Link to="/jobs" className="focus-ring inline-block mt-4 bg-primary text-white rounded-xl px-5 py-2 text-sm hover:bg-primary-dark transition">Browse jobs</Link>
        </div>
      ) : (
        <ul className="divide-y divide-sage/20">
          {items.map((s) => (
            <li key={s.id}>
              <Link to={`/jobs/${s.job._id}`} className="focus-ring flex items-center gap-3 rounded-xl px-2 py-2.5 -mx-2 hover:bg-mint/60 transition" aria-label={`${s.job.title} at ${s.job.company?.name}. Open job details`}>
                <CompanyLogo company={s.job.company} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{s.job.title}</p>
                  <p className="text-xs text-ink/60 truncate">{s.job.company?.name}</p>
                  <p className="text-xs text-ink/60 truncate flex items-center gap-1 mt-0.5">
                    <PinIcon size={12} className="shrink-0" />
                    {locationOf(s.job)}
                    {s.job.workMode && <span className="ml-1 px-1.5 py-px rounded-full bg-mint text-primary text-[10px] font-medium">{workModeLabel(s.job.workMode)}</span>}
                  </p>
                </div>
                <BookmarkFilled size={18} className="text-accent shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default SavedJobsPreview;
