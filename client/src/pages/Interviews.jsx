import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import InterviewCard from '../components/interviews/InterviewCard';
import InterviewForm from '../components/interviews/InterviewForm';
import CancelInterviewDialog from '../components/interviews/CancelInterviewDialog';
import { Skeleton, ErrorMessage, SuccessMessage, EmptyState } from '../components/Feedback';
import { fetchApplications } from '../utils/dashboard';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

function Interviews() {
  const [tab, setTab] = useState('upcoming');
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null); // null | { interview? }
  const [applications, setApplications] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/interviews', { params: { filter: tab } });
      setInterviews(res.data.interviews || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your interviews'));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch when the tab changes
    load();
  }, [load]);

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  // The "Schedule" picker needs the user's applications.
  const openSchedule = async () => {
    setFormLoading(true);
    setFeedback(null);
    try {
      const list = (await fetchApplications()).filter((a) => a?.job);
      setApplications(list);
      setForm({});
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not load your applications') });
    } finally {
      setFormLoading(false);
    }
  };

  const patch = async (interview, body, okText) => {
    setBusy(true);
    try {
      await axiosClient.put(`/interviews/${interview._id}`, body);
      setFeedback({ type: 'success', text: okText });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not update the interview') });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (interview, confirmed) => {
    if (confirmed === undefined) return setConfirmDeleteId(interview._id);
    if (!confirmed) return setConfirmDeleteId(null);
    setBusy(true);
    try {
      await axiosClient.delete(`/interviews/${interview._id}`);
      setConfirmDeleteId(null);
      setFeedback({ type: 'success', text: 'Interview deleted.' });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not delete the interview') });
    } finally {
      setBusy(false);
    }
  };

  const onSaved = async (_i, editing) => {
    setForm(null);
    setFeedback({ type: 'success', text: editing ? 'Interview updated.' : 'Interview scheduled.' });
    await load();
  };

  const noApplications = applications && applications.length === 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">Interviews</h1>
          <p className="text-ink/70 mt-1">Track the interviews you have lined up for your applications.</p>
        </div>
        <button type="button" onClick={openSchedule} disabled={formLoading} className="focus-ring bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
          {formLoading ? 'Loading…' : 'Schedule interview'}
        </button>
      </header>

      <div className="space-y-3 mb-4">
        {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
        {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
        {error && <ErrorMessage message={error} onRetry={load} />}
      </div>

      <div role="tablist" aria-label="Interview filter" className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`focus-ring text-sm px-4 py-1.5 rounded-full border transition ${tab === t.key ? 'bg-primary text-white border-primary' : 'bg-white border-sage/60 text-primary hover:bg-mint'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4" aria-label="Loading interviews"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : !error && interviews.length === 0 ? (
        <EmptyState
          title={tab === 'upcoming' ? 'No upcoming interviews' : 'No past interviews'}
          hint={tab === 'upcoming' ? 'When an interview is confirmed, schedule it here so you never miss it.' : 'Completed, cancelled and earlier interviews will appear here.'}
        >
          {tab === 'upcoming' && <Link to="/applications" className="text-primary underline text-sm">Go to my applications</Link>}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {interviews.map((i) => (
            <InterviewCard
              key={i._id}
              interview={i}
              busy={busy}
              confirmingDelete={confirmDeleteId === i._id}
              onEdit={(iv) => { setApplications(null); setForm({ interview: iv }); }}
              onComplete={(iv) => patch(iv, { status: 'completed' }, 'Interview marked as completed.')}
              onCancel={(iv) => setCancelTarget(iv)}
              onDelete={remove}
            />
          ))}
        </div>
      )}

      {cancelTarget && (
        <CancelInterviewDialog
          interview={cancelTarget}
          busy={busy}
          onClose={() => setCancelTarget(null)}
          onConfirm={async () => { await patch(cancelTarget, { status: 'cancelled' }, 'Interview cancelled. You can restore it from Past with Reschedule.'); setCancelTarget(null); }}
        />
      )}

      {form && noApplications && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/50" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
          <div role="dialog" aria-modal="true" aria-label="No applications" className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="font-display text-xl font-bold text-primary">Add an application first</h2>
            <p className="text-sm text-ink/75 mt-2">Interviews belong to an application. You have not recorded any applications yet.</p>
            <div className="flex gap-3 mt-5">
              <Link to="/jobs" className="bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-dark transition">Explore Job Discovery</Link>
              <button onClick={() => setForm(null)} className="border border-sage text-primary rounded-xl px-5 py-2.5 text-sm hover:bg-mint transition">Close</button>
            </div>
          </div>
        </div>
      )}
      {form && !noApplications && (
        <InterviewForm applications={applications} interview={form.interview} onClose={() => setForm(null)} onSaved={onSaved} />
      )}
    </div>
  );
}

export default Interviews;
