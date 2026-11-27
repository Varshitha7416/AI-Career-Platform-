import { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';

export const inputClass = 'focus-ring w-full bg-white border border-sage/50 rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 disabled:bg-mint/40 disabled:text-ink/60';
export const btnPrimary = 'focus-ring inline-flex items-center justify-center gap-2 min-h-10 px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed';
export const btnGhost = 'focus-ring inline-flex items-center justify-center gap-1.5 min-h-10 px-4 py-2 rounded-xl text-sm font-medium border border-sage/60 text-primary hover:bg-mint transition disabled:opacity-50 disabled:cursor-not-allowed';

// Pulls the field-level `errors` map and a message out of an axios error (server contract: {message, code, errors}).
export function parseApiError(err, fallback) {
  const data = err?.response?.data || {};
  return { errors: data.errors && typeof data.errors === 'object' ? data.errors : {}, code: data.code || '', message: getErrorMessage(err, fallback) };
}

/**
 * Per-section draft state. `toDraft(user)` builds editable state from the server user, `toPayload(draft)` the partial
 * PUT /auth/profile body. After a successful save the draft is rebuilt from the server response.
 */
export function useSectionForm(user, toDraft, toPayload, onSaved) {
  const [draft, setDraft] = useState(() => toDraft(user));
  const [base, setBase] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [errors, setErrors] = useState({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);

  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); setStatus(null); };
  const reset = () => { setDraft(base); setErrors({}); setStatus(null); };

  const save = async (extra) => {
    setSaving(true);
    setStatus(null);
    setErrors({});
    try {
      const res = await axiosClient.put('/auth/profile', { ...toPayload(draft), ...(extra || {}) });
      const next = toDraft(res.data.user);
      setDraft(next);
      setBase(next);
      setStatus({ type: 'success', text: 'Saved' });
      if (onSaved) onSaved(res.data);
      return res.data;
    } catch (err) {
      const p = parseApiError(err, 'Could not save. Please try again.');
      setErrors(p.errors);
      setStatus({ type: 'error', text: p.message, code: p.code });
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { draft, set, setDraft, dirty, saving, status, setStatus, errors, setErrors, save, reset };
}

