import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';
import useDashboard from '../../hooks/useDashboard';

// Home reads three independent real-data sources so one failure never blanks the page:
//   overview   GET /dashboard/overview        (stats, profile completeness, activity)
//   me         GET /auth/me                   (interests, primary role, resume summary: fields may be absent)
//   recommended GET /jobs/recommended?limit=3 (only `jobs` is used)
export default function useHomeData() {
  const { data: overview, loading: overviewLoading, error: overviewError, refetch: refetchOverview } = useDashboard('all');
  const [me, setMe] = useState(null);
  const [rec, setRec] = useState({ loading: true, error: '', jobs: [], personalized: null });

  useEffect(() => {
    let alive = true;
    axiosClient.get('/auth/me').then((r) => { if (alive) setMe(r.data?.user || null); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const loadRec = useCallback(async () => {
    setRec((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await axiosClient.get('/jobs/recommended', { params: { limit: 3 } });
      setRec({ loading: false, error: '', jobs: Array.isArray(res.data?.jobs) ? res.data.jobs.slice(0, 3) : [], personalized: res.data?.personalized ?? null });
    } catch (err) {
      setRec({ loading: false, error: getErrorMessage(err, 'Could not load recommendations'), jobs: [], personalized: null });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on mount
    loadRec();
  }, [loadRec]);

  return { overview, overviewLoading, overviewError, refetchOverview, me, rec, reloadRec: loadRec };
}
