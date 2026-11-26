import { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import useAllJobs from '../../hooks/useAllJobs';
import { ErrorMessage, Skeleton } from '../Feedback';
import MethodChooser from './MethodChooser';
import ResumeMethod from './ResumeMethod';
import ManualMethod from './ManualMethod';
import { CARD } from './skillGapUtils';

/** Method chooser + the chosen form. initialJob (from ?job=) starts a resume-based analysis aimed at that job. */
function AnalyzeTab({ initialJob, busy, error, onSubmit }) {
  const [method, setMethod] = useState(initialJob ? 'resume' : '');
  const [target, setTarget] = useState({ kind: initialJob ? 'job' : 'role', jobId: initialJob || '', jobTitle: '', role: '', jd: '', experience: '' });
  // Form state lives here (not in the method forms) so switching between resume and manual does not erase what was typed.
  // Each form only reads and sends the fields that belong to its own workflow.
  const [resumeId, setResumeId] = useState('');
  const [skills, setSkills] = useState([]);
  const [details, setDetails] = useState({ education: '', domain: '', projects: '', goals: '' });
  const [interests, setInterests] = useState([]);
  const jobsState = useAllJobs();

  // Profile career interests are only offered as suggestions the user must click to confirm.
  useEffect(() => {
    let cancelled = false;
    axiosClient.get('/auth/me').then((res) => {
      const u = res.data.user || res.data;
      const list = (u.careerInterests || []).map((c) => c.role).filter(Boolean);
      if (!cancelled) setInterests(list.length ? list : [u.primaryRole, u.seekingRole].filter(Boolean));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const patchTarget = (patch) => setTarget((t) => ({ ...t, ...patch }));
  const common = { target, onTargetChange: patchTarget, jobsState, interests, busy };

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="sg-method-h">
        <h2 id="sg-method-h" className="font-display text-xl font-bold text-primary mb-3">How would you like to start?</h2>
        <MethodChooser value={method} onChange={setMethod} />
        <p className="text-xs text-ink/60 mt-2">You only need one method. You can run the other one later.</p>
      </section>

      {busy && (
        <div className={CARD} role="status" aria-live="polite">
          <p className="font-semibold text-ink">Analyzing your skill gap...</p>
          <p className="text-sm text-ink/60 mt-1">This can take up to a minute. Please keep this page open.</p>
          <Skeleton className="h-3 w-2/3 mt-3" />
        </div>
      )}
      {error && <ErrorMessage message={error} />}

      {method === 'resume' && (
        <ResumeMethod {...common} resumeId={resumeId} onResumeChange={setResumeId} onSubmit={(b) => onSubmit('resume', b)} />
      )}
      {method === 'manual' && (
        <ManualMethod {...common} skills={skills} onSkillsChange={setSkills} details={details} onDetailsChange={setDetails} onSubmit={(b) => onSubmit('manual', b)} />
      )}
    </div>
  );
}

export default AnalyzeTab;
