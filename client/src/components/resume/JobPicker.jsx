import { useState, useMemo, useRef, useEffect } from 'react';
import { SearchIcon, CloseIcon } from '../Icons';
import { jobLabel } from './resumeUtils';

const MAX_SHOWN = 40;

/** Searchable picker for a CareerNest job. value = job id or ''. onChange(jobId). */
function JobPicker({ jobs, loading, error, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = jobs.find((j) => j._id === value);

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = words.length
      ? jobs.filter((j) => {
          const hay = `${j.title} ${j.company?.name || ''} ${j.city || ''} ${j.jobCode || ''}`.toLowerCase();
          return words.every((w) => hay.includes(w));
        })
      : jobs;
    return list;
  }, [jobs, query]);

  const pick = (id) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor="job-picker-input" className="block text-sm font-medium text-ink mb-1">
        Target job <span className="text-ink/50 font-normal">(optional)</span>
      </label>

      {value && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-mint text-primary px-3 py-2 text-sm mb-2">
          <span className="min-w-0 truncate">{selected ? jobLabel(selected) : 'Selected job'}</span>
          <button type="button" onClick={() => pick('')} aria-label="Remove selected job" className="focus-ring p-1 rounded shrink-0 hover:bg-white/40">
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      <div className="relative">
        <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/50 pointer-events-none" />
        <input
          id="job-picker-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="job-picker-list"
          autoComplete="off"
          value={query}
          disabled={loading}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          placeholder={loading ? 'Loading jobs...' : 'Search jobs by title, company or city'}
          className="w-full border border-sage/60 rounded-lg pl-9 pr-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error} You can still run a general analysis.</p>}
      {!value && !error && <p className="text-xs text-ink/60 mt-1">Leave empty for a general resume analysis.</p>}

      {open && !loading && (
        <ul id="job-picker-list" role="listbox" className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-sage/40 rounded-lg shadow-lg py-1">
          <li role="option" aria-selected={!value}>
            <button type="button" onClick={() => pick('')} className="focus-ring w-full text-left px-3 py-2 text-sm hover:bg-mint text-ink">
              General analysis (no specific job)
            </button>
          </li>
          {matches.slice(0, MAX_SHOWN).map((j) => (
            <li key={j._id} role="option" aria-selected={j._id === value}>
              <button type="button" onClick={() => pick(j._id)} className={`focus-ring w-full text-left px-3 py-2 text-sm hover:bg-mint ${j._id === value ? 'bg-mint' : ''}`}>
                <span className="block text-ink font-medium truncate">{j.title}</span>
                <span className="block text-xs text-ink/60 truncate">{[j.company?.name, j.city].filter(Boolean).join(' - ')}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-ink/60">No jobs match your search.</li>}
          {matches.length > MAX_SHOWN && (
            <li className="px-3 py-2 text-xs text-ink/60">Showing {MAX_SHOWN} of {matches.length}. Keep typing to narrow it down.</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default JobPicker;
