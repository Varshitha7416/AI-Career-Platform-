import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { getUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';

// Tracks which jobs the user has saved/applied to and exposes save/unsave/apply actions.
export default function useJobActions() {
  const user = getUser();
  const [savedIds, setSavedIds] = useState(new Set());
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text }
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.all([
      axiosClient.get(`/saved-jobs/${user.id}`),
      axiosClient.get(`/applications/${user.id}`),
    ])
      .then(([saved, apps]) => {
        if (cancelled) return;
        // Defensive: ignore entries whose job no longer exists (job: null).
        setSavedIds(new Set(saved.data.savedJobs.filter((s) => s?.job).map((s) => s.job._id)));
        setAppliedIds(new Set(apps.data.applications.filter((a) => a?.job).map((a) => a.job._id)));
      })
      .catch(() => {
        // Non-fatal: buttons simply start in their default state.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const toggleSave = useCallback(async (jobId) => {
    setFeedback(null);
    setBusyId(jobId);
    const isSaved = savedIds.has(jobId);
    try {
      if (isSaved) {
        await axiosClient.delete(`/saved-jobs/${jobId}`);
      } else {
        await axiosClient.post('/saved-jobs', { jobId });
      }
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(jobId); else next.add(jobId);
        return next;
      });
      setFeedback({ type: 'success', text: isSaved ? 'Job removed from saved jobs.' : 'Job saved!' });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not update saved jobs') });
    } finally {
      setBusyId(null);
    }
  }, [savedIds]);

  const apply = useCallback(async (jobId) => {
    setFeedback(null);
    setBusyId(jobId);
    try {
      await axiosClient.post('/applications', { jobId });
      setAppliedIds((prev) => new Set(prev).add(jobId));
      setFeedback({ type: 'success', text: 'Application tracked! You can follow it on your Dashboard.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not apply') });
    } finally {
      setBusyId(null);
    }
  }, []);

  return { savedIds, appliedIds, feedback, setFeedback, busyId, toggleSave, apply };
}
