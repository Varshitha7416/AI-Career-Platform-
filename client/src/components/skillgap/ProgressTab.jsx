import { useState, useEffect, useCallback } from 'react';
import { getOverview } from '../../api/skillGap';
import { Skeleton, ErrorMessage, EmptyState } from '../Feedback';
import ProgressBar from './ProgressBar';
import { CARD, BTN_GHOST, BTN_PRIMARY, STATUSES, aiErrorMessage, formatDateTime, basisLabel } from './skillGapUtils';

const statusLabel = (v) => STATUSES.find((s) => s.value === v)?.label || v;

function Tile({ label, value }) {
  return (
    <div className="rounded-xl bg-mint/70 px-4 py-3 text-center">
      <p className="font-display text-2xl font-bold text-primary leading-none">{value}</p>
      <p className="text-xs text-ink/70 mt-1">{label}</p>
    </div>
  );
}

/** Dashboard of real progress from GET /skill-gap/overview. Empty states when there is no data. */
function ProgressTab({ onOpenAnalysis, onStart }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getOverview());
    } catch (err) {
      setError(aiErrorMessage(err, 'Could not load your progress.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-32" /><Skeleton className="h-48" /></div>;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const { latestAnalysis: la, activeRoadmap: rm, totals, nextAction: next, skillsInProgress = [], recent = [] } = data || {};
  if (!la && !rm) {
    return (
      <EmptyState title="No progress to show yet" hint="Run a skill gap analysis and generate a roadmap. Your progress will appear here.">
        <button type="button" onClick={onStart} className={BTN_PRIMARY}>Start an analysis</button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {rm ? (
        <section className={CARD} aria-labelledby="sg-prog-h">
          <h2 id="sg-prog-h" className="font-display text-xl font-bold text-primary">Current roadmap</h2>
          <p className="text-sm text-ink mt-1 break-words">{rm.title}{rm.targetRole ? ` (${rm.targetRole})` : ''}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-ink/70 mb-1">
              <span>{totals?.percent ?? rm.progress?.percent ?? 0}% complete</span>
              <span>{totals?.completed ?? 0} of {totals?.tasks ?? 0} tasks</span>
            </div>
            <ProgressBar percent={totals?.percent ?? rm.progress?.percent} label="Overall roadmap progress" />
          </div>
          <div className="grid gap-3 grid-cols-3 mt-4">
            <Tile label="Completed" value={totals?.completed ?? 0} />
            <Tile label="In progress" value={totals?.inProgress ?? 0} />
            <Tile label="Remaining" value={(totals?.notStarted ?? 0) + (totals?.inProgress ?? 0)} />
          </div>
          <button type="button" onClick={() => onOpenAnalysis(rm.analysis)} className={`${BTN_GHOST} mt-4`}>Open roadmap</button>
        </section>
      ) : (
        <EmptyState title="No active roadmap" hint="Open an analysis and generate a roadmap to track your learning here." />
      )}

      {next && (
        <section className="rounded-2xl bg-forest text-leaf p-5" aria-labelledby="sg-next-h">
          <h2 id="sg-next-h" className="font-display text-lg font-bold text-leaf">Next recommended step</h2>
          <p className="text-sm mt-2">{next.title}</p>
          <p className="text-xs text-leaf-muted mt-1">{[next.skill, next.stage].filter(Boolean).join(' - ')}</p>
          <button type="button" onClick={() => onOpenAnalysis(next.analysisId)} className="focus-ring mt-3 inline-flex px-4 py-2 rounded-full bg-leaf text-forest text-sm font-semibold hover:opacity-90">Go to task</button>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={CARD} aria-labelledby="sg-sip-h">
          <h2 id="sg-sip-h" className="font-display text-lg font-bold text-primary">Skills in progress</h2>
          {skillsInProgress.length === 0 ? (
            <p className="text-sm text-ink/60 mt-2">No skills are in progress. Start a task to see it here.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {skillsInProgress.map((s) => (
                <li key={s.skillKey}>
                  <div className="flex justify-between text-sm text-ink"><span>{s.skill}</span><span className="text-ink/60">{s.percent}%</span></div>
                  <ProgressBar percent={s.percent} label={`${s.skill} progress`} className="mt-1" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={CARD} aria-labelledby="sg-rec-h">
          <h2 id="sg-rec-h" className="font-display text-lg font-bold text-primary">Recent progress</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-ink/60 mt-2">No task updates yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {recent.map((r) => (
                <li key={`${r.roadmapId}-${r.taskId}`} className="text-sm text-ink">
                  <span className="font-medium">{r.title}</span>
                  <span className="block text-xs text-ink/60">{statusLabel(r.status)} - {formatDateTime(r.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {la && (
        <section className={CARD} aria-labelledby="sg-latest-h">
          <h2 id="sg-latest-h" className="font-display text-lg font-bold text-primary">Latest analysis</h2>
          <p className="text-sm text-ink mt-1 break-words">{la.title}</p>
          <p className="text-xs text-ink/60 mt-0.5">{basisLabel(la.basis)} - skill-match score {la.score?.value ?? '--'} / 100</p>
          <button type="button" onClick={() => onOpenAnalysis(la._id)} className={`${BTN_GHOST} mt-3`}>Open</button>
        </section>
      )}
    </div>
  );
}

export default ProgressTab;
