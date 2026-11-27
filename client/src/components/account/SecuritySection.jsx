import { useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { setSession, getUser } from '../../utils/auth';
import { getErrorMessage } from '../../utils/errors';
import { ErrorMessage, SuccessMessage } from '../Feedback';

const inputCls = 'focus-ring w-full rounded-xl border border-sage/60 bg-white text-ink px-3 py-2 text-sm';
const btn = 'focus-ring border border-sage text-primary rounded-xl px-4 py-2 text-sm hover:bg-mint transition disabled:opacity-40';

// Email verification status (+ resend) and change password. Both are enforced by the API; this only shows the outcome.
export default function SecuritySection({ user, onVerifiedChange }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [pw, setPw] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mail, setMail] = useState(null);
  const [sending, setSending] = useState(false);

  const resend = async () => {
    setSending(true);
    setMail(null);
    try {
      const r = await axiosClient.post('/auth/verification/resend');
      if (r.data?.alreadyVerified) onVerifiedChange?.(true);
      setMail({ type: 'success', text: r.data?.message || 'We have sent a new verification link.' });
    } catch (err) {
      // 429 carries the cooldown / hourly budget message; 503 means email delivery is not available right now
      setMail({ type: 'error', text: getErrorMessage(err, 'We could not send a verification email. Please try again later.') });
    } finally {
      setSending(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (saving) return;
    setFieldErrors({});
    setPw(null);
    if (!current || !next) {
      setFieldErrors({ currentPassword: current ? '' : 'Enter your current password', newPassword: next ? '' : 'Enter a new password' });
      return;
    }
    setSaving(true);
    try {
      const res = await axiosClient.put('/auth/profile', { currentPassword: current, newPassword: next });
      // Older tokens are retired by the server; it returns a fresh one so THIS session continues (other devices must log in again).
      if (res.data.token) {
        const stored = { ...(getUser() || {}), ...res.data.user };
        delete stored.resumeSummary;
        setSession(res.data.token, stored);
      }
      setCurrent('');
      setNext('');
      setPw({ type: 'success', text: 'Password updated. You stay signed in here; your other devices and sessions will need to sign in again.' });
    } catch (err) {
      setFieldErrors(err.response?.data?.errors || {});
      setPw({ type: 'error', text: getErrorMessage(err, 'Could not update your password') });
    } finally {
      setSaving(false);
    }
  };

  const verified = user?.emailVerified === true;
  return (
    <div className="divide-y divide-sage/30">
      <div className="pb-4">
        <h3 className="font-semibold text-ink">Email verification</h3>
        <p className="text-sm mt-1 text-ink/70" data-testid="verification-status">
          {verified ? 'Your email address is verified.' : 'Your email address is not verified yet. Verification is optional: everything works without it. Verifying proves the address is yours.'}
        </p>
        {!verified && (
          <div className="mt-3">
            <button type="button" onClick={resend} disabled={sending} className={btn}>{sending ? 'Sending...' : 'Resend verification email'}</button>
            <div className="mt-3" aria-live="polite">
              {mail?.type === 'success' && <SuccessMessage message={mail.text} />}
              {mail?.type === 'error' && <ErrorMessage message={mail.text} />}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={changePassword} className="pt-4 space-y-3 max-w-md" aria-label="Change password">
        <h3 className="font-semibold text-ink">Change password</h3>
        {pw?.type === 'success' && <SuccessMessage message={pw.text} />}
        {pw?.type === 'error' && <ErrorMessage message={pw.text} />}
        <div>
          <label htmlFor="pw-current" className="block text-sm font-medium text-ink mb-1">Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} aria-invalid={Boolean(fieldErrors.currentPassword)} />
          {fieldErrors.currentPassword && <p className="text-xs text-red-700 dark:text-red-300 mt-1">{fieldErrors.currentPassword}</p>}
        </div>
        <div>
          <label htmlFor="pw-new" className="block text-sm font-medium text-ink mb-1">New password</label>
          <input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} aria-invalid={Boolean(fieldErrors.newPassword)} />
          {fieldErrors.newPassword && <p className="text-xs text-red-700 dark:text-red-300 mt-1">{fieldErrors.newPassword}</p>}
        </div>
        <button type="submit" disabled={saving} className="focus-ring bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">{saving ? 'Updating...' : 'Update password'}</button>
        <p className="text-xs text-ink/65">Forgot your current password? Sign out and use <Link to="/forgot-password" className="text-primary underline">Forgot password</Link> on the login page.</p>
      </form>
    </div>
  );
}
