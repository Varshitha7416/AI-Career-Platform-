import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CompanyLogo from '../CompanyLogo';
import StatusPill from '../dashboard/StatusPill';
import { formatDate } from '../dashboard/format';
import { ExternalIcon, FileTextIcon } from '../Icons';
import { ACTIONS, actionsFor, jobLink, jobTitleLine, resumeLabel } from './referralUtils';

const stop = (e) => e.stopPropagation();

function JobLink({ job, className = '' }) {
  const link = jobLink(job);
  if (!link) return null;
  const cls = `focus-ring inline-flex items-center gap-1 min-h-10 -my-2.5 text-primary font-medium hover:underline rounded ${className}`;
  return link.to ? (
    <Link to={link.to} onClick={stop} className={cls}>View Job <ExternalIcon size={12} /></Link>
  ) : (
    <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={stop} className={cls}>View Job <ExternalIcon size={12} /></a>
  );
}

// The "⋮" menu: only actions the lifecycle permits for this side of the request.
function CardMenu({ referral, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const actions = actionsFor(referral.direction, referral.status);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemCls = 'focus-ring w-full text-left px-3 py-2 text-sm hover:bg-mint';

  return (
    <div ref={ref} className="relative" onClick={stop}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        className="focus-ring min-w-10 min-h-10 inline-flex items-center justify-center rounded-lg text-ink/60 hover:bg-mint -mt-1 -mr-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-48 rounded-xl border border-sage/40 bg-white shadow-lg py-1 overflow-hidden">
          <button type="button" role="menuitem" className={`${itemCls} text-ink`} onClick={() => navigate(`/referrals/${referral._id}`)}>
            View details
          </button>
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              role="menuitem"
              className={`${itemCls} ${ACTIONS[a].danger ? 'text-red-600' : 'text-ink'}`}
              onClick={() => { setOpen(false); onAction(referral, a); }}
            >
              {ACTIONS[a].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Referral request card. The whole card opens /referrals/:id; inner links/buttons stop propagation.
function ReferralCard({ referral, onAction }) {
  const navigate = useNavigate();
  const { job, counterpart } = referral;
  const sent = referral.direction === 'sent';
  const who = counterpart?.name || 'Unknown user';
  const resume = resumeLabel(referral.resume);

  return (
    <article
      onClick={() => navigate(`/referrals/${referral._id}`)}
      className="group cursor-pointer min-w-0 p-4 border-b border-sage/25 last:border-b-0 hover:bg-mint/40 transition"
    >
      <div className="flex gap-3 min-w-0">
        <CompanyLogo company={{ name: job?.company || 'Company' }} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0">
              <h3 className="font-semibold text-ink text-[15px] leading-snug">
                <Link to={`/referrals/${referral._id}`} onClick={stop} className="focus-ring inline-block py-2 -my-2 rounded hover:underline break-words">{jobTitleLine(job)}</Link>
              </h3>
              <p className="text-xs text-ink/70 mt-0.5 flex flex-wrap items-center gap-x-2 min-w-0">
                {job?.jobCode && <span>Job ID: {job.jobCode}</span>}
                <JobLink job={job} className="text-xs" />
              </p>
              <p className="text-xs text-ink/70 mt-0.5 truncate">
                {sent ? 'To' : 'From'}: {who}
                {counterpart?.headline ? ` · ${counterpart.headline}` : ''}
              </p>
            </div>
            <div className="flex items-start gap-1 shrink-0">
              <div className="text-right">
                <StatusPill status={referral.status} />
                <p className="text-[11px] text-ink/60 mt-1">{sent ? 'Sent on' : 'Received on'}<br />{formatDate(referral.createdAt)}</p>
              </div>
              <CardMenu referral={referral} onAction={onAction} />
            </div>
          </div>
          {referral.messagePreview && (
            <p className="text-sm text-ink/80 mt-2 truncate">&ldquo;{referral.messagePreview}&rdquo;</p>
          )}
          {resume && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink/65 max-w-full">
              <FileTextIcon size={13} className="shrink-0" /> <span className="truncate">{resume}</span>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default ReferralCard;
