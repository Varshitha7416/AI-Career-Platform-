import { useState } from 'react';
import TargetPicker from './TargetPicker';
import SkillSelector from './SkillSelector';
import { SparkIcon } from '../Icons';
import { BTN_PRIMARY, CARD, FIELD } from './skillGapUtils';

/** Manual flow: target + self-reported skills (+ optional details). Nothing here is verified. */
function ManualMethod({ target, onTargetChange, jobsState, interests, busy, skills, onSkillsChange, details, onDetailsChange, onSubmit }) {
  const [showErrors, setShowErrors] = useState(false);
  const set = (k) => (e) => onDetailsChange((d) => ({ ...d, [k]: e.target.value }));

  const problems = [];
  if (target.kind === 'job' ? !target.jobId : target.role.trim().length < 2) problems.push(target.kind === 'job' ? 'Pick a job.' : 'Enter a target role (at least 2 characters).');
  if (skills.length === 0) problems.push('Add at least one skill.');
  if (target.experience !== '' && !(Number(target.experience) >= 0 && Number(target.experience) <= 60)) problems.push('Years of experience must be between 0 and 60.');

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    if (problems.length) { setShowErrors(true); return; }
    const body = {
      targetRole: target.kind === 'job' ? (jobsState.jobs.find((j) => j._id === target.jobId)?.title || target.jobTitle || 'Target job') : target.role.trim(),
      skills: skills.map((s) => ({ name: s.name, ...(s.level ? { level: s.level } : {}) })),
    };
    if (target.kind === 'job') body.jobId = target.jobId;
    else if (target.jd.trim()) body.jobDescription = target.jd.trim();
    if (target.experience !== '') body.experienceYears = Number(target.experience);
    ['education', 'domain', 'projects', 'goals'].forEach((k) => { if (details[k].trim()) body[k] = details[k].trim(); });
    onSubmit(body);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <section className={CARD} aria-labelledby="sg-m-target">
        <h3 id="sg-m-target" className="font-display text-lg font-bold text-primary mb-3">1. Choose a target</h3>
        <TargetPicker
          target={target}
          onChange={onTargetChange}
          jobs={jobsState.jobs}
          jobsLoading={jobsState.loading}
          jobsError={jobsState.error}
          showExperience={false}
          interests={interests}
        />
      </section>

      <section className={CARD} aria-labelledby="sg-m-skills">
        <h3 id="sg-m-skills" className="font-display text-lg font-bold text-primary mb-3">2. Your skills</h3>
        <SkillSelector skills={skills} onChange={onSkillsChange} />
      </section>

      <section className={CARD} aria-labelledby="sg-m-more">
        <h3 id="sg-m-more" className="font-display text-lg font-bold text-primary">3. More about you <span className="text-sm font-normal text-ink/60">(optional)</span></h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sg-m-exp" className="block text-sm font-medium text-ink mb-1">Years of experience</label>
            <input id="sg-m-exp" type="number" min="0" max="60" step="0.5" inputMode="decimal" value={target.experience} onChange={(e) => onTargetChange({ experience: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label htmlFor="sg-m-edu" className="block text-sm font-medium text-ink mb-1">Education</label>
            <input id="sg-m-edu" type="text" maxLength={120} value={details.education} onChange={set('education')} className={FIELD} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="sg-m-dom" className="block text-sm font-medium text-ink mb-1">Industry or domain</label>
            <input id="sg-m-dom" type="text" maxLength={120} value={details.domain} onChange={set('domain')} className={FIELD} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="sg-m-proj" className="block text-sm font-medium text-ink mb-1">Projects</label>
            <textarea id="sg-m-proj" rows={3} maxLength={2000} value={details.projects} onChange={set('projects')} className={FIELD} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="sg-m-goals" className="block text-sm font-medium text-ink mb-1">Career goals</label>
            <textarea id="sg-m-goals" rows={2} maxLength={1000} value={details.goals} onChange={set('goals')} className={FIELD} />
          </div>
        </div>
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

export default ManualMethod;
