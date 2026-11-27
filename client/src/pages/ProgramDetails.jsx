import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { ProgramVisual } from '../components/programs/ProgramCard';
import ProgressBar from '../components/programs/ProgressBar';
import { Skeleton, ErrorMessage, SuccessMessage, EmptyState } from '../components/Feedback';
import { ArrowLeft, ExternalIcon, ClockIcon, TagIcon, CheckIcon } from '../components/Icons';
import { ENROLLMENT_META, DANGER_OUTLINE, formatDate } from '../utils/dashboard';

function ProgramDetails() {
  const { id } = useParams();
  const [program, setProgram] = useState(null);
  const [enrollment, setEnrollment] = useState(null); // { status, startedAt, completedAt } | null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [pctInput, setPctInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await axiosClient.get(`/programs/${id}`);
      setProgram(res.data.program);
      const e = res.data.enrollment;
      setEnrollment(e ? (typeof e === 'string' ? { status: e } : e) : null);
      setPctInput(String(e?.progress ?? 0));
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) setNotFound(true);
      else setError(getErrorMessage(err, 'Could not load this program'));
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

  const save = async (body, okText) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await axiosClient.put(`/programs/${id}/enrollment`, body);
      const e = res.data.enrollment;
      setEnrollment(body.status === 'none' ? null : (e ? (typeof e === 'string' ? { status: e } : e) : { status: body.status }));
      setPctInput(String(e?.progress ?? 0));
      window.dispatchEvent(new Event('careernest:notifications-changed'));
      setFeedback({ type: 'success', text: okText });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not update your enrollment') });
    } finally {
      setSaving(false);
    }
  };

  const back = (
    <Link to="/programs" className="focus-ring inline-flex items-center gap-1.5 text-sm text-primary hover:underline rounded mb-4">
      <ArrowLeft size={16} /> Back to career programs
    </Link>
  );

  if (loading && !program) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{back}<Skeleton className="h-48 w-full" /><Skeleton className="h-40 w-full mt-4" /></div>;
  }
  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {back}
        <EmptyState title="Program not found" hint="It may have been removed.">
          <Link to="/programs" className="inline-block bg-primary text-white px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition">Browse programs</Link>
        </EmptyState>
      </div>
    );
  }
  if (error && !program) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">{back}<ErrorMessage message={error} onRetry={load} /></div>;
  if (!program) return null;

  const setStatus = (status, okText) => save({ status }, okText);
  const hasMilestones = program.milestones?.length > 0;
  const done = enrollment?.completedMilestones || [];
  const toggleMilestone = (order) => {
    const next = done.includes(order) ? done.filter((o) => o !== order) : [...done, order];
    save({ completedMilestones: next }, 'Progress updated.');
  };
  const savePct = () => {
    const n = Number(pctInput);
    if (pctInput.trim() === '' || !Number.isInteger(n) || n < 0 || n > 100) {
      setFeedback({ type: 'error', text: 'Enter a whole number between 0 and 100.' });
      return;
    }
    save({ progress: n }, n === 100 ? 'Nice work! Marked as completed.' : 'Progress updated.');
  };
  const status = enrollment?.status || null;
  const meta = status ? ENROLLMENT_META[status] : null;
  const btn = 'focus-ring rounded-xl px-5 py-2.5 text-sm font-medium transition disabled:opacity-50';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {back}
      <div className="space-y-3 mb-4">
        {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
        {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
      </div>

      <div className="bg-white rounded-2xl border border-sage/30 shadow-sm overflow-hidden">
        <ProgramVisual theme={program.theme} category={program.category} className="h-36 sm:h-44" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary leading-tight">{program.title}</h1>
              <p className="text-lg text-accent font-medium mt-1">{program.provider}</p>
            </div>
            {meta && <span className={`text-xs font-semibold px-3 py-1 rounded-full ${meta.cls}`}>{meta.label}</span>}
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-ink/80">
            <li className="inline-flex items-center gap-1.5"><TagIcon size={15} /> {program.category}</li>
            <li className="inline-flex items-center gap-1.5"><CheckIcon size={15} /> {program.level}</li>
            <li className="inline-flex items-center gap-1.5"><ClockIcon size={15} /> {program.duration}</li>
          </ul>

          {program.available === false && (
            <p role="status" className="mt-4 text-sm font-medium text-amber-800 bg-amber-100 dark:bg-amber-400/15 dark:text-amber-200 rounded-xl px-4 py-2.5">This program is no longer available. Your saved record is kept; you can remove it below.</p>
          )}
          <p className="mt-5 text-ink/85 leading-relaxed">{program.description}</p>
          {program.enrollmentInfo && (
            <section className="mt-6">
              <h2 className="font-display text-lg font-bold text-primary mb-2">How to enrol</h2>
              <p className="text-ink/85 leading-relaxed whitespace-pre-line">{program.enrollmentInfo}</p>
            </section>
          )}
          {program.resources?.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-lg font-bold text-primary mb-2">Resources</h2>
              <ul className="space-y-1">
                {program.resources.map((r) => (
                  <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary underline">{r.title} <ExternalIcon size={13} /></a></li>
                ))}
              </ul>
            </section>
          )}

          {program.skills?.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-lg font-bold text-primary mb-2">Skills you will build</h2>
              <div className="flex flex-wrap gap-2">
                {program.skills.map((s) => <span key={s} className="text-sm px-3 py-1 rounded-full bg-mint text-primary font-medium">{s}</span>)}
              </div>
            </section>
          )}

          <section className="mt-8 border-t border-sage/30 pt-6" aria-labelledby="enroll-heading">
            <h2 id="enroll-heading" className="font-display text-lg font-bold text-primary mb-3">Your progress</h2>
            {enrollment?.startedAt && <p className="text-sm text-ink/65 mb-3">Started {formatDate(enrollment.startedAt)}{enrollment.completedAt ? ` · Completed ${formatDate(enrollment.completedAt)}` : ''}</p>}
            {status && status !== 'saved' && (
              <div className="mb-4 max-w-md">
                <div className="flex justify-between text-sm text-ink/75 mb-1"><span>Progress</span><span>{enrollment.progress ?? 0}%</span></div>
                <ProgressBar value={enrollment.progress ?? 0} label="Program progress" />
              </div>
            )}
            {status && status !== 'saved' && hasMilestones && (
              <ul className="mb-4 space-y-2" aria-label="Milestones">
                {program.milestones.map((m) => (
                  <li key={m.order}>
                    <label className="inline-flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" checked={done.includes(m.order)} disabled={saving || program.available === false} onChange={() => toggleMilestone(m.order)} className="focus-ring h-4 w-4 accent-[var(--color-primary)]" />
                      {m.title}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {status === 'in-progress' && !hasMilestones && program.available !== false && (
              <div className="mb-4 flex flex-wrap items-end gap-2">
                <label className="text-sm text-ink/75">
                  <span className="block mb-1">Update progress (%)</span>
                  <input type="number" min="0" max="100" step="1" inputMode="numeric" value={pctInput} onChange={(e) => setPctInput(e.target.value)} className="focus-ring w-28 bg-white border border-sage/50 rounded-xl px-3 py-2 text-sm text-ink" />
                </label>
                <button type="button" disabled={saving} onClick={savePct} className={`${btn} border border-sage text-primary hover:bg-mint`}>Save progress</button>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {!status && program.available !== false && (
                <>
                  <button type="button" disabled={saving} onClick={() => setStatus('in-progress', 'Program started. Good luck!')} className={`${btn} bg-primary text-white hover:bg-primary-dark`}>Start program</button>
                  <button type="button" disabled={saving} onClick={() => setStatus('saved', 'Saved to your programs.')} className={`${btn} border border-sage text-primary hover:bg-mint`}>Save for later</button>
                </>
              )}
              {status === 'saved' && program.available !== false && (
                <button type="button" disabled={saving} onClick={() => setStatus('in-progress', 'Program started. Good luck!')} className={`${btn} bg-primary text-white hover:bg-primary-dark`}>Start program</button>
              )}
              {status === 'completed' && program.available !== false && (
                <button type="button" disabled={saving} onClick={() => setStatus('in-progress', 'Resumed. Keep going!')} className={`${btn} border border-sage text-primary hover:bg-mint`}>Resume program</button>
              )}
              {status === 'in-progress' && program.available !== false && (
                <button type="button" disabled={saving} onClick={() => setStatus('completed', 'Nice work! Marked as completed.')} className={`${btn} bg-primary text-white hover:bg-primary-dark`}>Mark as completed</button>
              )}
              {status && (
                <button type="button" disabled={saving} onClick={() => setStatus('none', 'Removed from your programs.')} className={`${btn} border ${DANGER_OUTLINE}`}>Remove</button>
              )}
              {program.url && (
                <a href={program.url} target="_blank" rel="noopener noreferrer" className={`${btn} inline-flex items-center gap-2 border border-primary text-primary hover:bg-mint`}>
                  Visit {program.provider} <ExternalIcon size={15} />
                </a>
              )}
            </div>
          </section>

          <p className="mt-6 text-xs text-ink/55">
            This program listing is curated demo content created for CareerNest. Check the provider&apos;s own site for current availability, pricing and curriculum.
            The provider link opens its public home page.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ProgramDetails;
