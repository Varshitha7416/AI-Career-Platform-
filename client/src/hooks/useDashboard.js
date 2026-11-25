import { useState, useEffect, useCallback, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';

export const RANGE_OPTIONS = [
  { value: '30d', label: 'Last 30 days' },
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
];

/**
 * Loads GET /api/dashboard/overview once (everything the Dashboard shows, scoped to the logged-in user).
 * Changing the range refetches with ?range= and sets `rangeLoading` (the page keeps showing the previous data
 * instead of falling back to a full-page skeleton). Stale responses are ignored.
 */
export default function useDashboard(initialRange = 'all') {
  const [data, setData] = useState(null);
  const [range, setRangeState] = useState(initialRange);
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (r, initial) => {
    const id = ++seq.current;
    if (initial) setLoading(true); else setRangeLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/dashboard/overview', { params: { range: r } });
      if (id === seq.current) setData(res.data);
    } catch (err) {
      if (id === seq.current) setError(getErrorMessage(err, 'Could not load your dashboard'));
    } finally {
      if (id === seq.current) {
        setLoading(false);
        setRangeLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on mount
    load(initialRange, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const setRange = useCallback((r) => {
    setRangeState(r);
    load(r, false);
  }, [load]);

  const refetch = useCallback(() => load(range, !data), [load, range, data]);

  return { data, loading, error, range, setRange, rangeLoading, refetch };
}
