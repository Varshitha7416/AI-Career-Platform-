import { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';
import { ErrorMessage } from '../Feedback';
import ModalShell from './ModalShell';
import { INTERVIEW_MODES, INTERVIEW_TYPES, toLocalInput, fromLocalInput } from '../../utils/dashboard';

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
  const [applicationId, setApplicationId] = useState(application?._id || interview?.application?._id || '');
  const [scheduledAt, setScheduledAt] = useState(() => {
    // A past time is not a valid default: start from tomorrow instead.
    const future = interview && new Date(interview.scheduledAt).getTime() > Date.now();
    return toLocalInput(future ? interview.scheduledAt : undefined);
  });
  const [durationMinutes, setDurationMinutes] = useState(interview?.durationMinutes || 60);
  const [mode, setMode] = useState(interview?.mode || 'video');
  const [type, setType] = useState(interview?.type || 'technical');
  const [location, setLocation] = useState(interview?.location || '');
  const [notes, setNotes] = useState(interview?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!editing && !applicationId) return setError('Choose the application this interview is for.');
    if (!scheduledAt) return setError('Choose a date and time.');
    const iso = fromLocalInput(scheduledAt);
    if (Number.isNaN(new Date(iso).getTime())) return setError('That date and time is not valid.');
    if (new Date(iso).getTime() < Date.now() - 60 * 1000) return setError('Pick a date and time in the future.');
    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) return setError('Duration must be between 5 and 600 minutes.');

    const payload = { scheduledAt: iso, mode, type, durationMinutes: minutes, location: location.trim(), notes: notes.trim() };
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
