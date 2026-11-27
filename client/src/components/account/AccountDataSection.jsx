import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { clearSession } from '../../utils/auth';
import { getErrorMessage } from '../../utils/errors';
import { ErrorMessage, SuccessMessage } from '../Feedback';

const CONFIRM_WORD = 'DELETE';
const btn = 'focus-ring border border-sage text-primary rounded-xl px-4 py-2 text-sm hover:bg-mint transition disabled:opacity-40';
const inputCls = 'focus-ring w-full rounded-xl border border-sage/60 bg-white text-ink px-3 py-2 text-sm';

// Blob download of a JSON string; the filename carries the date (the server also names it, but a blob download needs its own).
function downloadJson(data) {
  const day = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `careernest-data-export-${day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Block({ title, children }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <h3 className="font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

// Export my data / Sign out everywhere / Delete account. Rendered inside a Settings card.
export default function AccountDataSection() {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [busyLogout, setBusyLogout] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [busyDelete, setBusyDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const exportData = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const res = await axiosClient.get('/account/export');
      downloadJson(res.data);
      setMessage({ type: 'success', text: 'Your data export has been downloaded.' });
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Could not export your data') });
    } finally {
      setExporting(false);
    }
  };

  const logoutAll = async () => {
    setBusyLogout(true);
    setMessage(null);
    try {
      await axiosClient.post('/account/logout-all');
      clearSession();
      navigate('/login', { replace: true, state: { accountNotice: 'signedOutEverywhere' } });
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Could not sign you out of all devices') });
      setBusyLogout(false);
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    if (busyDelete) return;
    setBusyDelete(true);
    setDeleteError('');
    try {
      await axiosClient.post('/account/delete', { password, confirmation: typed });
      clearSession();
      navigate('/login', { replace: true, state: { accountNotice: 'deleted' } });
    } catch (err) {
      if (err.response?.data?.code === 'DELETION_INCOMPLETE') {
        // The account is already closed (old sessions no longer work), cleanup finishes on its own.
        clearSession();
        navigate('/login', { replace: true, state: { accountNotice: 'deletionPending' } });
        return;
      }
      setDeleteError(getErrorMessage(err, 'Could not delete your account'));
      setBusyDelete(false);
    }
  };

  const canDelete = password.length > 0 && typed.trim() === CONFIRM_WORD && !busyDelete;

  return (
    <div className="divide-y divide-sage/30">
      {message?.type === 'success' && <div className="pb-4"><SuccessMessage message={message.text} /></div>}
      {message?.type === 'error' && <div className="pb-4"><ErrorMessage message={message.text} /></div>}

      <Block title="Export my data">
        <p className="text-sm text-ink/65 mt-1">Download a JSON file with your profile, applications, saved jobs, resumes (including their extracted text), analyses, cover letters, roadmaps, notifications and more. It never includes your password or other people&apos;s contact details.</p>
        <button type="button" onClick={exportData} disabled={exporting} className={`${btn} mt-3`}>{exporting ? 'Preparing...' : 'Download my data'}</button>
      </Block>

      <Block title="Sign out everywhere">
        <p className="text-sm text-ink/65 mt-1">Ends your session on every device, including this one. You will need to log in again.</p>
        {!confirmingLogout ? (
          <button type="button" onClick={() => setConfirmingLogout(true)} className={`${btn} mt-3`}>Sign out of all devices</button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3" role="alertdialog" aria-label="Confirm sign out of all devices">
            <span className="text-sm text-ink">Sign out of all devices now?</span>
            <button type="button" onClick={logoutAll} disabled={busyLogout} className="focus-ring bg-primary text-white rounded-xl px-4 py-2 text-sm hover:bg-primary-dark transition disabled:opacity-50">{busyLogout ? 'Signing out...' : 'Yes, sign out everywhere'}</button>
            <button type="button" onClick={() => setConfirmingLogout(false)} disabled={busyLogout} className={btn}>Cancel</button>
          </div>
        )}
      </Block>

      <Block title="Delete account">
        <p className="text-sm text-ink/65 mt-1">This permanently closes your account. Your profile details are erased and your applications, saved jobs, resumes, analyses, cover letters, roadmaps, interviews, notifications and messages are deleted. Referral requests you were part of are closed; the other person keeps their own record, which shows &quot;Deleted user&quot;. You will be signed out everywhere and this cannot be undone. Consider exporting your data first.</p>
        {!deleting ? (
          <button type="button" onClick={() => setDeleting(true)} className="focus-ring mt-3 border border-red-600 text-red-700 dark:text-red-300 dark:border-red-400 rounded-xl px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition">Delete my account...</button>
        ) : (
          <form onSubmit={deleteAccount} className="mt-3 space-y-3 max-w-md" aria-label="Delete account">
            {deleteError && <ErrorMessage message={deleteError} />}
            <div>
              <label htmlFor="del-password" className="block text-sm font-medium text-ink mb-1">Your password</label>
              <input id="del-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="del-confirm" className="block text-sm font-medium text-ink mb-1">Type {CONFIRM_WORD} to confirm</label>
              <input id="del-confirm" type="text" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={!canDelete} className="focus-ring bg-red-700 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-red-800 transition disabled:opacity-40">{busyDelete ? 'Deleting...' : 'Permanently delete my account'}</button>
              <button type="button" onClick={() => { setDeleting(false); setPassword(''); setTyped(''); setDeleteError(''); }} disabled={busyDelete} className={btn}>Cancel</button>
            </div>
          </form>
        )}
      </Block>
    </div>
  );
}
