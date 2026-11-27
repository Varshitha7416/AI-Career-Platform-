import TaskCard from './TaskCard';
import ProgressBar from './ProgressBar';
import { LEVELS, hoursLabel } from './skillGapUtils';

/** Overall progress, per-skill progress (+ optional self-level) and the staged task list. */
function RoadmapView({ roadmap, savingTask, onSaveTask, onSaveLevel }) {
  const p = roadmap.progress || {};
  const stages = [...(roadmap.stages || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-mint/70 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-primary">Overall progress: {p.percent ?? 0}%</p>
          <p className="text-xs text-ink/70">
            {p.completed ?? 0} of {p.total ?? 0} tasks done
            {typeof roadmap.remainingEstimatedHours === 'number' ? ` - about ${hoursLabel(roadmap.remainingEstimatedHours)} left of ${hoursLabel(roadmap.totalEstimatedHours)}` : ''}
          </p>
        </div>
        <ProgressBar percent={p.percent} label="Overall roadmap progress" className="mt-2" />
        {roadmap.estimateNote && <p className="text-xs text-ink/70 mt-2">{roadmap.estimateNote}</p>}
        {roadmap.weeklyHours ? <p className="text-xs text-ink/70 mt-1">Planned pace: {roadmap.weeklyHours} hours per week.</p> : null}
      </div>

      {(roadmap.skills || []).length > 0 && (
        <section aria-label="Progress by skill">
          <h4 className="font-display text-base font-bold text-primary mb-2">Progress by skill</h4>
          <ul className="grid gap-2 sm:grid-cols-2">
            {roadmap.skills.map((s) => (
              <li key={s.skillKey} className="rounded-lg border border-sage/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink truncate">{s.skill}</span>
                  <span className="text-xs text-ink/60 shrink-0">{s.progress?.completed ?? 0}/{s.progress?.total ?? 0}</span>
                </div>
                <ProgressBar percent={s.progress?.percent} label={`${s.skill} progress`} className="mt-1.5" />
                <label htmlFor={`lvl-${s.skillKey}`} className="block text-xs text-ink/60 mt-2">Your own rating (optional)</label>
                <select
                  id={`lvl-${s.skillKey}`}
                  value={s.level || ''}
                  onChange={(e) => onSaveLevel(s.skillKey, e.target.value)}
                  className="mt-1 border border-sage/60 rounded-lg px-2 py-1 text-xs"
                >
                  <option value="">Not rated</option>
                  {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink/60 mt-2">Your rating is a personal note. It does not change your skill-match score.</p>
        </section>
      )}

      {stages.map((st) => (
        <section key={st.id} aria-label={st.title} className="rounded-2xl border border-sage/40 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-display text-base font-bold text-primary">
              <span className="text-ink/75 font-normal">Stage {st.order}.</span> {st.title}
            </h4>
            <span className="text-xs text-ink/60">{st.progress?.completed ?? 0}/{st.progress?.total ?? st.tasks.length} done</span>
          </div>
          {st.goal && <p className="text-sm text-ink/70 mt-1">{st.goal}</p>}
          <ProgressBar percent={st.progress?.percent} label={`${st.title} progress`} className="mt-2" />
          <ul className="mt-3 flex flex-col gap-3">
            {st.tasks.map((t) => (
              <TaskCard key={t.id} task={t} saving={savingTask === t.id} onSave={onSaveTask} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default RoadmapView;
