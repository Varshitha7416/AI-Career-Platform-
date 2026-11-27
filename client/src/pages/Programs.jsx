import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import ProgramCard from '../components/programs/ProgramCard';
import Pagination from '../components/Pagination';
import { Skeleton, ErrorMessage, EmptyState } from '../components/Feedback';
import { SearchIcon } from '../components/Icons';

const PAGE_SIZE = 9;
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const DURATIONS = [['short', 'Up to 4 weeks'], ['medium', '5 to 12 weeks'], ['long', 'Over 12 weeks']];
const ENROLLMENTS = [['not-started', 'Not started'], ['saved', 'Saved'], ['in-progress', 'In progress'], ['completed', 'Completed']];
const selectClass = 'focus-ring bg-white border border-sage/50 rounded-xl px-3 py-2.5 text-sm text-ink';

function Programs() {
  const [sp, setSp] = useSearchParams();
  const category = sp.get('category') || '';
  const q = sp.get('q') || '';
  const level = sp.get('level') || '';
  const duration = sp.get('duration') || '';
  const enrollment = sp.get('enrollment') || '';
  const page = Math.max(parseInt(sp.get('page'), 10) || 1, 1);

  const [qInput, setQInput] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setQInput(q);
  }

  const [programs, setPrograms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const update = useCallback((patch) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setSp(next);
  }, [sp, setSp]);

  const key = sp.toString();
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      if (category) params.category = category;
      if (q) params.q = q;
      if (level) params.level = level;
      if (duration) params.duration = duration;
      if (enrollment) params.enrollment = enrollment;
      const res = await axiosClient.get('/programs', { params });
      setPrograms(res.data.programs || []);
      setCategories(res.data.categories || []);
      setPages(res.data.pages || 1);
      setTotal(res.data.total ?? (res.data.programs || []).length);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load career programs'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on URL change
    load();
  }, [load]);

  // search as you type (debounced)
  useEffect(() => {
    if (qInput.trim() === q) return undefined;
    const t = setTimeout(() => update({ q: qInput.trim() }), 350);
    return () => clearTimeout(t);
  }, [qInput, q, update]);

  const hasFilters = Boolean(category || q || level || duration || enrollment);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-bold text-primary">Career Programs</h1>
          <Link to="/programs/mine" className="focus-ring inline-flex items-center rounded-xl border border-primary text-primary px-4 py-2 text-sm font-medium hover:bg-mint transition">My Programs</Link>
        </div>
        <p className="text-ink/70 mt-1 max-w-2xl">Courses, certifications and learning paths to grow your skills. Program details are curated demo content; each program links to its provider.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-full sm:w-72">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/60 pointer-events-none" />
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search programs, providers, skills"
            aria-label="Search programs"
            className="focus-ring w-full bg-white border border-sage/50 rounded-xl pl-9 pr-3 py-2.5 text-sm text-ink"
          />
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Categories">
          <button type="button" aria-pressed={!category} onClick={() => update({ category: '' })} className={`focus-ring text-sm px-3.5 py-1.5 rounded-full border transition ${!category ? 'bg-primary text-white border-primary' : 'bg-white border-sage/60 text-primary hover:bg-mint'}`}>All</button>
          {categories.map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => update({ category: category === c ? '' : c })} className={`focus-ring text-sm px-3.5 py-1.5 rounded-full border transition ${category === c ? 'bg-primary text-white border-primary' : 'bg-white border-sage/60 text-primary hover:bg-mint'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4" role="group" aria-label="Program filters">
        <select aria-label="Level" value={level} onChange={(e) => update({ level: e.target.value })} className={selectClass}>
          <option value="">All levels</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select aria-label="Duration" value={duration} onChange={(e) => update({ duration: e.target.value })} className={selectClass}>
          <option value="">Any duration</option>
          {DURATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="My status" value={enrollment} onChange={(e) => update({ enrollment: e.target.value })} className={selectClass}>
          <option value="">All programs</option>
          {ENROLLMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {hasFilters && <button type="button" onClick={() => setSp(new URLSearchParams())} className="focus-ring text-sm text-primary underline rounded">Clear filters</button>}
      </div>

      <p className="text-sm text-ink/65 mb-4" aria-live="polite">{loading ? 'Loading…' : `${total} program${total === 1 ? '' : 's'}`}</p>
      {error && <div className="mb-4"><ErrorMessage message={error} onRetry={load} /></div>}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-label="Loading programs">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : !error && programs.length === 0 ? (
        <EmptyState title="No programs found" hint={hasFilters ? 'Try different filters or a different search term.' : 'No programs are available yet.'}>
          {hasFilters && <button onClick={() => setSp(new URLSearchParams())} className="bg-primary text-white px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition">Clear filters</button>}
        </EmptyState>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {programs.map((p) => <ProgramCard key={p.id || p._id} program={p} />)}
          </div>
          <Pagination page={page} pages={pages} onChange={(n) => update({ page: n })} />
        </>
      )}
    </div>
  );
}

export default Programs;
