import { Link } from 'react-router-dom';
import ScoreRing from './ScoreRing';
import ExportPdfButton from './ExportPdfButton';
import { CheckIcon, InfoIcon, SparkIcon } from '../Icons';
import { formatDateTime, snapshotJobLabel, snapshotResumeName } from './resumeUtils';

const FALLBACK_DISCLAIMER =
  'This is a CareerNest AI-generated assessment. It is not the result of any employer or applicant tracking system, and it can be wrong. Use it as guidance and review every point yourself.';

function Section({ title, hint, children, id }) {
  return (
    <section aria-labelledby={id} className="bg-white rounded-2xl shadow-sm border border-sage/30 p-5">
      <h3 id={id} className="font-display text-lg font-bold text-primary">{title}</h3>
      {hint && <p className="text-xs text-ink/60 mt-0.5">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Evidence({ quote, section }) {
  if (!quote) return null;
  return (
    <blockquote className="mt-2 border-l-4 border-sage pl-3 text-sm italic text-ink/80">
      &ldquo;{quote}&rdquo;
      {section && <span className="not-italic text-xs text-ink/60 block mt-0.5">From your resume: {section}</span>}
    </blockquote>
  );
}

const TONES = {
  match: { dot: 'bg-accent' },
  partial: { dot: 'bg-amber-700' },
  missing: { dot: 'bg-red-600' },
};

// One expandable skill row.
function SkillItem({ tone, skill, extra, children }) {
  const t = TONES[tone];
  return (
    <details className="group border border-sage/30 rounded-lg bg-bg/60">
      <summary className="cursor-pointer list-none px-3 py-2 flex items-center gap-2 text-sm focus-ring rounded-lg">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.dot}`} aria-hidden="true" />
        <span className="font-medium text-ink flex-1 min-w-0 break-words">{skill}</span>
        {extra}
        <span className="text-xs text-ink/50 group-open:hidden">Details</span>
        <span className="text-xs text-ink/50 hidden group-open:inline">Hide</span>
      </summary>
      <div className="px-3 pb-3 text-sm text-ink/80">{children}</div>
    </details>
  );
}

function SkillsVisual({ result }) {
  const matching = result.matchingSkills || [];
  const partial = result.partialSkills || [];
  const missing = result.missingSkills || [];
  const total = matching.length + partial.length + missing.length;
  if (!total) {
    return <p className="text-sm text-ink/60">No skill comparison was produced for this analysis.</p>;
  }
  const pct = (n) => `${(n / total) * 100}%`;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-sage/20" role="img" aria-label={`${matching.length} matching, ${partial.length} partial, ${missing.length} missing skills`}>
        {matching.length > 0 && <div className={TONES.match.dot} style={{ width: pct(matching.length) }} />}
        {partial.length > 0 && <div className={TONES.partial.dot} style={{ width: pct(partial.length) }} />}
        {missing.length > 0 && <div className={TONES.missing.dot} style={{ width: pct(missing.length) }} />}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70 mt-2">
        <span className="inline-flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${TONES.match.dot}`} />Matching ({matching.length})</span>
        <span className="inline-flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${TONES.partial.dot}`} />Partial ({partial.length})</span>
        <span className="inline-flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${TONES.missing.dot}`} />Missing ({missing.length})</span>
      </div>

      <div className="grid gap-4 mt-4">
        {matching.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-ink mb-2">Matching skills</h4>
            <div className="flex flex-col gap-2">
              {matching.map((s, i) => (
                <SkillItem key={`m${i}`} tone="match" skill={s.skill}>
                  {s.explanation && <p>{s.explanation}</p>}
                  <Evidence quote={s.evidence} section={s.section} />
                </SkillItem>
              ))}
            </div>
          </div>
        )}
        {partial.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-ink mb-1">Partially shown</h4>
            <p className="text-xs text-ink/60 mb-2">Related experience that does not clearly demonstrate the requirement.</p>
            <div className="flex flex-col gap-2">
              {partial.map((s, i) => (
                <SkillItem key={`p${i}`} tone="partial" skill={s.skill}>
                  {s.requirement && <p className="mb-1"><span className="font-medium">Job asks for:</span> {s.requirement}</p>}
                  {s.explanation && <p>{s.explanation}</p>}
                  <Evidence quote={s.evidence} section={s.section} />
                </SkillItem>
              ))}
            </div>
          </div>
        )}
        {missing.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-ink mb-2">Not found in your resume</h4>
            <div className="flex flex-col gap-2">
              {missing.map((s, i) => (
                <SkillItem
                  key={`x${i}`}
                  tone="missing"
                  skill={s.skill}
                  extra={s.importance ? <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">{s.importance}</span> : null}
                >
                  {s.explanation && <p>{s.explanation}</p>}
                  <p className="text-xs text-ink/60 mt-1">Only add this to your resume if you genuinely have the skill.</p>
                </SkillItem>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const QUAL = {
  met: { label: 'Met', cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partly met', cls: 'bg-amber-100 text-amber-700' },
  'not-met': { label: 'Not met', cls: 'bg-red-100 text-red-700' },
  unclear: { label: 'Unclear', cls: 'bg-gray-100 text-gray-600' },
  'not-specified': { label: 'Not specified', cls: 'bg-gray-100 text-gray-600' },
};

const RATING = {
  good: { label: 'Good', cls: 'bg-green-100 text-green-700' },
  ok: { label: 'OK', cls: 'bg-amber-100 text-amber-700' },
  'needs-work': { label: 'Needs work', cls: 'bg-red-100 text-red-700' },
};

const PRIORITY = [
  { key: 'high', label: 'High priority' },
  { key: 'medium', label: 'Medium priority' },
  { key: 'low', label: 'Low priority' },
];

function Suggestions({ items }) {
  if (!items?.length) return <p className="text-sm text-ink/60">No suggestions were produced.</p>;
  return (
    <div className="flex flex-col gap-5">
      {PRIORITY.map(({ key, label }) => {
        const group = items.filter((s) => (s.priority || 'medium') === key);
        if (!group.length) return null;
        return (
          <div key={key}>
            <h4 className="text-sm font-semibold text-ink mb-2">{label}</h4>
            <ul className="flex flex-col gap-3">
              {group.map((s, i) => {
                const verify = s.requiresUserVerification || s.kind === 'content-to-verify';
                return (
                  <li key={i} className="border border-sage/30 rounded-lg p-3 bg-bg/60">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-ink">{s.title}</span>
                      {s.section && <span className="text-[11px] px-2 py-0.5 rounded-full bg-mint text-primary">{s.section}</span>}
                      {verify && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          <InfoIcon size={12} /> Needs your verification - only add if true
                        </span>
                      )}
                    </div>
                    {s.detail && <p className="text-sm text-ink/80 mt-1">{s.detail}</p>}
                    {s.suggestedWording && (
                      <div className="mt-2 text-sm rounded-lg bg-mint/70 border border-sage/40 px-3 py-2">
                        <span className="block text-xs font-semibold text-primary mb-0.5">
                          {verify ? 'Possible wording (fill in your real details)' : 'Suggested wording'}
                        </span>
                        <span className="text-ink">{s.suggestedWording}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function PlainList({ items, empty }) {
  if (!items?.length) return <p className="text-sm text-ink/60">{empty}</p>;
  return (
    <ul className="list-disc pl-5 text-sm text-ink/90 space-y-1">
      {items.map((s, i) => <li key={i}>{typeof s === 'string' ? s : s.point || s.title}</li>)}
    </ul>
  );
}

function AnalysisResultView({ analysis }) {
  const result = analysis.result;
  const overall = result?.overallScore ?? analysis.overallScore;
  const match = result ? result.matchPercentage : analysis.matchPercentage;
  const jobLabel = snapshotJobLabel(analysis);
  const jobId = analysis.job?._id;
  const resumeId = analysis.resume?._id;
  const jobSpecific = analysis.type === 'job-specific' || !!jobLabel;

  const params = new URLSearchParams();
  if (jobId) params.set('job', jobId);
  if (resumeId) params.set('resume', resumeId);
  params.set('analysis', analysis._id);
  const letterLink = `/cover-letter?${params.toString()}`;

  const disclaimer = result?.disclaimer || FALLBACK_DISCLAIMER;
  const summary = result?.summary || analysis.summary;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-sage/30 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">CareerNest AI assessment</p>
        <h2 className="font-display text-xl font-bold text-primary mt-1">
          {jobSpecific ? 'Job match analysis' : 'General resume analysis'}
        </h2>
        <p className="text-sm text-ink/70 mt-1">
          {snapshotResumeName(analysis)}
          {analysis.resumeDeleted && <span className="ml-1 text-xs text-amber-700">(Resume no longer available)</span>}
          {jobLabel && <> &middot; {jobLabel}{analysis.jobDeleted && <span className="ml-1 text-xs text-amber-700">(job no longer listed)</span>}</>}
          {analysis.createdAt && <> &middot; {formatDateTime(analysis.createdAt)}</>}
        </p>

        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 mt-5">
          <ScoreRing value={overall} label="AI readiness score" caption="CareerNest AI assessment" />
          {jobSpecific && <ScoreRing value={match} label="Job match" caption="For this job" />}
          <div className="flex-1 min-w-[240px]">
            {summary && <p className="text-sm text-ink">{summary}</p>}
            {result?.scoreExplanation && (
              <p className="text-sm text-ink/70 mt-2"><span className="font-semibold text-ink">Why this score: </span>{result.scoreExplanation}</p>
            )}
          </div>
        </div>

        {!result && (
          <p className="mt-4 text-xs bg-amber-50 text-amber-700 rounded-lg px-3 py-2" role="note">
            This is an older analysis, saved before detailed breakdowns existed. Only the basic strengths, missing skills and suggestions are available. Run a new analysis for the full report.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-start gap-2">
          <ExportPdfButton id={analysis._id} />
        </div>

        {jobId && (
          <div className="mt-4">
            <Link to={letterLink} className="focus-ring inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition">
              <SparkIcon size={16} /> Write a cover letter for this job
            </Link>
          </div>
        )}
      </div>

      {result ? (
        <>
          <Section id="sec-skills" title="Skills" hint="Based only on what your resume shows. Expand an item for the reasoning and evidence.">
            <SkillsVisual result={result} />
          </Section>

          {result.relevantExperience?.length > 0 && (
            <Section id="sec-exp" title="Relevant experience">
              <ul className="flex flex-col gap-3">
                {result.relevantExperience.map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-ink">{e.title}</span>
                    {e.explanation && <p className="text-ink/80 mt-0.5">{e.explanation}</p>}
                    <Evidence quote={e.evidence} section={e.section} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {result.experienceGaps?.length > 0 && (
            <Section id="sec-gaps" title="Experience gaps" hint="Requirements from the job that your resume does not clearly cover.">
              <ul className="flex flex-col gap-2">
                {result.experienceGaps.map((g, i) => (
                  <li key={i} className="text-sm border border-sage/30 rounded-lg p-3 bg-bg/60">
                    <span className="font-medium text-ink">{g.requirement}</span>
                    {g.explanation && <p className="text-ink/80 mt-0.5">{g.explanation}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {result.qualificationMatch && result.qualificationMatch.status !== 'not-specified' && (
            <Section id="sec-qual" title="Qualification match">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${(QUAL[result.qualificationMatch.status] || QUAL.unclear).cls}`}>
                  {(QUAL[result.qualificationMatch.status] || QUAL.unclear).label}
                </span>
              </div>
              {result.qualificationMatch.explanation && <p className="text-sm text-ink/80">{result.qualificationMatch.explanation}</p>}
              <Evidence quote={result.qualificationMatch.evidence} />
            </Section>
          )}

          <Section id="sec-strengths" title="Strengths">
            {result.strengths?.length ? (
              <ul className="flex flex-col gap-3">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <CheckIcon size={16} className="text-accent mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium text-ink">{s.point}</span>
                      {s.explanation && <p className="text-ink/80 mt-0.5">{s.explanation}</p>}
                      <Evidence quote={s.evidence} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/60">No specific strengths were listed.</p>
            )}
          </Section>

          {result.structureFeedback?.length > 0 && (
            <Section id="sec-structure" title="Resume structure and clarity">
              <ul className="grid gap-2 sm:grid-cols-2">
                {result.structureFeedback.map((f, i) => {
                  const r = RATING[f.rating] || RATING.ok;
                  return (
                    <li key={i} className="border border-sage/30 rounded-lg p-3 bg-bg/60 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink">{f.area}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.cls}`}>{r.label}</span>
                      </div>
                      {f.feedback && <p className="text-ink/80 mt-1">{f.feedback}</p>}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Section id="sec-suggestions" title="Suggestions to improve" hint="Grouped by priority. Items marked for verification are prompts, not facts about you.">
            <Suggestions items={result.suggestions} />
          </Section>
        </>
      ) : (
        <>
          <Section id="sec-l-str" title="Strengths"><PlainList items={analysis.strengths} empty="None listed." /></Section>
          <Section id="sec-l-miss" title="Missing skills"><PlainList items={analysis.missingSkills} empty="None listed." /></Section>
          <Section id="sec-l-sug" title="Suggestions"><PlainList items={analysis.suggestions} empty="None listed." /></Section>
        </>
      )}

      <p className="text-xs text-ink/60 px-1" role="note">{disclaimer}</p>
    </div>
  );
}

export default AnalysisResultView;
