import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';
import { ErrorMessage, SuccessMessage, Skeleton } from '../components/Feedback';
import { SearchIcon, BuildingIcon } from '../components/dashboard/DashIcons';
import { ArrowLeft } from '../components/Icons';
import CompanyLogo from '../components/CompanyLogo';
import RequestModal from '../components/referrals/RequestModal';

const field = 'focus-ring bg-white border border-sage/50 rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink/45';
const PAGE_SIZE = 12;

function ReferralFind() {
  const user = getUser();
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ providers: [], total: 0, pages: 1, loading: true, error: '' });
  const [requesting, setRequesting] = useState(null);
  const [sentTo, setSentTo] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    axiosClient.get('/referrals/companies').then((res) => setCompanies(res.data.companies || [])).catch(() => { /* filter list is optional */ });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-params change
    setState((s) => ({ ...s, loading: true, error: '' }));
    axiosClient
      .get('/referrals/providers', { params: { company: company || undefined, q: debouncedQ || undefined, page, limit: PAGE_SIZE } })
      .then((res) => {
        if (cancelled) return;
        const incoming = res.data.providers || [];
        setState((s) => ({
          providers: page > 1 ? [...s.providers, ...incoming] : incoming,
          total: res.data.total ?? incoming.length,
          pages: res.data.pages || 1,
          loading: false,
          error: '',
        }));
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: getErrorMessage(err, 'Could not load people.') }));
      });
    return () => { cancelled = true; };
  }, [company, debouncedQ, page, reload]);

  const { providers, total, pages, loading, error } = state;
  const filtering = !!(company || debouncedQ);
  const retry = useCallback(() => setReload((n) => n + 1), []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <div>
        <Link to="/referrals" className="focus-ring inline-flex items-center gap-1.5 min-h-10 text-sm text-primary hover:underline rounded">
          <ArrowLeft size={16} /> Back to Referrals
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary mt-2">Find People to Refer</h1>
        <p className="text-ink/70 mt-1">Members who opted in to give referrals. Company details are self-reported, not verified by CareerNest.</p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} role="search" className="grid gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <label>
          <span className="sr-only">Company</span>
          <select value={company} onChange={(e) => { setCompany(e.target.value); setPage(1); }} className={`${field} w-full`}>
            <option value="">All companies</option>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="relative">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/50 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, role or company"
            aria-label="Search by name, role or company"
            className={`${field} w-full pl-9`}
          />
        </div>
      </form>

      {sentTo && <SuccessMessage message={`Referral request sent to ${sentTo}. You can follow it on the Referrals page.`} />}
      {error && <ErrorMessage message={error} onRetry={retry} />}

      {loading && providers.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-label="Loading people">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-sage/30 p-5 flex gap-3">
              <Skeleton className="w-12 h-12 shrink-0" />
              <div className="flex-1"><Skeleton className="h-4 w-1/2 mb-2" /><Skeleton className="h-3 w-2/3 mb-2" /><Skeleton className="h-3 w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : providers.length === 0 && !error ? (
        <div className="bg-white rounded-2xl border border-sage/30 p-8 text-center">
          <p className="font-medium text-ink">{filtering ? 'No one matches your search' : 'No one is offering referrals yet'}</p>
          <p className="text-sm text-ink/65 mt-1">
            {filtering ? 'Try another company or a different name.' : 'Check back soon. Members can opt in from their profile.'}
          </p>
          {user && !user.isReferrer && (
            <Link to="/profile" className="focus-ring inline-block mt-4 text-sm font-medium text-primary underline rounded">Offer referrals yourself</Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-ink/65" aria-live="polite">{total} {total === 1 ? 'person' : 'people'} found</p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {providers.map((p) => (
              <li key={p._id} className="bg-white rounded-2xl border border-sage/30 shadow-sm p-5 flex flex-col gap-3">
                <div className="flex gap-3 min-w-0">
                  <CompanyLogo company={{ name: p.companies?.[0] || p.name }} size={48} />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-ink truncate">{p.name}</h2>
                    {p.currentCompanyRole && <p className="text-sm text-ink/70 truncate">{p.currentCompanyRole}</p>}
                    {p.seekingRole && <p className="text-xs text-ink/60 truncate">Also exploring: {p.seekingRole}</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-ink/60 mb-1 inline-flex items-center gap-1"><BuildingIcon size={13} /> Can refer at (self-reported)</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {(p.companies?.length ? p.companies : ['Company not listed']).map((c) => (
                      <li key={c} className="text-xs px-2.5 py-1 rounded-full bg-mint text-primary font-medium">{c}</li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => { setSentTo(null); setRequesting(p); }}
                  className="focus-ring mt-auto self-start bg-primary text-white px-4 py-2 min-h-10 rounded-lg text-sm font-medium hover:bg-primary-dark transition"
                >
                  Request referral
                </button>
              </li>
            ))}
          </ul>
          {page < pages && (
            <button
              type="button"
              onClick={() => setPage((n) => n + 1)}
              disabled={loading}
              className="focus-ring self-center px-5 py-2 min-h-10 rounded-lg border border-sage/60 text-sm text-primary font-medium hover:bg-mint disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          )}
        </>
      )}

      {requesting && (
        <RequestModal
          provider={requesting}
          onClose={() => setRequesting(null)}
          onSent={() => { setSentTo(requesting.name); setRequesting(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />
      )}
    </div>
  );
}

export default ReferralFind;
