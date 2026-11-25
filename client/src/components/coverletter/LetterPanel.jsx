import { useState } from 'react';
import { Skeleton } from '../Feedback';
import { FileTextIcon } from '../Icons';
import { MAX_LETTER_CHARS, formatDate, jobLabel, resumeLabel } from './letterUtils';

const SOURCE_LABEL = { ai: 'AI generated', edit: 'Edited', regeneration: 'Regenerated', restore: 'Restored' };

function EmptyArt() {
  return (
    <svg viewBox="0 0 220 170" className="w-48" role="img" aria-label="Document with leaves">
      <path d="M40 160c-8-30-6-60 6-84" fill="none" stroke="#8EB69B" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 76c-16-2-26-14-28-30 16 0 26 12 28 30Zm-4 34c-14 0-24-8-28-22 14-2 24 8 28 22Zm6-60c-4-12 0-24 12-30 6 12 2 24-12 30Z" fill="#8EB69B" opacity="0.8" />
      <rect x="70" y="20" width="100" height="130" rx="10" fill="#DAF1DE" stroke="#8EB69B" strokeWidth="2" />
      <path d="M88 54h64M88 70h64M88 86h50M88 102h58" stroke="#8EB69B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="38" r="6" fill="#8EB69B" />
      <path d="M170 150c4-26 18-42 38-48-2 24-14 42-38 48Z" fill="#8EB69B" opacity="0.9" />
    </svg>
  );
}

function Btn({ children, onClick, disabled, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`focus-ring px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 ${primary ? 'bg-primary text-white hover:bg-primary-dark' : 'border border-sage/60 text-primary hover:bg-mint'}`}
    >
      {children}
    </button>
  );
}

