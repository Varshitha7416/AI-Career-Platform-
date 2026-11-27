import { useState, useEffect, useCallback } from 'react';
import { compareAnalyses } from '../../api/skillGap';
import { Skeleton, ErrorMessage } from '../Feedback';
import { CARD, BTN_GHOST, PRIORITY_STYLE, aiErrorMessage, formatDate, basisLabel } from './skillGapUtils';

function Side({ title, s }) {
  return (
    <div className="rounded-xl border border-sage/40 p-4 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/65">{title}</p>
      <p className="text-sm font-semibold text-ink mt-1 break-words">{s.title}</p>
      <p className="text-xs text-ink/60 mt-0.5">{formatDate(s.createdAt)} - {basisLabel(s.basis)}</p>
      <p className="font-display text-3xl font-bold text-primary mt-2">{s.score?.value ?? '--'}<span className="text-sm font-normal text-ink/60"> / 100</span></p>
      <p className="text-xs text-ink/60 mt-1">{s.counts?.matched ?? 0} matched, {s.counts?.missing ?? 0} missing</p>
    </div>
  );
}

function List({ title, items, empty, render }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">{title} <span className="font-normal text-ink/60">({items.length})</span></h4>
      {items.length === 0 ? <p className="text-xs text-ink/60 mt-1">{empty}</p> : <ul className="mt-1.5 flex flex-wrap gap-1.5">{items.map(render)}</ul>}
    </div>
  );
}

/** Compares two saved analyses (older = baseline, decided by the server). Never claims progress across different targets. */
function CompareView({ a, b, onClose }) {
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRes(await compareAnalyses(a, b));
    } catch (err) {
      setError(aiErrorMessage(err, 'Could not compare these analyses.'));
    } finally {
      setLoading(false);
    }
  }, [a, b]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / selection change
    load();
  }, [load]);

  const chip = 'text-xs px-2.5 py-1 rounded-full bg-mint text-ink';

  return (
    <section className={CARD} aria-labelledby="sg-cmp-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sg-cmp-h" className="font-display text-xl font-bold text-primary">Compare analyses</h2>
        <button type="button" onClick={onClose} className={BTN_GHOST}>Close</button>
      </div>

      {loading ? (
        <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-16" /></div>
      ) : error ? (
        <div className="mt-4"><ErrorMessage message={error} onRetry={load} /></div>
      ) : res && (
        <div className="mt-4 flex flex-col gap-4">
          {res.warning && <p role="alert" className="rounded-lg bg-amber-100 text-amber-800 text-sm px-4 py-3">{res.warning}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Side title="Earlier" s={res.a} />
            <Side title="Later" s={res.b} />
          </div>

          {typeof res.scoreDelta === 'number' && (
            <p className="text-sm text-ink">
              {res.sameTarget ? 'Score change: ' : 'Score difference (different targets, not a measure of progress): '}
              <span className="font-display text-lg font-bold text-primary">{res.scoreDelta > 0 ? '+' : ''}{res.scoreDelta}</span>
            </p>
          )}
          {res.roadmap && (res.roadmap.a != null || res.roadmap.b != null) && (
            <p className="text-xs text-ink/70">Roadmap completion: earlier {res.roadmap.a ?? 'no roadmap'}{res.roadmap.a != null ? '%' : ''}, later {res.roadmap.b ?? 'no roadmap'}{res.roadmap.b != null ? '%' : ''}.</p>
          )}

          {res.comparable !== false && (
            <div className="grid gap-4 sm:grid-cols-2">
              <List title="Newly matched" items={res.newlySkills || []} empty="No new matches." render={(s) => <li key={s.skill} className={chip}>{s.skill}</li>} />
              <List title="Gaps now closed" items={res.resolvedMissing || []} empty="None." render={(s) => <li key={s.skill} className={chip}>{s.skill}</li>} />
              <List
                title="Still missing"
                items={res.stillMissing || []}
                empty="Nothing is still missing."
                render={(s) => <li key={s.skill} className={`text-xs px-2.5 py-1 rounded-full ${PRIORITY_STYLE[s.priority] || PRIORITY_STYLE.low}`}>{s.skill}</li>}
              />
              <List title="Needs improvement" items={res.needsImprovement || []} empty="None." render={(s) => <li key={s.skill} className={chip}>{s.skill}</li>} />
            </div>
          )}

          {(res.notes || []).length > 0 && (
            <ul className="text-xs text-ink/70 list-disc pl-5 flex flex-col gap-1">
              {res.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default CompareView;
