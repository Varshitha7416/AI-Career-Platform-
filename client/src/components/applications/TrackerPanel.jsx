import { Link } from 'react-router-dom';
import TrackerFlags from './TrackerFlags';
import { ExternalIcon } from '../Icons';
import { formatDate, formatDateTime } from '../../utils/dashboard';

// Read-only summary of an application's tracker details with an Edit button.
function TrackerPanel({ application: a, onEdit }) {
  const empty = !a.notes && !a.followUpAt && !a.nextAction && !a.reminderAt && !a.externalUrl && !a.resume && !a.coverLetter;
  const row = (label, value) => (
    <div className="flex justify-between gap-3"><dt className="text-ink/60 shrink-0">{label}</dt><dd className="font-medium text-right break-words min-w-0">{value}</dd></div>
  );
  return (
    <section className="bg-white rounded-2xl border border-sage/30 shadow-sm p-6" aria-labelledby="tracker-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 id="tracker-heading" className="font-display text-xl font-bold text-primary">Tracker notes</h2>
        <button type="button" onClick={onEdit} className="focus-ring border border-sage text-primary rounded-xl px-4 py-1.5 text-sm font-medium hover:bg-mint transition">Edit details</button>
      </div>
      <div className="mb-3"><TrackerFlags application={a} /></div>
      {empty ? (
        <p className="text-sm text-ink/65 bg-bg rounded-xl px-4 py-5 text-center">
          Nothing added yet. Use Edit details to add notes, a follow-up date, a next action, a reminder, or the resume and cover letter you used.
        </p>
      ) : (
        <>
          {a.notes && <p className="text-sm text-ink/80 bg-bg rounded-lg px-3 py-2 whitespace-pre-line mb-3">{a.notes}</p>}
          <dl className="text-sm space-y-2">
            {a.followUpAt && row('Follow up', formatDate(a.followUpAt))}
            {a.nextAction && row('Next action', <>{a.nextAction.text}{a.nextAction.dueAt ? ` (due ${formatDate(a.nextAction.dueAt)})` : ''}</>)}
            {a.reminderAt && row('Reminder', <>{formatDateTime(a.reminderAt)}{a.reminderNotifiedAt ? ' (sent)' : ''}</>)}
            {a.externalUrl && row('Job posting', (
              <a href={a.externalUrl} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 text-primary underline">Open link <ExternalIcon size={13} /></a>
            ))}
            {a.resume && row('Resume', a.resume.missing ? <span className="text-ink/60">Deleted since</span> : <Link to="/resume" className="focus-ring text-primary underline">{a.resume.name}</Link>)}
            {a.coverLetter && row('Cover letter', a.coverLetter.missing ? <span className="text-ink/60">Deleted since</span> : <Link to="/cover-letter" className="focus-ring text-primary underline">{a.coverLetter.title}</Link>)}
          </dl>
        </>
      )}
    </section>
  );
}

export default TrackerPanel;
