import { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import ModalShell from '../interviews/ModalShell';
import JobPicker from '../coverletter/JobPicker';
import ResumeLibrary from '../resume/ResumeLibrary';
import { ErrorMessage } from '../Feedback';
import { isHttpUrl } from './referralUtils';

const field = 'focus-ring w-full bg-white border border-sage/50 rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink/45';
const MAX = 1000;

const ERROR_BY_CODE = {
  DUPLICATE_ACTIVE: 'You already have an active request to this person for this job. Wait for their response or withdraw it first.',
  RATE_LIMIT: "You've reached today's limit of referral requests. Please try again tomorrow.",
};

function Label({ htmlFor, children }) {
  return <label htmlFor={htmlFor} className="block text-xs font-medium text-ink/70 mb-1">{children}</label>;
}

// Request-a-referral modal. provider = a /referrals/providers item. onSent(referral) after a successful send.
function RequestModal({ provider, onClose, onSent }) {
  const firstName = provider.name.split(' ')[0];
  const defaultCompany = provider.companies?.length === 1 ? provider.companies[0] : '';
  const [source, setSource] = useState('careernest');
  const [job, setJob] = useState(null);
  const [ext, setExt] = useState({ company: defaultCompany, title: '', url: '', externalJobId: '' });
  const [resume, setResume] = useState(null);
  const [message, setMessage] = useState(`Hi ${firstName}, I'm interested in a role you may be able to refer me for and would really appreciate a referral. Thank you!`);
  const [ack, setAck] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const setExtField = (k) => (e) => setExt((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const body = { providerId: provider._id, message: message.trim(), acknowledgeResumeShare: true };

    if (source === 'careernest') {
      if (!job) return setError('Pick a CareerNest job, or switch to "Job elsewhere".');
      body.jobId = job._id;
    } else {
      if (!ext.company.trim() || !ext.title.trim()) return setError('Enter the company and job title.');
      if (!isHttpUrl(ext.url.trim())) return setError('Enter a valid job link starting with http:// or https://.');
      body.externalJob = { company: ext.company.trim(), title: ext.title.trim(), url: ext.url.trim() };
      if (ext.externalJobId.trim()) body.externalJob.externalJobId = ext.externalJobId.trim();
    }
    if (!resume) return setError('Select or upload the resume you want to share.');
    body.resumeId = resume._id;
    if (!body.message) return setError('Please write a message.');
    if (!ack) return setError('Please confirm that you understand how your resume copy is kept.');

    setSending(true);
    try {
      const res = await axiosClient.post('/referrals', body);
      onSent(res.data.referral);
    } catch (err) {
      const data = err.response?.data;
      setError(ERROR_BY_CODE[data?.code] || data?.message || (err.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check that the backend is running.' : 'Could not send the request. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const tab = (key, text) => (
    <button
      type="button"
      onClick={() => setSource(key)}
      aria-pressed={source === key}
      className={`focus-ring flex-1 px-3 py-2 min-h-10 text-sm rounded-lg font-medium transition ${source === key ? 'bg-primary text-white' : 'text-primary hover:bg-mint'}`}
    >
      {text}
    </button>
  );

  return (
    <ModalShell title={`Request a referral from ${provider.name}`} onClose={onClose} labelId="request-title" wide>
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-5">
        <fieldset>
          <legend className="text-sm font-semibold text-ink mb-2">1. Which job?</legend>
          <div className="flex gap-1 p-1 rounded-xl border border-sage/40 mb-3">
            {tab('careernest', 'CareerNest job')}
            {tab('external', 'Job elsewhere')}
          </div>
          {source === 'careernest' ? (
            <JobPicker label="Search CareerNest jobs (required)" jobId={job?._id || ''} onPick={setJob} onClear={() => setJob(null)} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ext-company">Company</Label>
                <input id="ext-company" className={field} value={ext.company} onChange={setExtField('company')} maxLength={120} />
              </div>
              <div>
                <Label htmlFor="ext-title">Job title</Label>
                <input id="ext-title" className={field} value={ext.title} onChange={setExtField('title')} maxLength={160} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ext-url">Job link</Label>
                <input id="ext-url" type="url" className={field} value={ext.url} onChange={setExtField('url')} placeholder="https://..." />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ext-id">Job ID (optional)</Label>
                <input id="ext-id" className={field} value={ext.externalJobId} onChange={setExtField('externalJobId')} maxLength={80} />
              </div>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-ink mb-2">2. Resume to share</legend>
          <ResumeLibrary compact selectedId={resume?._id || ''} onSelect={setResume} />
        </fieldset>

        <div>
          <label htmlFor="ref-message" className="text-sm font-semibold text-ink">3. Message</label>
          <textarea
            id="ref-message"
            rows={5}
            maxLength={MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={`${field} mt-2`}
          />
          <p className="text-xs text-ink/60 text-right mt-1" aria-live="polite">{message.length}/{MAX}</p>
        </div>

        <label className="flex items-start gap-2 text-sm text-ink bg-mint/60 border border-sage/40 rounded-xl p-3">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-800 shrink-0" />
          <span>
            I understand that {firstName} will receive a <strong>copy of my resume text</strong>, and that copy stays attached to this request even if I later delete the original resume. My profile and job details never expose my email, but the resume text is shared as-is, so it may contain contact details I included. {firstName} can read it while the request is pending, accepted or referred, but not if it is declined or withdrawn.
          </span>
        </label>

        {error && <ErrorMessage message={error} />}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="focus-ring px-4 py-2 min-h-10 rounded-lg border border-sage/50 text-sm text-ink hover:bg-mint">Cancel</button>
          <button type="submit" disabled={sending} className="focus-ring px-5 py-2 min-h-10 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
            {sending ? 'Sending...' : 'Send request'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default RequestModal;
