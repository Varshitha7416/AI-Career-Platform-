// Accessible progress bar (0-100) using semantic tokens.
function ProgressBar({ value = 0, label = 'Progress' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} className="h-2 w-full rounded-full bg-mint overflow-hidden">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

export default ProgressBar;
