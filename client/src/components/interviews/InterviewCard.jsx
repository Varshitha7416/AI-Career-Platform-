import { Link } from 'react-router-dom';
import CompanyLogo from '../CompanyLogo';
import { CalendarIcon, ClockIcon, PinIcon, ExternalIcon } from '../Icons';
import { formatDateTime as fmtDateTime } from '../../utils/dashboard';
import { INTERVIEW_MODES, INTERVIEW_TYPES, INTERVIEW_STATUS_META, DANGER_OUTLINE, DANGER_FILLED_STYLE, formatDate, formatTime, isLikelyUrl } from '../../utils/dashboard';

// Interview summary card. Action handlers are optional: pass only the ones that make sense for the context.
function InterviewCard({ interview, onEdit, onComplete, onCancel, onDelete, onChecklistToggle, confirmingDelete, busy, showApplicationLink = true }) {
  const status = INTERVIEW_STATUS_META[interview.status] || INTERVIEW_STATUS_META.scheduled;
  const isScheduled = interview.status === 'scheduled';
  const when = new Date(interview.scheduledAt);
  const btn = 'focus-ring text-sm rounded-lg px-3 py-1.5 border transition disabled:opacity-50';

  return (
    <article className="bg-white rounded-2xl border border-sage/30 shadow-sm p-5 flex flex-col sm:flex-row gap-4">
      <div className="shrink-0 w-full sm:w-20 sm:self-start rounded-xl bg-mint text-primary flex sm:flex-col items-center justify-center gap-2 sm:gap-0 py-2 sm:py-3" aria-label={`${formatDate(when)} at ${formatTime(when)}`}>
        <span className="text-xs uppercase tracking-wide font-semibold">{when.toLocaleDateString(undefined, { month: 'short' })}</span>
        <span className="font-display text-2xl font-bold leading-none">{when.getDate()}</span>
        <span className="text-xs">{when.toLocaleDateString(undefined, { weekday: 'short' })}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <CompanyLogo company={interview.company} size={40} />
            <div className="min-w-0">
              <h3 className="font-semibold text-ink leading-snug">
                {interview.job?._id ? (
                  <Link to={`/jobs/${interview.job._id}`} className="focus-ring hover:text-accent">{interview.job?.title}</Link>
                ) : interview.job?.title}
              </h3>
              <p className="text-sm text-ink/70">{interview.company?.name}</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${status.cls}`}>{status.label}</span>
        </div>

        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink/80">
          <li className="flex items-center gap-1.5"><CalendarIcon size={15} /> {formatDate(when, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</li>
          <li className="flex items-center gap-1.5"><ClockIcon size={15} /> {formatTime(when)}{interview.durationMinutes ? ` · ${interview.durationMinutes} min` : ''}</li>
          <li className="flex items-center gap-1.5"><PinIcon size={15} /> {INTERVIEW_MODES[interview.mode] || interview.mode} · {INTERVIEW_TYPES[interview.type] || interview.type}</li>
        </ul>

        {interview.location && (
          <p className="mt-2 text-sm text-ink/80 break-words">
            {isLikelyUrl(interview.location) ? (
              <a href={interview.location} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1.5 text-primary underline">
                Join link <ExternalIcon size={14} />
              </a>
            ) : interview.location}
          </p>
        )}
        {(interview.round || interview.roundLabel) && (
          <p className="mt-2 text-sm text-ink/80">{interview.round ? `Round ${interview.round}` : ''}{interview.round && interview.roundLabel ? ': ' : ''}{interview.roundLabel || ''}</p>
        )}
        {isScheduled && interview.remindAt && <p className="mt-1 text-xs text-ink/60">Reminder: {fmtDateTime(interview.remindAt)}</p>}
        {interview.prepNotes && <div className="mt-2 text-sm text-ink/70 bg-bg rounded-lg px-3 py-2"><p className="text-xs font-semibold text-primary mb-0.5">Preparation</p><p className="whitespace-pre-line">{interview.prepNotes}</p></div>}
        {interview.prepChecklist?.length > 0 && (
          <ul className="mt-2 space-y-1" aria-label="Preparation checklist">
            {interview.prepChecklist.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-ink/80">
                <input type="checkbox" checked={!!c.done} disabled={busy || !onChecklistToggle} onChange={() => onChecklistToggle(interview, i)} aria-label={c.text} />
                <span className={c.done ? 'line-through text-ink/50' : ''}>{c.text}</span>
              </li>
            ))}
          </ul>
        )}
        {interview.prepResources?.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {interview.prepResources.map((r, i) => (
              <li key={i}><a href={r.url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 text-primary underline">{r.title} <ExternalIcon size={13} /></a></li>
            ))}
          </ul>
        )}
        {interview.debrief && <div className="mt-2 text-sm text-ink/70 bg-bg rounded-lg px-3 py-2"><p className="text-xs font-semibold text-primary mb-0.5">Interview notes</p><p className="whitespace-pre-line">{interview.debrief}</p></div>}
        {interview.notes && <p className="mt-2 text-sm text-ink/70 bg-bg rounded-lg px-3 py-2 whitespace-pre-line">{interview.notes}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {showApplicationLink && interview.application?._id && (
            <Link to={`/applications/${interview.application._id}`} className={`${btn} border-sage text-primary hover:bg-mint`}>View application</Link>
          )}
          {interview.status === 'completed' && onEdit && <button type="button" disabled={busy} onClick={() => onEdit(interview)} className={`${btn} border-sage text-primary hover:bg-mint`}>Add notes</button>}
          {isScheduled && onEdit && <button type="button" disabled={busy} onClick={() => onEdit(interview)} className={`${btn} border-sage text-primary hover:bg-mint`}>Reschedule / edit</button>}
          {isScheduled && onComplete && <button type="button" disabled={busy} onClick={() => onComplete(interview)} className={`${btn} border-sage text-primary hover:bg-mint`}>Mark completed</button>}
          {isScheduled && onCancel && <button type="button" disabled={busy} onClick={() => onCancel(interview)} className={`${btn} ${DANGER_OUTLINE}`}>Cancel interview</button>}
          {interview.status === 'cancelled' && onEdit && <button type="button" disabled={busy} onClick={() => onEdit(interview)} className={`${btn} border-sage text-primary hover:bg-mint`}>Reschedule</button>}
          {onDelete && (
            confirmingDelete ? (
              <>
                <button type="button" disabled={busy} onClick={() => onDelete(interview, true)} style={DANGER_FILLED_STYLE} className={`${btn} hover:brightness-90`}>Confirm delete</button>
                <button type="button" onClick={() => onDelete(interview, false)} className={`${btn} border-sage text-primary hover:bg-mint`}>Keep</button>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={() => onDelete(interview)} className={`${btn} border-transparent text-ink/70 hover:text-red-700`}>Delete</button>
            )
          )}
        </div>
      </div>
    </article>
  );
}

export default InterviewCard;
