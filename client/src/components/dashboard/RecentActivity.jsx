import { Link } from 'react-router-dom';
import SectionCard from './SectionCard';
import StatusPill from './StatusPill';
import CompanyLogo from '../CompanyLogo';
import { BriefcaseIcon, CalendarIcon, FileIcon, RefreshIcon, PeopleIcon, SparkleIcon } from './DashIcons';
import { BookmarkFilled } from './DashIcons';
import { relativeTime, formatDateTime } from './format';

const ICONS = {
  application_created: <BriefcaseIcon size={18} />,
  job_saved: <BookmarkFilled size={18} />,
  interview_scheduled: <CalendarIcon size={18} />,
  status_changed: <RefreshIcon size={18} />,
  referral_received: <PeopleIcon size={18} />,
  referral_updated: <PeopleIcon size={18} />,
  resume_uploaded: <FileIcon size={18} />,
};

function ActivityRow({ item }) {
  return (
    <li>
      <Link
        to={item.link}
        className="focus-ring flex items-center gap-3 rounded-xl px-2 py-2.5 -mx-2 hover:bg-mint/60 transition"
      >
        {item.company?.name ? (
          <CompanyLogo company={item.company} size={40} />
        ) : (
          <span className="w-10 h-10 rounded-xl bg-mint text-primary flex items-center justify-center shrink-0">{ICONS[item.type] || <SparkleIcon size={18} />}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink line-clamp-2 leading-snug">{item.title}</p>
          <p className="text-xs text-ink/60 truncate">
            {item.description && <>{item.description} · </>}
            <time dateTime={item.at} title={formatDateTime(item.at)}>{relativeTime(item.at)}</time>
          </p>
        </div>
        <StatusPill status={item.status} className="shrink-0" />
      </Link>
    </li>
  );
}

function RecentActivity({ items, className = '' }) {
  return (
    <SectionCard id="activity-heading" title="Recent Activity" subtitle="Your latest actions" className={className}>
      {items.length === 0 ? (
        <div className="text-center py-8">
          <span className="mx-auto w-12 h-12 rounded-2xl bg-mint text-primary flex items-center justify-center"><SparkleIcon size={22} /></span>
          <p className="font-medium text-ink mt-3">No activity yet</p>
          <p className="text-sm text-ink/60 mt-1">Save a job, apply or upload your resume and it will show up here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-sage/20">
          {items.map((item) => <ActivityRow key={item.id} item={item} />)}
        </ul>
      )}
    </SectionCard>
  );
}

export default RecentActivity;
