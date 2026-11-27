import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { categoryLabel, formatDate } from '../utils/support';
import { CardSkeletons, ErrorMessage, EmptyState, Skeleton } from '../components/Feedback';
import Pagination from '../components/Pagination';
import StatusPill from '../components/StatusPill';

function Thread({ id }) {
  const [state, setState] = useState({ loading: true, error: '', ticket: null });
  useEffect(() => {
    let alive = true;
    axiosClient.get(`/contact/${id}`)
      .then((r) => { if (alive) setState({ loading: false, error: '', ticket: r.data.ticket }); })
      .catch((err) => { if (alive) setState({ loading: false, error: err.response?.status === 404 ? 'This request was not found.' : getErrorMessage(err), ticket: null }); });
    return () => { alive = false; };
  }, [id]);

  if (state.loading) return <Skeleton className="h-48 w-full" />;
  if (state.error) return <ErrorMessage message={state.error} />;
  const t = state.ticket;
  return (
    <article className="bg-white rounded-2xl border border-sage/30 shadow-sm p-6">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h2 className="font-display text-xl font-bold text-primary break-words">{t.subject}</h2>
        <StatusPill status={t.status} />
      </div>
      <p className="text-xs text-ink/60 mt-1">{categoryLabel(t.category)} · Sent {formatDate(t.createdAt)}</p>
      <div className="mt-5 space-y-4">
        <div className="rounded-xl bg-bg/60 border border-sage/30 p-4">
          <p className="text-xs font-semibold text-ink/60 mb-1">You</p>
          <p className="text-sm text-ink whitespace-pre-wrap break-words">{t.message}</p>
        </div>
        {t.responses.length === 0 && <p className="text-sm text-ink/70">No reply yet. We will notify you here when the team responds.</p>}
        {t.responses.map((r) => (
          <div key={r.id} className="rounded-xl bg-mint border border-sage/40 p-4">
            <p className="text-xs font-semibold text-primary mb-1">{r.from} · {formatDate(r.at)}</p>
            <p className="text-sm text-ink whitespace-pre-wrap break-words">{r.text}</p>
            <p className="text-xs text-ink/60 mt-2">Reply saved in your CareerNest inbox</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function ContactHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get('page'), 10) || 1);
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    if (id) return undefined;
    let alive = true;
    axiosClient.get('/contact', { params: { page, limit: 10 } })
      .then((r) => { if (alive) setState({ loading: false, error: '', data: r.data }); })
      .catch((err) => { if (alive) setState({ loading: false, error: getErrorMessage(err), data: null }); });
    return () => { alive = false; };
  }, [id, page]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-primary">My support requests</h1>
        <p className="text-ink/70 mt-1">Your messages to CareerNest and the replies you received.</p>
        <div className="flex flex-wrap gap-3 mt-3 text-sm">
          <Link to="/contact" className="focus-ring text-primary underline underline-offset-2 rounded">New request</Link>
          {id && <Link to="/contact/history" className="focus-ring text-primary underline underline-offset-2 rounded">All requests</Link>}
        </div>
      </header>

      {id ? <Thread id={id} /> : state.loading ? <CardSkeletons count={3} /> : state.error ? <ErrorMessage message={state.error} /> : state.data.messages.length === 0 ? (
        <EmptyState title="No requests yet" hint="When you contact support, your requests and our replies will show up here." />
      ) : (
        <>
          <ul className="space-y-3">
            {state.data.messages.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => navigate(`/contact/history/${m.id}`)} className="focus-ring w-full text-left bg-white rounded-2xl border border-sage/30 shadow-sm p-4 hover:bg-mint transition">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink break-words">{m.subject}</span>
                    <StatusPill status={m.status} />
                  </span>
                  <span className="block text-xs text-ink/60 mt-1">{categoryLabel(m.category)} · {formatDate(m.createdAt)}</span>
                  {m.latestResponse && <span className="block text-sm text-ink/80 mt-2 break-words">Latest reply: {m.latestResponse.text}</span>}
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={state.data.page} pages={state.data.pages} onChange={(p) => setParams({ page: String(p) })} />
        </>
      )}
    </div>
  );
}

export default ContactHistory;
