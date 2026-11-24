import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';
import { CardSkeletons, ErrorMessage, SuccessMessage, EmptyState, StatusBadge } from '../components/Feedback';

const STATUSES = ['applied', 'interviewing', 'offer', 'rejected'];

function Dashboard() {
  const [savedJobs, setSavedJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);

  const user = getUser();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [savedRes, appsRes] = await Promise.all([
        axiosClient.get(`/saved-jobs/${user.id}`),
        axiosClient.get(`/applications/${user.id}`),
      ]);
      // Defensive: ignore entries whose job no longer exists.
      setSavedJobs((savedRes.data.savedJobs || []).filter((s) => s?.job));
      setApplications((appsRes.data.applications || []).filter((a) => a?.job));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/params change
    fetchData();
  }, [fetchData]);

  const appliedJobIds = new Set(applications.map((a) => a.job._id));

  const handleApply = async (jobId) => {
    setFeedback(null);
    try {
      await axiosClient.post('/applications', { jobId });
      setFeedback({ type: 'success', text: 'Application tracked.' });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not apply') });
    }
  };

  const handleUnsave = async (jobId) => {
    setFeedback(null);
    try {
      await axiosClient.delete(`/saved-jobs/${jobId}`);
      setSavedJobs((prev) => prev.filter((s) => s.job._id !== jobId));
      setFeedback({ type: 'success', text: 'Removed from saved jobs.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not remove job') });
    }
  };

  const handleStatusChange = async (appId, status) => {
    setFeedback(null);
    try {
      const res = await axiosClient.put(`/applications/${appId}`, { status });
      setApplications((prev) => prev.map((a) => (a._id === appId ? { ...a, status: res.data.application.status } : a)));
      setFeedback({ type: 'success', text: 'Status updated.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Could not update status') });
    }
  };

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-8 text-center">My Dashboard</h1>

      <div className="max-w-3xl mx-auto mb-6 flex flex-col gap-3">
        {error && <ErrorMessage message={error} onRetry={fetchData} />}
        {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
        {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
      </div>

      {loading ? (
        <div className="max-w-3xl mx-auto"><CardSkeletons count={3} /></div>
      ) : !error && (
        <>
          <div className="max-w-3xl mx-auto mb-10">
            <h2 className="text-xl font-semibold text-charcoal mb-4">Saved Jobs ({savedJobs.length})</h2>
            {savedJobs.length === 0 ? (
              <EmptyState title="No saved jobs yet" hint="Save jobs while browsing to keep track of them here.">
                <Link to="/jobs" className="text-primary underline">Browse jobs</Link>
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-4">
                {savedJobs.map((saved) => (
                  <div key={saved._id} className="bg-white rounded-xl shadow-sm p-5 flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                      <Link to={`/jobs/${saved.job._id}`} className="text-lg font-semibold text-charcoal hover:text-primary">
                        {saved.job.title}
                      </Link>
                      <p className="text-primary font-medium">{saved.job.company?.name}</p>
                      <p className="text-sm text-gray-500">{saved.job.city} · {saved.job.experienceLevel}</p>
                    </div>
                    <div className="shrink-0 flex gap-2">
                      <button
                        onClick={() => handleUnsave(saved.job._id)}
                        className="border border-gray-300 text-charcoal px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
                      >
                        Unsave
                      </button>
                      <button
                        onClick={() => handleApply(saved.job._id)}
                        disabled={appliedJobIds.has(saved.job._id)}
                        className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-dark transition disabled:opacity-50"
                      >
                        {appliedJobIds.has(saved.job._id) ? 'Applied ✓' : 'Apply'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-semibold text-charcoal mb-4">My Applications ({applications.length})</h2>
            {applications.length === 0 ? (
              <EmptyState title="No applications yet" hint="Apply to a job and track its progress here." />
            ) : (
              <div className="flex flex-col gap-4">
                {applications.map((app) => (
                  <div key={app._id} className="bg-white rounded-xl shadow-sm p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <Link to={`/jobs/${app.job._id}`} className="text-lg font-semibold text-charcoal hover:text-primary">
                        {app.job.title}
                      </Link>
                      <p className="text-primary font-medium">{app.job.company?.name}</p>
                      <p className="text-xs text-gray-400">Applied {new Date(app.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <StatusBadge status={app.status} />
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app._id, e.target.value)}
                        aria-label="Update status"
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
