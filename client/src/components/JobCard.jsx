import { Link, useNavigate } from 'react-router-dom';
import CompanyLogo from './CompanyLogo';
import { BookmarkIcon, PinIcon, BriefcaseIcon, UsersIcon, WalletIcon, ClockIcon } from './Icons';
import { formatExperience, formatSalary, formatLocation, timeAgo, WORK_MODE_LABEL, EMPLOYMENT_LABEL, isDemo } from '../utils/jobs';

// Job summary card used for recommended, search and saved jobs.
function JobCard({ job, saved, busy, onToggleSave, showMatch = false }) {
  const navigate = useNavigate();
  const salary = formatSalary(job);
  const open = () => navigate(`/jobs/${job._id}`);

  return (
    <article
      onClick={open}
      className="group relative bg-white rounded-2xl border border-sage/30 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition p-4 flex flex-col cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <CompanyLogo company={job.company} size={40} />
          <span className="text-sm font-medium text-ink/80 truncate">{job.company?.name}</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSave(job._id); }}
          disabled={busy}
          aria-pressed={saved}
          aria-label={saved ? `Unsave ${job.title}` : `Save ${job.title}`}
          className={`focus-ring shrink-0 p-1.5 rounded-lg transition disabled:opacity-50 ${saved ? 'text-accent' : 'text-ink/50 hover:text-accent hover:bg-mint'}`}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>

      <h3 className="mt-3 font-semibold text-ink leading-snug">
        <Link to={`/jobs/${job._id}`} onClick={(e) => e.stopPropagation()} className="focus-ring hover:text-accent">
          {job.title}
        </Link>
      </h3>

      <ul className="mt-2 space-y-1 text-xs text-ink/70">
        <li className="flex items-center gap-1.5"><PinIcon size={14} className="shrink-0" /> {formatLocation(job)}</li>
        <li className="flex items-center gap-1.5">
          <BriefcaseIcon size={14} className="shrink-0" /> {EMPLOYMENT_LABEL[job.employmentType] || 'Full-time'}
          <span className="mx-1 text-sage">·</span>
          <UsersIcon size={14} className="shrink-0" /> {formatExperience(job)}
        </li>
        {salary && <li className="flex items-center gap-1.5"><WalletIcon size={14} className="shrink-0" /> {salary}</li>}
      </ul>

      {showMatch && job.matchReasons?.length > 0 && (
        <p className="mt-2 text-xs text-accent bg-mint/70 rounded-lg px-2 py-1.5 leading-snug">
          <span className="font-semibold">{job.matchScore}% match</span> · {job.matchReasons[0]}
        </p>
      )}

      <div className="mt-auto pt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-accent text-white">{WORK_MODE_LABEL[job.workMode] || 'Onsite'}</span>
        {job.applyUrl && <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-mint text-primary">Apply link</span>}
        {isDemo(job) && <span title="Sample listing created for the CareerNest demo; not a verified live vacancy" className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-sage text-primary/80">Demo</span>}
        <span className="ml-auto text-[11px] text-ink/50 flex items-center gap-1"><ClockIcon size={12} /> {timeAgo(job.postedAt || job.createdAt).replace('Posted ', '')}</span>
      </div>
    </article>
  );
}

export default JobCard;
