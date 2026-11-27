import { Link } from 'react-router-dom';
import JobPicker from './JobPicker';
import ResumeLibrary from '../resume/ResumeLibrary';
import { SparkIcon } from '../Icons';

const fieldClass = 'focus-ring w-full bg-white border border-sage/50 rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink/45 read-only:bg-mint/40';
const DESC_MAX = 1000;

function Segmented({ label, value, options, onChange }) {
  return (
    <fieldset>
      <legend className="block text-xs font-medium text-ink/70 mb-1">{label}</legend>
      <div className="inline-flex flex-wrap rounded-lg border border-sage/50 p-0.5 bg-white">
        {options.map(([key, text]) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
            className={`focus-ring px-3 py-1.5 text-sm rounded-md ${value === key ? 'bg-primary text-white' : 'text-ink hover:bg-mint'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function GenerateForm({ form, patch, resumeId, onResumeSelect, analysis, canGenerate, generating, onGenerate, hasLetter }) {
  const linked = form.jobMode === 'catalog' && !!form.jobId;
  const jobReady = linked || !!(form.manual.title.trim() && form.manual.company.trim());
  const analyzerLink = resumeId && linked ? `/resume?resume=${resumeId}&job=${form.jobId}` : '/resume';
  const setManual = (k, v) => patch({ manual: { ...form.manual, [k]: v } });
  const fillFrom = (job) => patch({
    manual: { title: job.title || '', company: job.company?.name || '', description: (job.jobDescription || '').slice(0, DESC_MAX) },
  });

  return (
    <section className="rounded-2xl border border-sage/30 bg-white p-5 lg:p-6" aria-labelledby="cl-form-h">
      <h2 id="cl-form-h" className="font-display text-xl text-primary">Job Details</h2>

      <div className="mt-4 space-y-4">
        <JobPicker
          jobId={form.jobMode === 'catalog' ? form.jobId : ''}
          onPick={(j) => { patch({ jobId: j._id, jobMode: 'catalog' }); fillFrom(j); }}
          onClear={() => patch({ jobId: '', jobMode: 'manual' })}
          onDetail={fillFrom}
        />

        <div>
          <label htmlFor="cl-m-title" className="block text-xs font-medium text-ink/70 mb-1">Job Title <span className="text-red-600">*</span></label>
          <input id="cl-m-title" className={fieldClass} maxLength={150} readOnly={linked} value={form.manual.title} onChange={(e) => setManual('title', e.target.value)} placeholder="e.g. Software Engineer" />
        </div>
        <div>
          <label htmlFor="cl-m-company" className="block text-xs font-medium text-ink/70 mb-1">Company Name <span className="text-red-600">*</span></label>
          <input id="cl-m-company" className={fieldClass} maxLength={150} readOnly={linked} value={form.manual.company} onChange={(e) => setManual('company', e.target.value)} placeholder="e.g. Google" />
        </div>
        <div>
          <label htmlFor="cl-m-desc" className="block text-xs font-medium text-ink/70 mb-1">Job Description (optional)</label>
          <textarea
            id="cl-m-desc"
            rows={5}
            maxLength={DESC_MAX}
            readOnly={linked}
            className={`${fieldClass} resize-y`}
            value={form.manual.description}
            onChange={(e) => setManual('description', e.target.value)}
            placeholder="Paste the job description for a more tailored letter..."
          />
          <p className="text-right text-xs text-ink/55 mt-0.5">{form.manual.description.length}/{DESC_MAX}</p>
          {linked && <p className="text-xs text-ink/65">Linked to a CareerNest job, so the full job record is used. Unlink it to edit these fields.</p>}
        </div>

        <div>
          <p className="text-xs font-medium text-ink/70 mb-2">Resume <span className="text-red-600">*</span></p>
          <ResumeLibrary selectedId={resumeId} onSelect={onResumeSelect} compact />
        </div>

        <details className="rounded-xl border border-sage/30 p-3 group">
          <summary className="cursor-pointer text-sm font-medium text-primary">More options</summary>
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="cl-facts" className="block text-xs font-medium text-ink/70 mb-1">Extra facts about me (optional)</label>
              <textarea
                id="cl-facts"
                rows={3}
                maxLength={3000}
                className={fieldClass}
                value={form.userFacts}
                onChange={(e) => patch({ userFacts: e.target.value })}
                placeholder="e.g. I led a 3-person team on my final-year project."
              />
              <p className="mt-1 text-xs text-ink/65">Only add true information. The AI will not invent anything beyond your resume and what you write here.</p>
            </div>
            <div>
              <label htmlFor="cl-instr" className="block text-xs font-medium text-ink/70 mb-1">Instructions (optional)</label>
              <textarea
                id="cl-instr"
                rows={2}
                maxLength={1000}
                className={fieldClass}
                value={form.instructions}
                onChange={(e) => patch({ instructions: e.target.value })}
                placeholder="e.g. Mention my interest in accessibility. Keep it to three paragraphs."
              />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Segmented label="Tone" value={form.tone} onChange={(v) => patch({ tone: v })} options={[['professional', 'Professional'], ['confident', 'Confident'], ['concise', 'Concise']]} />
              <Segmented label="Length" value={form.length} onChange={(v) => patch({ length: v })} options={[['standard', 'Standard'], ['detailed', 'Detailed']]} />
            </div>
            {analysis && (
              <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" checked={form.useAnalysis} onChange={(e) => patch({ useAnalysis: e.target.checked })} className="mt-0.5 accent-[var(--color-accent)]" />
                <span>
                  Use insights from my analysis
                  <span className="block text-xs text-ink/65">
                    Uses strengths and skills from your analysis of this resume and job (score {analysis.overallScore ?? analysis.matchPercentage ?? 'n/a'}, CareerNest AI assessment).
                  </span>
                </span>
              </label>
            )}
          </div>
        </details>

        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="focus-ring w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <SparkIcon size={16} />
          {generating ? 'Generating...' : hasLetter ? 'Generate a new letter' : 'Generate Cover Letter'}
        </button>
        {!canGenerate && !generating && (
          <p className="text-xs text-ink/65 -mt-2">{!resumeId ? 'Select or upload a resume.' : !jobReady ? 'Enter a job title and company, or pick a CareerNest job.' : ''}</p>
        )}
        {resumeId && jobReady && (
          <p className="text-xs text-ink/70 -mt-2">
            {linked && !analysis && 'No analysis yet for this resume and job. '}
            <Link to={analyzerLink} className="underline text-primary">Analyze my resume for this job</Link>
          </p>
        )}
      </div>
    </section>
  );
}
