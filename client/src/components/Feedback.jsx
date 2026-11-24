// Small shared UI pieces: loading skeletons, empty/error/success states.

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-sage/30 rounded-lg ${className}`} />;
}

export function CardSkeletons({ count = 3 }) {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm p-5">
          <Skeleton className="h-5 w-1/3 mb-3" />
          <Skeleton className="h-4 w-1/4 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="underline font-medium shrink-0">Retry</button>
      )}
    </div>
  );
}

export function SuccessMessage({ message }) {
  if (!message) return null;
  return (
    <div role="status" className="bg-mint text-primary text-sm px-4 py-3 rounded-lg">
      {message}
    </div>
  );
}

export function EmptyState({ title, hint, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
      <p className="text-charcoal font-medium">{title}</p>
      {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

const STATUS_STYLES = {
  applied: 'bg-mint text-primary',
  interviewing: 'bg-amber-100 text-amber-700',
  offer: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  requested: 'bg-mint text-primary',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  referred: 'bg-teal-100 text-teal-700',
};

export function StatusBadge({ status }) {
  return (
    <span className={`text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}
