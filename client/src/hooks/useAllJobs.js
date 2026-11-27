import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

// Loads every job (paging through the API, 50 at a time) for use in <select> pickers.
export default function useAllJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let page = 1;
        let pages = 1;
        const all = [];
        do {
          const res = await axiosClient.get('/jobs', { params: { page, limit: 50 } });
          all.push(...res.data.jobs);
          pages = res.data.pages;
          page += 1;
        } while (page <= pages && page <= 20);
        if (!cancelled) setJobs(all);
      } catch {
        if (!cancelled) setError('Could not load the job list.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { jobs, loading, error };
}
