import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getUser, isLoggedIn, updateStoredUser } from '../utils/auth';
import AuthShell from '../components/auth/AuthShell';
import { TextField, SubmitButton, Banner } from '../components/auth/AuthFields';
import { CheckSmallIcon, AlertIcon, MailIcon } from '../components/auth/authIcons';
import { emailError } from '../components/auth/authRules';
import { getInitialVerifyToken, clearInitialVerifyToken, stripFragment } from '../utils/verifyToken';

// Public page for the emailed link /verify-email#token=<token> (token handling: utils/verifyToken.js). The token is used once,
// kept in memory only and never rendered. Outcomes: success | used | expired | invalid | missing | error.
const COPY = {
  used: { title: 'Link already used', text: 'This verification link was already used. If you verified your email, you can simply log in. Otherwise request a new link.' },
  expired: { title: 'Link expired', text: 'This verification link has expired. Request a new one and use the newest email we send.' },
  invalid: { title: 'Link not valid', text: 'This verification link is invalid or was replaced by a newer one. Request a new link and use the newest email we send.' },
  missing: { title: 'No verification link found', text: 'Open the link from your verification email, or request a new one below.' },
  error: { title: 'Something went wrong', text: 'We could not verify your email right now. Please try the link again in a moment, or request a new one.' },
};

function VerifyEmail() {
  const [token] = useState(getInitialVerifyToken); // early handoff, else the live fragment (kept in memory only)
  const [status, setStatus] = useState(token ? 'working' : 'missing'); // working | success | used | expired | invalid | missing | error
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState('error');
  const [loading, setLoading] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    document.title = 'Verify email | CareerNest';
    return () => { document.title = 'CareerNest'; };
  }, []);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; the one-time link must be spent once
    started.current = true;
    stripFragment(window);
    clearInitialVerifyToken();
    if (!token) return;
    axiosClient.post('/auth/verify-email', { token })
      .then(() => {
        const u = getUser();
        if (isLoggedIn() && u) updateStoredUser({ ...u, emailVerified: true });
        window.dispatchEvent(new Event('careernest:email-verified'));
        setStatus('success');
      })
      .catch((err) => {
        const code = err?.response?.data?.code;
        if (code === 'VERIFICATION_LINK_USED') setStatus('used');
        else if (code === 'VERIFICATION_LINK_EXPIRED') setStatus('expired');
        else if (code === 'INVALID_VERIFICATION_TOKEN') setStatus('invalid');
        else setStatus('error');
      });
  }, [token]);

  const resendForLoggedIn = async () => {
    setLoading(true); setBanner('');
    try {
      const r = await axiosClient.post('/auth/verification/resend');
      setBannerTone('success'); setBanner(r.data?.message || 'We have sent a new verification link.');
    } catch (err) {
      setBannerTone('error'); setBanner(err?.response?.data?.message || 'We could not send a new link. Please try again later.');
    } finally { setLoading(false); }
  };

  const requestByEmail = async (e) => {
    e.preventDefault();
    if (loading) return;
    const msg = emailError(email);
    setEmailErr(msg || '');
    if (msg) return;
    setLoading(true); setBanner('');
    try {
      const r = await axiosClient.post('/auth/verification/request', { email: email.trim() });
      setBannerTone('success'); setBanner(r.data?.message || 'Request received.');
    } catch (err) {
      setBannerTone('error'); setBanner(err?.response?.data?.message || 'We could not process your request. Please try again.');
    } finally { setLoading(false); }
  };

  if (status === 'working') {
    return (
      <AuthShell title="Verifying your email" subtitle="One moment...">
        <p role="status" className="text-sm text-ink/70" data-testid="verify-working">Checking your verification link&hellip;</p>
      </AuthShell>
    );
  }

  if (status === 'success') {
    return (
      <AuthShell title="Email verified" subtitle="Your email address is confirmed.">
        <div role="status" className="rounded-2xl bg-mint/70 px-5 py-5 text-primary" data-testid="verify-success">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white"><CheckSmallIcon size={20} /></span>
          <h2 className="mt-3 font-display text-xl font-semibold">Thank you, you are verified</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink">Applying to jobs, referrals and the AI tools are now unlocked.</p>
          <Link to={isLoggedIn() ? '/home' : '/login'} className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
            {isLoggedIn() ? 'Continue to CareerNest' : 'Log in'}
          </Link>
        </div>
      </AuthShell>
    );
  }

  const c = COPY[status] || COPY.error;
  return (
    <AuthShell title={c.title} subtitle="Email verification">
      <div role="alert" className="rounded-2xl bg-red-50 px-5 py-5 text-red-700" data-testid={`verify-${status}`}>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700"><AlertIcon size={20} /></span>
        <h2 className="mt-3 font-display text-xl font-semibold">{c.title}</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed">{c.text}</p>
      </div>
      <div className="mt-6">
        <Banner tone={bannerTone}>{banner}</Banner>
        {isLoggedIn() ? (
          <button type="button" onClick={resendForLoggedIn} disabled={loading} className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-70">
            {loading ? 'Sending...' : 'Send me a new verification email'}
          </button>
        ) : (
          <form onSubmit={requestByEmail} noValidate aria-label="Request a new verification email" className="flex flex-col gap-4">
            <TextField id="verify-email-address" label="Email address" icon={MailIcon} type="email" name="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailErr(''); }} error={emailErr} disabled={loading} required />
            <SubmitButton loading={loading} loadingText="Sending...">Send a new verification email</SubmitButton>
          </form>
        )}
        <p className="mt-6 text-sm text-gray-600">
          <Link to="/login" className="focus-ring inline-flex min-h-10 items-center font-semibold text-primary hover:underline">Back to login</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default VerifyEmail;
