import { Link } from 'react-router-dom';
import { BriefcaseIcon, CalendarIcon, CapIcon, UserCheckIcon, ArrowRight, BookmarkFilled } from './DashIcons';
import ProgressRing from './ProgressRing';
import { LeafCorner } from './Botanical';
import { formatDate, formatTime, clampPercent, pluralize } from './format';

// One clickable stat card. `indicator` is an optional subtle visual (bar / ring) shown at the bottom.
function StatCard({ to, icon, label, value, caption, indicator, valueSuffix = '', ariaLabel, className = '' }) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={`focus-ring group relative overflow-hidden bg-white rounded-2xl border border-sage/30 shadow-sm p-4 sm:p-5 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition ${className}`}
    >
      <LeafCorner className="absolute -right-4 -bottom-4 w-20 h-20 text-mint opacity-80 pointer-events-none" />
      <div className="flex items-center justify-between gap-2">
        <span className="w-10 h-10 rounded-xl bg-mint text-primary flex items-center justify-center">{icon}</span>
        <ArrowRight size={16} className="text-ink/30 group-hover:text-primary group-hover:translate-x-0.5 transition" />
      </div>
      <div>
        <p className="text-sm text-ink/70">{label}</p>
        <p className="font-display text-2xl sm:text-3xl font-bold text-primary leading-tight mt-0.5">
          {value}{valueSuffix}
        </p>
        <p className="text-xs text-ink/60 mt-0.5 min-h-4">{caption}</p>
      </div>
      <div className="mt-auto pt-1 min-h-3">{indicator}</div>
    </Link>
  );
}

function Bar({ pct, className = 'bg-accent' }) {
  return (
    <div className="h-1.5 rounded-full bg-mint overflow-hidden" role="presentation">
      <div className={`h-full rounded-full transition-[width] duration-700 ${className}`} style={{ width: `${clampPercent(pct)}%` }} />
    </div>
  );
}

function StatsRow({ stats }) {
  const apps = stats.totalApplications;
  const saved = stats.savedJobs;
  const iv = stats.upcomingInterviews;
  const prog = stats.careerPrograms;
  const prof = stats.profileComplete;

  const nextInterview = iv.nextAt ? `Next: ${formatDate(iv.nextAt, false)}, ${formatTime(iv.nextAt)}` : 'None scheduled yet';
  const missing = prof.missing?.[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 xl:grid-cols-5 gap-3 sm:gap-4" aria-label="Key statistics">
      <StatCard
        to={apps.link}
        icon={<BriefcaseIcon size={20} />}
        className="lg:col-span-2 xl:col-span-1"
        label="Total Applications"
        value={apps.value}
        caption={apps.value ? `${apps.inProgress} in progress` : 'Apply to your first job'}
        indicator={apps.value ? <Bar pct={(apps.inProgress / apps.value) * 100} /> : null}
        ariaLabel={`Total applications: ${apps.value}. View your application tracker`}
      />
      <StatCard
        to={saved.link}
        icon={<BookmarkFilled size={20} />}
        className="lg:col-span-2 xl:col-span-1"
        label="Saved Jobs"
        value={saved.value}
        caption={saved.value ? `${pluralize(saved.value, 'job')} to revisit` : 'Bookmark jobs you like'}
        ariaLabel={`Saved jobs: ${saved.value}. View saved jobs`}
      />
      <StatCard
        to={iv.link}
        icon={<CalendarIcon size={20} />}
        className="lg:col-span-2 xl:col-span-1"
        label="Upcoming Interviews"
        value={iv.value}
        caption={nextInterview}
        ariaLabel={`Upcoming interviews: ${iv.value}. View interviews`}
      />
      <StatCard
        to={prog.link}
        icon={<CapIcon size={20} />}
        className="lg:col-span-3 xl:col-span-1"
        label="Career Programs"
        value={prog.value}
        caption={prog.value ? `Enrolled · ${prog.completed} completed` : 'Explore learning programs'}
        indicator={prog.value ? <Bar pct={(prog.completed / prog.value) * 100} className="bg-sage" /> : null}
        ariaLabel={`Career programs: ${prog.value} enrolled. View career programs`}
      />
      <StatCard
        to={prof.link}
        className="col-span-2 lg:col-span-3 xl:col-span-1"
        icon={<UserCheckIcon size={20} />}
        label="Profile Complete"
        value={clampPercent(prof.value)}
        valueSuffix="%"
        caption={missing ? `Next: ${missing.label}` : 'Your profile is complete'}
        indicator={
          <div className="flex items-center gap-3">
            <ProgressRing percent={prof.value} size={44} stroke={6} barClass="text-accent" label={`Profile ${clampPercent(prof.value)}% complete`}>
              <span className="text-[10px] font-bold text-primary">{clampPercent(prof.value)}</span>
            </ProgressRing>
            <div className="flex-1"><Bar pct={prof.value} /></div>
          </div>
        }
        ariaLabel={`Profile ${clampPercent(prof.value)}% complete. View your profile`}
      />
    </div>
  );
}

export default StatsRow;
