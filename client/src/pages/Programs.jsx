import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import ProgramCard from '../components/programs/ProgramCard';
import Pagination from '../components/Pagination';
import { Skeleton, ErrorMessage, EmptyState } from '../components/Feedback';
import { SearchIcon } from '../components/Icons';

const PAGE_SIZE = 9;

function Programs() {
  const [sp, setSp] = useSearchParams();
  const category = sp.get('category') || '';
  const q = sp.get('q') || '';
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

  const hasFilters = Boolean(category || q);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-primary">Career Programs</h1>
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

      <p className="text-sm text-ink/65 mb-4" aria-live="polite">{loading ? 'Loading…' : `${total} program${total === 1 ? '' : 's'}`}</p>
      {error && <div className="mb-4"><ErrorMessage message={error} onRetry={load} /></div>}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-label="Loading programs">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : !error && programs.length === 0 ? (
        <EmptyState title="No programs found" hint={hasFilters ? 'Try a different category or search term.' : 'No programs are available yet.'}>
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
