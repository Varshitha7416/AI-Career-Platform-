import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import CompanyLogo from '../components/CompanyLogo';
import StatusPill from '../components/applications/StatusPill';
import StatusTimeline from '../components/applications/StatusTimeline';
import InterviewCard from '../components/interviews/InterviewCard';
import InterviewForm from '../components/interviews/InterviewForm';
import CancelInterviewDialog from '../components/interviews/CancelInterviewDialog';
import { Skeleton, ErrorMessage, SuccessMessage, EmptyState } from '../components/Feedback';
import { ArrowLeft, ExternalIcon } from '../components/Icons';
import { STATUS_OPTIONS, STATUS_META, formatDate, formatDateTime } from '../utils/dashboard';
import { formatLocation, formatExperience } from '../utils/jobs';

function ApplicationDetails() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState(null); // null | { interview? }
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await axiosClient.get(`/applications/item/${id}`);
      setApp(res.data.application);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) setNotFound(true);
      else setError(getErrorMessage(err, 'Could not load this application'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on route change
    load();
  }, [load]);

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const changeStatus = async (status) => {
    if (status === app.status) return;
    setBusy(true);
    try {
      await axiosClient.put(`/applications/${app._id}`, { status });
      setFeedback({ type: 'success', text: `Status updated to ${STATUS_META[status].label}.` });
      await load(); // refresh so the history timeline includes the new entry
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not update the status') });
    } finally {
      setBusy(false);
    }
  };

  const interviewAction = async (interview, patch, okText) => {
    setBusy(true);
    try {
      await axiosClient.put(`/interviews/${interview._id}`, patch);
      setFeedback({ type: 'success', text: okText });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not update the interview') });
    } finally {
      setBusy(false);
    }
  };

  const deleteInterview = async (interview, confirmed) => {
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

  const onSaved = async (_interview, editing) => {
    setForm(null);
    setFeedback({ type: 'success', text: editing ? 'Interview updated.' : 'Interview scheduled.' });
    await load();
  };

  const back = (
    <Link to="/applications" className="focus-ring inline-flex items-center gap-1.5 text-sm text-primary hover:underline rounded mb-4">
      <ArrowLeft size={16} /> Back to applications
    </Link>
  );

  if (loading && !app) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {back}
        <Skeleton className="h-36 w-full" />
        <div className="grid md:grid-cols-2 gap-4 mt-4"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {back}
        <EmptyState title="Application not found" hint="It may have been removed, or it does not belong to your account.">
          <Link to="/applications" className="inline-block bg-primary text-white px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition">View my applications</Link>
        </EmptyState>
      </div>
    );
  }
  if (error && !app) {
    return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">{back}<ErrorMessage message={error} onRetry={load} /></div>;
  }
  if (!app) return null;

  const job = app.job || {};
  const interviews = [...(app.interviews || [])].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const interviewShape = (i) => ({ ...i, company: job.company, job: { _id: job._id, title: job.title }, application: { _id: app._id, status: app.status } });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {back}

      <div className="space-y-3 mb-4">
        {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
        {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
        {error && <ErrorMessage message={error} onRetry={load} />}
      </div>

      <section className="bg-white rounded-2xl border border-sage/30 shadow-sm p-6 flex flex-col md:flex-row md:items-start gap-5 justify-between">
        <div className="flex gap-4 min-w-0">
          <CompanyLogo company={job.company} size={60} />
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary leading-tight">{job.title}</h1>
            <p className="text-lg text-ink/80">{job.company?.name}</p>
            <p className="text-sm text-ink/60 mt-1">{formatLocation(job)} · {formatExperience(job)}</p>
            <Link to={`/jobs/${job._id}`} className="focus-ring inline-flex items-center gap-1.5 text-sm text-primary underline mt-2">
              View the job <ExternalIcon size={14} />
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
          <StatusPill status={app.status} />
          <label className="text-xs text-ink/60" htmlFor="app-status">Update status</label>
          <select
            id="app-status"
            value={app.status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value)}
            className="focus-ring border border-sage/60 rounded-lg px-3 py-1.5 text-sm bg-white text-ink disabled:opacity-50"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
      </section>

      <div className="grid md:grid-cols-[1fr_320px] gap-5 mt-5">
        <section className="bg-white rounded-2xl border border-sage/30 shadow-sm p-6" aria-labelledby="interviews-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 id="interviews-heading" className="font-display text-xl font-bold text-primary">Interviews</h2>
            <button type="button" onClick={() => setForm({})} className="focus-ring bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary-dark transition">
              Schedule interview
            </button>
          </div>
          {interviews.length === 0 ? (
            <p className="text-sm text-ink/65 bg-bg rounded-xl px-4 py-6 text-center">
              No interviews scheduled for this application yet. When one is confirmed, add it here so it shows on your Dashboard and Interviews page.
            </p>
          ) : (
            <div className="space-y-4">
              {interviews.map((i) => (
                <InterviewCard
                  key={i._id}
                  interview={interviewShape(i)}
                  showApplicationLink={false}
                  busy={busy}
                  confirmingDelete={confirmDeleteId === i._id}
                  onEdit={(iv) => setForm({ interview: iv })}
                  onComplete={(iv) => interviewAction(iv, { status: 'completed' }, 'Interview marked as completed.')}
                  onCancel={(iv) => setCancelTarget(iv)}
                  onDelete={deleteInterview}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="bg-white rounded-2xl border border-sage/30 shadow-sm p-6">
            <h2 className="font-display text-lg font-bold text-primary mb-3">Details</h2>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-3"><dt className="text-ink/60">Applied</dt><dd className="font-medium text-right">{formatDate(app.appliedAt || app.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/60">Method</dt><dd className="font-medium text-right">{app.applyMethod === 'external' ? "Employer's site" : 'Recorded manually'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/60">Last update</dt><dd className="font-medium text-right">{formatDateTime(app.updatedAt)}</dd></div>
            </dl>
          </section>
          <section className="bg-white rounded-2xl border border-sage/30 shadow-sm p-6">
            <h2 className="font-display text-lg font-bold text-primary mb-4">Status history</h2>
            <StatusTimeline history={app.statusHistory || []} fallbackAt={app.appliedAt || app.createdAt} />
          </section>
        </aside>
      </div>

      {cancelTarget && (
        <CancelInterviewDialog
          interview={cancelTarget}
          busy={busy}
          onClose={() => setCancelTarget(null)}
          onConfirm={async () => { await interviewAction(cancelTarget, { status: 'cancelled' }, 'Interview cancelled. You can restore it with Reschedule.'); setCancelTarget(null); }}
        />
      )}

      {form && (
        <InterviewForm
          application={{ _id: app._id, job }}
          interview={form.interview}
          onClose={() => setForm(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

export default ApplicationDetails;
