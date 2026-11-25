import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { ProgramVisual } from '../components/programs/ProgramCard';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await axiosClient.get(`/programs/${id}`);
      setProgram(res.data.program);
      const e = res.data.enrollment;
      setEnrollment(e ? (typeof e === 'string' ? { status: e } : e) : null);
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

  const setStatus = async (status, okText) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await axiosClient.put(`/programs/${id}/enrollment`, { status });
      const e = res.data.enrollment;
      setEnrollment(status === 'none' ? null : (e ? (typeof e === 'string' ? { status: e } : e) : { status }));
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

          <p className="mt-5 text-ink/85 leading-relaxed">{program.description}</p>

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
            <div className="flex flex-wrap gap-3">
              {!status && (
                <>
                  <button type="button" disabled={saving} onClick={() => setStatus('in-progress', 'Program started. Good luck!')} className={`${btn} bg-primary text-white hover:bg-primary-dark`}>Start program</button>
                  <button type="button" disabled={saving} onClick={() => setStatus('saved', 'Saved to your programs.')} className={`${btn} border border-sage text-primary hover:bg-mint`}>Save for later</button>
                </>
              )}
              {status === 'saved' && (
                <button type="button" disabled={saving} onClick={() => setStatus('in-progress', 'Program started. Good luck!')} className={`${btn} bg-primary text-white hover:bg-primary-dark`}>Start program</button>
              )}
              {status === 'in-progress' && (
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
