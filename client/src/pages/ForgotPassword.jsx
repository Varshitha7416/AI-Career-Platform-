import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import AuthShell from '../components/auth/AuthShell';
import { TextField, SubmitButton, Banner } from '../components/auth/AuthFields';
import { MailIcon, CheckSmallIcon } from '../components/auth/authIcons';
import { emailError, describeAuthFailure } from '../components/auth/authRules';

// Public page. It never says whether an address is registered: after any accepted submission it shows the same message.
// It states that the request was ACCEPTED, never that an email was sent or delivered.
const SENT_MESSAGE = 'If an account exists for this email address, we will send password reset instructions shortly.';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    document.title = 'Forgot password | CareerNest';
    if (window.matchMedia?.('(min-width: 1024px)').matches) emailRef.current?.focus();
    return () => { document.title = 'CareerNest'; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setBanner('');
    const msg = emailError(email);
    setError(msg || '');
    if (msg) return emailRef.current?.focus();

    setLoading(true);
    try {
      await axiosClient.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      const failure = describeAuthFailure(err, 'We could not process your request. Please try again.');
      setError(failure.fields.email || '');
      setBanner(failure.banner);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email address you signed up with and we'll send you a link to choose a new one."
    >
      {sent ? (
        <div role="status" className="rounded-2xl bg-mint/70 px-5 py-5 text-primary" data-testid="forgot-sent">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white"><CheckSmallIcon size={20} /></span>
          <h2 className="mt-3 font-display text-xl font-semibold">Request received</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{SENT_MESSAGE}</p>
          <p className="mt-2 text-sm text-ink/70">The link works once and expires soon. Watch your inbox; if nothing arrives within a few minutes, check your spam folder or try again.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/login" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
              Back to login
            </Link>
            <button type="button" onClick={() => { setSent(false); setEmail(''); }} className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-sage px-5 text-sm font-medium text-primary hover:bg-white/60">
              Use a different email
            </button>
          </div>
        </div>
      ) : (
        <>
          <Banner tone="error">{banner}</Banner>
          <form onSubmit={handleSubmit} noValidate aria-label="Request a password reset link" className="flex flex-col gap-4">
            <TextField
              ref={emailRef}
              id="forgot-email"
              label="Email address"
              icon={MailIcon}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              error={error}
              disabled={loading}
              required
            />
            <div className="mt-1">
              <SubmitButton loading={loading} loadingText="Sending link...">Send reset link</SubmitButton>
            </div>
          </form>
          <p className="mt-6 text-sm text-gray-600">
            Remembered it?{' '}
            <Link to="/login" className="focus-ring inline-flex min-h-10 items-center font-semibold text-primary hover:underline">Back to login</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

export default ForgotPassword;
