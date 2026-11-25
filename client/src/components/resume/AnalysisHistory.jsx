import { useState, useMemo } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';
import { ErrorMessage, EmptyState, Skeleton } from '../Feedback';
import ModalShell from '../interviews/ModalShell';
import { formatDateTime, snapshotJobLabel, snapshotResumeName } from './resumeUtils';

const scoreOf = (a) => (typeof a.overallScore === 'number' ? a.overallScore : null);

/**
 * Analysis history list. Props: analyses (summaries), loading, error, onRetry, activeId,
 * onOpen(id), onDeleted(id), onCompare([idA, idB]).
 */
function AnalysisHistory({ analyses, loading, error, onRetry, activeId, onOpen, onDeleted, onCompare }) {
  const [resumeFilter, setResumeFilter] = useState('');
  const [picked, setPicked] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  // Filter options come from the history itself so deleted resumes (snapshots) can be filtered too.
  const resumeOptions = useMemo(() => {
    const map = new Map();
    analyses.forEach((a) => {
      const key = a.resume?._id || `snap:${a.resumeSnapshot?.fileName || ''}:${a.resumeSnapshot?.name || ''}`;
      if (!map.has(key)) map.set(key, `${snapshotResumeName(a)}${a.resumeDeleted ? ' (deleted)' : ''}`);
    });
    return [...map.entries()];
  }, [analyses]);

  const keyOf = (a) => a.resume?._id || `snap:${a.resumeSnapshot?.fileName || ''}:${a.resumeSnapshot?.name || ''}`;
  const shown = resumeFilter ? analyses.filter((a) => keyOf(a) === resumeFilter) : analyses;

  const togglePick = (id) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]));
  };

  const confirmDelete = async () => {
    setBusy(true);
    setActionError('');
    try {
      await axiosClient.delete(`/resume-analysis/${deleting._id}`);
      setPicked((p) => p.filter((x) => x !== deleting._id));
      onDeleted(deleting._id);
      setDeleting(null);
    } catch (err) {
      setDeleting(null);
      setActionError(getErrorMessage(err, 'Could not delete the analysis.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="history-title" className="bg-white rounded-2xl shadow-sm border border-sage/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="history-title" className="font-display text-xl font-bold text-primary">Analysis history</h2>
        <div className="flex flex-wrap items-center gap-2">
          {resumeOptions.length > 1 && (
            <select
              value={resumeFilter}
              onChange={(e) => setResumeFilter(e.target.value)}
              aria-label="Filter history by resume"
              className="border border-sage/60 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">All resumes</option>
              {resumeOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          )}
          {analyses.length > 1 && (
            <button
              type="button"
              disabled={picked.length !== 2}
              onClick={() => onCompare(picked)}
              className="focus-ring text-sm px-4 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Compare selected ({picked.length}/2)
            </button>
          )}
        </div>
      </div>
      {analyses.length > 1 && <p className="text-xs text-ink/60 mt-1">Tick two analyses to compare them side by side.</p>}

      <div className="mt-4 flex flex-col gap-2">
        {actionError && <ErrorMessage message={actionError} />}
        {loading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : error ? (
          <ErrorMessage message={error} onRetry={onRetry} />
        ) : analyses.length === 0 ? (
          <EmptyState title="No analyses yet" hint="Upload a resume and run your first analysis." />
        ) : shown.length === 0 ? (
          <p className="text-sm text-ink/60">No analyses for that resume.</p>
        ) : (
          shown.map((a) => {
            const job = snapshotJobLabel(a);
            const active = a._id === activeId;
            return (
              <div key={a._id} className={`rounded-xl border p-3 flex items-start gap-3 ${active ? 'border-accent ring-1 ring-accent' : 'border-sage/40'}`}>
                {analyses.length > 1 && (
                  <input
                    type="checkbox"
                    checked={picked.includes(a._id)}
                    onChange={() => togglePick(a._id)}
                    aria-label={`Select analysis from ${formatDateTime(a.createdAt)} for comparison`}
                    className="mt-1 w-4 h-4 accent-[#235347]"
                  />
                )}
                <button type="button" onClick={() => onOpen(a._id)} className="focus-ring text-left min-w-0 flex-1 rounded">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm text-ink truncate">{job || 'General analysis'}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-mint text-primary">{a.type === 'job-specific' ? 'Job-specific' : 'General'}</span>
                    {a.jobDeleted && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Job removed</span>}
                  </span>
                  <span className="block text-xs text-ink/60 mt-0.5 truncate">
                    {snapshotResumeName(a)}{a.resumeDeleted ? ' (resume deleted)' : ''} &middot; {formatDateTime(a.createdAt)}
                  </span>
                </button>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{scoreOf(a) !== null ? scoreOf(a) : '--'}<span className="text-[11px] font-normal text-ink/50"> readiness</span></p>
                  {typeof a.matchPercentage === 'number' && <p className="text-xs text-ink/70">{a.matchPercentage}% match</p>}
                  <button type="button" onClick={() => setDeleting(a)} className="focus-ring text-xs text-red-600 hover:bg-red-50 rounded px-1.5 py-0.5 mt-1">Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {deleting && (
        <ModalShell title="Delete this analysis?" onClose={() => setDeleting(null)} labelId="delete-analysis-title">
          <p className="text-sm text-ink/80 mt-3">This permanently removes the saved analysis from your history. Your resume is not affected.</p>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={() => setDeleting(null)} className="focus-ring px-4 py-2 rounded-lg text-sm text-primary hover:bg-mint">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={busy} className="focus-ring px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {busy ? 'Deleting...' : 'Delete analysis'}
            </button>
          </div>
        </ModalShell>
      )}
    </section>
  );
}

export default AnalysisHistory;
