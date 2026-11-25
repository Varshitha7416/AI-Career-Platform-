import { Link } from 'react-router-dom';
import SectionCard from './SectionCard';
import StatusPill from './StatusPill';
import CompanyLogo from '../CompanyLogo';
import { BriefcaseIcon } from './DashIcons';
import { formatDate } from './format';

function RecentApplications({ items, className = '' }) {
  return (
    <SectionCard id="apps-heading" title="Your Applications" viewAll={{ to: '/applications' }} className={className}>
      {items.length === 0 ? (
        <div className="text-center py-6">
          <span className="mx-auto w-12 h-12 rounded-2xl bg-mint text-primary flex items-center justify-center"><BriefcaseIcon size={22} /></span>
          <p className="font-medium text-ink mt-3">No applications yet</p>
          <p className="text-sm text-ink/60 mt-1">Find a role you like, apply, and confirm it to track it here.</p>
          <Link to="/jobs" className="focus-ring inline-block mt-4 bg-primary text-white rounded-xl px-5 py-2 text-sm hover:bg-primary-dark transition">Explore Job Discovery</Link>
        </div>
      ) : (
        <ul className="divide-y divide-sage/20">
          {items.map((a) => (
            <li key={a.id}>
              <Link to={a.link} className="focus-ring flex items-center gap-3 rounded-xl px-2 py-2.5 -mx-2 hover:bg-mint/60 transition" aria-label={`${a.title} at ${a.company?.name}, ${a.status}. View application`}>
                <CompanyLogo company={a.company} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{a.title}</p>
                  <p className="text-xs text-ink/60 truncate">{a.company?.name} · Applied {formatDate(a.appliedAt)}</p>
                </div>
                <StatusPill status={a.status} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default RecentApplications;
