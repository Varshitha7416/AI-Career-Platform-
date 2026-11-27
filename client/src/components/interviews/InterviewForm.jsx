import { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';
import { ErrorMessage } from '../Feedback';
import ModalShell from './ModalShell';
import { INTERVIEW_MODES, INTERVIEW_TYPES, toLocalInput, fromLocalInput } from '../../utils/dashboard';
import { REMINDER_OFFSETS } from '../../utils/tracker';

const field = 'focus-ring w-full border border-sage/60 rounded-xl px-3 py-2 text-sm bg-white text-ink';

/**
 * Schedule (POST /interviews) or edit (PUT /interviews/:id) an interview.
 *  - applications: pass the user's applications to let them pick one (Interviews page)
 *  - application: fixed application (Application details page)
 *  - interview: edit mode
 */
function InterviewForm({ applications = null, application = null, interview = null, onClose, onSaved }) {
  const editing = Boolean(interview);
  const restoring = editing && interview.status === 'cancelled';
  const completed = editing && interview.status === 'completed'; // only notes/prep change; the (past) time stays as is
  const [applicationId, setApplicationId] = useState(application?._id || interview?.application?._id || '');
  const [scheduledAt, setScheduledAt] = useState(() => {
    // A past time is not a valid default: start from tomorrow instead.
    const future = interview && (completed || new Date(interview.scheduledAt).getTime() > Date.now());
    return toLocalInput(future ? interview.scheduledAt : undefined);
  });
  const [durationMinutes, setDurationMinutes] = useState(interview?.durationMinutes || 60);
  const [mode, setMode] = useState(interview?.mode || 'video');
  const [type, setType] = useState(interview?.type || 'technical');
  const [location, setLocation] = useState(interview?.location || '');
  const [notes, setNotes] = useState(interview?.notes || '');
  const [round, setRound] = useState(interview?.round || '');
  const [roundLabel, setRoundLabel] = useState(interview?.roundLabel || '');
  const [reminderOffset, setReminderOffset] = useState(interview?.reminderOffsetMinutes ? String(interview.reminderOffsetMinutes) : '');
  const [prepNotes, setPrepNotes] = useState(interview?.prepNotes || '');
  const [debrief, setDebrief] = useState(interview?.debrief || '');
  const [resources, setResources] = useState(interview?.prepResources || []);
  const [checklist, setChecklist] = useState(interview?.prepChecklist || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!editing && !applicationId) return setError('Choose the application this interview is for.');
    if (!scheduledAt) return setError('Choose a date and time.');
    const iso = fromLocalInput(scheduledAt);
    if (Number.isNaN(new Date(iso).getTime())) return setError('That date and time is not valid.');
    if (!completed && new Date(iso).getTime() < Date.now() - 60 * 1000) return setError('Pick a date and time in the future.');
    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) return setError('Duration must be between 5 and 600 minutes.');

    if (round !== '' && (!Number.isInteger(Number(round)) || Number(round) < 1 || Number(round) > 20)) return setError('Round must be a whole number from 1 to 20.');
    const cleanResources = resources.filter((r) => r.title.trim() || r.url.trim());
    for (const r of cleanResources) {
      if (!r.title.trim()) return setError('Give each preparation link a title.');
      if (!/^https?:\/\//i.test(r.url.trim())) return setError('Preparation links must start with http:// or https://');
    }
    const cleanChecklist = checklist.filter((c) => c.text.trim());
    // Reminder fields are only sent when the user changed them (an unchanged one follows the interview on the server).
    const reminderChanged = reminderOffset !== (interview?.reminderOffsetMinutes ? String(interview.reminderOffsetMinutes) : '');
    if (reminderOffset && reminderChanged && !completed) {
      const at = new Date(iso).getTime() - Number(reminderOffset) * 60000;
      if (at < Date.now() - 60000) return setError('That reminder time has already passed. Choose a shorter lead time.');
    }
    const payload = {
      scheduledAt: iso, mode, type, durationMinutes: minutes, location: location.trim(), notes: notes.trim(),
      round: round === '' ? null : Number(round), roundLabel: roundLabel.trim(), prepNotes: prepNotes.trim(), debrief: debrief.trim(),
      prepResources: cleanResources.map((r) => ({ title: r.title.trim(), url: r.url.trim() })),
      prepChecklist: cleanChecklist.map((c) => ({ text: c.text.trim(), done: !!c.done })),
      ...(reminderChanged ? { reminderOffsetMinutes: reminderOffset ? Number(reminderOffset) : null } : {}),
    };
    if (restoring) payload.status = 'scheduled'; // puts a cancelled interview back on the schedule
    setSaving(true);
    try {
      const res = editing
        ? await axiosClient.put(`/interviews/${interview._id}`, payload)
        : await axiosClient.post('/interviews', { applicationId, ...payload });
      onSaved(res.data.interview, editing);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the interview'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={restoring ? 'Reschedule interview' : editing ? 'Edit interview' : 'Schedule an interview'} onClose={onClose} wide>
      <form onSubmit={submit} className="mt-4 grid gap-4" noValidate>
        {!editing && !application && (
          <label className="text-sm font-medium text-ink">
            Application
            <select value={applicationId} onChange={(e) => setApplicationId(e.target.value)} className={`${field} mt-1 font-normal`}>
              <option value="">Select an application…</option>
              {(applications || []).map((a) => (
                <option key={a._id} value={a._id}>{a.job?.title} — {a.job?.company?.name}</option>
              ))}
            </select>
          </label>
        )}
        {restoring && (
          <p className="text-sm text-ink/80 bg-mint/60 rounded-xl px-3 py-2">This interview was cancelled. Pick a new date and time to put it back on your schedule.</p>
        )}
        {application && (
          <p className="text-sm text-ink/80 bg-mint/60 rounded-xl px-3 py-2">
            For <strong>{application.job?.title}</strong> at {application.job?.company?.name}
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-ink">
            Date and time
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={`${field} mt-1 font-normal`} />
          </label>
          <label className="text-sm font-medium text-ink">
            Duration (minutes)
            <input type="number" min="5" max="600" step="5" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className={`${field} mt-1 font-normal`} />
          </label>
          <label className="text-sm font-medium text-ink">
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={`${field} mt-1 font-normal`}>
              {Object.entries(INTERVIEW_MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            Interview type
            <select value={type} onChange={(e) => setType(e.target.value)} className={`${field} mt-1 font-normal`}>
              {Object.entries(INTERVIEW_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>

        <label className="text-sm font-medium text-ink">
          {mode === 'onsite' ? 'Address' : 'Meeting link or phone number'} <span className="text-ink/50 font-normal">(optional)</span>
          <input type="text" maxLength={300} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={mode === 'onsite' ? 'Office address' : 'https://meet.example.com/…'} className={`${field} mt-1 font-normal`} />
        </label>
        <label className="text-sm font-medium text-ink">
          Notes <span className="text-ink/50 font-normal">(optional)</span>
          <textarea rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Topics to prepare, interviewer names…" className={`${field} mt-1 font-normal`} />
        </label>

        <div className="grid sm:grid-cols-[110px_1fr_1fr] gap-4">
          <label className="text-sm font-medium text-ink">
            Round
            <input type="number" min="1" max="20" value={round} onChange={(e) => setRound(e.target.value)} placeholder="1" className={`${field} mt-1 font-normal`} />
          </label>
          <label className="text-sm font-medium text-ink">
            Round name <span className="text-ink/50 font-normal">(optional)</span>
            <input type="text" maxLength={80} value={roundLabel} onChange={(e) => setRoundLabel(e.target.value)} placeholder="e.g. System design" className={`${field} mt-1 font-normal`} />
          </label>
          <label className="text-sm font-medium text-ink">
            Remind me
            <select value={reminderOffset} onChange={(e) => setReminderOffset(e.target.value)} className={`${field} mt-1 font-normal`}>
              <option value="">No reminder</option>
              {REMINDER_OFFSETS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="border border-sage/40 rounded-xl p-4 grid gap-4">
          <legend className="text-sm font-semibold text-primary px-1">Preparation</legend>
          <label className="text-sm font-medium text-ink">
            Preparation notes <span className="text-ink/50 font-normal">({prepNotes.length}/4000)</span>
            <textarea rows={3} maxLength={4000} value={prepNotes} onChange={(e) => setPrepNotes(e.target.value)} placeholder="Topics to revise, questions to ask" className={`${field} mt-1 font-normal`} />
          </label>
          <div>
            <p className="text-sm font-medium text-ink mb-1">Checklist</p>
            {checklist.map((c, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={!!c.done} onChange={(e) => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} aria-label={`Done: ${c.text || 'item'}`} />
                <input type="text" maxLength={200} value={c.text} onChange={(e) => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="e.g. Re-read the job description" className={field} aria-label={`Checklist item ${i + 1}`} />
                <button type="button" onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))} className="focus-ring text-sm text-ink/70 px-2 py-1 rounded hover:bg-mint" aria-label="Remove checklist item">Remove</button>
              </div>
            ))}
            {checklist.length < 20 && <button type="button" onClick={() => setChecklist((l) => [...l, { text: '', done: false }])} className="focus-ring text-sm text-primary underline">Add a checklist item</button>}
          </div>
          <div>
            <p className="text-sm font-medium text-ink mb-1">Preparation links <span className="text-ink/50 font-normal">(your own references)</span></p>
            {resources.map((r, i) => (
              <div key={i} className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-2 mb-2">
                <input type="text" maxLength={120} value={r.title} onChange={(e) => setResources((l) => l.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Title" className={field} aria-label={`Link title ${i + 1}`} />
                <input type="url" maxLength={500} value={r.url} onChange={(e) => setResources((l) => l.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://..." className={field} aria-label={`Link address ${i + 1}`} />
                <button type="button" onClick={() => setResources((l) => l.filter((_, j) => j !== i))} className="focus-ring text-sm text-ink/70 px-2 py-1 rounded hover:bg-mint" aria-label="Remove link">Remove</button>
              </div>
            ))}
            {resources.length < 10 && <button type="button" onClick={() => setResources((l) => [...l, { title: '', url: '' }])} className="focus-ring text-sm text-primary underline">Add a link</button>}
          </div>
        </fieldset>

        <label className="text-sm font-medium text-ink">
          Notes during or after the interview <span className="text-ink/50 font-normal">({debrief.length}/4000)</span>
          <textarea rows={3} maxLength={4000} value={debrief} onChange={(e) => setDebrief(e.target.value)} placeholder="What was asked, how it went, follow-ups" className={`${field} mt-1 font-normal`} />
        </label>

        {error && <ErrorMessage message={error} />}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="focus-ring bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
            {saving ? 'Saving…' : restoring ? 'Reschedule interview' : editing ? 'Save changes' : 'Schedule interview'}
          </button>
          <button type="button" onClick={onClose} className="focus-ring border border-sage text-primary rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-mint transition">Cancel</button>
        </div>
      </form>
    </ModalShell>
  );
}

export default InterviewForm;
