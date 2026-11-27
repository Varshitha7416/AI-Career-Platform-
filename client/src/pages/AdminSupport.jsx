import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { CATEGORIES, STATUSES, categoryLabel, statusLabel, formatDate } from '../utils/support';
import { AdminPage, inputClass } from '../components/admin/AdminNav';
import { Skeleton, ErrorMessage, EmptyState } from '../components/Feedback';
import Pagination from '../components/Pagination';
import StatusPill from '../components/StatusPill';

function AdminSupport() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const status = params.get('status') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const page = Math.max(1, parseInt(params.get('page'), 10) || 1);
  const [search, setSearch] = useState(q);
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [counts, setCounts] = useState(null);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: '1', ...patch }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  useEffect(() => {
    let alive = true;
    axiosClient.get('/admin/support', { params: { q: q || undefined, status: status || undefined, category: category || undefined, sort, page, limit: 20 } })
      .then((r) => { if (alive) setState({ loading: false, error: '', data: r.data }); })
      .catch((err) => { if (alive) setState({ loading: false, error: getErrorMessage(err), data: null }); });
    axiosClient.get('/admin/support/counts').then((r) => { if (alive) setCounts(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [q, status, category, sort, page]);

  return (
    <AdminPage title="Support inbox" subtitle="Requests sent through Contact Us. Replies are saved in the user's CareerNest inbox.">
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5" aria-label="Support counts">
          {[['Unread', counts.unread], ...STATUSES.map((s) => [statusLabel(s), counts[s]])].map(([label, n]) => (
            <div key={label} className="bg-white rounded-xl border border-sage/30 p-3">
              <p className="text-xs text-ink/60">{label}</p>
              <p className="text-2xl font-bold text-primary">{n}</p>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }} className="grid sm:grid-cols-4 gap-3 mb-5" role="search">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject, message, name or email" maxLength={100} aria-label="Search support requests" className={`${inputClass} sm:col-span-2`} />
        <select value={status} onChange={(e) => update({ status: e.target.value })} aria-label="Filter by status" className={inputClass}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <select value={category} onChange={(e) => update({ category: e.target.value })} aria-label="Filter by category" className={inputClass}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })} aria-label="Sort" className={inputClass}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="updated">Recently updated</option>
        </select>
      </form>

      {state.loading ? <Skeleton className="h-48 w-full" /> : state.error ? <ErrorMessage message={state.error} /> : state.data.messages.length === 0 ? (
        <EmptyState title="No requests found" hint="Try different filters or search terms." />
      ) : (
        <>
          <ul className="space-y-2">
            {state.data.messages.map((m) => (
              <li key={m.id}>
                <Link to={`/admin/support/${m.id}`} className="focus-ring block bg-white rounded-xl border border-sage/30 p-4 hover:bg-mint transition">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`break-words ${m.unread ? 'font-bold text-ink' : 'font-medium text-ink'}`}>{m.unread && <span className="inline-block w-2 h-2 rounded-full bg-accent mr-2" aria-label="Unread" />}{m.subject}</span>
                    <StatusPill status={m.status} />
                  </span>
                  <span className="block text-xs text-ink/60 mt-1">
                    {m.user?.name || 'Unknown'}{m.user?.email ? ` (${m.user.email})` : ''} · {categoryLabel(m.category)} · {formatDate(m.createdAt)}
                    {m.assignee ? ` · Assigned to ${m.assignee.name}` : ''} · {m.responseCount} repl{m.responseCount === 1 ? 'y' : 'ies'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={state.data.page} pages={state.data.pages} onChange={(p) => update({ page: String(p) })} />
        </>
      )}
    </AdminPage>
  );
}

export default AdminSupport;
