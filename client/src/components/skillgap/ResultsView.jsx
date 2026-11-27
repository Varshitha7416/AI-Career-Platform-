import { Link } from 'react-router-dom';
import ScoreRing from '../resume/ScoreRing';
import SkillGroups from './SkillGroups';
import RoadmapPanel from './RoadmapPanel';
import ProgramsPanel from './ProgramsPanel';
import { SuccessMessage } from '../Feedback';
import { ArrowLeft } from '../Icons';
import { CARD, BTN_GHOST, basisLabel, targetKindLabel, targetKindHint, resumeLabel, jobLabelOf, formatDateTime } from './skillGapUtils';

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-mint/70 px-4 py-2.5 text-center min-w-[5.5rem]">
      <p className="font-display text-xl font-bold text-primary leading-none">{value}</p>
      <p className="text-xs text-ink/70 mt-1">{label}</p>
    </div>
  );
}

function Coverage({ label, value }) {
  if (typeof value !== 'number') return null;
  return <li className="text-sm text-ink/80">{label}: <span className="font-semibold">{Math.round(value)}%</span></li>;
}

/** Full analysis: summary, score, skill groups, roadmap and programs. */
function ResultsView({ analysis, notice, onNew }) {
  const a = analysis;
  const c = a.counts || a.score?.counts || {};
  const job = jobLabelOf(a);
  const resume = resumeLabel(a);
  const jobId = a.job?._id && !a.jobDeleted ? a.job._id : null;
  const method = a.score?.method || 'v1';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onNew} className={BTN_GHOST}><ArrowLeft size={14} /> New analysis</button>
        {jobId && <Link to={`/jobs/${jobId}`} className={BTN_GHOST}>View this job</Link>}
      </div>
      {notice && <SuccessMessage message={notice} />}

      <section className={CARD} aria-labelledby="sg-result-h">
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-mint text-primary">{basisLabel(a.basis)}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border border-sage/60 text-primary">{targetKindLabel(a.targetKind)}</span>
        </div>
        <h2 id="sg-result-h" className="font-display text-2xl font-bold text-primary break-words">{a.title || a.targetRole}</h2>
        <p className="text-sm text-ink/60 mt-1">
          {[job && `Job: ${job}`, resume && `Resume: ${resume}`, a.createdAt && formatDateTime(a.createdAt)].filter(Boolean).join(' - ')}
        </p>
        <p className="text-xs text-ink/60 mt-1">{targetKindHint(a.targetKind)}</p>

        <div className="mt-5 flex flex-col items-center gap-6 md:flex-row md:items-start">
          <ScoreRing value={a.score?.value} label="Skill-match score" size={150} caption={a.basis === 'resume-verified' ? 'Based on your resume' : 'Based on what you entered'} />
          <div className="min-w-0 flex-1">
            {a.result?.summary && <p className="text-sm text-ink leading-relaxed">{a.result.summary}</p>}
            <div className="flex flex-wrap gap-2 mt-4">
              <Stat label="Matched" value={c.matched ?? 0} />
              {a.mode === 'resume' && <Stat label="Partial" value={c.partial ?? 0} />}
              <Stat label="Missing" value={c.missing ?? 0} />
              <Stat label="Required" value={c.required ?? 0} />
              <Stat label="Preferred" value={c.preferred ?? 0} />
            </div>
            <ul className="mt-3 flex flex-col gap-0.5">
              <Coverage label="Required skills covered" value={a.score?.requiredCoverage} />
              <Coverage label="Preferred skills covered" value={a.score?.preferredCoverage} />
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-sage/40 p-4 text-sm text-ink/80 flex flex-col gap-2">
          <p className="font-semibold text-ink">How this score works</p>
          {a.methodNote && <p>{a.methodNote}</p>}
          {a.result?.scoreExplanation && <p>{a.result.scoreExplanation}</p>}
          <p className="text-xs text-ink/60">
            {a.disclaimer || 'Skill-match score: how much of the role’s listed skills your resume or entries cover. Not a prediction of hiring outcome.'} (Method {method})
          </p>
        </div>
      </section>

      <SkillGroups analysis={a} />
      <RoadmapPanel key={`rm-${a._id}`} analysis={a} />
      <ProgramsPanel key={`pg-${a._id}`} analysisId={a._id} />
    </div>
  );
}

export default ResultsView;
