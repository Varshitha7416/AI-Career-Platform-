import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { ExternalIcon, CheckIcon, CloseIcon } from './Icons';
import { ErrorMessage } from './Feedback';
import { formatDate } from '../utils/jobs';

const todayStr = () => new Date().toISOString().slice(0, 10);

// Turns a yyyy-mm-dd value into an ISO timestamp that is never in the future.
function toAppliedAt(dateStr) {
  if (!dateStr || dateStr === todayStr()) return new Date().toISOString();
  return new Date(`${dateStr}T12:00:00`).toISOString();
}

/**
 * Apply workflow.
 *  - Job has an external apply URL: open it in a new tab, then ASK the user to confirm they applied.
 *  - No apply URL: say so, and only record an application if the user explicitly tells us they applied elsewhere.
 * Nothing is written to the tracker until the user confirms.
 */
function ApplyFlow({ job, application, onApplied }) {
  const [step, setStep] = useState(null); // null | 'confirm' | 'nolink' | 'manual'
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);

  const close = () => { setStep(null); setError(''); };

  useEffect(() => {
    if (!step) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [step]);

  const start = () => {
    setError('');
    if (job.applyUrl) {
      window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
      setStep('confirm');
    } else {
      setStep('nolink');
    }
  };

  const record = async (applyMethod) => {
    setSaving(true);
    setError('');
    try {
      const res = await axiosClient.post('/applications', {
        jobId: job._id,
        applyMethod,
        appliedAt: applyMethod === 'manual' ? toAppliedAt(date) : undefined,
      });
      onApplied(res.data.application);
      close();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record the application'));
    } finally {
      setSaving(false);
    }
  };

  if (application) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 bg-mint text-primary rounded-xl px-4 py-2.5 text-sm font-medium">
          <CheckIcon size={16} /> Applied on {formatDate(application.appliedAt || application.createdAt)}
        </span>
        <Link to="/applications" className="focus-ring text-sm text-primary underline">View in my tracker</Link>
      </div>
    );
  }

  const btn = 'focus-ring rounded-xl px-5 py-2.5 text-sm font-medium transition';
  return (
    <>
      <button type="button" onClick={start} className={`${btn} inline-flex items-center gap-2 bg-primary text-white hover:bg-primary-dark`}>
        Apply now {job.applyUrl && <ExternalIcon size={16} />}
      </button>

      {step && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="apply-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button type="button" onClick={close} aria-label="Close" className="focus-ring absolute top-3 right-3 p-1.5 rounded-lg text-ink/60 hover:bg-mint"><CloseIcon size={18} /></button>

            {step === 'confirm' && (
              <>
                <h2 id="apply-title" className="font-display text-xl font-bold text-primary">Did you complete your application?</h2>
                <p className="text-sm text-ink/75 mt-2">
                  We opened the application page for <strong>{job.title}</strong> at {job.company?.name} in a new tab. Finish applying there, then come back and confirm.
                  CareerNest only adds it to your tracker once you tell us you applied.
                </p>
                <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1.5 text-sm text-primary underline mt-3">
                  Open the application page again <ExternalIcon size={14} />
                </a>
                {error && <div className="mt-3"><ErrorMessage message={error} /></div>}
                <div className="flex flex-wrap gap-3 mt-5">
                  <button type="button" disabled={saving} onClick={() => record('external')} className={`${btn} bg-primary text-white hover:bg-primary-dark disabled:opacity-50`}>
                    {saving ? 'Saving…' : "Yes, I've applied"}
                  </button>
                  <button type="button" onClick={close} className={`${btn} border border-sage text-primary hover:bg-mint`}>Not yet</button>
                </div>
              </>
            )}

            {step === 'nolink' && (
              <>
                <h2 id="apply-title" className="font-display text-xl font-bold text-primary">No application link for this listing</h2>
                <p className="text-sm text-ink/75 mt-2">
                  This is a sample listing, so CareerNest doesn&apos;t have an employer application page for it and can&apos;t send you anywhere to apply.
                  If you applied to this role through another channel, you can record it in your tracker.
                </p>
                <div className="flex flex-wrap gap-3 mt-5">
                  <button type="button" onClick={() => setStep('manual')} className={`${btn} bg-primary text-white hover:bg-primary-dark`}>I applied elsewhere, add to tracker</button>
                  <button type="button" onClick={close} className={`${btn} border border-sage text-primary hover:bg-mint`}>Close</button>
                </div>
              </>
            )}

            {step === 'manual' && (
              <>
                <h2 id="apply-title" className="font-display text-xl font-bold text-primary">Add to my tracker</h2>
                <p className="text-sm text-ink/75 mt-2">Only add this if you have actually applied. When did you apply?</p>
                <label className="block text-sm font-medium text-ink mt-4" htmlFor="applied-date">Date applied</label>
                <input
                  id="applied-date"
                  type="date"
                  value={date}
                  max={todayStr()}
                  onChange={(e) => setDate(e.target.value)}
                  className="focus-ring mt-1 border border-sage/60 rounded-xl px-3 py-2 text-sm w-full"
                />
                {error && <div className="mt-3"><ErrorMessage message={error} /></div>}
                <div className="flex flex-wrap gap-3 mt-5">
                  <button type="button" disabled={saving || !date} onClick={() => record('manual')} className={`${btn} bg-primary text-white hover:bg-primary-dark disabled:opacity-50`}>
                    {saving ? 'Saving…' : 'Confirm and add'}
                  </button>
                  <button type="button" onClick={close} className={`${btn} border border-sage text-primary hover:bg-mint`}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ApplyFlow;
