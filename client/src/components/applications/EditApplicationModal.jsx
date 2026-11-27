import { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';
import { ErrorMessage } from '../Feedback';
import ModalShell from '../interviews/ModalShell';
import { toDateInput, fromDateInput, toDateTimeInput, fromDateTimeInput } from '../../utils/tracker';

const field = 'focus-ring w-full border border-sage/60 rounded-xl px-3 py-2 text-sm bg-white text-ink';
const todayInput = () => toDateInput(new Date().toISOString());

/** Edit the tracker details of an application (PUT /applications/:id). Validation mirrors the server. */
function EditApplicationModal({ application, onClose, onSaved }) {
  const a = application;
  const [appliedAt, setAppliedAt] = useState(toDateInput(a.appliedAt || a.createdAt));
  const [applyMethod, setApplyMethod] = useState(a.applyMethod || 'manual');
  const [externalUrl, setExternalUrl] = useState(a.externalUrl || '');
  const [notes, setNotes] = useState(a.notes || '');
  const [followUp, setFollowUp] = useState(toDateInput(a.followUpAt));
  const [actionText, setActionText] = useState(a.nextAction?.text || '');
  const [actionDue, setActionDue] = useState(toDateInput(a.nextAction?.dueAt));
  const [reminder, setReminder] = useState(toDateTimeInput(a.reminderAt));
  const [resumeId, setResumeId] = useState(a.resume && !a.resume.missing ? a.resume._id : '');
  const [coverLetterId, setCoverLetterId] = useState(a.coverLetter && !a.coverLetter.missing ? a.coverLetter._id : '');
  const [resumes, setResumes] = useState([]);
  const [letters, setLetters] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    axiosClient.get('/resumes').then((r) => alive && setResumes(r.data.resumes || [])).catch(() => {});
    axiosClient.get('/cover-letters').then((r) => alive && setLetters(r.data.coverLetters || [])).catch(() => {});
    return () => { alive = false; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!appliedAt) return setError('Choose the date you applied.');
    if (appliedAt > todayInput()) return setError('The applied date cannot be in the future.');
    if (externalUrl.trim() && !/^https?:\/\//i.test(externalUrl.trim())) return setError('The job link must start with http:// or https://');
    if (notes.length > 2000) return setError('Notes must be 2000 characters or fewer.');
    if (actionText.trim().length > 200) return setError('The next action must be 200 characters or fewer.');
    if (actionDue && !actionText.trim()) return setError('Describe the next action, or clear its due date.');
    const reminderIso = fromDateTimeInput(reminder);
    const unchanged = reminderIso && a.reminderAt && new Date(a.reminderAt).getTime() === new Date(reminderIso).getTime();
    if (reminderIso && !unchanged && new Date(reminderIso).getTime() < Date.now() - 60000) return setError('Pick a reminder time in the future.');

    const payload = {
      appliedAt: fromDateInput(appliedAt),
      applyMethod,
      externalUrl: externalUrl.trim() || null,
      notes: notes.trim() || null,
      followUpAt: fromDateInput(followUp),
      nextAction: actionText.trim() ? { text: actionText.trim(), dueAt: fromDateInput(actionDue) } : null,
      reminderAt: reminderIso,
      resumeId: resumeId || null,
      coverLetterId: coverLetterId || null,
    };
    // Do not move the applied time when only the calendar day is unchanged.
    if (toDateInput(a.appliedAt || a.createdAt) === appliedAt) delete payload.appliedAt;
    setSaving(true);
    try {
      await axiosClient.put(`/applications/${a._id}`, payload);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your changes'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Edit application details" onClose={onClose} wide>
      <form onSubmit={submit} className="mt-4 grid gap-4" noValidate>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-ink">
            Applied on
            <input type="date" max={todayInput()} value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} className={`${field} mt-1 font-normal`} />
          </label>
          <label className="text-sm font-medium text-ink">
            How you applied
            <select value={applyMethod} onChange={(e) => setApplyMethod(e.target.value)} className={`${field} mt-1 font-normal`}>
              <option value="external">Employer&apos;s site</option>
              <option value="manual">Recorded manually</option>
            </select>
          </label>
        </div>
        <label className="text-sm font-medium text-ink">
          Job posting link <span className="text-ink/50 font-normal">(optional, http or https)</span>
          <input type="url" maxLength={500} value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." className={`${field} mt-1 font-normal`} />
        </label>
        <label className="text-sm font-medium text-ink">
          Notes <span className="text-ink/50 font-normal">({notes.length}/2000)</span>
          <textarea rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Recruiter name, salary discussed, anything to remember" className={`${field} mt-1 font-normal`} />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-ink">
            Follow up on <span className="text-ink/50 font-normal">(optional)</span>
            <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className={`${field} mt-1 font-normal`} />
          </label>
          <label className="text-sm font-medium text-ink">
            Reminder <span className="text-ink/50 font-normal">(optional)</span>
            <input type="datetime-local" value={reminder} onChange={(e) => setReminder(e.target.value)} className={`${field} mt-1 font-normal`} />
          </label>
        </div>
        <div className="grid sm:grid-cols-[1fr_180px] gap-4">
          <label className="text-sm font-medium text-ink">
            Next action <span className="text-ink/50 font-normal">(optional)</span>
            <input type="text" maxLength={200} value={actionText} onChange={(e) => setActionText(e.target.value)} placeholder="e.g. Send a thank-you email" className={`${field} mt-1 font-normal`} />
          </label>
          <label className="text-sm font-medium text-ink">
            Due
            <input type="date" value={actionDue} onChange={(e) => setActionDue(e.target.value)} className={`${field} mt-1 font-normal`} />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-ink">
            Resume used
            <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className={`${field} mt-1 font-normal`}>
              <option value="">None selected</option>
              {resumes.map((r) => <option key={r._id} value={r._id}>{r.name || r.fileName}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            Cover letter used
            <select value={coverLetterId} onChange={(e) => setCoverLetterId(e.target.value)} className={`${field} mt-1 font-normal`}>
              <option value="">None selected</option>
              {letters.map((c) => <option key={c._id} value={c._id}>{c.job?.title || c.jobSnapshot?.title || 'Cover letter'}</option>)}
            </select>
          </label>
        </div>
        {error && <ErrorMessage message={error} />}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="focus-ring bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
          <button type="button" onClick={onClose} className="focus-ring border border-sage text-primary rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-mint transition">Cancel</button>
        </div>
      </form>
    </ModalShell>
  );
}

export default EditApplicationModal;
