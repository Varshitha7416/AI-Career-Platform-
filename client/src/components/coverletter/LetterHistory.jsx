import { useState, useMemo } from 'react';
import { EmptyState, Skeleton } from '../Feedback';
import { formatDate, jobLabel, resumeLabel } from './letterUtils';

const fieldClass = 'focus-ring bg-white border border-sage/50 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink/45';

function LinkBtn({ children, onClick, danger, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`focus-ring text-sm underline disabled:opacity-50 ${danger ? 'text-red-600' : 'text-primary'}`}
    >
      {children}
    </button>
  );
}

export default function LetterHistory({ letters, loading, activeId, downloadingId, onOpen, onDownload, onRegenerate, onDelete }) {
  const [q, setQ] = useState('');
  const [resumeFilter, setResumeFilter] = useState('');

  const resumeOptions = useMemo(() => {
    const map = new Map();
    letters.forEach((l) => map.set(l.resume?._id || `deleted:${resumeLabel(l)}`, resumeLabel(l)));
    return [...map.entries()];
  }, [letters]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return letters.filter((l) => {
      const { title, company } = jobLabel(l);
      if (needle && !`${title} ${company}`.toLowerCase().includes(needle)) return false;
      if (resumeFilter && (l.resume?._id || `deleted:${resumeLabel(l)}`) !== resumeFilter) return false;
      return true;
    });
  }, [letters, q, resumeFilter]);

  return (
    <section className="mt-8" aria-labelledby="cl-hist-h">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h2 id="cl-hist-h" className="font-display text-xl text-primary">Your cover letters</h2>
        {letters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="cl-h-q">Search letters</label>
            <input id="cl-h-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job or company" className={fieldClass} />
            <label className="sr-only" htmlFor="cl-h-r">Filter by resume</label>
            <select id="cl-h-r" value={resumeFilter} onChange={(e) => setResumeFilter(e.target.value)} className={fieldClass}>
              <option value="">All resumes</option>
              {resumeOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : letters.length === 0 ? (
        <EmptyState title="No cover letters yet" hint="Generate your first one above and it will be saved here." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No letters match your search" hint="Try a different word or clear the filter." />
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {filtered.map((l) => {
            const { title, company } = jobLabel(l);
            return (
              <li key={l._id} className={`rounded-2xl border bg-white p-4 ${activeId === l._id ? 'border-accent' : 'border-sage/30'}`}>
                <p className="font-medium text-ink">{title}{company ? ` at ${company}` : ''}</p>
                {(l.jobDeleted || l.jobSnapshot?.manual) && (
                  <p className="text-xs text-ink/60">{l.jobDeleted ? 'Job no longer listed' : 'Manually entered job'}</p>
                )}
                <dl className="mt-1 text-xs text-ink/65 space-y-0.5">
                  <div>Resume: {resumeLabel(l)}</div>
                  <div>Generated {formatDate(l.createdAt)}</div>
                  {l.editedAt && <div>Last edited {formatDate(l.editedAt)}</div>}
                  <div>Version {l.currentVersion || 1}</div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  <LinkBtn onClick={() => onOpen(l)}>Open / edit</LinkBtn>
                  <LinkBtn onClick={() => onDownload(l, 'pdf')} disabled={downloadingId === l._id}>PDF</LinkBtn>
                  <LinkBtn onClick={() => onDownload(l, 'docx')} disabled={downloadingId === l._id}>DOCX</LinkBtn>
                  <LinkBtn onClick={() => onRegenerate(l)}>Regenerate</LinkBtn>
                  <LinkBtn danger onClick={() => onDelete(l)}>Delete</LinkBtn>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
