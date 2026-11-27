import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import JobCard from '../components/JobCard';
import { Skeleton, ErrorMessage, SuccessMessage, EmptyState } from '../components/Feedback';
import { BookmarkIcon } from '../components/Icons';
import { fetchSavedJobs } from '../utils/dashboard';

const SORTS = [
  { value: 'recent', label: 'Recently saved' },
  { value: 'oldest', label: 'Oldest saved' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'company', label: 'Company A-Z' },
];

function SavedJobs() {
  const [items, setItems] = useState([]); // [{ id, savedAt, job }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [sort, setSort] = useState('recent');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchSavedJobs();
      setItems(list.filter((s) => s?.job).map((s) => ({ id: s._id, savedAt: s.createdAt, job: s.job })));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your saved jobs'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on mount
    load();
  }, [load]);

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const sorted = useMemo(() => {
    const list = [...items];
    if (sort === 'oldest') list.sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt));
    else if (sort === 'title') list.sort((a, b) => a.job.title.localeCompare(b.job.title));
    else if (sort === 'company') list.sort((a, b) => (a.job.company?.name || '').localeCompare(b.job.company?.name || ''));
    else list.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    return list;
  }, [items, sort]);

  // Unsave = DELETE /saved-jobs/:jobId, then drop the card.
  const unsave = async (jobId) => {
    setBusyId(jobId);
    setFeedback(null);
    try {
      await axiosClient.delete(`/saved-jobs/${jobId}`);
      setItems((prev) => prev.filter((s) => s.job._id !== jobId));
      setFeedback({ type: 'success', text: 'Removed from your saved jobs.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not remove this job') });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2"><BookmarkIcon size={26} filled className="text-accent" /> Saved Jobs</h1>
          <p className="text-ink/70 mt-1" aria-live="polite">{loading ? 'Loading…' : `${items.length} saved job${items.length === 1 ? '' : 's'}`}</p>
        </div>
        {items.length > 1 && (
          <label className="text-sm text-ink/70 flex items-center gap-2">
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="focus-ring border border-sage/60 rounded-xl px-3 py-2 text-sm bg-white text-ink">
              {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
      </header>

      <div className="space-y-3 mb-4">
        {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
        {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
        {error && <ErrorMessage message={error} onRetry={load} />}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Loading saved jobs">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : !error && items.length === 0 ? (
        <EmptyState title="No saved jobs yet" hint="Tap the bookmark on any job in Job Discovery to keep it here for later.">
          <Link to="/jobs" className="inline-block bg-primary text-white px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition">Explore Job Discovery</Link>
        </EmptyState>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(({ id, job }) => (
            <JobCard key={id} job={job} saved busy={busyId === job._id} onToggleSave={unsave} />
          ))}
        </div>
      )}
    </div>
  );
}

export default SavedJobs;
