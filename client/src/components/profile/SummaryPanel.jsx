import { BriefcaseIcon, SparkIcon, FileTextIcon, TagIcon, CheckIcon } from '../Icons';

const SECTION_FOR = { name: 'account', seekingRole: 'interests', experienceYears: 'experience', preferredLocation: 'preferences', preferredWorkMode: 'preferences', preferredEmploymentType: 'preferences', resume: 'resumes' };

function Row({ icon, label, children }) {
  const Icon = icon;
  return (
    <li className="flex items-start gap-3 py-3 border-b border-sage/20 last:border-0">
      <span className="shrink-0 w-9 h-9 rounded-lg bg-mint text-primary flex items-center justify-center"><Icon size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink/55">{label}</p>
        <div className="text-sm text-ink font-medium break-words">{children}</div>
      </div>
    </li>
  );
}

// Right-hand summary built only from real data (the user, the resume summary and the dashboard completeness).
function SummaryPanel({ user, completeness }) {
  const rs = user.resumeSummary;
  const skills = user.skills || [];
  const interests = user.careerInterests || [];
  const nextStep = completeness?.missing?.[0];
  return (
    <aside aria-label="Your profile summary" className="bg-white rounded-2xl border border-sage/30 shadow-sm p-5">
      <h2 className="font-display text-xl font-bold text-primary">Your Profile Summary</h2>
      <p className="text-sm text-ink/60 mt-0.5">A quick look at what job matching uses.</p>

      {completeness && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink/70">Profile complete</span>
            <span className="font-semibold text-primary">{completeness.value}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-sage/30 overflow-hidden mt-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completeness.value} aria-label="Profile completeness">
            <div className="h-full bg-accent" style={{ width: `${completeness.value}%` }} />
          </div>
        </div>
      )}

      <ul className="mt-3">
        <Row icon={BriefcaseIcon} label="Primary role">{user.primaryRole || <span className="text-ink/50 font-normal">Not set yet</span>}</Row>
        <Row icon={SparkIcon} label={`Career interests (${interests.length}/3)`}>
          {interests.length ? (
            <span className="flex flex-wrap gap-1.5 mt-0.5">{interests.map((i) => <span key={i.roleKey} className="text-xs px-2 py-0.5 rounded-full bg-mint text-primary">{i.role}</span>)}</span>
          ) : <span className="text-ink/50 font-normal">None yet</span>}
        </Row>
        <Row icon={TagIcon} label="Skills">
          {skills.length ? <span>{skills.slice(0, 5).map((s) => s.name).join(', ')}{skills.length > 5 ? ` +${skills.length - 5} more` : ''}</span> : <span className="text-ink/50 font-normal">None added yet</span>}
        </Row>
        <Row icon={FileTextIcon} label="Resume">
          {rs ? (
            rs.resumeReady ? (
              <span className="inline-flex items-center gap-1.5"><CheckIcon size={15} className="text-accent" /> Ready: {rs.count} resume{rs.count === 1 ? '' : 's'}, {rs.roleResumeCount} for a role</span>
            ) : (
              <span className="text-ink/50 font-normal">Not uploaded yet</span>
            )
          ) : <span className="text-ink/50 font-normal">Loading...</span>}
          {rs && !rs.resumeReady && <a href="#resumes" className="focus-ring flex items-center min-h-10 text-primary underline text-sm font-medium">Upload a resume</a>}
        </Row>
      </ul>

      <div className="mt-3 rounded-xl bg-mint/70 px-4 py-3 text-sm text-primary">
        <p className="font-semibold">{nextStep ? 'Next step' : 'Keep your profile updated'}</p>
        <p className="text-ink/75 mt-0.5">
          {nextStep
            ? <>{nextStep.label}.{' '}{nextStep.link === '/resume' ? <a href="#resumes" className="focus-ring inline-flex items-center min-h-11 underline font-medium">Go to Resumes</a> : <a href={`#${SECTION_FOR[nextStep.key] || 'account'}`} className="focus-ring inline-flex items-center min-h-11 underline font-medium">Take me there</a>}</>
            : 'A complete, current profile gives you better job recommendations.'}
        </p>
      </div>
    </aside>
  );
}

export default SummaryPanel;
