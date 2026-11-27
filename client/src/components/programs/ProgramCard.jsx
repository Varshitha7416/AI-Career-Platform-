import { Link } from 'react-router-dom';
import { ClockIcon } from '../Icons';
import ProgressBar from './ProgressBar';
import { PROGRAM_THEMES, ENROLLMENT_META } from '../../utils/dashboard';

// Themed visual header (palette colours + leaf motif) shared by the card and the details page.
export function ProgramVisual({ theme = 'forest', category = '', className = 'h-28' }) {
  const t = PROGRAM_THEMES[theme] || PROGRAM_THEMES.forest;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: t.background, color: t.color }} aria-hidden="true">
      <svg viewBox="0 0 200 110" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <circle cx="168" cy="26" r="46" fill="currentColor" opacity="0.10" />
        <circle cx="30" cy="104" r="40" fill="currentColor" opacity="0.08" />
        <path d="M150 120C128 92 134 60 164 40c24 22 22 56-14 80Z" fill="currentColor" opacity="0.22" />
        <path d="M184 120c-12-20-8-44 10-60 16 18 14 42-10 60Z" fill="currentColor" opacity="0.35" />
      </svg>
      <span className="absolute left-4 bottom-3 text-[11px] font-semibold tracking-wide uppercase opacity-90">{category}</span>
    </div>
  );
}

function ProgramCard({ program }) {
  const enr = program.enrollment ? ENROLLMENT_META[program.enrollment] : null;
  return (
    <article className="bg-white rounded-2xl border border-sage/30 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition overflow-hidden flex flex-col">
      <ProgramVisual theme={program.theme} category={program.category} />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-ink leading-snug">{program.title}</h3>
          {enr && <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${enr.cls}`}>{enr.label}</span>}
        </div>
        <p className="text-sm text-accent font-medium mt-1">{program.provider}</p>
        <p className="text-sm text-ink/70 mt-2 line-clamp-3">{program.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink/70">
          <span className="px-2.5 py-1 rounded-full bg-mint text-primary font-medium">{program.level}</span>
          <span className="inline-flex items-center gap-1"><ClockIcon size={13} /> {program.duration}</span>
        </div>
        {program.enrollment === 'in-progress' && Number.isInteger(program.enrollmentProgress) && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-ink/70 mb-1"><span>Progress</span><span>{program.enrollmentProgress}%</span></div>
            <ProgressBar value={program.enrollmentProgress} label={`Progress for ${program.title}`} />
          </div>
        )}
        <Link to={`/programs/${program.id || program._id}`} className="focus-ring mt-auto pt-4 text-sm font-medium text-primary hover:underline self-start">
          Learn more →
        </Link>
      </div>
    </article>
  );
}

export default ProgramCard;
