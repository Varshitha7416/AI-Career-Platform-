/** Simple accessible progress bar. percent 0-100. */
function ProgressBar({ percent = 0, label, className = '' }) {
  const p = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <div
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-2 rounded-full bg-sage/30 overflow-hidden ${className}`}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${p}%` }} />
    </div>
  );
}

export default ProgressBar;
