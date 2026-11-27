import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import CompanyLogo from '../components/CompanyLogo';
import StatusPill from '../components/applications/StatusPill';
import TrackerFlags from '../components/applications/TrackerFlags';
import { Skeleton, ErrorMessage, SuccessMessage, EmptyState } from '../components/Feedback';
import { SearchIcon } from '../components/Icons';
import { STATUS_OPTIONS, STATUS_META, fetchApplications, formatDate } from '../utils/dashboard';

function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchApplications();
      setApplications(list.filter((a) => a?.job));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your applications'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on mount
    load();
  }, [load]);

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const counts = useMemo(() => {
    const c = { all: applications.length };
    STATUS_OPTIONS.forEach((s) => { c[s] = applications.filter((a) => a.status === s).length; });
    return c;
  }, [applications]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications
      .filter((a) => filter === 'all' || a.status === filter)
      .filter((a) => !q || `${a.job?.title} ${a.job?.company?.name}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.appliedAt || b.createdAt) - new Date(a.appliedAt || a.createdAt));
  }, [applications, filter, query]);

  const changeStatus = async (app, status) => {
    if (status === app.status) return;
    setBusyId(app._id);
    setFeedback(null);
    try {
      const res = await axiosClient.put(`/applications/${app._id}`, { status });
      setApplications((prev) => prev.map((a) => (a._id === app._id ? { ...a, status: res.data.application.status } : a)));
      setFeedback({ type: 'success', text: `Status updated to ${STATUS_META[status].label}.` });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not update the status') });
    } finally {
      setBusyId(null);
    }
  };

  const tabs = [{ key: 'all', label: 'All' }, ...STATUS_OPTIONS.map((s) => ({ key: s, label: STATUS_META[s].label }))];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-primary">Application Tracker</h1>
        <p className="text-ink/70 mt-1">Every job you have applied to, in one place. Open an application to see its history and schedule interviews.</p>
      </header>

      <div className="space-y-3 mb-4">
        {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
        {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
        {error && <ErrorMessage message={error} onRetry={load} />}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={filter === t.key}
              onClick={() => setFilter(t.key)}
              className={`focus-ring text-sm px-3.5 py-1.5 rounded-full border transition ${filter === t.key ? 'bg-primary text-white border-primary' : 'bg-white border-sage/60 text-primary hover:bg-mint'}`}
            >
              {t.label} <span className="opacity-70">({counts[t.key] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64 sm:ml-auto">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/60 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or company"
            aria-label="Search applications"
            className="focus-ring w-full bg-white border border-sage/50 rounded-xl pl-9 pr-3 py-2 text-sm text-ink"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="Loading applications">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !error && applications.length === 0 ? (
        <EmptyState title="No applications yet" hint="Open a job, apply on the employer's page, then confirm it to track it here.">
          <Link to="/jobs" className="inline-block bg-primary text-white px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition">Explore Job Discovery</Link>
        </EmptyState>
      ) : !error && visible.length === 0 ? (
        <EmptyState title="No applications match" hint="Try another status or search term.">
          <button onClick={() => { setFilter('all'); setQuery(''); }} className="text-primary underline text-sm">Clear filters</button>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {visible.map((app) => (
            <li key={app._id} className="bg-white rounded-2xl border border-sage/30 shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <CompanyLogo company={app.job.company} size={44} />
                <div className="min-w-0">
                  <Link to={`/applications/${app._id}`} className="focus-ring font-semibold text-ink hover:text-accent block truncate">{app.job.title}</Link>
                  <p className="text-sm text-ink/70 truncate">{app.job.company?.name}</p>
                  <p className="text-xs text-ink/55">
                    Applied {formatDate(app.appliedAt || app.createdAt)}{app.applyMethod === 'external' ? ' · via employer link' : ''}
                  </p>
                  <div className="mt-1"><TrackerFlags application={app} /></div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <StatusPill status={app.status} />
                <select
                  value={app.status}
                  disabled={busyId === app._id}
                  onChange={(e) => changeStatus(app, e.target.value)}
                  aria-label={`Update status for ${app.job.title}`}
                  className="focus-ring border border-sage/60 rounded-lg px-2 py-1.5 text-sm bg-white text-ink disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
                <Link to={`/applications/${app._id}`} className="focus-ring text-sm text-primary border border-sage rounded-lg px-3 py-1.5 hover:bg-mint transition">Details</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Applications;
