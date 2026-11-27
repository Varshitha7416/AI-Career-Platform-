import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { categoryLabel, statusLabel, deliveryLabel, formatDate } from '../utils/support';
import { getUser } from '../utils/auth';
import { AdminPage, inputClass, btnPrimary, btnGhost } from '../components/admin/AdminNav';
import { Skeleton, ErrorMessage, SuccessMessage } from '../components/Feedback';
import StatusPill from '../components/StatusPill';

function AdminSupportDetail() {
  const { id } = useParams();
  const me = getUser();
  const [state, setState] = useState({ loading: true, error: '', ticket: null, transitions: [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ error: '', ok: '' });
  const [reply, setReply] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    axiosClient.get(`/admin/support/${id}`)
      .then((r) => { if (alive) setState({ loading: false, error: '', ticket: r.data.ticket, transitions: r.data.transitions }); })
      .catch((err) => { if (alive) setState({ loading: false, error: getErrorMessage(err), ticket: null, transitions: [] }); });
    return () => { alive = false; };
  }, [id]);

  const run = async (fn, okText) => {
    setBusy(true);
    setMsg({ error: '', ok: '' });
    try {
      const r = await fn();
      setState((s) => ({ ...s, ticket: r.data.ticket, transitions: r.data.transitions || s.transitions }));
      setMsg({ error: '', ok: typeof okText === 'function' ? okText(r.data) : okText });
      return true;
    } catch (err) {
      setMsg({ error: getErrorMessage(err), ok: '' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  // The allowed-transitions list is returned by GET and PUT status; other calls keep the previous value.
  const changeStatus = (status) => run(() => axiosClient.put(`/admin/support/${id}/status`, { status }), `Status changed to ${statusLabel(status)}.`);
  const assign = (assignee) => run(() => axiosClient.put(`/admin/support/${id}/assignee`, { assignee }), 'Assignee updated.');
  const addNote = async () => { if (await run(() => axiosClient.post(`/admin/support/${id}/notes`, { text: note }), 'Internal note added.')) setNote(''); };
  const sendReply = async () => {
    const ok = await run(
      () => axiosClient.post(`/admin/support/${id}/responses`, { text: reply, sendEmail }),
      (d) => `Reply saved in the user's CareerNest inbox. ${deliveryLabel(d.emailDelivery)}.`,
    );
    if (ok) {
      setReply('');
      // moving open -> in-progress happens server side: refresh the allowed transitions
      axiosClient.get(`/admin/support/${id}`).then((r) => setState((s) => ({ ...s, transitions: r.data.transitions }))).catch(() => {});
    }
  };

  const t = state.ticket;
  return (
    <AdminPage title="Support request" actions={<Link to="/admin/support" className={btnGhost}>Back to inbox</Link>}>
      {state.loading ? <Skeleton className="h-64 w-full" /> : state.error ? <ErrorMessage message={state.error} /> : (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <article className="bg-white rounded-2xl border border-sage/30 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-primary break-words">{t.subject}</h2>
                <StatusPill status={t.status} />
              </div>
              <p className="text-xs text-ink/60 mt-1">{t.user?.name}{t.user?.email ? ` (${t.user.email})` : ''} · {categoryLabel(t.category)} · {formatDate(t.createdAt)}</p>
              <p className="mt-4 text-sm text-ink whitespace-pre-wrap break-words">{t.message}</p>
            </article>

            {t.responses.map((r) => (
              <div key={r.id} className="rounded-xl bg-mint border border-sage/40 p-4">
                <p className="text-xs font-semibold text-primary mb-1">Public reply by {r.author?.name || 'admin'} · {formatDate(r.at)}</p>
                <p className="text-sm text-ink whitespace-pre-wrap break-words">{r.text}</p>
                <p className="text-xs text-ink/60 mt-2">{deliveryLabel(r.emailDelivery)}</p>
              </div>
            ))}

            <section className="bg-white rounded-2xl border border-sage/30 p-5" aria-label="Reply to user">
              <h3 className="font-semibold text-primary">Reply to the user</h3>
              <p className="text-xs text-ink/60 mb-2">Visible to the user. Saved in their CareerNest inbox and sent as a notification.</p>
              {t.status === 'closed' ? <p className="text-sm text-ink/70">This request is closed and cannot receive replies.</p> : t.anonymized ? <p className="text-sm text-ink/70">The account was deleted; replies cannot be delivered.</p> : (
                <>
                  <textarea rows={5} maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply text" className={inputClass} />
                  <label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> Also try to send an email copy (delivery is not guaranteed)</label>
                  <button type="button" disabled={busy || !reply.trim()} onClick={sendReply} className={`${btnPrimary} mt-3`}>Send reply</button>
                </>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="bg-white rounded-2xl border border-sage/30 p-5">
              <h3 className="font-semibold text-primary mb-2">Status</h3>
              <div className="flex flex-wrap gap-2">
                {state.transitions.length === 0 && <p className="text-sm text-ink/70">Closed requests cannot be changed.</p>}
                {state.transitions.map((s) => <button key={s} type="button" disabled={busy} onClick={() => changeStatus(s)} className={btnGhost}>{s === 'open' && t.status !== 'open' ? 'Reopen' : `Mark ${statusLabel(s).toLowerCase()}`}</button>)}
              </div>
              <h3 className="font-semibold text-primary mt-5 mb-2">Assignee</h3>
              <p className="text-sm text-ink/80 mb-2">{t.assignee ? t.assignee.name : 'Unassigned'}</p>
              <div className="flex flex-wrap gap-2">
                {me?.id && t.assignee?.id !== me.id && <button type="button" disabled={busy} onClick={() => assign(me.id)} className={btnGhost}>Assign to me</button>}
                {t.assignee && <button type="button" disabled={busy} onClick={() => assign(null)} className={btnGhost}>Unassign</button>}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-amber-300 p-5" aria-label="Internal notes">
              <h3 className="font-semibold text-primary">Internal notes</h3>
              <p className="text-xs text-ink/60 mb-2">Admins only. Never shown to the user or included in emails.</p>
              <ul className="space-y-2 mb-3">
                {t.internalNotes.map((n) => <li key={n.id} className="text-sm bg-amber-50 text-gray-900 rounded-lg p-2 break-words"><span className="block text-xs text-gray-600">{n.author?.name || 'admin'} · {formatDate(n.at)}</span>{n.text}</li>)}
              </ul>
              <textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Internal note" className={inputClass} />
              <button type="button" disabled={busy || !note.trim()} onClick={addNote} className={`${btnGhost} mt-2`}>Add note</button>
            </section>
          </aside>
        </div>
      )}
      <div className="mt-4" aria-live="polite">
        {msg.error && <ErrorMessage message={msg.error} />}
        {msg.ok && <SuccessMessage message={msg.ok} />}
      </div>
    </AdminPage>
  );
}

export default AdminSupportDetail;
