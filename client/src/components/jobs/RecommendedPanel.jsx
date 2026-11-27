import { useState } from 'react';
import { Link } from 'react-router-dom';
import JobCard from '../JobCard';
import { SparkIcon } from '../Icons';
import { Skeleton } from '../Feedback';

const RESUME_LABEL = { role: 'Role resume', 'default-fallback': 'Default resume (fallback)' };

// Short chips shown on each recommended card: which role matched and which resume/skills produced the match.
function MatchChips({ job, basisOf }) {
  const resumeSource = job.matchedResume?.source;
  const label = resumeSource ? RESUME_LABEL[resumeSource] : basisOf === 'profile-skills' ? 'Profile skills' : job.matchedRole ? 'Role title only' : null;
  if (!job.matchedRole && !label) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {job.matchedRole && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent text-white">Role: {job.matchedRole}</span>}
      {label && <span title={job.matchedResume?.name || ''} className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-sage text-primary">{label}</span>}
    </div>
  );
}

function basisText(group) {
  switch (group.basis) {
    case 'role-resume': return <>Matched using your <strong>{group.resume?.name}</strong> resume, assigned to {group.role}.</>;
    case 'default-resume': return <>No resume is assigned to {group.role}, so your default resume <strong>{group.resume?.name}</strong> is used as a fallback. <Link to="/profile#resumes" className="underline text-primary">Assign a resume to {group.role}</Link> for tighter matches.</>;
    case 'profile-skills': return <>No resume yet, so matches use the skills in your profile and the {group.role} job title. <Link to="/profile#resumes" className="underline text-primary">Upload a resume</Link> to improve them.</>;
    default: return <>Matched on the {group.role} job title only. <Link to="/profile#resumes" className="underline text-primary">Upload a resume</Link> or <Link to="/profile#skills" className="underline text-primary">add skills</Link> for better matches.</>;
  }
}

function RecommendedPanel({ reco, loading, savedIds, busyId, onToggleSave }) {
  const [tab, setTab] = useState('all');
  const groups = reco?.groups || [];
  const ctx = reco?.context;
  const active = groups.find((g) => g.roleKey === tab) || null;
  const current = active || null;
  const jobs = current ? current.jobs : reco?.jobs || [];
  const grid = 'grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4';

  return (
    <section className="mb-10" aria-labelledby="reco-heading">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
        <div>
          <h2 id="reco-heading" className="font-display text-2xl font-bold text-primary flex items-center gap-2"><SparkIcon className="text-accent" /> Recommended Jobs</h2>
          {reco && <p className="text-sm text-ink/65 mt-1 max-w-3xl">{reco.message}</p>}
        </div>
        {reco && <span className={`text-xs font-medium px-3 py-1 rounded-full ${reco.personalized ? 'bg-accent text-white' : 'bg-sage/40 text-primary'}`}>{reco.personalized ? 'Matched to your profile' : 'Latest jobs'}</span>}
      </div>

      {groups.length > 0 && (
        <div role="tablist" aria-label="Recommendations by career interest" className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {[{ roleKey: 'all', role: 'All recommended' }, ...groups].map((g) => (
            <button key={g.roleKey} role="tab" type="button" aria-selected={tab === g.roleKey} onClick={() => setTab(g.roleKey)} className={`focus-ring shrink-0 min-h-11 px-4 rounded-full text-sm font-medium border transition whitespace-nowrap ${tab === g.roleKey ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-sage/60 hover:bg-mint'}`}>
              {g.role}{g.isPrimary ? ' ★' : ''}
            </button>
          ))}
        </div>
      )}

      {current && <p className="text-sm text-ink/70 mb-3 rounded-lg bg-mint/60 px-3 py-2" data-testid="basis">{basisText(current)}</p>}
      {!current && ctx && ctx.interestCount === 0 && ctx.resumeCount > 0 && (
        <p className="text-sm text-ink/70 mb-3 rounded-lg bg-mint/60 px-3 py-2">These matches come from your resume text only. <Link to="/profile#interests" className="underline text-primary">Add career interests</Link> to get a tab of matches for each role.</p>
      )}
      {!current && ctx && ctx.interestCount > 0 && ctx.resumeCount === 0 && (
        <p className="text-sm text-ink/70 mb-3 rounded-lg bg-mint/60 px-3 py-2">You have career interests but no resume yet, so matching uses job titles{ctx.profileSkillCount ? ' and your profile skills' : ''}. <Link to="/profile#resumes" className="underline text-primary">Upload a resume</Link> for better matches.</p>
      )}
      {!current && ctx && ctx.interestCount > 1 && ctx.resumeCount > 0 && ctx.roleResumeCount < ctx.interestCount && (
        <p className="text-sm text-ink/70 mb-3 rounded-lg bg-mint/60 px-3 py-2">{ctx.roleResumeCount === 0 ? 'None of your roles has its own resume, so your default resume is used as a fallback.' : `${ctx.interestCount - ctx.roleResumeCount} of your ${ctx.interestCount} roles use your default resume as a fallback.`} <Link to="/profile#resumes" className="underline text-primary">Assign role resumes</Link></p>
      )}
      {!current && ctx && ctx.interestCount === 0 && ctx.resumeCount === 0 && !reco.personalized && (
        <p className="text-sm text-ink/70 mb-3">Add career interests in your <Link to="/profile#interests" className="underline text-primary">Profile</Link> or upload a resume in <Link to="/profile#resumes" className="underline text-primary">Resumes</Link> to get matched recommendations.</p>
      )}

      {loading ? (
        <div className={grid}><Skeleton className="h-52" /><Skeleton className="h-52" /><Skeleton className="h-52 hidden lg:block" /><Skeleton className="h-52 hidden xl:block" /><Skeleton className="h-52 hidden xl:block" /></div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-sage/30 p-6 text-center text-sm text-ink/70">
          {current ? <>No close matches for <strong>{current.role}</strong> right now. Try adding skills or a resume for this role.</> : 'No recommendations yet.'}
        </div>
      ) : (
        <div className={grid}>
          {jobs.map((job) => (
            <JobCard key={`${tab}-${job._id}`} job={job} saved={savedIds.has(job._id)} busy={busyId === job._id} onToggleSave={onToggleSave} showMatch={reco.personalized} extra={reco.personalized ? <MatchChips job={job} basisOf={current?.basis || groups.find((g) => g.role === job.matchedRole)?.basis} /> : null} />
          ))}
        </div>
      )}
    </section>
  );
}

export default RecommendedPanel;
