import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { ErrorMessage, SuccessMessage, Skeleton } from '../components/Feedback';
import { ArrowLeft, ExternalIcon, FileTextIcon } from '../components/Icons';
import CompanyLogo from '../components/CompanyLogo';
import StatusPill from '../components/dashboard/StatusPill';
import { formatDateTime } from '../components/dashboard/format';
import ActionConfirm from '../components/referrals/ActionConfirm';
import { ACTIONS, jobLink, jobTitleLine, resumeLabel } from '../components/referrals/referralUtils';

const card = 'bg-white rounded-2xl border border-sage/30 shadow-sm p-5 sm:p-6';

function Row({ label, children }) {
  if (!children) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-1.5">
      <dt className="text-xs uppercase tracking-wide text-ink/55 sm:w-40 shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-ink min-w-0">{children}</dd>
    </div>
  );
}

function ResumeSection({ referral }) {
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const view = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get(`/referrals/${referral._id}/resume`);
      setResume(res.data.resume);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the resume.'));
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    setError('');
    try {
      const res = await axiosClient.get(`/referrals/${referral._id}/resume`, { params: { download: 'txt' }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const base = (resumeLabel(referral.resume) || 'resume').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_');
      a.download = `${base}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not download the resume.'));
    }
  };

  const btn = 'focus-ring px-4 py-2.5 min-h-10 rounded-lg text-sm font-medium border border-sage/60 text-primary hover:bg-mint disabled:opacity-50';

  return (
    <section aria-labelledby="resume-h" className={card}>
      <h2 id="resume-h" className="font-display text-xl font-bold text-primary">Candidate resume</h2>
      <p className="text-xs text-ink/60 mt-1">{referral.resumeRetentionNotice || 'This is a copy of the resume text the candidate shared with this request.'}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        {!resume && <button type="button" onClick={view} disabled={loading} className={btn}>{loading ? 'Loading...' : 'View resume text'}</button>}
        {resume && <button type="button" onClick={() => setResume(null)} className={btn}>Hide resume</button>}
        <button type="button" onClick={download} className={btn}>Download .txt</button>
      </div>
      {error && <div className="mt-3"><ErrorMessage message={error} /></div>}
      {resume && (
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-mint/50 border border-sage/30 p-4 text-sm text-ink font-sans" tabIndex={0}>
          {resume.text}
        </pre>
      )}
    </section>
  );
}

function ReferralDetails() {
  const { id } = useParams();
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get(`/referrals/${id}`);
      setReferral(res.data.referral);
      setNotFound(false);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) setNotFound(true);
      else setError(getErrorMessage(err, 'Could not load this request.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / id change
    load();
  }, [load]);

  const back = (
    <Link to="/referrals" className="focus-ring inline-flex items-center gap-1.5 min-h-10 text-sm text-primary hover:underline rounded">
      <ArrowLeft size={16} /> Back to Referrals
    </Link>
  );

  if (loading && !referral) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4" aria-label="Loading request">
        {back}
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        {back}
        <div className={`${card} text-center`}>
          <h1 className="font-display text-2xl font-bold text-primary">Request not found</h1>
          <p className="text-ink/70 mt-2">It may have been removed, or it isn&apos;t one of your requests.</p>
        </div>
      </div>
    );
  }

  if (!referral) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        {back}
        <ErrorMessage message={error || 'Could not load this request.'} onRetry={load} />
      </div>
    );
  }

  const sent = referral.direction === 'sent';
  const { job, counterpart } = referral;
  const link = jobLink(job);
  const actions = referral.allowedActions || [];
  const profile = sent ? referral.provider : referral.candidate;
  const history = [...(referral.statusHistory || [])].reverse();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      {back}

      <header className="flex flex-wrap items-start gap-4">
        <CompanyLogo company={{ name: job?.company || 'Company' }} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary leading-tight">{jobTitleLine(job)}</h1>
          <p className="text-sm text-ink/70 mt-1">
            {sent ? 'Request you sent' : 'Request you received'} &middot; {formatDateTime(referral.createdAt)}
          </p>
        </div>
        <StatusPill status={referral.status} className="!text-xs !px-3 !py-1" />
      </header>

      {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
      {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Actions">
          {actions.filter((a) => ACTIONS[a]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => { setFeedback(null); setAction(a); }}
              className={`focus-ring px-4 py-2.5 min-h-10 rounded-lg text-sm font-medium ${ACTIONS[a].danger ? 'border border-red-300 text-red-600 hover:bg-red-50' : 'bg-primary text-white hover:bg-primary-dark'}`}
            >
              {ACTIONS[a].label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby="who-h" className={card}>
          <h2 id="who-h" className="font-display text-xl font-bold text-primary">{sent ? 'Referrer' : 'Candidate'}</h2>
          <p className="font-semibold text-ink mt-2">{counterpart?.name || 'Unknown user'}</p>
          <dl className="mt-2">
            {sent ? (
              <>
                <Row label="Role">{profile?.currentCompanyRole}</Row>
                <Row label="Company">{profile?.company && <>{profile.company} <span className="text-xs text-ink/55">(self-reported)</span></>}</Row>
              </>
            ) : (
              <>
                <Row label="Looking for">{profile?.seekingRole}</Row>
                <Row label="Experience">{profile?.experienceYears != null && profile.experienceYears !== '' ? `${profile.experienceYears} ${Number(profile.experienceYears) === 1 ? 'year' : 'years'}` : ''}</Row>
                <Row label="Preferred location">{profile?.preferredLocation}</Row>
              </>
            )}
          </dl>
        </section>

        <section aria-labelledby="job-h" className={card}>
          <h2 id="job-h" className="font-display text-xl font-bold text-primary">Job</h2>
          {job?.title || job?.company ? (
            <dl className="mt-2">
              <Row label="Title">{job.title}</Row>
              <Row label="Company">{job.company}</Row>
              <Row label="Job ID">{job.jobCode || job.externalJobId}</Row>
              <Row label="Source">{job.jobId ? 'CareerNest job' : job.external ? 'External job' : ''}</Row>
              <Row label="Link">
                {link && (link.to ? (
                  <Link to={link.to} className="focus-ring inline-flex items-center gap-1 min-h-10 -my-2 text-primary font-medium hover:underline rounded">View Job <ExternalIcon size={13} /></Link>
                ) : (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 min-h-10 -my-2 text-primary font-medium hover:underline rounded">Open job link <ExternalIcon size={13} /></a>
                ))}
              </Row>
            </dl>
          ) : (
            <p className="text-sm text-ink/65 mt-2">Job details not recorded for this request.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="msg-h" className={card}>
        <h2 id="msg-h" className="font-display text-xl font-bold text-primary">Message</h2>
        <p className="text-sm text-ink mt-2 whitespace-pre-line break-words">{referral.message || referral.messagePreview}</p>
        {referral.resume && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink/65"><FileTextIcon size={14} /> Resume shared: {resumeLabel(referral.resume)}</p>
        )}
      </section>

      {referral.resumeAvailable && <ResumeSection referral={referral} />}

      <section aria-labelledby="hist-h" className={card}>
        <h2 id="hist-h" className="font-display text-xl font-bold text-primary">Status history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink/65 mt-2">No status changes recorded.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {history.map((h, i) => (
              <li key={`${h.status}-${h.at}-${i}`} className="flex items-center gap-3">
                <StatusPill status={h.status} />
                <span className="text-sm text-ink/70">{formatDateTime(h.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {action && (
        <ActionConfirm
          referralId={referral._id}
          action={action}
          onCancel={() => setAction(null)}
          onDone={(updated, message) => { setAction(null); setFeedback({ type: 'success', text: message }); load(); if (updated) setReferral((r) => ({ ...r, ...updated })); }}
          onFail={(text) => { setAction(null); setFeedback({ type: 'error', text }); load(); }}
        />
      )}
    </div>
  );
}

export default ReferralDetails;
