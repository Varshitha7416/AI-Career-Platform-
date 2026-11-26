import JobSelect from './JobSelect';
import RoleInput from './RoleInput';
import { FIELD } from './skillGapUtils';

const JD_MAX = 8000;

/**
 * Choose what to compare against: a CareerNest job, or a custom role (role only, or with a pasted job description).
 * target = { kind: 'job'|'role', jobId, jobTitle, role, jd, experience }.
 */
function TargetPicker({ target, onChange, jobs, jobsLoading, jobsError, showExperience = true, interests = [] }) {
  const kinds = [
    { id: 'job', label: 'A CareerNest job', sub: 'Use the skills listed on a real job post.' },
    { id: 'role', label: 'A custom role', sub: 'Type a role, optionally paste a job description.' },
  ];

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-ink mb-2">What are you aiming for?</legend>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Target type">
        {kinds.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={target.kind === k.id}
            onClick={() => onChange({ kind: k.id })}
            className={`focus-ring text-left rounded-xl border px-4 py-3 transition ${target.kind === k.id ? 'border-primary bg-mint' : 'border-sage/50 hover:bg-mint/60'}`}
          >
            <span className="block text-sm font-semibold text-ink">{k.label}</span>
            <span className="block text-xs text-ink/60 mt-0.5">{k.sub}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {target.kind === 'job' ? (
          <JobSelect
            jobs={jobs}
            loading={jobsLoading}
            error={jobsError}
            value={target.jobId}
            onChange={(job) => onChange({ jobId: job?._id || '', jobTitle: job?.title || '' })}
          />
        ) : (
          <>
            <RoleInput id="sg-role" label="Target role" value={target.role} onChange={(role) => onChange({ role })} interests={interests} />
            <div>
              <label htmlFor="sg-jd" className="block text-sm font-medium text-ink mb-1">
                Job description <span className="text-ink/65 font-normal">(optional)</span>
              </label>
              <textarea
                id="sg-jd"
                rows={5}
                maxLength={JD_MAX}
                value={target.jd}
                onChange={(e) => onChange({ jd: e.target.value })}
                placeholder="Paste a job description to compare against it"
                className={FIELD}
              />
              <p className="text-xs text-ink/60 mt-1">
                {target.jd.trim()
                  ? 'Job-description based: the required skills are read from the text you pasted.'
                  : 'Role only: without a description, typical skills for this role are suggested by AI. They are not from a real posting.'}
                <span className="float-right">{target.jd.length}/{JD_MAX}</span>
              </p>
            </div>
            {showExperience && (
              <div className="sm:max-w-xs">
                <label htmlFor="sg-exp" className="block text-sm font-medium text-ink mb-1">
                  Years of experience <span className="text-ink/65 font-normal">(optional)</span>
                </label>
                <input
                  id="sg-exp"
                  type="number"
                  min="0"
                  max="60"
                  step="0.5"
                  inputMode="decimal"
                  value={target.experience}
                  onChange={(e) => onChange({ experience: e.target.value })}
                  className={FIELD}
                />
              </div>
            )}
          </>
        )}
      </div>
    </fieldset>
  );
}

export default TargetPicker;