function Versions({ versions, currentText, busy, onRestore }) {
  const [openNum, setOpenNum] = useState(null);
  const list = [...(versions || [])].sort((a, b) => b.number - a.number);
  if (list.length === 0) return null;
  return (
    <details className="mt-4 rounded-xl border border-sage/30 p-3">
      <summary className="cursor-pointer text-sm font-medium text-primary">Version history ({list.length})</summary>
      <p className="mt-2 text-xs text-ink/65">Earlier versions are always kept. Restoring one adds it as a new version, nothing is lost.</p>
      <ul className="mt-2 space-y-2">
        {list.map((v) => (
          <li key={v.number} className="rounded-lg bg-bg/60 border border-sage/20 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-ink">
                Version {v.number} <span className="text-ink/60">- {SOURCE_LABEL[v.source] || v.source}, {formatDate(v.createdAt)}</span>
              </span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setOpenNum(openNum === v.number ? null : v.number)} className="focus-ring text-xs underline text-primary">
                  {openNum === v.number ? 'Hide' : 'Preview'}
                </button>
                <button
                  type="button"
                  disabled={busy || v.text === currentText}
                  onClick={() => onRestore(v.number)}
                  className="focus-ring text-xs underline text-primary disabled:opacity-40 disabled:no-underline"
                >
                  {v.text === currentText ? 'Current' : 'Restore'}
                </button>
              </span>
            </div>
            {openNum === v.number && <p className="mt-2 text-sm text-ink/85 whitespace-pre-line max-h-60 overflow-auto">{v.text}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function NeedsInfo({ items, onSubmit, busy }) {
  const [answers, setAnswers] = useState('');
  return (
    <div className="mb-4 rounded-xl border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-700">
      <p className="font-semibold">The AI needs more information to make this letter stronger</p>
      <ul className="mt-1 list-disc pl-5">
        {items.map((q, i) => <li key={i}>{q}</li>)}
      </ul>
      <label htmlFor="cl-needs" className="sr-only">Your answers</label>
      <textarea
        id="cl-needs"
        rows={3}
        maxLength={2000}
        value={answers}
        onChange={(e) => setAnswers(e.target.value)}
        placeholder="Answer here with true details only. They will be added to your extra facts."
        className="focus-ring mt-2 w-full bg-white text-ink border border-sage/50 rounded-lg px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={busy || !answers.trim()}
        onClick={() => { onSubmit(answers.trim()); setAnswers(''); }}
        className="focus-ring mt-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm hover:bg-primary-dark disabled:opacity-50"
      >
        Add answers and regenerate
      </button>
    </div>
  );
}

export default function LetterPanel({
  letter, generating, text, setText, dirty, saving, onSave, onCopy, copied,
  onDownload, downloading, onRegenerate, regenerating, onRestore, restoring, onAnswerNeedsInfo, notice,
}) {
  const busyAI = generating || regenerating;

  return (
    <section className="rounded-2xl border border-sage/30 bg-white p-5" aria-labelledby="cl-letter-h" aria-busy={busyAI}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="cl-letter-h" className="font-display text-xl text-primary flex items-center gap-2"><FileTextIcon size={20} /> Your Cover Letter</h2>
        {letter && !busyAI && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${dirty ? 'bg-amber-100 text-amber-700' : 'bg-mint text-primary'}`} role="status">
            {saving ? 'Saving...' : dirty ? 'Unsaved changes' : 'Saved'}
          </span>
        )}
      </div>

      {busyAI ? (
        <div className="mt-4" role="status" aria-live="polite">
          <p className="text-sm text-ink/75 mb-3">{regenerating ? 'Regenerating your letter' : 'Writing your letter'}, this can take up to a minute.</p>
          <Skeleton className="h-4 w-1/3 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6 mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : !letter ? (
        <div className="mt-4 text-center py-8 px-4 lg:min-h-[420px] flex flex-col items-center justify-center">
          <EmptyArt />
          <p className="mt-5 text-ink font-semibold">Your cover letter will appear here</p>
          <p className="text-sm text-ink/65 mt-2 max-w-xs">Fill in the details and click "Generate" to create a professional cover letter tailored to your profile and the job.</p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs text-ink/65">
            {jobLabel(letter).title}{jobLabel(letter).company ? ` at ${jobLabel(letter).company}` : ''} - resume: {resumeLabel(letter)}
            {letter.currentVersion ? ` - version ${letter.currentVersion}` : ''}
          </p>

          {notice && <p role="status" className="mt-3 text-sm bg-mint text-primary rounded-lg px-3 py-2">{notice}</p>}

          {letter.groundingWarnings?.length > 0 && (
            <div role="alert" className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold">Please check these statements before using this letter</p>
              <p className="text-xs mt-0.5">They may not be supported by your resume or the facts you added. Edit or remove anything that is not true.</p>
              <ul className="mt-1 list-disc pl-5">{letter.groundingWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}

          {letter.needsInfo?.length > 0 && (
            <div className="mt-3">
              <NeedsInfo items={letter.needsInfo} onSubmit={onAnswerNeedsInfo} busy={busyAI} />
            </div>
          )}

          <label htmlFor="cl-text" className="sr-only">Cover letter text</label>
          <textarea
            id="cl-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={18}
            maxLength={MAX_LETTER_CHARS}
            className="focus-ring mt-3 w-full bg-white border border-sage/50 rounded-xl px-4 py-3 text-sm text-ink leading-relaxed"
          />
          <p className="text-xs text-ink/55 text-right">{text.length} / {MAX_LETTER_CHARS}</p>

          <div className="mt-2 flex flex-wrap gap-2">
            <Btn primary onClick={onSave} disabled={!dirty || saving || !text.trim()}>{saving ? 'Saving...' : 'Save'}</Btn>
            <Btn onClick={onCopy} disabled={!text}>{copied ? 'Copied' : 'Copy'}</Btn>
            <Btn onClick={() => onDownload('pdf')} disabled={downloading || !text.trim()}>{downloading === 'pdf' ? 'Preparing...' : 'Download PDF'}</Btn>
            <Btn onClick={() => onDownload('docx')} disabled={downloading || !text.trim()}>{downloading === 'docx' ? 'Preparing...' : 'Download DOCX'}</Btn>
            <Btn onClick={onRegenerate} disabled={busyAI}>Regenerate</Btn>
          </div>
          {dirty && <p className="mt-2 text-xs text-ink/65">Downloads use the saved version, so your unsaved edits are saved first.</p>}

          <Versions versions={letter.versions} currentText={letter.currentText} busy={restoring} onRestore={onRestore} />
        </>
      )}
    </section>
  );
}
