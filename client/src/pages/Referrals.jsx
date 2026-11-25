import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { ErrorMessage, SuccessMessage, Skeleton } from '../components/Feedback';
import { ArrowRight } from '../components/dashboard/DashIcons';
import { UsersIcon } from '../components/Icons';
import ReferralArt from '../components/referrals/ReferralArt';
import ReferralList from '../components/referrals/ReferralList';
import StatusGuide from '../components/referrals/StatusGuide';
import ActionConfirm from '../components/referrals/ActionConfirm';
import useReferralList from '../components/referrals/useReferralList';
import { STATUS_FILTERS } from '../components/referrals/referralUtils';

function SendIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z" />
    </svg>
  );
}

function InboxIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v8m0 0-3-3m3 3 3-3" />
      <path d="M3.5 13h5l1.2 2.5h4.6L15.5 13h5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19v-6Z" />
    </svg>
  );
}

const two = (n) => String(n ?? 0).padStart(2, '0');

function SummaryCard({ icon, title, count, hint, onClick, loading, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring text-left w-full bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 hover:border-primary transition ${active ? 'border-primary' : 'border-sage/30'}`}
    >
      <span className="w-14 h-14 shrink-0 rounded-full bg-mint text-primary flex items-center justify-center">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        {loading ? <Skeleton className="h-8 w-12 mt-1" /> : <span className="block font-display text-3xl font-bold text-primary leading-tight">{two(count)}</span>}
      </span>
      <span className="hidden sm:block self-stretch w-px bg-sage/40 mx-1" />
      <span className="hidden sm:block text-sm text-ink/70 flex-1">{hint}</span>
      <span className="ml-auto w-9 h-9 shrink-0 rounded-full bg-mint text-primary flex items-center justify-center"><ArrowRight size={16} /></span>
    </button>
  );
}

function Referrals() {
  const [tab, setTab] = useState('sent');
  const [status, setStatus] = useState('');
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [pending, setPending] = useState(null); // { referral, action }
  const [feedback, setFeedback] = useState(null);
  const listsRef = useRef(null);

  const sent = useReferralList('mine', status, refreshKey);
  const received = useReferralList('incoming', status, refreshKey);

  const loadSummary = useCallback(async () => {
    setSummaryError('');
    try {
      const res = await axiosClient.get('/referrals/summary');
      setSummary(res.data);
    } catch (err) {
      setSummaryError(getErrorMessage(err, 'Could not load your referral summary.'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / after changes
    loadSummary();
  }, [loadSummary, refreshKey]);

  // Switching tabs: if the user has scrolled down the list, bring the list top back under the header.
  const selectTab = (which) => {
    setTab(which);
    const top = listsRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) listsRef.current.scrollIntoView({ block: 'start' });
  };

  const focusList = (which) => {
    setTab(which);
    listsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onDone = (_referral, message) => {
    setPending(null);
    setFeedback({ type: 'success', text: message });
    setRefreshKey((k) => k + 1);
  };
  const onFail = (text) => {
    setPending(null);
    setFeedback({ type: 'error', text });
    setRefreshKey((k) => k + 1);
  };
  const askAction = (referral, action) => { setFeedback(null); setPending({ referral, action }); };

  const sentCount = summary?.sent?.all;
  const receivedCount = summary?.received?.all;
  const loadingSummary = !summary && !summaryError;

  const tabCls = (key) => `focus-ring relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${tab === key ? 'border-primary text-primary' : 'border-transparent text-ink/70 hover:text-primary'}`;
  const badge = (n) => (
    <span className="min-w-5 px-1.5 h-5 inline-flex items-center justify-center rounded-full bg-accent text-white text-[11px] font-semibold">{n ?? '–'}</span>
  );

  return (
    <div className="max-w-7xl mx-auto min-w-0 px-4 sm:px-6 py-6 flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary">Referrals</h1>
        <p className="text-ink/70 mt-1">Connect, refer and grow together!</p>
      </header>

      <section aria-labelledby="referral-banner" className="hero-bg rounded-2xl border border-sage/30 overflow-hidden grid md:grid-cols-[minmax(0,1fr)_320px] items-center">
        <div className="p-6 sm:p-8">
          <h2 id="referral-banner" className="font-display text-2xl sm:text-[1.7rem] font-bold text-primary leading-tight">Refer a friend. Help a fellow dreamer.</h2>
          <p className="text-ink/75 mt-2 max-w-lg">Share opportunities and build a stronger community together.</p>
          <Link to="/referrals/find" className="focus-ring mt-5 inline-flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-dark transition">
            Find People to Refer <ArrowRight size={16} />
          </Link>
        </div>
        <ReferralArt className="hidden md:block w-full h-auto self-end" />
      </section>

      {summaryError && <ErrorMessage message={summaryError} onRetry={loadSummary} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard
          icon={<SendIcon />} title="Sent Requests" count={sentCount} loading={loadingSummary}
          hint="Requests you sent to others" onClick={() => focusList('sent')} active={tab === 'sent'}
        />
        <SummaryCard
          icon={<InboxIcon />} title="Received Requests" count={receivedCount} loading={loadingSummary}
          hint="Requests you received" onClick={() => focusList('received')} active={tab === 'received'}
        />
      </div>

      <section ref={listsRef} aria-label="Referral requests" className="bg-white rounded-2xl border border-sage/30 shadow-sm p-3 sm:p-4 scroll-mt-20">
        <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-sage/30 mb-4 -mx-3 px-3 sm:-mx-4 sm:px-4 pt-2 -mt-2 sm:pt-2 bg-white rounded-t-2xl">
          {/* Sticky under the top bar. Tabs switch lists below lg; on lg+ both lists show side by side and the active tab highlights its column. */}
          <div role="tablist" aria-label="Request direction" className="flex">
            <button type="button" role="tab" aria-selected={tab === 'sent'} onClick={() => selectTab('sent')} className={tabCls('sent')}>
              <SendIcon size={16} /> Sent Requests {badge(sentCount)}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'received'} onClick={() => selectTab('received')} className={tabCls('received')}>
              <UsersIcon size={16} /> Received Requests {badge(receivedCount)}
            </button>
          </div>
          <label className="mb-2 inline-flex items-center">
            <span className="sr-only">Filter by status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="focus-ring bg-white border border-sage/50 rounded-lg px-3 py-2 min-h-10 text-sm text-ink"
            >
              {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
        </div>

        {feedback?.type === 'success' && <div className="mb-3"><SuccessMessage message={feedback.text} /></div>}
        {feedback?.type === 'error' && <div className="mb-3"><ErrorMessage message={feedback.text} /></div>}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
          <div className={`min-w-0 lg:rounded-xl lg:outline-2 lg:outline-offset-4 ${tab === 'sent' ? 'lg:outline lg:outline-sage/40' : 'hidden lg:block'}`} role="tabpanel" aria-label="Sent requests">
            <ReferralList kind="sent" list={sent} filtered={!!status} onAction={askAction} />
          </div>
          <div className={`min-w-0 lg:rounded-xl lg:outline-2 lg:outline-offset-4 ${tab === 'received' ? 'lg:outline lg:outline-sage/40' : 'hidden lg:block'}`} role="tabpanel" aria-label="Received requests">
            <ReferralList kind="received" list={received} filtered={!!status} onAction={askAction} />
          </div>
        </div>
      </section>

      <StatusGuide />

      {pending && (
        <ActionConfirm
          referralId={pending.referral._id}
          action={pending.action}
          onCancel={() => setPending(null)}
          onDone={onDone}
          onFail={onFail}
        />
      )}
    </div>
  );
}

export default Referrals;
