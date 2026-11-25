import { Link } from 'react-router-dom';
import { ArrowRight } from './DashIcons';

// Shared card chrome: heading + optional "View All" link or custom action.
function SectionCard({ id, title, subtitle, viewAll, action, children, className = '', bodyClassName = '' }) {
  return (
    <section aria-labelledby={id} className={`relative overflow-hidden bg-white rounded-2xl border border-sage/30 shadow-sm p-5 sm:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 id={id} className="font-display text-xl font-bold text-primary leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-ink/60 mt-0.5">{subtitle}</p>}
        </div>
        {action}
        {viewAll && (
          <Link
            to={viewAll.to}
            className="focus-ring shrink-0 inline-flex items-center gap-1 text-sm font-medium text-primary rounded-md hover:underline"
          >
            {viewAll.label || 'View All'} <ArrowRight size={14} />
          </Link>
        )}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export default SectionCard;
