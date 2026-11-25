import { useId } from 'react';
import { Link } from 'react-router-dom';
import SectionCard from './SectionCard';
import DonutChart from './DonutChart';
import { RANGE_OPTIONS } from '../../hooks/useDashboard';
import { pluralize } from './format';
import { ArrowRight } from './DashIcons';

// Colours use text-* classes (stroke is currentColor) so both themes can restyle them.
const SEGMENTS = [
  { key: 'inProgress', label: 'In Progress', className: 'text-sage', dot: 'bg-sage' },
  { key: 'interview', label: 'Interview', className: 'text-[#235347] dark:text-[#2dd4bf]', dot: 'bg-[#235347] dark:bg-[#2dd4bf]' },
  { key: 'offer', label: 'Offer', className: 'text-[#10b981]', dot: 'bg-[#10b981]' },
  { key: 'rejected', label: 'Rejected', className: 'text-[#f87171]', dot: 'bg-[#f87171]' },
];

function ApplicationOverview({ overview, range, onRangeChange, busy, className = '' }) {
  const selectId = useId();
  const total = overview.total || 0;
  const segments = SEGMENTS.map((s) => ({ ...s, value: overview[s.key] || 0 }));
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label || 'All time';
  const summary = `Application overview, ${rangeLabel.toLowerCase()}: ${pluralize(total, 'application')}. ` +
    segments.map((s) => `${s.label} ${s.value}`).join(', ');

  return (
    <SectionCard
      id="overview-heading"
      title="Application Overview"
      className={`flex flex-col ${className}`}
      bodyClassName="flex-1 flex flex-col justify-evenly gap-6"
      action={
        <div className="shrink-0">
          <label htmlFor={selectId} className="sr-only">Time range</label>
          <select
            id={selectId}
            value={range}
            onChange={(e) => onRangeChange(e.target.value)}
            className="focus-ring text-sm bg-white border border-sage/50 rounded-lg px-2.5 py-1.5 text-ink"
          >
            {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      }
    >
      <p className="sr-only" aria-live="polite">{busy ? 'Updating chart' : summary}</p>

      {total === 0 && !busy ? (
        <div className="text-center py-8">
          <div className="mx-auto w-40 h-40 relative">
            <DonutChart segments={segments} total={0} size={160} stroke={22} ariaLabel="No applications in this period" />
          </div>
          <p className="font-medium text-ink mt-4">No applications {range === 'all' ? 'yet' : 'in this period'}</p>
          <p className="text-sm text-ink/60 mt-1">
            {range === 'all' ? 'Apply to a job and confirm it to see your progress here.' : 'Try a longer time range.'}
          </p>
          <Link to="/jobs" className="focus-ring inline-block mt-4 bg-primary text-white rounded-xl px-5 py-2 text-sm hover:bg-primary-dark transition">Browse Job Discovery</Link>
        </div>
      ) : (
        <div className={`flex flex-col sm:flex-row items-center gap-6 transition-opacity ${busy ? 'opacity-60' : 'opacity-100'}`} aria-busy={busy}>
          <DonutChart segments={segments} total={total} size={216} stroke={30} ariaLabel={summary} />
          <ul className="w-full sm:flex-1 space-y-3.5">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center gap-3 text-sm">
                <span className={`w-3 h-3 rounded-full shrink-0 ${s.dot}`} aria-hidden="true" />
                <span className="text-ink/80 flex-1">{s.label}</span>
                <span className="font-semibold text-primary tabular-nums">{s.value}</span>
                <span className="w-10 text-right text-xs text-ink/50 tabular-nums">{total ? `${Math.round((s.value / total) * 100)}%` : '0%'}</span>
              </li>
            ))}
            <li className="flex items-center gap-3 text-sm border-t border-sage/30 pt-2.5 mt-1">
              <span className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="text-ink/80 flex-1 font-medium">Total</span>
              <span className="font-bold text-primary tabular-nums">{total}</span>
              <span className="w-10" />
            </li>
          </ul>
        </div>
      )}

      {total > 0 && (
        <dl className="grid grid-cols-2 gap-3 text-center" aria-label="Application insights">
          <div className="rounded-xl bg-mint/60 py-4">
            <dt className="text-xs text-ink/60">Reached interview stage</dt>
            <dd className="font-display text-2xl font-bold text-primary">{Math.round(((overview.interview + overview.offer) / total) * 100)}%</dd>
          </div>
          <div className="rounded-xl bg-mint/60 py-4">
            <dt className="text-xs text-ink/60">Offer rate</dt>
            <dd className="font-display text-2xl font-bold text-primary">{Math.round((overview.offer / total) * 100)}%</dd>
          </div>
        </dl>
      )}

      {total > 0 && (
        <Link to="/applications" className="focus-ring self-center inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Open application tracker <ArrowRight size={14} />
        </Link>
      )}
    </SectionCard>
  );
}

export default ApplicationOverview;
