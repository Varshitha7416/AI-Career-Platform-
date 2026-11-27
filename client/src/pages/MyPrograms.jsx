import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import ProgressBar from '../components/programs/ProgressBar';
import Pagination from '../components/Pagination';
import { Skeleton, ErrorMessage, EmptyState } from '../components/Feedback';
import { ClockIcon } from '../components/Icons';
import { ENROLLMENT_META, formatDate } from '../utils/dashboard';

const PAGE_SIZE = 9;
const TABS = [['all', 'All'], ['saved', 'Saved'], ['in-progress', 'In progress'], ['completed', 'Completed']];
const SORTS = [['updated', 'Recently updated'], ['title', 'Title (A-Z)'], ['progress', 'Progress']];

function MyPrograms() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') || 'all';
  const sort = sp.get('sort') || 'updated';
  const page = Math.max(parseInt(sp.get('page'), 10) || 1, 1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const update = useCallback((patch) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v && v !== 'all' && v !== 'updated' ? next.set(k, String(v)) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setSp(next);
  }, [sp, setSp]);

  const key = sp.toString();
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/programs/mine', { params: { status, sort, page, limit: PAGE_SIZE } });
      setData(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your programs'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on URL change
    load();
  }, [load]);

  const counts = data?.counts || {};
  const items = data?.items || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">My Programs</h1>
          <p className="text-ink/70 mt-1">Programs you saved, started or completed.</p>
        </div>
        <Link to="/programs" className="focus-ring inline-flex items-center rounded-xl bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary-dark transition">Browse programs</Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {TABS.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={status === v} onClick={() => update({ status: v })} className={`focus-ring text-sm px-3.5 py-1.5 rounded-full border transition ${status === v ? 'bg-primary text-white border-primary' : 'bg-white border-sage/60 text-primary hover:bg-mint'}`}>
              {label}{data ? ` (${counts[v] ?? 0})` : ''}
            </button>
          ))}
        </div>
        <label className="text-sm text-ink/70 inline-flex items-center gap-2">
          Sort by
          <select value={sort} onChange={(e) => update({ sort: e.target.value })} className="focus-ring bg-white border border-sage/50 rounded-xl px-3 py-2 text-sm text-ink">
            {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="mb-4"><ErrorMessage message={error} onRetry={load} /></div>}

      {loading && !data ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-label="Loading programs">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : !error && items.length === 0 ? (
        <EmptyState title={status === 'all' ? 'No programs yet' : 'Nothing here yet'} hint={status === 'all' ? 'Save or start a program to track it here.' : 'No programs with this status.'}>
          <Link to="/programs" className="inline-block bg-primary text-white px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition">Browse programs</Link>
        </EmptyState>
      ) : (
        <>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map(({ program, enrollment }) => {
              const meta = ENROLLMENT_META[enrollment.status];
              return (
                <li key={program.id} className="bg-white rounded-2xl border border-sage/30 shadow-sm p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-ink leading-snug">{program.title}</h2>
                    {meta && <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${meta.cls}`}>{meta.label}</span>}
                  </div>
                  <p className="text-sm text-accent font-medium mt-1">{program.provider}</p>
                  {!program.available && <p className="mt-2 text-xs font-medium text-amber-800 bg-amber-100 dark:bg-amber-400/15 dark:text-amber-200 rounded-lg px-2.5 py-1 self-start">No longer available</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink/70">
                    <span className="px-2.5 py-1 rounded-full bg-mint text-primary font-medium">{program.level}</span>
                    {program.duration && <span className="inline-flex items-center gap-1"><ClockIcon size={13} /> {program.duration}</span>}
                  </div>
                  {enrollment.status !== 'saved' && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-ink/70 mb-1"><span>Progress</span><span>{enrollment.progress}%</span></div>
                      <ProgressBar value={enrollment.progress} label={`Progress for ${program.title}`} />
                    </div>
                  )}
                  <p className="text-xs text-ink/60 mt-3">Updated {formatDate(enrollment.updatedAt)}{enrollment.completedAt ? ` · Completed ${formatDate(enrollment.completedAt)}` : ''}</p>
                  <Link to={`/programs/${program.id}`} className="focus-ring mt-auto pt-4 text-sm font-medium text-primary hover:underline self-start">
                    {enrollment.status === 'in-progress' ? 'Continue →' : 'View details →'}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pages={data?.pages || 1} onChange={(n) => update({ page: n })} />
        </>
      )}
    </div>
  );
}

export default MyPrograms;
