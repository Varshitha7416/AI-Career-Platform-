import { useState } from 'react';
import { ExternalIcon, ChevronDown } from '../Icons';
import { FIELD, PRIORITY_STYLE, STATUSES, hoursLabel, formatDate } from './skillGapUtils';

const NOTE_MAX = 1000;

function Detail({ label, children }) {
  if (!children) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink/65">{label}</dt>
      <dd className="text-sm text-ink/80 mt-0.5">{children}</dd>
    </div>
  );
}

/** One roadmap task: status controls, details, resource, notes. Reopening = moving a completed task back. */
function TaskCard({ task, saving, onSave }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(task.notes || '');
  const dirty = notes !== (task.notes || '');
  const done = task.status === 'completed';
  const res = task.resource;

  return (
    <li className={`rounded-xl border p-4 ${done ? 'border-accent/50 bg-mint/50' : 'border-sage/40'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm font-semibold text-ink ${done ? 'line-through decoration-ink/30' : ''}`}>{task.title}</p>
          <p className="text-xs text-ink/60 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{task.skill}</span>
            {task.estimatedHours ? <span>about {hoursLabel(task.estimatedHours)}</span> : null}
            {task.priority && <span className={`px-2 py-0.5 rounded-full font-semibold ${PRIORITY_STYLE[task.priority]}`}>{task.priority}</span>}
            {done && task.completedAt && <span>completed {formatDate(task.completedAt)}</span>}
          </p>
        </div>
        <div role="radiogroup" aria-label={`Status of ${task.title}`} className="inline-flex rounded-full border border-sage/60 overflow-hidden shrink-0">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={task.status === s.value}
              disabled={saving}
              onClick={() => task.status !== s.value && onSave(task.id, { status: s.value })}
              className={`focus-ring px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${task.status === s.value ? 'bg-primary text-white' : 'text-ink hover:bg-mint'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="focus-ring mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary rounded"
      >
        {open ? 'Hide details' : 'Show details, resource and notes'}
        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <dl className="flex flex-col gap-2.5">
            <Detail label="Objective">{task.objective}</Detail>
            <Detail label="Activity">{task.activity}</Detail>
            <Detail label="Practice exercise">{task.exercise}</Detail>
            <Detail label="You are done when">{task.completionCriteria}</Detail>
            {res && (
              <Detail label="Resource">
                {res.type === 'program' && res.url ? (
                  <a href={res.url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 text-primary underline">
                    {res.title}{res.provider ? ` (${res.provider})` : ''}{res.duration ? `, ${res.duration}` : ''}
                    <ExternalIcon size={13} />
                  </a>
                ) : (
                  <span>Practical activity: {res.title || task.activity}</span>
                )}
              </Detail>
            )}
          </dl>
          <div>
            <label htmlFor={`note-${task.id}`} className="block text-xs font-semibold uppercase tracking-wide text-ink/65 mb-1">Your notes</label>
            <textarea id={`note-${task.id}`} rows={2} maxLength={NOTE_MAX} value={notes} onChange={(e) => setNotes(e.target.value)} className={FIELD} placeholder="Add a note for yourself" />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-ink/65">{notes.length}/{NOTE_MAX}</span>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() => onSave(task.id, { notes })}
                className="focus-ring text-xs px-3 py-1.5 rounded-full border border-sage/60 text-primary hover:bg-mint disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export default TaskCard;
