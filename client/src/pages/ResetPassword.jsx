import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { clearSession } from '../utils/auth';
import AuthShell from '../components/auth/AuthShell';
import { PasswordField, PasswordStrength, SubmitButton, Banner } from '../components/auth/AuthFields';
import { LockIcon, CheckSmallIcon, AlertIcon } from '../components/auth/authIcons';
import { passwordError, describeAuthFailure } from '../components/auth/authRules';
import { getInitialToken, clearInitialToken, parseTokenFromHash, stripFragment } from '../utils/resetToken';

// The emailed link is /reset-password#token=<token>. index.html's inline script already moved the token out of the address bar
// before the bundle loaded (handoff and its documented platform limits: utils/resetToken.js). The token lives in component
// memory only: never localStorage/sessionStorage, never rendered, never logged.

function ResetPassword() {
  const [token, setToken] = useState(getInitialToken); // lazy initializer: early handoff, else the live fragment
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(token ? 'form' : 'invalid'); // form | success | invalid | interrupted
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Reset password | CareerNest';
    // Normally the inline script already removed the fragment; this covers the case where it did not run.
    const strip = () => stripFragment(window);
    strip();
    clearInitialToken(); // the token now lives only in component state
    // Opening a NEWER reset link in a tab that already shows this page only changes the #fragment: the browser fires
    // `hashchange` without reloading, so pick the new token up instead of staying stuck on the old state.
    const onHashChange = () => {
      const t = parseTokenFromHash(window.location.hash);
      if (!t) return;
      setToken(t); setPassword(''); setConfirm(''); setErrors({}); setBanner(''); setLoading(false); setStatus('form');
      strip();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => { window.removeEventListener('hashchange', onHashChange); document.title = 'CareerNest'; };
  }, []);

  useEffect(() => {
    if (status !== 'success') return undefined;
    const t = setTimeout(() => navigate('/login', { replace: true, state: { passwordReset: true } }), 2500);
    return () => clearTimeout(t);
  }, [status, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setBanner('');
    const next = {};
    const pwMsg = passwordError(password);
    if (pwMsg) next.password = pwMsg;
    if (!confirm) next.confirm = 'Please confirm your new password.';
    else if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (next.password) return passwordRef.current?.focus();
    if (next.confirm) return confirmRef.current?.focus();

    setLoading(true);
    try {
      await axiosClient.post('/auth/reset-password', { token, password, confirmPassword: confirm });
      // Clear everything sensitive. The old session (if any) was just revoked by the server, so drop it here too.
      setPassword(''); setConfirm(''); setToken('');
      clearSession();
      setStatus('success');
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'RESET_INTERRUPTED') {
        // The link was used up but the server could not confirm the password change: never retry with it.
        setToken(''); setPassword(''); setConfirm('');
        setStatus('interrupted');
      } else if (code === 'INVALID_RESET_TOKEN') {
        setToken(''); setPassword(''); setConfirm('');
        setStatus('invalid');
      } else {
        const failure = describeAuthFailure(err, 'We could not reset your password. Please try again.');
        const f = failure.fields || {};
        setErrors({ password: f.password, confirm: f.confirmPassword });
        setBanner(failure.banner);
      }
      setLoading(false);
    }
  };

  if (status === 'invalid') {
    return (
      <AuthShell title="This link can't be used" subtitle="Password reset links work once and expire after a short time.">
        <div role="alert" className="rounded-2xl bg-red-50 px-5 py-5 text-red-700" data-testid="reset-invalid">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700"><AlertIcon size={20} /></span>
          <h2 className="mt-3 font-display text-xl font-semibold">Invalid or expired link</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed">This password reset link is invalid or has expired. Request a new one and use the newest email we send.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/forgot-password" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
              Request a new link
            </Link>
            <Link to="/login" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-sage bg-white px-5 text-sm font-medium text-primary hover:bg-mint">
              Back to login
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (status === 'interrupted') {
    return (
      <AuthShell title="We could not confirm the change" subtitle="Your reset link has been used up.">
        <div role="alert" className="rounded-2xl bg-red-50 px-5 py-5 text-red-700" data-testid="reset-interrupted">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700"><AlertIcon size={20} /></span>
          <h2 className="mt-3 font-display text-xl font-semibold">Please check your password</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed">Something went wrong while saving your new password. Try logging in with the new password first. If that does not work, request a new reset link.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/login" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
              Try logging in
            </Link>
            <Link to="/forgot-password" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-sage bg-white px-5 text-sm font-medium text-primary hover:bg-mint">
              Request a new link
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (status === 'success') {
    return (
      <AuthShell title="Password updated" subtitle="You can now log in with your new password.">
        <div role="status" className="rounded-2xl bg-mint/70 px-5 py-5 text-primary" data-testid="reset-success">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white"><CheckSmallIcon size={20} /></span>
          <h2 className="mt-3 font-display text-xl font-semibold">Your password has been reset</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink">You were signed out on all devices. Taking you to the login page&hellip;</p>
          <Link to="/login" replace state={{ passwordReset: true }} className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
            Log in now
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick a strong password you have not used elsewhere.">
      <Banner tone="error">{banner}</Banner>
      <form onSubmit={handleSubmit} noValidate aria-label="Choose a new password" className="flex flex-col gap-4">
        <div>
          <PasswordField
            ref={passwordRef}
            id="reset-password"
            label="New password"
            icon={LockIcon}
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
            error={errors.password}
            describedBy="reset-password-rules"
            disabled={loading}
            required
          />
          <PasswordStrength id="reset-password-rules" password={password} name="" email="" />
        </div>
        <PasswordField
          ref={confirmRef}
          id="reset-confirm"
          label="Confirm new password"
          icon={LockIcon}
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
          error={errors.confirm}
          disabled={loading}
          required
        />
        <div className="mt-1">
          <SubmitButton loading={loading} loadingText="Saving password...">Reset password</SubmitButton>
        </div>
      </form>
      <p className="mt-6 text-sm text-gray-600">
        <Link to="/login" className="focus-ring inline-flex min-h-10 items-center font-semibold text-primary hover:underline">Back to login</Link>
      </p>
    </AuthShell>
  );
}

export default ResetPassword;
