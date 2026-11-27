import { useState, useEffect, useCallback } from 'react';
import { listAnalyses, deleteAnalysis } from '../../api/skillGap';
import ConfirmDialog from '../coverletter/ConfirmDialog';
import Pagination from '../Pagination';
import { Skeleton, ErrorMessage, EmptyState, SuccessMessage } from '../Feedback';
import CompareView from './CompareView';
import { CARD, BTN_GHOST, basisLabel, targetKindLabel, resumeLabel, jobLabelOf, formatDate, aiErrorMessage } from './skillGapUtils';

const LIMIT = 8;

/** Paginated saved analyses: open, delete (with cascade confirm), pick two to compare. */
function HistoryTab({ onOpen, onDeleted, onStart }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ analyses: [], pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState([]);
  const [comparing, setComparing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listAnalyses(page, LIMIT);
      setData({ analyses: res.analyses || [], pages: res.pages || 1, total: res.total ?? (res.analyses || []).length });
    } catch (err) {
      setError(aiErrorMessage(err, 'Could not load your analysis history.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / page change
    load();
  }, [load]);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 2 ? [p[1], id] : [...p, id]));

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await deleteAnalysis(toDelete._id);
      setNotice(res.roadmapDeleted ? 'Analysis and its roadmap were deleted.' : 'Analysis deleted.');
      onDeleted(toDelete._id);
      setPicked((p) => p.filter((x) => x !== toDelete._id));
      setComparing(null);
      setToDelete(null);
      if (data.analyses.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (err) {
      setDeleteError(aiErrorMessage(err, 'Could not delete that analysis.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {notice && <SuccessMessage message={notice} />}
      {comparing && <CompareView a={comparing[0]} b={comparing[1]} onClose={() => setComparing(null)} />}

      <section className={CARD} aria-labelledby="sg-hist-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sg-hist-h" className="font-display text-xl font-bold text-primary">Saved analyses</h2>
          <button type="button" disabled={picked.length !== 2} onClick={() => setComparing([...picked])} className={BTN_GHOST}>
            {picked.length === 2 ? 'Compare the two selected' : `Select 2 to compare (${picked.length}/2)`}
          </button>
        </div>

        {loading ? (
          <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        ) : error ? (
          <div className="mt-4"><ErrorMessage message={error} onRetry={load} /></div>
        ) : data.analyses.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No analyses yet" hint="Run your first skill gap analysis and it will be saved here.">
              <button type="button" onClick={onStart} className={BTN_GHOST}>Start an analysis</button>
            </EmptyState>
          </div>
        ) : (
          <>
            <ul className="mt-4 flex flex-col gap-3">
              {data.analyses.map((a) => {
                const src = [jobLabelOf(a) && `Job: ${jobLabelOf(a)}`, resumeLabel(a) && `Resume: ${resumeLabel(a)}`].filter(Boolean).join(' - ');
                return (
                  <li key={a._id} className="rounded-xl border border-sage/40 p-4 flex flex-wrap items-center gap-3">
                    <input
                      type="checkbox"
                      checked={picked.includes(a._id)}
                      onChange={() => toggle(a._id)}
                      aria-label={`Select ${a.title} for comparison`}
                      className="focus-ring w-4 h-4 accent-[var(--color-primary)]"
                    />
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="text-sm font-semibold text-ink break-words">{a.title}</p>
                      <p className="text-xs text-ink/60 mt-0.5">
                        {basisLabel(a.basis)} - {targetKindLabel(a.targetKind)} - {formatDate(a.createdAt)}
                      </p>
                      {src && <p className="text-xs text-ink/60 mt-0.5 break-words">{src}</p>}
                      <p className="text-xs text-ink/60 mt-0.5">
                        {a.counts?.matched ?? 0} matched, {a.counts?.missing ?? 0} missing
                        {a.hasRoadmap ? `, roadmap ${a.roadmapPercent ?? 0}% done` : ', no roadmap yet'}
                      </p>
                    </div>
                    <span className="font-display text-2xl font-bold text-primary" aria-label={`Score ${a.score?.value ?? 'not available'} out of 100`}>{a.score?.value ?? '--'}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => onOpen(a._id)} className={BTN_GHOST}>Open</button>
                      <button type="button" onClick={() => { setDeleteError(''); setToDelete(a); }} className="focus-ring px-4 py-2 rounded-full text-sm text-red-600 border border-red-200 hover:bg-red-50">Delete</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {data.pages > 1 && <div className="mt-4"><Pagination page={page} pages={data.pages} onChange={setPage} /></div>}
          </>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title="Delete this analysis?"
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setToDelete(null)}
        >
          <p>&ldquo;{toDelete.title}&rdquo; will be permanently deleted.</p>
          {toDelete.hasRoadmap && <p className="font-medium">Its learning roadmap and all task progress will be deleted too.</p>}
          {deleteError && <ErrorMessage message={deleteError} />}
        </ConfirmDialog>
      )}
    </div>
  );
}

export default HistoryTab;
