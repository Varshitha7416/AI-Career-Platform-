// Hand-built SVG donut chart. `segments`: [{ key, label, value, className }] where className sets the colour
// (stroke uses currentColor). Segment lengths animate when values change.
function DonutChart({ segments, total, size = 188, stroke = 26, centerLabel = 'Applications', ariaLabel }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sum = segments.reduce((s, x) => s + x.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 3 : 0;
  // Precompute each segment's arc length and start offset (no mutation during render).
  const arcs = segments.reduce((acc, s) => {
    const len = sum ? (s.value / sum) * c : 0;
    const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].len : 0;
    acc.push({ ...s, len, start });
    return acc;
  }, []);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-mint" />
        {arcs.map((s) => {
          const dash = Math.max(s.len - (s.value > 0 ? gap : 0), 0);
          return (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-s.start}
              className={`${s.className} transition-all duration-700 ease-out`}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-4xl font-bold text-primary leading-none">{total}</span>
        <span className="text-xs text-ink/60 mt-1">{centerLabel}</span>
      </div>
    </div>
  );
}

export default DonutChart;
