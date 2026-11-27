import { Link } from 'react-router-dom';
import SectionCard from './SectionCard';
import CompanyLogo from '../CompanyLogo';
import { CalendarIcon, VideoIcon, PhoneIcon, BuildingIcon } from './DashIcons';
import { dayParts, formatTime, MODE_LABEL, INTERVIEW_TYPE_LABEL } from './format';

const MODE_ICON = { video: <VideoIcon size={13} />, phone: <PhoneIcon size={13} />, onsite: <BuildingIcon size={13} /> };

function UpcomingInterviews({ items, className = '' }) {
  return (
    <SectionCard id="interviews-heading" title="Upcoming Interviews" viewAll={{ to: '/interviews' }} className={className}>
      {items.length === 0 ? (
        <div className="text-center py-6">
          <span className="mx-auto w-12 h-12 rounded-2xl bg-mint text-primary flex items-center justify-center"><CalendarIcon size={22} /></span>
          <p className="font-medium text-ink mt-3">No upcoming interviews</p>
          <p className="text-sm text-ink/60 mt-1">When you schedule an interview for one of your applications, it will appear here.</p>
          <Link to="/interviews" className="focus-ring inline-block mt-4 border border-primary text-primary rounded-xl px-5 py-2 text-sm hover:bg-mint transition">Schedule an interview</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((iv) => {
            const d = dayParts(iv.scheduledAt);
            return (
              <li key={iv.id} className="flex items-center gap-3 rounded-xl border border-sage/30 p-3">
                <div className="shrink-0 w-14 rounded-xl bg-mint text-primary text-center py-1.5" aria-hidden="true">
                  <div className="text-[10px] font-semibold tracking-wide">{d.month}</div>
                  <div className="font-display text-2xl font-bold leading-none">{d.day}</div>
                  <div className="text-[10px] text-ink/60">{d.weekday}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{iv.job?.title}</p>
                  <div className="text-xs text-ink/60 flex items-center gap-1.5 min-w-0"><CompanyLogo company={iv.company} size={16} className="rounded-md!" /> <span className="truncate">{iv.company?.name}</span></div>
                  <p className="text-xs text-ink/70 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium">{formatTime(iv.scheduledAt)}</span>
                    <span className="inline-flex items-center gap-1">{MODE_ICON[iv.mode]} {MODE_LABEL[iv.mode] || iv.mode}</span>
                    <span className="text-ink/50">· {INTERVIEW_TYPE_LABEL[iv.type] || iv.type}</span>
                  </p>
                </div>
                <Link
                  to="/interviews"
                  className="focus-ring shrink-0 text-xs font-medium text-primary border border-sage rounded-lg px-2.5 py-1.5 hover:bg-mint transition"
                  aria-label={`View details for the ${iv.job?.title} interview at ${iv.company?.name}`}
                >
                  View Details
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 0 && (
        <Link to="/interviews" className="focus-ring mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Schedule another interview
        </Link>
      )}
    </SectionCard>
  );
}

export default UpcomingInterviews;
