import { Link } from 'react-router-dom';
import { ArrowRight, BriefcaseIcon, CalendarIcon, CapIcon, CheckCircle, OpenCircle, BookmarkFilled } from '../dashboard/DashIcons';
import { Skeleton, ErrorMessage } from '../Feedback';
import ProgressRing from '../dashboard/ProgressRing';
import CompanyLogo from '../CompanyLogo';
import { interestsOf } from './homeData';
import { relativeTime, formatDateTime, pluralize, locationOf, workModeLabel, clampPercent } from '../dashboard/format';

const CARD = 'bg-white rounded-2xl border border-sage/30 shadow-sm p-5 sm:p-6';
const LINK = 'focus-ring rounded-md hover:underline';
const TAP = 'focus-ring inline-flex items-center min-h-10 rounded-md hover:underline text-primary font-medium';

function StarOutline({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" /></svg>;
}

function ProfileCard({ overview, me, stored }) {
  const pc = overview?.stats?.profileComplete;
  const missing = pc?.missing || [];
  const { roles, primary } = interestsOf(me, stored);
  const summary = me?.resumeSummary;
  let resume = null; // { ready, text }
  if (summary && typeof summary.resumeReady === 'boolean') {
    const n = Number(summary.count) || 0;
    resume = { ready: summary.resumeReady, text: summary.resumeReady ? `${pluralize(n, 'resume')} on file${summary.roleResumeCount ? `, ${summary.roleResumeCount} matched to a role` : ''}` : 'No resume yet' };
  } else if (pc) {
    const ready = !missing.some((m) => m.key === 'resume');
    resume = { ready, text: ready ? 'Resume on file' : 'No resume yet' };
  }

  return (
    <div className={CARD}>
      <h3 className="font-display text-xl font-bold text-primary">Your profile</h3>
      {pc ? (
        <div className="mt-4 flex items-center gap-4">
          <ProgressRing percent={pc.value} size={88} stroke={9} label={`Profile ${clampPercent(pc.value)}% complete`} />
          <p className="text-sm text-ink/75">
            {missing.length === 0 ? 'Your profile is complete. Nice work.' : `Your profile is ${clampPercent(pc.value)}% complete. A few more details help us suit suggestions to you.`}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink/60">Profile progress is unavailable right now.</p>
      )}

      {missing.length > 0 && (
        <ul className="mt-4 space-y-1">
          {missing.slice(0, 4).map((m) => (
            <li key={m.key}>
              <Link to={m.link || '/profile'} className="focus-ring flex items-center gap-2 min-h-10 rounded-lg px-2 -mx-2 text-sm text-primary hover:bg-mint transition">
                <OpenCircle size={16} className="text-sage shrink-0" /> <span className="flex-1">{m.label}</span> <ArrowRight size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 pt-4 border-t border-sage/25">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Career interests</p>
        {roles.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {roles.map((r) => (
              <li key={r} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${r === primary ? 'bg-primary text-white' : 'bg-mint text-primary'}`}>
                {r === primary && roles.length > 1 && <StarOutline size={12} />}{r}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink/70">
            No target role yet. <Link to="/profile" className={TAP}>Add a career interest</Link> to get matched jobs.
          </p>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-sage/25">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Resume</p>
        {resume ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink">
            {resume.ready ? <CheckCircle size={18} className="text-accent shrink-0" /> : <OpenCircle size={18} className="text-sage shrink-0" />}
            <span>{resume.text}.</span>
            <Link to="/resume" className={TAP}>{resume.ready ? 'Open' : 'Upload your resume'}</Link>
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink/60">Resume status unavailable right now.</p>
        )}
      </div>
    </div>
  );
}

function StatTile({ to, icon: Icon, value, label, sub }) {
  return (
    <Link to={to} className="focus-ring block rounded-xl border border-sage/30 bg-mint/40 p-4 hover:bg-mint transition">
      <span className="flex items-center gap-2 text-primary"><Icon size={18} /><span className="font-display text-2xl font-bold leading-none">{value}</span></span>
      <span className="mt-1 block text-sm font-medium text-ink">{label}</span>
      {sub && <span className="block text-xs text-ink/60">{sub}</span>}
    </Link>
  );
}

function ActivityCard({ overview }) {
  const s = overview?.stats;
  const activity = (overview?.recentActivity || []).slice(0, 4);
  const upcoming = overview?.upcomingInterviews?.[0];
  return (
    <div className={`${CARD} flex flex-col`}>
      <h3 className="font-display text-xl font-bold text-primary">Your job search</h3>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile to="/applications" icon={BriefcaseIcon} value={s.totalApplications.value} label={s.totalApplications.value === 1 ? 'Application' : 'Applications'} sub={s.totalApplications.value ? `${s.totalApplications.inProgress} in progress` : 'None yet'} />
        <StatTile to="/saved-jobs" icon={BookmarkFilled} value={s.savedJobs.value} label="Saved jobs" sub={s.savedJobs.value ? '' : 'None yet'} />
        <StatTile to="/interviews" icon={CalendarIcon} value={s.upcomingInterviews.value} label="Upcoming interviews" sub={s.upcomingInterviews.value ? '' : 'None scheduled'} />
        <StatTile to="/programs" icon={CapIcon} value={s.careerPrograms.value} label="Programs" sub={s.careerPrograms.value ? `${s.careerPrograms.completed} completed` : 'None saved'} />
      </div>

      {upcoming && (
        <p className="mt-4 text-sm text-ink/80 rounded-xl bg-mint/60 px-3 py-2">
          Next interview: <Link to="/interviews" className={TAP}>{upcoming.job?.title}{upcoming.company?.name ? ` at ${upcoming.company.name}` : ''}</Link>, {formatDateTime(upcoming.scheduledAt)}
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-sage/25 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Recent activity</p>
        {activity.length ? (
          <ul className="mt-2 divide-y divide-sage/20">
            {activity.map((a) => (
              <li key={a.id}>
                <Link to={a.link || '/dashboard'} className="focus-ring flex items-start justify-between gap-3 min-h-11 py-2 rounded-md hover:bg-mint/50 transition">
                  <span className="min-w-0">
                    <span className="block text-sm text-ink truncate">{a.title}</span>
                    {a.description && <span className="block text-xs text-ink/60 truncate">{a.description}</span>}
                  </span>
                  <span className="text-xs text-ink/60 shrink-0 pt-0.5">{relativeTime(a.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink/70">
            Nothing here yet. <Link to="/jobs" className={TAP}>Find a job</Link> to save or apply to, and your activity will show up here.
          </p>
        )}
      </div>
      <Link to="/dashboard" className={`${LINK} mt-3 inline-flex items-center gap-1 self-start min-h-10 text-sm font-medium text-primary`}>Open full dashboard <ArrowRight size={14} /></Link>
    </div>
  );
}

function RecommendedCard({ rec, onRetry, hasRole }) {
  return (
    <div className={`${CARD} lg:col-span-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-primary">Recommended for you</h3>
          {!rec.loading && !rec.error && rec.jobs.length > 0 && (
            <p className="text-xs text-ink/60 mt-0.5">
              {rec.personalized ? 'Matched to your profile and resume.' : 'Latest jobs. Add a target role and resume for personalised picks.'}
            </p>
          )}
        </div>
        <Link to="/jobs" className={`${LINK} shrink-0 inline-flex items-center gap-1 min-h-10 text-sm font-medium text-primary`}>Browse all <ArrowRight size={14} /></Link>
      </div>

      {rec.loading ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3" aria-label="Loading recommendations">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : rec.error ? (
        <div className="mt-4"><ErrorMessage message={rec.error} onRetry={onRetry} /></div>
      ) : rec.jobs.length === 0 ? (
        <p className="mt-3 text-sm text-ink/70">
          No jobs to show yet. {hasRole ? '' : 'Add a career interest in your profile, '}
          <Link to={hasRole ? '/jobs' : '/profile'} className={TAP}>{hasRole ? 'Browse Job Discovery' : 'then check back here'}</Link>.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {rec.jobs.map((j) => (
            <li key={j._id}>
              <Link to={`/jobs/${j._id}`} className="focus-ring flex gap-3 h-full rounded-xl border border-sage/30 bg-mint/30 p-3.5 hover:bg-mint/60 transition">
                <CompanyLogo company={j.company} size={40} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink leading-snug">{j.title}</span>
                  <span className="block text-xs text-ink/70 truncate">{j.company?.name}{locationOf(j) ? ` · ${locationOf(j)}` : ''}{j.workMode ? ` · ${workModeLabel(j.workMode)}` : ''}</span>
                  {rec.personalized && Array.isArray(j.matchReasons) && j.matchReasons[0] && <span className="mt-1 block text-xs text-accent">{j.matchReasons[0]}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-3" aria-label="Loading your progress" aria-busy="true">
      <Skeleton className="h-80" />
      <Skeleton className="h-80 lg:col-span-2" />
    </div>
  );
}

function ProgressSection({ overview, loading, error, onRetry, me, stored, rec, onRetryRec }) {
  const { roles } = interestsOf(me, stored);
  return (
    <section aria-labelledby="home-progress" className="bg-mint/30 border-y border-sage/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="inline-block rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary border border-sage/40">Your progress</span>
          <h2 id="home-progress" className="mt-3 font-display text-3xl sm:text-4xl font-bold text-primary">Where you are today</h2>
          <p className="mt-2 text-sm sm:text-base text-ink/70">A quick look at your profile, your job search and what to do next, from your own CareerNest data.</p>
        </div>

        {loading && !overview ? (
          <SectionSkeleton />
        ) : (
          <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
            {overview ? (
              <>
                <ProfileCard overview={overview} me={me} stored={stored} />
                <div className="lg:col-span-2"><ActivityCard overview={overview} /></div>
              </>
            ) : (
              <div className="lg:col-span-3"><ErrorMessage message={error || 'Could not load your progress'} onRetry={onRetry} /></div>
            )}
            <RecommendedCard rec={rec} onRetry={onRetryRec} hasRole={roles.length > 0} />
          </div>
        )}
      </div>
    </section>
  );
}

export default ProgressSection;
