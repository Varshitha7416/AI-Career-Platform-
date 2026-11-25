import { Skeleton } from '../Feedback';

// First-load placeholder that mirrors the real layout (hero, 5 stat cards, content grid).
function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your dashboard">
      <div className="hero-bg border-b border-sage/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-10">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-2/3 max-w-lg mt-4" />
          <Skeleton className="h-4 w-full max-w-xl mt-4" />
          <Skeleton className="h-12 w-full max-w-2xl mt-6" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
        <div className="grid gap-6 xl:grid-cols-12">
          <Skeleton className="h-72 rounded-2xl xl:col-span-5" />
          <Skeleton className="h-72 rounded-2xl xl:col-span-4" />
          <Skeleton className="h-72 rounded-2xl xl:col-span-3" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default DashboardSkeleton;
