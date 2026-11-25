import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';

export const PREVIEW_SIZE = 3;
const STEP = 20;

// Loads one side of the referral lists ("mine" = sent, "incoming" = received) with a status filter.
// Collapsed = 3-item preview; "View All" expands to the full list (grows by 20 via Load more).
export default function useReferralList(kind, status, refreshKey) {
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState(PREVIEW_SIZE);
  const [state, setState] = useState({ items: [], total: 0, loading: true, error: '' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-params change
    setState((s) => ({ ...s, loading: true, error: '' }));
    axiosClient
      .get(`/referrals/${kind}`, { params: { status: status || undefined, limit, page: 1 } })
      .then((res) => {
        const items = res.data.referrals || [];
        if (!cancelled) setState({ items, total: res.data.total ?? items.length, loading: false, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: getErrorMessage(err, 'Could not load requests.') }));
      });
    return () => { cancelled = true; };
  }, [kind, status, limit, refreshKey, reload]);

  const viewAll = useCallback(() => { setExpanded(true); setLimit(STEP); }, []);
  const showLess = useCallback(() => { setExpanded(false); setLimit(PREVIEW_SIZE); }, []);
  const loadMore = useCallback(() => setLimit((l) => l + STEP), []);
  const retry = useCallback(() => setReload((n) => n + 1), []);

  return { ...state, expanded, viewAll, showLess, loadMore, retry };
}
