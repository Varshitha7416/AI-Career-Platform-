import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import useJobActions from '../hooks/useJobActions';
import { getUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';
import JobCard from '../components/JobCard';
import RecommendedPanel from '../components/jobs/RecommendedPanel';
import Pagination from '../components/Pagination';
import HeroArt from '../components/HeroArt';
import { SearchIcon, PinIcon, BookmarkIcon, FilterIcon, ChevronDown } from '../components/Icons';
import { Skeleton, ErrorMessage, SuccessMessage, EmptyState } from '../components/Feedback';
import { EXPERIENCE_OPTIONS, SALARY_OPTIONS, SORT_OPTIONS, WORK_MODE_LABEL, EMPLOYMENT_LABEL } from '../utils/jobs';

const QUICK_KEYWORDS = ['Software Engineer', 'Data Analyst', 'Frontend Developer', 'Full Stack Developer', 'Product Engineer', 'UI/UX Designer'];
const PAGE_SIZE = 12;
const FILTER_KEYS = ['q', 'city', 'experience', 'workMode', 'employmentType', 'minSalaryLpa'];

const selectClass = 'focus-ring appearance-none w-full bg-white border border-sage/50 rounded-xl pl-3 pr-9 py-2.5 text-sm text-ink';

function Select({ value, onChange, children, label, icon }) {
  return (
    <div className="relative min-w-0">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/60 pointer-events-none">{icon}</span>}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${selectClass} ${icon ? 'pl-9' : ''}`}>
        {children}
      </select>
      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/60 pointer-events-none" />
    </div>
  );
}

function CardGridSkeleton({ count = 8 }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Loading jobs">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-sage/30 p-4">
          <div className="flex items-center gap-2.5"><Skeleton className="w-10 h-10" /><Skeleton className="h-4 w-24" /></div>
          <Skeleton className="h-5 w-3/4 mt-4" />
          <Skeleton className="h-3 w-1/2 mt-3" />
          <Skeleton className="h-3 w-2/3 mt-2" />
          <Skeleton className="h-6 w-20 mt-5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function Jobs() {
  const user = getUser();
  const [sp, setSp] = useSearchParams();
  const { savedIds, feedback, busyId, toggleSave } = useJobActions();
  const resultsRef = useRef(null);

  const view = sp.get('view') === 'saved' ? 'saved' : 'search';
  const page = Math.max(parseInt(sp.get('page'), 10) || 1, 1);
  const sort = sp.get('sort') || 'relevance';
  const q = sp.get('q') || '';
  const modes = useMemo(() => (sp.get('workMode') || '').split(',').filter(Boolean), [sp]);

  // Keep the search box in sync when the URL changes (back/forward, quick keywords, clear all).
  const [qInput, setQInput] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setQInput(q);
  }

  const [meta, setMeta] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reco, setReco] = useState(null);
  const [recoLoading, setRecoLoading] = useState(true);
  const [savedJobs, setSavedJobs] = useState([]);

  const hasFilters = FILTER_KEYS.some((k) => sp.get(k));

  // Update URL params; any change other than `page` goes back to page 1.
  const update = useCallback((patch) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
    });
    if (!('page' in patch)) next.delete('page');
    setSp(next);
  }, [sp, setSp]);

  const clearAll = () => {
    const next = new URLSearchParams();
    if (view === 'saved') next.set('view', 'saved');
    setSp(next);
  };

  // ---- filter options (cities etc.) from the backend
  useEffect(() => {
    axiosClient.get('/jobs/meta').then((res) => setMeta(res.data)).catch(() => {});
  }, []);

  // ---- recommendations
  useEffect(() => {
    let cancelled = false;
    axiosClient.get('/jobs/recommended', { params: { limit: 5 } })
      .then((res) => { if (!cancelled) setReco(res.data); })
      .catch(() => { if (!cancelled) setReco(null); })
      .finally(() => { if (!cancelled) setRecoLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ---- search results (driven entirely by the URL, so refresh / back / shared links work)
  const searchKey = sp.toString();
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (view === 'saved') {
        const res = await axiosClient.get(`/saved-jobs/${user.id}`);
        setSavedJobs(res.data.savedJobs.filter((s) => s?.job).map((s) => s.job));
      } else {
        const params = { page, limit: PAGE_SIZE, sort };
        FILTER_KEYS.forEach((k) => { if (sp.get(k)) params[k] = sp.get(k); });
        const res = await axiosClient.get('/jobs', { params });
        setJobs(res.data.jobs);
        setTotal(res.data.total);
        setPages(res.data.pages);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load jobs'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, user?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on URL change
    fetchJobs();
  }, [fetchJobs]);

  const goToPage = (n) => {
    update({ page: n });
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitSearch = (e) => {
    e.preventDefault();
    update({ q: qInput.trim() });
  };

  const toggleMode = (m) => update({ workMode: modes.includes(m) ? modes.filter((x) => x !== m) : [...modes, m] });

  const visibleSaved = savedJobs.filter((j) => savedIds.has(j._id));
  const showReco = view === 'search' && !hasFilters && page === 1 && (recoLoading || Boolean(reco?.jobs?.length || reco?.groups?.length));

  return (
    <div className="min-h-screen bg-bg">
      {/* ------------------------------------------------------------ hero + search */}
      <section className="hero-bg border-b border-sage/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-8 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-center">
          <div>
            <span className="inline-block text-[11px] font-semibold tracking-[0.14em] text-primary bg-sage/40 rounded-md px-2.5 py-1">JOB DISCOVERY</span>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] leading-tight font-bold text-primary mt-3">Find Your Next Opportunity</h1>
            <p className="text-ink/75 mt-2 max-w-xl">Search roles by title, skill, company or city, then save the ones you like and track what you apply to.</p>

            <form onSubmit={submitSearch} className="mt-6 flex flex-wrap gap-3" role="search">
              <div className="relative flex-1 basis-[200px] min-w-[180px]">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/60 pointer-events-none" />
                <input
                  type="search"
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Job title, skills, company…"
                  aria-label="Search jobs by title, skills or company"
                  className="focus-ring w-full bg-white border border-sage/50 rounded-xl pl-10 pr-3 py-2.5 text-sm"
                />
              </div>
              <div className="w-36 shrink-0">
                <Select label="City" value={sp.get('city') || ''} onChange={(v) => update({ city: v })} icon={<PinIcon size={16} />}>
                  <option value="">City</option>
                  {meta?.cities?.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
                </Select>
              </div>
              <div className="w-44 shrink-0">
                <Select label="Experience" value={sp.get('experience') || ''} onChange={(v) => update({ experience: v })}>
                  {EXPERIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <button type="submit" className="focus-ring inline-flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-dark transition">
                <SearchIcon size={16} /> Search
              </button>
              <button
                type="button"
                onClick={() => update({ view: view === 'saved' ? '' : 'saved' })}
                aria-pressed={view === 'saved'}
                className={`focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border transition ${view === 'saved' ? 'bg-primary text-white border-primary' : 'bg-white border-primary text-primary hover:bg-mint'}`}
              >
                <BookmarkIcon size={16} filled={view === 'saved'} /> Saved Jobs{savedIds.size ? ` (${savedIds.size})` : ''}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2" aria-label="Quick searches">
              {QUICK_KEYWORDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => update({ q: q === k ? '' : k, view: '' })}
                  aria-pressed={q === k}
                  className={`focus-ring text-xs px-3 py-1.5 rounded-full border transition ${q === k ? 'bg-primary text-white border-primary' : 'bg-white/80 border-sage/60 text-primary hover:bg-white hover:border-primary'}`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden lg:block h-[270px]"><HeroArt /></div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-3 mb-4">
          {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
          {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
        </div>

        {/* ------------------------------------------------------------ saved view */}
        {view === 'saved' ? (
          <section aria-labelledby="saved-heading">
            <div className="flex items-end justify-between gap-3 mb-4">
              <h2 id="saved-heading" className="font-display text-2xl font-bold text-primary">Saved jobs</h2>
              <button onClick={() => update({ view: '' })} className="focus-ring text-sm text-primary underline">← Back to all jobs</button>
            </div>
            {error && <ErrorMessage message={error} onRetry={fetchJobs} />}
            {loading ? <CardGridSkeleton count={4} /> : !error && visibleSaved.length === 0 ? (
              <EmptyState title="No saved jobs yet" hint="Tap the bookmark on any job to keep it here for later.">
                <button onClick={() => update({ view: '' })} className="bg-primary text-white px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition">Browse jobs</button>
              </EmptyState>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleSaved.map((job) => (
                  <JobCard key={job._id} job={job} saved={savedIds.has(job._id)} busy={busyId === job._id} onToggleSave={toggleSave} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* ---------------------------------------------------------- recommended */}
            {showReco && (
              <RecommendedPanel reco={reco} loading={recoLoading} savedIds={savedIds} busyId={busyId} onToggleSave={toggleSave} />
            )}

            {/* ---------------------------------------------------------- filters */}
            <section ref={resultsRef} className="scroll-mt-20" aria-labelledby="results-heading">
              <div className="flex flex-wrap items-center gap-2 mb-5" aria-label="Filters">
                <span className="flex items-center gap-1.5 text-sm text-ink/70 mr-1"><FilterIcon size={16} /> Filters</span>
                {Object.entries(WORK_MODE_LABEL).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMode(m)}
                    aria-pressed={modes.includes(m)}
                    className={`focus-ring text-sm px-3.5 py-1.5 rounded-full border transition ${modes.includes(m) ? 'bg-primary text-white border-primary' : 'bg-white border-sage/60 text-primary hover:bg-mint'}`}
                  >
                    {label}
                  </button>
                ))}
                <div className="w-40"><Select label="Employment type" value={sp.get('employmentType') || ''} onChange={(v) => update({ employmentType: v })}>
                  <option value="">Any type</option>
                  {Object.entries(EMPLOYMENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select></div>
                <div className="w-36"><Select label="Minimum salary" value={sp.get('minSalaryLpa') || ''} onChange={(v) => update({ minSalaryLpa: v })}>
                  {SALARY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select></div>
                {hasFilters && (
                  <button type="button" onClick={clearAll} className="focus-ring text-sm text-primary underline ml-1">Clear all</button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 id="results-heading" className="font-display text-2xl font-bold text-primary">
                  {hasFilters ? 'Search results' : 'All jobs'}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-ink/65" aria-live="polite">
                    {loading ? 'Loading…' : `${total} job${total === 1 ? '' : 's'} found`}
                  </span>
                  <div className="w-52">
                    <Select label="Sort jobs" value={sort} onChange={(v) => update({ sort: v === 'relevance' ? '' : v })}>
                      {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </div>
                </div>
              </div>

              {error && <ErrorMessage message={error} onRetry={fetchJobs} />}

              {loading ? <CardGridSkeleton count={8} /> : !error && jobs.length === 0 ? (
                <EmptyState title="No jobs match your search" hint="Try different keywords, a nearby city or fewer filters.">
                  {hasFilters && <button onClick={clearAll} className="bg-primary text-white px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition">Clear filters</button>}
                </EmptyState>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {jobs.map((job) => (
                      <JobCard key={job._id} job={job} saved={savedIds.has(job._id)} busy={busyId === job._id} onToggleSave={toggleSave} />
                    ))}
                  </div>
                  <Pagination page={page} pages={pages} onChange={goToPage} />
                </>
              )}
            </section>
          </>
        )}

        <p className="text-xs text-ink/50 mt-10 text-center">
          Listings marked “Demo” are sample data created for the CareerNest demo and are not verified live vacancies.
        </p>
      </div>
    </div>
  );
}

export default Jobs;
