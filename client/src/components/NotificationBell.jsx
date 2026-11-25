import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { BellIcon, BriefcaseIcon, CalendarIcon, UsersIcon, InfoIcon, CheckIcon } from './Icons';

const POLL_MS = 60000;
// Other pages can call window.dispatchEvent(new Event('careernest:notifications-changed')) to refresh the bell.
const NOTIFICATIONS_CHANGED_EVENT = 'careernest:notifications-changed';

const TYPE_ICON = { application: BriefcaseIcon, interview: CalendarIcon, referral: UsersIcon, system: InfoIcon };

function relativeTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(diff)) return '';
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ok | error
  const unavailable = useRef(false); // endpoint missing (404): stop polling
  const wrapRef = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus('loading');
    try {
      const res = await axiosClient.get('/notifications', { params: { limit: 10 } });
      setItems(res.data.notifications || []);
      setUnread(res.data.unreadCount || 0);
      setStatus('ok');
      unavailable.current = false;
    } catch (err) {
      unavailable.current = err.response?.status === 404;
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on mount
    load();
    const poll = setInterval(() => { if (!unavailable.current) load({ silent: true }); }, POLL_MS);
    const refresh = () => { if (!unavailable.current) load({ silent: true }); };
    window.addEventListener('focus', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      clearInterval(poll);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [load]);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load({ silent: items.length > 0 });
  };

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      axiosClient.put(`/notifications/${n._id}/read`).catch(() => load({ silent: true }));
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    const before = { items, unread };
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try {
      await axiosClient.put('/notifications/read-all');
    } catch {
      setItems(before.items);
      setUnread(before.unread);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        data-testid="bell"
        className="focus-ring relative w-10 h-10 rounded-full flex items-center justify-center text-ink/80 hover:bg-mint hover:text-primary transition"
      >
        <BellIcon size={20} />
        {unread > 0 && (
          <span data-testid="bell-badge" className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-[#B42318] text-white text-[10px] font-bold leading-4 text-center ring-2 ring-white dark:ring-[#0B2B26]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          data-testid="bell-panel"
          className="fixed left-2 right-2 top-[68px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem] z-[70] bg-white border border-sage/40 rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-sage/30">
            <h2 className="font-semibold text-ink">Notifications</h2>
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0}
              className="focus-ring text-xs text-primary underline disabled:opacity-40 disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {status === 'loading' && items.length === 0 && (
              <div className="p-4 space-y-3" aria-label="Loading notifications">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3"><div className="w-9 h-9 rounded-full bg-sage/30 animate-pulse" /><div className="flex-1 space-y-2"><div className="h-3 w-2/3 rounded bg-sage/30 animate-pulse" /><div className="h-3 w-full rounded bg-sage/20 animate-pulse" /></div></div>
                ))}
              </div>
            )}

            {status === 'error' && (
              <div className="p-6 text-center text-sm text-ink/70">
                <p>Notifications are unavailable right now.</p>
                <button type="button" onClick={() => load()} className="focus-ring mt-2 text-primary underline">Try again</button>
              </div>
            )}

            {status === 'ok' && items.length === 0 && (
              <div className="p-8 text-center text-sm text-ink/70">
                <span className="mx-auto mb-2 w-10 h-10 rounded-full bg-mint text-primary flex items-center justify-center"><CheckIcon size={18} /></span>
                You&apos;re all caught up.
              </div>
            )}

            {status !== 'error' && items.length > 0 && (
              <ul>
                {items.map((n) => {
                  const Icon = TYPE_ICON[n.type] || InfoIcon;
                  return (
                    <li key={n._id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        data-testid="bell-item"
                        data-read={n.read ? 'true' : 'false'}
                        className={`focus-ring w-full text-left flex gap-3 px-4 py-3 border-b border-sage/20 last:border-0 hover:bg-mint transition ${n.read ? '' : 'bg-mint/50'}`}
                      >
                        <span className="w-9 h-9 shrink-0 rounded-full bg-mint text-primary flex items-center justify-center"><Icon size={17} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className={`text-sm text-ink ${n.read ? '' : 'font-semibold'}`}>{n.title}</span>
                            {!n.read && <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                          </span>
                          {n.message && <span className="block text-xs text-ink/70 mt-0.5 line-clamp-2">{n.message}</span>}
                          <span className="block text-[11px] text-ink/50 mt-1">{relativeTime(n.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
