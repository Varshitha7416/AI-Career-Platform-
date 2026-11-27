import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { AdminPage } from '../components/admin/AdminNav';
import { Skeleton, ErrorMessage, EmptyState } from '../components/Feedback';
import Pagination from '../components/Pagination';

function Stat({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-sage/30 p-4">
      <p className="text-xs uppercase tracking-wide text-ink/60">{label}</p>
      <p className="font-display text-3xl font-bold text-primary mt-1">{value}</p>
      {sub && <p className="text-xs text-ink/70 mt-1">{sub}</p>}
    </div>
  );
}

const ACTIVITY_PAGE = 10;

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activity, setActivity] = useState(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await axiosClient.get('/admin/overview');
      setData(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let alive = true;
    axiosClient.get('/admin/activity', { params: { page, limit: ACTIVITY_PAGE } })
      .then((res) => { if (alive) setActivity(res.data); })
      .catch(() => { if (alive) setActivity({ activity: [], pages: 1, total: 0 }); });
    return () => { alive = false; };
  }, [page]);

  return (
    <AdminPage title="Admin dashboard" subtitle="Live counts from the database.">
      <ErrorMessage message={error} onRetry={load} />
      {!data && !error && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>}
      {data && (
        <>
          <section aria-labelledby="a-users" className="mb-8">
            <h2 id="a-users" className="font-display text-lg font-semibold text-primary mb-3">Users</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <Stat label="Total users" value={data.users.total} />
              <Stat label="Verified" value={data.users.verified} />
              <Stat label="Unverified" value={data.users.unverified} />
            </div>
          </section>
          <section aria-labelledby="a-jobs" className="mb-8">
            <h2 id="a-jobs" className="font-display text-lg font-semibold text-primary mb-3">Jobs and companies</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Total jobs" value={data.jobs.total} sub={`${data.jobs.inactive} hidden, ${data.jobs.expired} expired`} />
              <Stat label="Active jobs" value={data.jobs.active} sub="Visible and accepting applications" />
              <Stat label="Closed jobs" value={data.jobs.closed} />
              <Stat label="Companies" value={data.companies.total} sub={`${data.companies.active} active, ${data.companies.archived} archived`} />
            </div>
          </section>
          <section aria-labelledby="a-programs" className="mb-8">
            <h2 id="a-programs" className="font-display text-lg font-semibold text-primary mb-3">Career programs</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Total programs" value={data.programs.total} sub={`${data.programs.active} active`} />
              <Stat label="Saved" value={data.programs.enrollments.byStatus.saved} />
              <Stat label="In progress" value={data.programs.enrollments.byStatus['in-progress']} />
              <Stat label="Completed" value={data.programs.enrollments.byStatus.completed} />
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="a-activity">
        <h2 id="a-activity" className="font-display text-lg font-semibold text-primary mb-3">Recent admin activity</h2>
        {!activity && <Skeleton className="h-32" />}
        {activity && activity.activity.length === 0 && <EmptyState title="No admin activity yet" hint="Creating or changing jobs and companies is recorded here." />}
        {activity && activity.activity.length > 0 && (
          <ul className="bg-white rounded-2xl border border-sage/30 divide-y divide-sage/20">
            {activity.activity.map((a) => (
              <li key={a.id} className="px-4 py-3 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-ink">{a.summary || a.action}</span>
                <span className="text-xs text-ink/60">{a.actorName} · {new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
        {activity && <Pagination page={page} pages={activity.pages || 1} onChange={setPage} />}
      </section>
    </AdminPage>
  );
}

export default AdminDashboard;
