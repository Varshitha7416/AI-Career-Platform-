import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { getUser, updateStoredUser } from '../utils/auth';

// Shown under the top bar to logged-in users whose email is not verified yet. Verification is OPTIONAL: nothing is blocked; the
// notice only offers it (policy: docs/31) and lets the user request a new link (server enforces cooldown and budget).
// Sessions stored before verification existed carry no `emailVerified`, so the banner confirms the real status once via /auth/me.
function VerifyEmailBanner() {
  const [verified, setVerified] = useState(() => getUser()?.emailVerified === true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ tone: '', text: '' });

  useEffect(() => {
    let alive = true;
    if (getUser()?.emailVerified !== true) {
      axiosClient.get('/auth/me').then((r) => {
        if (!alive || !r.data?.user) return;
        const u = getUser();
        if (u) updateStoredUser({ ...u, emailVerified: r.data.user.emailVerified === true });
        setVerified(r.data.user.emailVerified === true);
      }).catch(() => {});
    }
    const onVerified = () => setVerified(true);
    window.addEventListener('careernest:email-verified', onVerified);
    return () => { alive = false; window.removeEventListener('careernest:email-verified', onVerified); };
  }, []);

  if (verified) return null;

  const resend = async () => {
    setBusy(true); setNote({ tone: '', text: '' });
    try {
      const r = await axiosClient.post('/auth/verification/resend');
      if (r.data?.alreadyVerified) { setVerified(true); return; }
      setNote({ tone: 'ok', text: r.data?.message || 'We have sent a new verification link.' });
    } catch (err) {
      setNote({ tone: 'err', text: err?.response?.data?.message || 'We could not send a verification email. Please try again later.' });
    } finally { setBusy(false); }
  };

  return (
    <div role="status" data-testid="verify-banner" className="bg-mint text-primary border-b border-sage/40 px-4 py-2.5 text-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Verify your email address (optional).</span>
        <span className="text-ink/80">Everything in CareerNest works without it. Verifying proves the address is yours and helps with account recovery.</span>
        <button type="button" onClick={resend} disabled={busy} className="focus-ring ml-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-70">
          {busy ? 'Sending...' : 'Resend verification email'}
        </button>
        {note.text && <span className={`basis-full text-xs ${note.tone === 'err' ? 'text-red-700' : 'text-primary'}`} aria-live="polite">{note.text}</span>}
      </div>
    </div>
  );
}

export default VerifyEmailBanner;
