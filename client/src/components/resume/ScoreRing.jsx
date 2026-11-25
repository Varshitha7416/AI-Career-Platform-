// Hand-built SVG score ring (0-100). No chart library.
function toneFor(value) {
  if (value >= 75) return 'var(--color-accent)';
  if (value >= 50) return '#D99A1E';
  return '#D1545B';
}

function ScoreRing({ value, label, size = 132, caption }) {
  const has = typeof value === 'number' && !Number.isNaN(value);
  const v = has ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <figure className="flex flex-col items-center text-center m-0">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={has ? `${label}: ${v} out of 100` : `${label}: not available`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sage)" strokeOpacity="0.3" strokeWidth={stroke} />
          {has && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={toneFor(v)}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - v / 100)}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold text-primary leading-none">{has ? v : '--'}</span>
          {has && <span className="text-[11px] text-ink/60 mt-0.5">out of 100</span>}
        </div>
      </div>
      <figcaption className="mt-2 text-sm font-semibold text-ink">{label}</figcaption>
      {caption && <span className="text-xs text-ink/60">{caption}</span>}
    </figure>
  );
}

export default ScoreRing;
