import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { AdminPage, AvailabilityBadge, inputClass, btnPrimary, btnGhost } from '../components/admin/AdminNav';
import { Skeleton, ErrorMessage, SuccessMessage, EmptyState } from '../components/Feedback';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [['all', 'All statuses'], ['active', 'Active'], ['inactive', 'Hidden (inactive)'], ['closed', 'Closed'], ['expired', 'Expired']];

function AdminJobs() {
  const [filters, setFilters] = useState({ q: '', status: 'all', company: '', city: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    axiosClient.get('/admin/companies/options', { params: { include: 'archived' } })
      .then((res) => setCompanies(res.data.companies || []))
      .catch(() => setCompanies([]));
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      for (const [k, v] of Object.entries(applied)) if (v && !(k === 'status' && v === 'all')) params[k] = v;
      const res = await axiosClient.get('/admin/jobs', { params });
      setData(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [applied, page]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const submit = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  };

  const act = async (job, action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(job._id);
    setNotice('');
    try {
      await axiosClient.post(`/admin/jobs/${job._id}/${action}`);
      setNotice(`Job "${job.title}" updated.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  return (
    <AdminPage
      title="Jobs"
      subtitle="Create, edit, hide and close job listings."
      actions={<Link to="/admin/jobs/new" className={btnPrimary}>New job</Link>}
    >
      <form onSubmit={submit} className="bg-white rounded-2xl border border-sage/30 p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5" role="search" aria-label="Filter jobs">
        <input aria-label="Search jobs" placeholder="Title, job ID, company" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className={`${inputClass} lg:col-span-2`} />
        <select aria-label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={inputClass}>
          {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="Company" value={filters.company} onChange={(e) => setFilters({ ...filters, company: e.target.value })} className={inputClass}>
          <option value="">All companies</option>
          {companies.map((c) => <option key={c._id} value={c._id}>{c.name}{c.isActive ? '' : ' (archived)'}</option>)}
        </select>
        <input aria-label="City" placeholder="City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} className={inputClass} />
        <div className="sm:col-span-2 lg:col-span-5 flex gap-2">
          <button type="submit" className={btnPrimary}>Apply filters</button>
          <button type="button" className={btnGhost} onClick={() => { const f = { q: '', status: 'all', company: '', city: '' }; setFilters(f); setApplied(f); setPage(1); }}>Reset</button>
        </div>
      </form>

      <ErrorMessage message={error} onRetry={load} />
      <SuccessMessage message={notice} />

      {!data && !error && <Skeleton className="h-48" />}
      {data && data.jobs.length === 0 && <EmptyState title="No jobs match these filters" />}
      {data && data.jobs.length > 0 && (
        <>
          <p className="text-sm text-ink/70 mb-2" aria-live="polite">{data.total} job{data.total === 1 ? '' : 's'}</p>
          <ul className="space-y-3">
            {data.jobs.map((job) => (
              <li key={job._id} className="bg-white rounded-2xl border border-sage/30 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/admin/jobs/${job._id}`} className="font-semibold text-primary hover:underline">{job.title}</Link>
                    <AvailabilityBadge value={job.availability} />
                  </div>
                  <p className="text-sm text-ink/70 mt-1">
                    {job.company?.name || 'Unknown company'}{job.company && job.company.isActive === false ? ' (archived)' : ''} · {job.city}
                    {job.category ? ` · ${job.category}` : ''} · {job.jobCode}
                  </p>
                  {job.applicationDeadline && <p className="text-xs text-ink/60 mt-0.5">Deadline {new Date(job.applicationDeadline).toLocaleDateString()}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/admin/jobs/${job._id}`} className={btnGhost}>View / edit</Link>
                  {job.availability === 'inactive'
                    ? <button type="button" className={btnGhost} disabled={busyId === job._id} onClick={() => act(job, 'activate')}>Activate</button>
                    : <button type="button" className={btnGhost} disabled={busyId === job._id} onClick={() => act(job, 'deactivate', `Hide "${job.title}" from job seekers?`)}>Deactivate</button>}
                  {job.availability === 'closed'
                    ? <button type="button" className={btnGhost} disabled={busyId === job._id} onClick={() => act(job, 'reopen')}>Reopen</button>
                    : <button type="button" className={btnGhost} disabled={busyId === job._id} onClick={() => act(job, 'close', `Close "${job.title}"? It will stop accepting applications.`)}>Close</button>}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </AdminPage>
  );
}

export default AdminJobs;
