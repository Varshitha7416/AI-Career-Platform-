import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

function Dashboard() {
  const [savedJobs, setSavedJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('user'));

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [savedRes, appsRes] = await Promise.all([
        axiosClient.get(`/saved-jobs/${user.id}`),
        axiosClient.get(`/applications/${user.id}`),
      ]);
      setSavedJobs(savedRes.data.savedJobs);
      setApplications(appsRes.data.applications);
    } catch (err) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (jobId) => {
    try {
      await axiosClient.post('/applications', { userId: user.id, jobId });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not apply');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <p className="text-center mt-10 text-charcoal">Loading dashboard...</p>;
  if (error) return <p className="text-center mt-10 text-red-600">{error}</p>;

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-8 text-center">My Dashboard</h1>

      <div className="max-w-3xl mx-auto mb-10">
        <h2 className="text-xl font-semibold text-charcoal mb-4">Saved Jobs</h2>
        {savedJobs.length === 0 && <p className="text-gray-500">No saved jobs yet.</p>}
        <div className="flex flex-col gap-4">
          {savedJobs.map((saved) => (
            <div key={saved._id} className="bg-white rounded-xl shadow-sm p-5 flex justify-between items-start gap-4">
              <div>
                <h3 className="text-lg font-semibold text-charcoal">{saved.job.title}</h3>
                <p className="text-primary font-medium">{saved.job.company}</p>
                <p className="text-sm text-gray-500">{saved.job.city} · {saved.job.experienceLevel}</p>
              </div>
              <button
                onClick={() => handleApply(saved.job._id)}
                className="shrink-0 bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-dark transition"
              >
                Apply
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold text-charcoal mb-4">My Applications</h2>
        {applications.length === 0 && <p className="text-gray-500">No applications yet.</p>}
        <div className="flex flex-col gap-4">
          {applications.map((app) => (
            <div key={app._id} className="bg-white rounded-xl shadow-sm p-5 flex justify-between items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-charcoal">{app.job.title}</h3>
                <p className="text-primary font-medium">{app.job.company}</p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full bg-accent/10 text-accent">
                {app.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;