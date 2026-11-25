import { Link } from 'react-router-dom';
import SectionCard from './SectionCard';
import { ProgramVisual } from './Botanical';
import { CapIcon, ClockIcon, ArrowRight } from './DashIcons';

const ENROLL_LABEL = { saved: 'Saved', 'in-progress': 'In progress', completed: 'Completed' };

function ProgramCard({ p }) {
  return (
    <article className="flex flex-col bg-white rounded-2xl border border-sage/30 overflow-hidden">
      <ProgramVisual theme={p.theme} className="h-28 rounded-none">
        <div className="h-28 p-4 flex flex-col justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase opacity-90"><CapIcon size={14} /> {p.category}</span>
          <span className="text-[11px] opacity-90 flex items-center gap-1"><ClockIcon size={12} /> {p.duration} · {p.level}</span>
        </div>
      </ProgramVisual>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-ink leading-snug">{p.title}</h3>
        <p className="text-xs text-primary font-medium mt-0.5">{p.provider}</p>
        <p className="text-sm text-ink/70 mt-2 line-clamp-2">{p.description}</p>
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <Link to={`/programs/${p.id}`} className="focus-ring inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" aria-label={`Learn more about ${p.title}`}>
            Learn More <ArrowRight size={14} />
          </Link>
          {p.enrollment && <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-mint text-primary">{ENROLL_LABEL[p.enrollment] || p.enrollment}</span>}
        </div>
      </div>
    </article>
  );
}

function ProgramsPreview({ items, className = '' }) {
  return (
    <SectionCard
      id="programs-heading"
      title="Career Programs"
      subtitle="Curated sample programs to build in-demand skills"
      viewAll={{ to: '/programs' }}
      className={className}
    >
      {items.length === 0 ? (
        <p className="text-sm text-ink/60 py-4">No programs are available right now. Check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => <ProgramCard key={p.id} p={p} />)}
        </div>
      )}
    </SectionCard>
  );
}

export default ProgramsPreview;
