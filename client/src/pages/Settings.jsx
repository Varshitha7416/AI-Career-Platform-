import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import useTheme from '../hooks/useTheme';
import { updateStoredUser, getUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';
import { Skeleton, ErrorMessage, SuccessMessage } from '../components/Feedback';
import { CheckIcon } from '../components/Icons';
import AccountDataSection from '../components/account/AccountDataSection';
import SecuritySection from '../components/account/SecuritySection';
import PrivacyNotice from '../components/account/PrivacyNotice';

const THEMES = [
  { value: 'light', label: 'Light', hint: 'Bright cream and mint surfaces' },
  { value: 'dark', label: 'Dark', hint: 'Deep forest greens, easier at night' },
  { value: 'system', label: 'System', hint: 'Match your device setting' },
];

const PREFS = [
  { key: 'applications', label: 'Applications', hint: 'When an application is added or its status changes' },
  { key: 'interviews', label: 'Interviews', hint: 'When an interview is scheduled, rescheduled or cancelled' },
  { key: 'referrals', label: 'Referrals', hint: 'When someone requests a referral or answers yours' },
  { key: 'programs', label: 'Career programs', hint: 'When you save, start or complete a program' },
  { key: 'reminders', label: 'Reminders', hint: 'Reminders about interviews, applications and follow-ups' },
  { key: 'support', label: 'Support replies', hint: 'When the CareerNest team replies to your contact request' },
];
const DEFAULT_PREFS = Object.fromEntries(PREFS.map((p) => [p.key, true]));

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`focus-ring relative w-11 h-6 rounded-full transition shrink-0 disabled:opacity-50 ${checked ? 'bg-accent' : 'bg-sage/50'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <section className="bg-white rounded-2xl border border-sage/30 shadow-sm p-6">
      <h2 className="font-display text-xl font-bold text-primary">{title}</h2>
      {subtitle && <p className="text-sm text-ink/65 mt-1">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Settings() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [unread, setUnread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [me, notes] = await Promise.all([
        axiosClient.get('/auth/me'),
        axiosClient.get('/notifications', { params: { limit: 1 } }).catch(() => null),
      ]);
      setUser(me.data.user);
      setPrefs({ ...DEFAULT_PREFS, ...(me.data.user.notificationPrefs || {}) });
      setUnread(notes ? notes.data.unreadCount : null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on mount
    load();
  }, [load]);

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const changePref = async (key, value) => {
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next); // optimistic
    setSavingKey(key);
    setFeedback(null);
    try {
      const res = await axiosClient.put('/auth/profile', { notificationPrefs: { [key]: value } });
      setPrefs({ ...DEFAULT_PREFS, ...(res.data.user.notificationPrefs || {}) });
      updateStoredUser({ ...(getUser() || {}), ...res.data.user, resumeSummary: undefined });
      setFeedback({ type: 'success', text: 'Notification preferences saved.' });
    } catch (err) {
      setPrefs(previous);
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not save your preferences') });
    } finally {
      setSavingKey(null);
    }
  };

  const markAllRead = async () => {
    setFeedback(null);
    try {
      await axiosClient.put('/notifications/read-all');
      setUnread(0);
      setFeedback({ type: 'success', text: 'All notifications marked as read.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not update notifications') });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-primary">Settings</h1>
        <p className="text-ink/70 mt-1">Choose how CareerNest looks and which updates you want to see.</p>
      </header>

      <div className="space-y-3 mb-4">
        {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
        {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
        {error && <ErrorMessage message={error} onRetry={load} />}
      </div>

      <div className="space-y-5">
        <Card title="Appearance" subtitle={`Currently showing the ${resolvedTheme} theme. Your choice is remembered on this device.`}>
          <div role="radiogroup" aria-label="Theme" className="grid sm:grid-cols-3 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={theme === t.value}
                onClick={() => setTheme(t.value)}
                className={`focus-ring text-left rounded-xl border p-4 transition ${theme === t.value ? 'border-accent bg-mint' : 'border-sage/50 hover:bg-mint/60'}`}
              >
                <span className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{t.label}</span>
                  <span
                    aria-hidden="true"
                    data-selected={theme === t.value}
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={theme === t.value ? { background: '#235347', borderColor: '#235347', color: '#FFFFFF' } : { borderColor: '#8EB69B' }}
                  >
                    {theme === t.value && <CheckIcon size={12} strokeWidth={3} />}
                  </span>
                </span>
                <span className="block text-xs text-ink/65 mt-1">{t.hint}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Notifications" subtitle="In-app notifications appear under the bell in the top bar.">
          {loading ? (
            <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : (
            <ul className="divide-y divide-sage/30">
              {PREFS.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium text-ink">{p.label}</p>
                    <p className="text-sm text-ink/65">{p.hint}</p>
                  </div>
                  <Toggle checked={Boolean(prefs[p.key])} onChange={(v) => changePref(p.key, v)} label={`${p.label} notifications`} disabled={savingKey === p.key} />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 pt-4 border-t border-sage/30 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink/70">{unread === null ? 'Notification status unavailable.' : unread === 0 ? 'You have no unread notifications.' : `You have ${unread} unread notification${unread === 1 ? '' : 's'}.`}</p>
            <button type="button" onClick={markAllRead} disabled={!unread} className="focus-ring border border-sage text-primary rounded-xl px-4 py-2 text-sm hover:bg-mint transition disabled:opacity-40">Mark all as read</button>
          </div>
        </Card>

        <Card title="Account" subtitle="Your sign-in email and profile. Names, career interests, resumes and job preferences are edited on your profile.">
          {loading ? <Skeleton className="h-16" /> : user && (
            <dl className="text-sm grid sm:grid-cols-2 gap-4">
              <div><dt className="text-ink/60">Name</dt><dd className="font-medium text-ink">{user.name}</dd></div>
              <div><dt className="text-ink/60">Email</dt><dd className="font-medium text-ink break-all">{user.email}</dd></div>
              <div><dt className="text-ink/60">Email status</dt><dd className="font-medium text-ink">{user.emailVerified ? 'Verified' : 'Not verified'}</dd></div>
            </dl>
          )}
          <Link to="/profile" className="focus-ring inline-block mt-4 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-dark transition">Edit profile</Link>
        </Card>

        <Card title="Security" subtitle="Verify your email and keep your password up to date.">
          {loading ? <Skeleton className="h-24" /> : user && <SecuritySection user={user} onVerifiedChange={(v) => setUser((u) => ({ ...u, emailVerified: v }))} />}
        </Card>

        <Card title="Your data and privacy" subtitle="Export your data, end all sessions, or close your account.">
          <AccountDataSection />
          <PrivacyNotice />
        </Card>
      </div>
    </div>
  );
}

export default Settings;
