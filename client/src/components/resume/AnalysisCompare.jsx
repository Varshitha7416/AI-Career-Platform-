import { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { ErrorMessage, Skeleton } from '../Feedback';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime, snapshotJobLabel, snapshotResumeName } from './resumeUtils';

const norm = (s) => String(s || '').trim().toLowerCase();

function skillSet(a) {
  if (a.result) return new Map((a.result.matchingSkills || []).map((s) => [norm(s.skill), s.skill]));
  return null;
}

function Delta({ label, from, to }) {
  const has = typeof from === 'number' && typeof to === 'number';
  const d = has ? to - from : null;
  return (
    <div className="rounded-lg border border-sage/30 bg-bg/60 p-3 text-center">
      <p className="text-xs text-ink/60">{label}</p>
      <p className="font-display text-xl font-bold text-primary">
        {typeof from === 'number' ? from : '--'} <span className="text-ink/40 text-base">to</span> {typeof to === 'number' ? to : '--'}
      </p>
      {has && (
        <p className={`text-xs font-semibold ${d > 0 ? 'text-green-700' : d < 0 ? 'text-red-600' : 'text-ink/60'}`}>
          {d > 0 ? `+${d}` : d === 0 ? 'No change' : d} {d !== 0 && 'points'}
        </p>
      )}
    </div>
  );
}

function Column({ title, a }) {
  return (
    <div className="rounded-lg border border-sage/30 p-3 text-sm min-w-0">
      <p className="text-xs font-semibold uppercase text-accent">{title}</p>
      <p className="font-medium text-ink truncate">{snapshotJobLabel(a) || 'General analysis'}</p>
      <p className="text-xs text-ink/60 truncate">{snapshotResumeName(a)} &middot; {formatDateTime(a.createdAt)}</p>
    </div>
  );
}

function Chips({ items, cls, empty }) {
  if (!items.length) return <p className="text-sm text-ink/60">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => <span key={s} className={`text-xs px-2.5 py-1 rounded-full ${cls}`}>{s}</span>)}
    </div>
  );
}

/** Side-by-side comparison. `ids` = [olderId, newerId] chosen by the caller. */
function AnalysisCompare({ ids, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, b] = await Promise.all(ids.map((id) => axiosClient.get(`/resume-analysis/${id}`)));
        if (cancelled) return;
        const list = [a.data.analysis, b.data.analysis].sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt));
        setData(list);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the analyses to compare.'));
      }
    })();
    return () => { cancelled = true; };
  }, [ids]);

  let body;
  if (error) body = <ErrorMessage message={error} />;
  else if (!data) body = <Skeleton className="h-40 w-full" />;
  else {
    const [before, after] = data;
    const sb = skillSet(before);
    const sa = skillSet(after);
    const comparable = sb && sa;
    const gained = comparable ? [...sa.entries()].filter(([k]) => !sb.has(k)).map(([, v]) => v) : [];
    const lost = comparable ? [...sb.entries()].filter(([k]) => !sa.has(k)).map(([, v]) => v) : [];
    const sameKind = before.type === after.type && snapshotJobLabel(before) === snapshotJobLabel(after);
    body = (
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Column title="Earlier" a={before} />
          <Column title="Later" a={after} />
        </div>
        {!sameKind && (
          <p className="text-xs bg-amber-50 text-amber-700 rounded-lg px-3 py-2">
            These two analyses are for different jobs or types, so score changes may reflect the job rather than your resume.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Delta label="AI readiness score" from={before.result?.overallScore ?? before.overallScore} to={after.result?.overallScore ?? after.overallScore} />
          <Delta label="Job match %" from={before.matchPercentage} to={after.matchPercentage} />
        </div>
        {comparable ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-ink mb-2">Skills gained</h4>
              <Chips items={gained} cls="bg-green-100 text-green-700" empty="No newly matched skills." />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ink mb-2">Skills no longer matched</h4>
              <Chips items={lost} cls="bg-red-100 text-red-700" empty="No skills dropped out." />
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink/60">Skill-level comparison is not available because at least one of these is an older analysis without a detailed breakdown.</p>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Compare analyses" className="bg-white rounded-2xl shadow-sm border border-sage/30 p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-display text-lg font-bold text-primary">Compare analyses</h3>
        <button type="button" onClick={onClose} className="focus-ring text-sm px-3 py-1.5 rounded-lg text-primary hover:bg-mint">Close comparison</button>
      </div>
      {body}
    </section>
  );
}

export default AnalysisCompare;
