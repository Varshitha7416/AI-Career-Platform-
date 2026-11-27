import { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { ErrorMessage, Skeleton } from '../Feedback';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from './resumeUtils';

function Delta({ label, from, to, delta }) {
  const shown = (v) => (typeof v === 'number' ? v : '--');
  return (
    <div className="rounded-lg border border-sage/30 bg-bg/60 p-3 text-center">
      <p className="text-xs text-ink/60">{label}</p>
      <p className="font-display text-xl font-bold text-primary">
        {shown(from)} <span className="text-ink/40 text-base">to</span> {shown(to)}
      </p>
      {typeof delta === 'number' ? (
        <p className={`text-xs font-semibold ${delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-600' : 'text-ink/60'}`}>
          {delta === 0 ? 'No change' : `${delta > 0 ? '+' : ''}${delta} points`}
        </p>
      ) : (
        <p className="text-xs text-ink/60">Not comparable</p>
      )}
    </div>
  );
}

function Column({ title, s }) {
  return (
    <div className="rounded-lg border border-sage/30 p-3 text-sm min-w-0">
      <p className="text-xs font-semibold uppercase text-accent">{title}</p>
      <p className="font-medium text-ink truncate">{s.target}</p>
      <p className="text-xs text-ink/60 truncate">
        {s.resumeDeleted ? `${s.resume} (Resume no longer available)` : s.resume} &middot; {formatDateTime(s.createdAt)}
      </p>
    </div>
  );
}

function Chips({ title, items, cls, empty }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink mb-2">{title}</h4>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((s) => <span key={s} className={`text-xs px-2.5 py-1 rounded-full ${cls}`}>{s}</span>)}
        </div>
      ) : <p className="text-sm text-ink/60">{empty}</p>}
    </div>
  );
}

function Lines({ title, items, empty }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink mb-2">{title}</h4>
      {items.length ? (
        <ul className="list-disc pl-5 text-sm text-ink/80 flex flex-col gap-1">{items.map((s) => <li key={s}>{s}</li>)}</ul>
      ) : <p className="text-sm text-ink/60">{empty}</p>}
    </div>
  );
}

/** Server-side comparison (GET /resume-analysis/compare?a=&b=). `ids` = [baselineId, comparedId]; the caller orders them by date. */
function AnalysisCompare({ ids, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosClient.get('/resume-analysis/compare', { params: { a: ids[0], b: ids[1] } });
        if (!cancelled) { setData(res.data.comparison); setError(''); }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not compare these analyses.'));
      }
    })();
    return () => { cancelled = true; };
  }, [ids]);

  let body;
  if (error) body = <ErrorMessage message={error} />;
  else if (!data) body = <Skeleton className="h-40 w-full" />;
  else {
    body = (
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Column title="Baseline" s={data.a} />
          <Column title="Compared" s={data.b} />
        </div>
        {data.notes.length > 0 && (
          <ul className="text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2 flex flex-col gap-1" aria-label="How to read this comparison">
            {data.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Delta label="AI readiness score" from={data.a.overallScore} to={data.b.overallScore} delta={data.scoreDelta} />
          <Delta label="Job match %" from={data.a.matchPercentage} to={data.b.matchPercentage} delta={data.matchDelta} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Chips title="Missing skills resolved" items={data.missingSkills.resolved} cls="bg-green-100 text-green-700" empty="None resolved." />
          <Chips title="New missing skills" items={data.missingSkills.new} cls="bg-red-100 text-red-700" empty="No new gaps." />
          <Chips title="Still missing" items={data.missingSkills.unchanged} cls="bg-mint text-primary" empty="Nothing carried over." />
        </div>
        {data.matchedSkills && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Chips title="Matched skills gained" items={data.matchedSkills.gained} cls="bg-green-100 text-green-700" empty="No newly matched skills." />
            <Chips title="Matched skills lost" items={data.matchedSkills.lost} cls="bg-red-100 text-red-700" empty="No skills dropped out." />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Lines title="Strengths gained" items={data.strengths.gained} empty="No new strengths." />
          <Lines title="Strengths no longer listed" items={data.strengths.lost} empty="None dropped." />
          <Lines title="New suggestions" items={data.suggestions.added} empty="No new suggestions." />
          <Lines title="Suggestions no longer listed" items={data.suggestions.removed} empty="None dropped." />
        </div>
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
