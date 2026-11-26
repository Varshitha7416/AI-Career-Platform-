import { useState } from 'react';
import useSkillGapRoadmap from '../../hooks/useSkillGapRoadmap';
import ConfirmDialog from '../coverletter/ConfirmDialog';
import { Skeleton, ErrorMessage } from '../Feedback';
import { SparkIcon } from '../Icons';
import RoadmapView from './RoadmapView';
import { BTN_PRIMARY, BTN_GHOST, CARD, FIELD } from './skillGapUtils';

/** Learning roadmap section of a result: generate, view, update progress, regenerate (with a progress-reset warning). */
function RoadmapPanel({ analysis }) {
  const rm = useSkillGapRoadmap(analysis._id);
  const [hours, setHours] = useState('');
  const [confirming, setConfirming] = useState(false);

  const gaps = (analysis.counts?.missing ?? analysis.score?.counts?.missing ?? 0) + (analysis.counts?.partial ?? analysis.score?.counts?.partial ?? 0);
  const weekly = hours !== '' && Number(hours) >= 1 && Number(hours) <= 60 ? Math.round(Number(hours)) : undefined;
  const hoursInvalid = hours !== '' && weekly === undefined;

  const onGenerate = (regenerate) => async () => {
    const ok = await rm.generate({ weeklyHours: weekly, regenerate });
    if (ok) setConfirming(false);
  };

  return (
    <section className={CARD} aria-labelledby="sg-roadmap-h">
      <h3 id="sg-roadmap-h" className="font-display text-xl font-bold text-primary">Your learning roadmap</h3>

      {rm.loading ? (
        <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-16" /><Skeleton className="h-28" /></div>
      ) : rm.loadError ? (
        <div className="mt-4"><ErrorMessage message={rm.loadError} onRetry={rm.reload} /></div>
      ) : !rm.roadmap ? (
        <div className="mt-2">
          {gaps === 0 ? (
            <p className="text-sm text-ink/70">There are no skill gaps to plan for, so no roadmap is needed for this analysis.</p>
          ) : (
            <>
              <p className="text-sm text-ink/70">
                Turn your {gaps} gap{gaps === 1 ? '' : 's'} into staged tasks with time estimates and real Career Programs where we have them.
                Estimates are rough guides, not promises.
              </p>
              <div className="mt-4 sm:max-w-xs">
                <label htmlFor="sg-weekly" className="block text-sm font-medium text-ink mb-1">
                  Study hours per week <span className="text-ink/65 font-normal">(optional)</span>
                </label>
                <input id="sg-weekly" type="number" min="1" max="60" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} className={FIELD} aria-invalid={hoursInvalid} />
                {hoursInvalid && <p className="text-xs text-red-600 mt-1">Enter a number from 1 to 60, or leave it empty.</p>}
              </div>
              <div className="mt-4">
                <button type="button" onClick={onGenerate(false)} disabled={rm.generating || hoursInvalid} className={BTN_PRIMARY}>
                  <SparkIcon size={16} />
                  {rm.generating ? 'Building your roadmap...' : 'Generate roadmap'}
                </button>
              </div>
              {rm.genError && <div className="mt-3"><ErrorMessage message={rm.genError} /></div>}
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {rm.actionError && <ErrorMessage message={rm.actionError} />}
          <RoadmapView roadmap={rm.roadmap} savingTask={rm.savingTask} onSaveTask={rm.saveTask} onSaveLevel={rm.saveLevel} />
          <div className="border-t border-sage/30 pt-4">
            <button type="button" onClick={() => setConfirming(true)} className={BTN_GHOST}>Regenerate roadmap</button>
            <p className="text-xs text-ink/60 mt-2">Regenerating builds a new plan and resets all task progress and notes.</p>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title="Regenerate this roadmap?"
          confirmLabel="Regenerate and reset progress"
          danger
          busy={rm.generating}
          onConfirm={onGenerate(true)}
          onCancel={() => !rm.generating && setConfirming(false)}
        >
          <p>This replaces the current plan with a new one. Your task statuses and notes for this roadmap will be reset and cannot be restored.</p>
          <div>
            <label htmlFor="sg-regen-hours" className="block text-sm font-medium text-ink mb-1">Study hours per week (optional)</label>
            <input id="sg-regen-hours" type="number" min="1" max="60" value={hours} onChange={(e) => setHours(e.target.value)} className={FIELD} />
          </div>
          {rm.genError && <ErrorMessage message={rm.genError} />}
        </ConfirmDialog>
      )}
    </section>
  );
}

export default RoadmapPanel;
