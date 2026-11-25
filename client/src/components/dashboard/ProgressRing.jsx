import { clampPercent } from './format';

// Circular progress indicator. Colours come from CSS classes so both themes can restyle it.
function ProgressRing({ percent, size = 96, stroke = 10, trackClass = 'text-mint', barClass = 'text-accent', label, children }) {
  const pct = clampPercent(percent);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label || `${pct}% complete`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className={trackClass} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          className={`${barClass} transition-[stroke-dasharray] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        {children ?? <span className="font-display font-bold" style={{ fontSize: size * 0.26 }}>{pct}%</span>}
      </div>
    </div>
  );
}

export default ProgressRing;
