import { useState, useEffect, useRef } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';
import { SearchIcon, CloseIcon, CheckIcon } from '../Icons';
import { Skeleton } from '../Feedback';

const fieldClass = 'focus-ring w-full bg-white border border-sage/50 rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink/45';

function Retrieved({ job }) {
  const parts = [
    job.jobDescription ? 'description' : null,
    job.requirements?.length ? `${job.requirements.length} requirements` : null,
    job.skills?.length ? `${job.skills.length} skills` : null,
    job.responsibilities?.length ? `${job.responsibilities.length} responsibilities` : null,
  ].filter(Boolean);
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-primary bg-mint/60 border border-sage/40 rounded-lg px-3 py-2" aria-live="polite">
      <CheckIcon size={14} className="mt-0.5 shrink-0" />
      <span>
        Retrieved from CareerNest: {parts.length ? parts.join(', ') : 'title and company only'}. The full job record is used when generating.
      </span>
    </p>
  );
}

// Searchable CareerNest job picker. Selecting a job reports it via onPick (the form auto-fills its fields).
export default function JobPicker({ jobId, onPick, onClear, onDetail }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [searchError, setSearchError] = useState('');
  const boxRef = useRef(null);
  const detailCb = useRef(onDetail);
  useEffect(() => { detailCb.current = onDetail; });

  // Debounced server-side search (only while the list is open).
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const res = await axiosClient.get('/jobs', { params: { q: query.trim() || undefined, limit: 8 } });
        if (!cancelled) setResults(res.data.jobs || []);
      } catch (err) {
        if (!cancelled) setSearchError(getErrorMessage(err, 'Could not search jobs'));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open]);

  // Load full details for the linked job (also covers ?job= deep links and opened letters).
  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosClient.get(`/jobs/${jobId}`);
        if (!cancelled) {
          setSelected(res.data.job);
          setDetailError('');
          detailCb.current?.(res.data.job);
        }
      } catch (err) {
        if (!cancelled) {
          setSelected(null);
          setDetailError(getErrorMessage(err, 'Could not load that job. Pick another or enter it below.'));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = jobId && selected?._id === jobId ? selected : null;

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor="cl-job-search" className="block text-xs font-medium text-ink/70 mb-1">Find a CareerNest job (optional)</label>
      {current ? (
        <div className="flex items-center justify-between gap-3 border border-sage/50 rounded-xl px-3 py-2.5 bg-white">
          <span className="text-sm text-ink min-w-0 truncate">{current.title}{current.company?.name ? ` at ${current.company.name}` : ''}</span>
          <button type="button" onClick={() => { setSelected(null); setDetailError(''); onClear(); }} className="focus-ring text-sm text-primary underline shrink-0 flex items-center gap-1">
            <CloseIcon size={14} /> Unlink
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/50 pointer-events-none" />
            <input
              id="cl-job-search"
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Search by title, company, skill or job ID"
              autoComplete="off"
              className={`${fieldClass} pl-9`}
            />
          </div>
          {open && (
            <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-sage/40 bg-white shadow-lg" aria-label="Matching jobs">
              {searching && <li className="p-3"><Skeleton className="h-4 w-2/3" /></li>}
              {!searching && searchError && <li className="p-3 text-sm text-red-600">{searchError}</li>}
              {!searching && !searchError && results.length === 0 && (
                <li className="p-3 text-sm text-ink/70">No matching jobs. Fill in the fields below instead.</li>
              )}
              {!searching && results.map((j) => (
                <li key={j._id}>
                  <button
                    type="button"
                    onClick={() => { setSelected(j); setDetailError(''); onPick(j); setOpen(false); setQuery(''); }}
                    className="focus-ring w-full text-left px-3 py-2 hover:bg-mint"
                  >
                    <span className="block text-sm font-medium text-ink">{j.title}</span>
                    <span className="block text-xs text-ink/65">{[j.company?.name, j.city].filter(Boolean).join(' - ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {detailError && <p role="alert" className="mt-2 text-sm text-red-600">{detailError}</p>}
      {current && <Retrieved job={current} />}
    </div>
  );
}
