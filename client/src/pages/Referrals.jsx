import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';
import { ErrorMessage, SuccessMessage, EmptyState, StatusBadge, CardSkeletons } from '../components/Feedback';

const TABS = [
  { key: 'find', label: 'Find referrers' },
  { key: 'mine', label: 'My requests' },
  { key: 'incoming', label: 'Incoming requests' },
];

function Referrals() {
  const [tab, setTab] = useState('find');
  const [feedback, setFeedback] = useState(null);
  const user = getUser();

  // Find tab
  const [company, setCompany] = useState('');
  const [searchedCompany, setSearchedCompany] = useState('');
  const [referrers, setReferrers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [requestingFor, setRequestingFor] = useState(null); // referrer being messaged
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Mine / incoming tabs
  const [mine, setMine] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const loadLists = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const [mineRes, incomingRes] = await Promise.all([
        axiosClient.get('/referrals/mine'),
        axiosClient.get('/referrals/incoming'),
      ]);
      setMine(mineRes.data.referrals);
      setIncoming(incomingRes.data.referrals);
    } catch (err) {
      setListError(getErrorMessage(err, 'Could not load referral requests'));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/params change
    loadLists();
  }, [loadLists]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = company.trim();
    if (!q) return;
    setSearching(true);
    setFeedback(null);
    setRequestingFor(null);
    try {
      const response = await axiosClient.get('/referrals/find', { params: { company: q } });
      setReferrers(response.data.referrers);
      setSearchedCompany(q);
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Search failed') });
    } finally {
      setSearching(false);
    }
  };

  const openRequest = (referrer) => {
    setRequestingFor(referrer);
    setMessage(`Hi ${referrer.name.split(' ')[0]}, I'm interested in opportunities at ${referrer.currentCompany} and would really appreciate a referral. Thank you!`);
    setFeedback(null);
  };

  const sendRequest = async () => {
    if (!message.trim()) {
      return setFeedback({ type: 'error', text: 'Please write a message.' });
    }
    setSending(true);
    setFeedback(null);
    try {
      await axiosClient.post('/referrals', { referrerId: requestingFor._id, message: message.trim() });
      setFeedback({ type: 'success', text: `Referral requested from ${requestingFor.name}!` });
      setRequestingFor(null);
      loadLists();
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Request failed') });
    } finally {
      setSending(false);
    }
  };

  const respond = async (id, status) => {
    setFeedback(null);
    try {
      const res = await axiosClient.put(`/referrals/${id}`, { status });
      setIncoming((prev) => prev.map((r) => (r._id === id ? { ...r, status: res.data.referral.status } : r)));
      setFeedback({ type: 'success', text: `Request ${status}.` });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not update request') });
    }
  };

  const pendingIncoming = incoming.filter((r) => r.status === 'requested').length;

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-6 text-center">Referrals</h1>

      <div className="max-w-xl mx-auto flex gap-2 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setFeedback(null); }}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition ${
              tab === t.key ? 'border-primary text-primary font-semibold' : 'border-transparent text-charcoal hover:text-primary'
            }`}
          >
            {t.label}
            {t.key === 'incoming' && pendingIncoming > 0 && (
              <span className="ml-2 text-xs bg-accent text-white rounded-full px-2 py-0.5">{pendingIncoming}</span>
            )}
          </button>
        ))}
      </div>

      <div className="max-w-xl mx-auto mb-4 flex flex-col gap-3">
        {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
        {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
      </div>

      {tab === 'find' && (
        <div className="max-w-xl mx-auto">
          <form onSubmit={handleSearch} className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder="Search by company (e.g. Zoho)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={searching}
              className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          <div className="flex flex-col gap-4">
            {referrers.map((ref) => (
              <div key={ref._id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-charcoal">{ref.name}</h3>
                    <p className="text-sm text-gray-500">{ref.currentCompanyRole || 'Employee'} at {ref.currentCompany}</p>
                  </div>
                  {requestingFor?._id !== ref._id && (
                    <button
                      onClick={() => openRequest(ref)}
                      className="shrink-0 bg-accent text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 transition"
                    >
                      Request Referral
                    </button>
                  )}
                </div>
                {requestingFor?._id === ref._id && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-charcoal" htmlFor="ref-message">Your message</label>
                    <textarea
                      id="ref-message"
                      rows={4}
                      maxLength={1000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={sendRequest}
                        disabled={sending}
                        className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-dark transition disabled:opacity-50"
                      >
                        {sending ? 'Sending...' : 'Send request'}
                      </button>
                      <button onClick={() => setRequestingFor(null)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {searchedCompany && referrers.length === 0 && !searching && (
              <EmptyState
                title={`No referrers found for "${searchedCompany}"`}
                hint="Try a different spelling, or check back later."
              />
            )}
            {!searchedCompany && (
              <EmptyState
                title="Search a company to find employees who offer referrals"
                hint={user?.isReferrer ? undefined : 'Work somewhere? You can also offer referrals from your Profile.'}
              >
                {!user?.isReferrer && <Link to="/profile" className="text-primary underline text-sm">Become a referrer</Link>}
              </EmptyState>
            )}
          </div>
        </div>
      )}

      {tab === 'mine' && (
        <div className="max-w-xl mx-auto">
          {listError && <ErrorMessage message={listError} onRetry={loadLists} />}
          {listLoading ? (
            <CardSkeletons count={2} />
          ) : mine.length === 0 && !listError ? (
            <EmptyState title="You haven't requested any referrals yet" hint="Search a company in the Find tab." />
          ) : (
            <div className="flex flex-col gap-4">
              {mine.map((r) => (
                <div key={r._id} className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h3 className="font-semibold text-charcoal">{r.referrer?.name || 'Unknown user'}</h3>
                      <p className="text-sm text-gray-500">{r.referrer?.currentCompanyRole} {r.referrer?.currentCompany && `at ${r.referrer.currentCompany}`}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-charcoal mt-3 whitespace-pre-line">{r.message}</p>
                  <p className="text-xs text-gray-400 mt-2">Sent {new Date(r.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'incoming' && (
        <div className="max-w-xl mx-auto">
          {!user?.isReferrer && incoming.length === 0 && !listLoading ? (
            <EmptyState title="You're not registered as a referrer" hint="Add your company in your profile to receive referral requests.">
              <Link to="/profile" className="text-primary underline text-sm">Go to Profile</Link>
            </EmptyState>
          ) : (
            <>
              {listError && <ErrorMessage message={listError} onRetry={loadLists} />}
              {listLoading ? (
                <CardSkeletons count={2} />
              ) : incoming.length === 0 && !listError ? (
                <EmptyState title="No incoming requests yet" hint="When someone asks you for a referral, it shows up here." />
              ) : (
                <div className="flex flex-col gap-4">
                  {incoming.map((r) => (
                    <div key={r._id} className="bg-white rounded-xl shadow-sm p-5">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <h3 className="font-semibold text-charcoal">{r.seeker?.name || 'Unknown user'}</h3>
                          {r.seeker?.seekingRole && <p className="text-sm text-gray-500">Looking for: {r.seeker.seekingRole}</p>}
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-sm text-charcoal mt-3 whitespace-pre-line">{r.message}</p>
                      <p className="text-xs text-gray-400 mt-2">Received {new Date(r.createdAt).toLocaleString()}</p>
                      {r.status === 'requested' && (
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => respond(r._id, 'accepted')} className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 transition">
                            Accept
                          </button>
                          <button onClick={() => respond(r._id, 'declined')} className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition">
                            Decline
                          </button>
                        </div>
                      )}
                      {r.status === 'accepted' && (
                        <div className="mt-4">
                          <button onClick={() => respond(r._id, 'referred')} className="border border-primary text-primary px-4 py-2 rounded-lg text-sm hover:bg-primary hover:text-white transition">
                            Mark as referred
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Referrals;
