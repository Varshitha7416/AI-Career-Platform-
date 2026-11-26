import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';
import { Skeleton, ErrorMessage } from '../Feedback';
import { SparkIcon, CheckIcon } from '../Icons';
import TargetPicker from './TargetPicker';
import { BTN_PRIMARY, CARD, formatDate } from './skillGapUtils';

/** Resume-based flow: pick an existing resume (never auto-selected) and a target. Uploading lives in Resume AI / Profile. */
function ResumeMethod({ target, onTargetChange, jobsState, interests, busy, resumeId, onResumeChange, onSubmit }) {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await axiosClient.get('/resumes');
      const list = res.data.resumes || [];
      setResumes(list);
      // A resume chosen earlier (kept while switching methods) may have been deleted meanwhile: never submit a stale id.
      onResumeChange((cur) => (cur && !list.some((r) => r._id === cur) ? '' : cur));
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load your resumes.'));
    } finally {
      setLoading(false);
    }
  }, [onResumeChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  const selected = resumes.find((r) => r._id === resumeId);
  const roleChips = [...new Set([selected?.targetRole, ...interests].filter(Boolean))];

  const problems = [];
  if (!resumeId) problems.push('Select a resume.');
  if (target.kind === 'job' ? !target.jobId : target.role.trim().length < 2) problems.push(target.kind === 'job' ? 'Pick a job.' : 'Enter a target role (at least 2 characters).');
  if (target.kind === 'role' && target.experience !== '' && !(Number(target.experience) >= 0 && Number(target.experience) <= 60)) problems.push('Years of experience must be between 0 and 60.');

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    if (problems.length) { setShowErrors(true); return; }
    if (target.kind === 'job') return onSubmit({ resumeId, jobId: target.jobId });
    const body = { resumeId, targetRole: target.role.trim() };
    if (target.jd.trim()) body.jobDescription = target.jd.trim();
    if (target.experience !== '' && !Number.isNaN(Number(target.experience))) body.experience = Number(target.experience);
    return onSubmit(body);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <section className={CARD} aria-labelledby="sg-resume-h">
        <h3 id="sg-resume-h" className="font-display text-lg font-bold text-primary">1. Choose a resume</h3>
        {loading ? (
          <div className="mt-3 flex flex-col gap-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        ) : loadError ? (
          <div className="mt-3"><ErrorMessage message={loadError} onRetry={load} /></div>
        ) : resumes.length === 0 ? (
          <div className="mt-3 rounded-xl bg-mint/70 p-4 text-sm text-ink">
            <p className="font-medium">You have no resumes yet.</p>
            <p className="text-ink/70 mt-1">Upload one in Resume AI, then come back. Or use the manual method instead.</p>
            <Link to="/resume" className="focus-ring inline-block mt-3 text-primary underline font-medium">Go to Resume AI</Link>
          </div>
        ) : (
          <>
            <ul role="radiogroup" aria-label="Resumes" className="mt-3 grid gap-2 sm:grid-cols-2">
              {resumes.map((r) => {
                const on = r._id === resumeId;
                return (
                  <li key={r._id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => onResumeChange(r._id)}
                      className={`focus-ring w-full text-left rounded-xl border px-4 py-3 transition ${on ? 'border-primary bg-mint' : 'border-sage/50 hover:bg-mint/60'}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink truncate">{r.name || r.fileName || 'Resume'}</span>
                        {on && <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0"><CheckIcon size={14} /> Selected</span>}
                      </span>
                      <span className="block text-xs text-ink/60 mt-0.5">
                        {r.targetRole ? `Target role: ${r.targetRole}` : 'No target role set'}
                        {r.createdAt ? ` - uploaded ${formatDate(r.createdAt)}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!resumeId && <p className="text-xs text-ink/60 mt-2">Select the resume that fits the role you are aiming for.</p>}
            <p className="text-xs text-ink/60 mt-2">
              Need another one? Upload and manage resumes in <Link to="/resume" className="text-primary underline">Resume AI</Link> or your <Link to="/profile" className="text-primary underline">Profile</Link>.
            </p>
          </>
        )}
      </section>

      <section className={CARD} aria-labelledby="sg-target-h">
        <h3 id="sg-target-h" className="font-display text-lg font-bold text-primary mb-3">2. Choose a target</h3>
        <TargetPicker
          target={target}
          onChange={onTargetChange}
          jobs={jobsState.jobs}
          jobsLoading={jobsState.loading}
          jobsError={jobsState.error}
          interests={roleChips}
        />
      </section>

      <div>
        {showErrors && problems.length > 0 && (
          <ul role="alert" className="mb-3 list-disc pl-5 text-sm text-red-700 dark:text-red-300">
            {problems.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
        <button type="submit" disabled={busy} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
          <SparkIcon size={16} />
          {busy ? 'Analyzing... this can take up to a minute' : 'Analyze my skill gap'}
        </button>
      </div>
    </form>
  );
}

export default ResumeMethod;
