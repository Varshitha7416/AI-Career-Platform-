import { Link } from 'react-router-dom';
import { BulbIcon, ArrowRight } from './DashIcons';
import { LeafCorner } from './Botanical';

// Bottom banner with a tip chosen from the user's real state (server decides) and a useful action.
function CareerTip({ tip }) {
  if (!tip) return null;
  return (
    <section aria-labelledby="tip-heading" className="relative overflow-hidden rounded-2xl bg-mint border border-sage/40 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <LeafCorner className="absolute -left-5 -bottom-5 w-28 h-28 text-sage opacity-50 pointer-events-none" flip />
      <span className="relative w-12 h-12 rounded-2xl bg-white text-primary flex items-center justify-center shrink-0 shadow-sm"><BulbIcon size={24} /></span>
      <div className="relative flex-1 min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-accent">CAREER TIP</p>
        <h2 id="tip-heading" className="font-display text-lg font-bold text-primary leading-snug">{tip.title}</h2>
        <p className="text-sm text-ink/75 mt-0.5">{tip.message}</p>
      </div>
      {tip.action && (
        <Link to={tip.action.link} className="focus-ring relative inline-flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-dark transition shrink-0">
          {tip.action.label} <ArrowRight size={16} />
        </Link>
      )}
    </section>
  );
}

export default CareerTip;
