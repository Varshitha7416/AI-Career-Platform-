import { Link } from 'react-router-dom';
import { Skeleton, ErrorMessage } from '../Feedback';
import { ArrowRight } from '../dashboard/DashIcons';
import ReferralCard from './ReferralCard';
import { PREVIEW_SIZE } from './useReferralList';

function ListSkeleton() {
  return (
    <div aria-label="Loading requests">
      {[0, 1, 2].map((i) => (
        <div key={i} className="p-4 border-b border-sage/25 last:border-b-0 flex gap-3">
          <Skeleton className="w-12 h-12 shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-4 w-2/3 mb-2" />
            <Skeleton className="h-3 w-1/3 mb-2" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// One side (sent / received) of the lists. `list` comes from useReferralList.
function ReferralList({ kind, list, filtered, onAction }) {
  const sent = kind === 'sent';
  const { items, total, loading, error, expanded } = list;
  const noun = sent ? 'Sent' : 'Received';

  let body;
  if (error && items.length === 0) {
    body = <div className="p-4"><ErrorMessage message={error} onRetry={list.retry} /></div>;
  } else if (loading && items.length === 0) {
    body = <ListSkeleton />;
  } else if (items.length === 0) {
    body = (
      <div className="p-8 text-center">
        <p className="font-medium text-ink">
          {filtered ? `No ${noun.toLowerCase()} requests with this status` : sent ? "You haven't sent any referral requests yet" : 'No referral requests received yet'}
        </p>
        <p className="text-sm text-ink/65 mt-1">
          {filtered
            ? 'Try a different status.'
            : sent
              ? 'Find people at companies you like and ask them for a referral.'
              : 'Turn on "I’m open to giving referrals" in your profile, and requests will show up here.'}
        </p>
        {!filtered && (
          <Link to={sent ? '/referrals/find' : '/profile'} className="focus-ring inline-block mt-4 text-sm font-medium text-primary underline rounded">
            {sent ? 'Find people to refer' : 'Go to your profile'}
          </Link>
        )}
      </div>
    );
  } else {
    body = (
      <div className={loading ? 'opacity-60 transition-opacity' : ''}>
        {error && <div className="p-3"><ErrorMessage message={error} onRetry={list.retry} /></div>}
        {items.map((r) => <ReferralCard key={r._id} referral={r} onAction={onAction} />)}
      </div>
    );
  }

  const linkCls = 'focus-ring inline-flex items-center min-h-10 gap-1.5 text-sm font-medium text-ink hover:text-primary rounded';

  return (
    <div className="rounded-xl border border-sage/30 bg-white overflow-hidden min-w-0">
      {body}
      {items.length > 0 && (
        <div className="border-t border-sage/25 px-4 py-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {!expanded && total > PREVIEW_SIZE && (
            <button type="button" onClick={list.viewAll} className={linkCls}>
              View All {noun} Requests ({total}) <ArrowRight size={14} />
            </button>
          )}
          {expanded && items.length < total && (
            <button type="button" onClick={list.loadMore} disabled={loading} className={`${linkCls} disabled:opacity-50`}>
              Load more <ArrowRight size={14} />
            </button>
          )}
          {expanded && (
            <button type="button" onClick={list.showLess} className={linkCls}>Show fewer</button>
          )}
          {!expanded && total <= PREVIEW_SIZE && (
            <span className="text-xs text-ink/60">Showing all {total} {noun.toLowerCase()} request{total === 1 ? '' : 's'}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default ReferralList;
