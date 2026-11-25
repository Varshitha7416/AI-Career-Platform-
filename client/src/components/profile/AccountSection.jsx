import { useState, useId } from 'react';
import axiosClient from '../../api/axiosClient';
import { setSession } from '../../utils/auth';
import { UserIcon } from '../Icons';
import { SectionCard, TextField, Field } from './ui';
import { inputClass, btnPrimary, useSectionForm, parseApiError } from './formKit';

function PasswordInput({ label, value, onChange, error, autoComplete }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={error} htmlFor={id}>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} className={`${inputClass} pr-20 ${error ? 'border-red-400' : ''}`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} className="focus-ring absolute right-0.5 top-1/2 -translate-y-1/2 min-h-10 min-w-11 px-3 text-xs font-medium text-primary rounded-lg hover:bg-mint">
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </Field>
  );
}

function AccountSection({ user, onSaved }) {
  const form = useSectionForm(user, (u) => ({ name: u.name || '' }), (d) => ({ name: d.name }), onSaved);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwErrors, setPwErrors] = useState({});
  const [pwStatus, setPwStatus] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);

  const changePassword = async () => {
    setPwErrors({});
    setPwStatus(null);
    if (!current || !next) {
      setPwErrors({ currentPassword: current ? '' : 'Enter your current password', newPassword: next ? '' : 'Enter a new password' });
      return;
    }
    setPwSaving(true);
    try {
      const res = await axiosClient.put('/auth/profile', { currentPassword: current, newPassword: next });
      // The server retires older tokens on a password change and returns a fresh one so this session continues.
      if (res.data.token) {
        const stored = { ...res.data.user };
        delete stored.resumeSummary;
        setSession(res.data.token, stored);
      }
      setCurrent('');
      setNext('');
      setPwStatus({ type: 'success', text: 'Password updated. Your other sessions will need to sign in again.' });
    } catch (err) {
      const p = parseApiError(err, 'Could not update your password.');
      setPwErrors(p.errors);
      setPwStatus({ type: 'error', text: p.message });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <SectionCard id="account" icon={UserIcon} title="Account Information" subtitle="Manage your basic account details and security settings." form={form}>
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField label="Full name" required value={form.draft.name} onChange={(v) => form.set({ name: v })} error={form.errors.name} maxLength={80} autoComplete="name" />
        <TextField label="Email address" value={user.email} onChange={() => {}} disabled hint="Your email cannot be changed." />
      </div>

      <div className="mt-6 pt-5 border-t border-sage/25">
        <h3 className="text-sm font-semibold text-ink">Change password</h3>
        <p className="text-xs text-ink/55 mt-0.5 mb-3">Use 8 or more characters with at least one letter and one number.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <PasswordInput label="Current password" value={current} onChange={setCurrent} error={pwErrors.currentPassword} autoComplete="current-password" />
          <PasswordInput label="New password" value={next} onChange={setNext} error={pwErrors.newPassword} autoComplete="new-password" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={changePassword} disabled={pwSaving} className={btnPrimary}>{pwSaving ? 'Updating...' : 'Update password'}</button>
          {pwStatus && <p role={pwStatus.type === 'error' ? 'alert' : 'status'} className={`text-sm ${pwStatus.type === 'error' ? 'text-red-600' : 'text-accent'}`}>{pwStatus.text}</p>}
        </div>
      </div>
    </SectionCard>
  );
}

export default AccountSection;
