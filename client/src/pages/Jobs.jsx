import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import useJobActions from '../hooks/useJobActions';
import { getErrorMessage } from '../utils/errors';
import { CardSkeletons, ErrorMessage, SuccessMessage, EmptyState } from '../components/Feedback';

const inputClass = 'border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary';

function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Form inputs vs. applied filters (so typing doesn't refetch).
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [filters, setFilters] = useState({ title: '', city: '', experienceLevel: '' });

  const { savedIds, appliedIds, feedback, busyId, toggleSave, apply } = useJobActions();

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 10 };
      if (filters.title) params.title = filters.title;
      if (filters.city) params.city = filters.city;
      if (filters.experienceLevel) params.experienceLevel = filters.experienceLevel;

      const response = await axiosClient.get('/jobs', { params });
      setJobs(response.data.jobs);
      setPages(response.data.pages);
      setTotal(response.data.total);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load jobs'));
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/params change
    fetchJobs();
  }, [fetchJobs]);

  const handleFilter = (e) => {
    e.preventDefault();
    setPage(1);
    setFilters({ title: title.trim(), city: city.trim(), experienceLevel });
  };

  const handleReset = () => {
    setTitle('');
    setCity('');
    setExperienceLevel('');
    setPage(1);
    setFilters({ title: '', city: '', experienceLevel: '' });
  };

  const hasFilters = filters.title || filters.city || filters.experienceLevel;

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-6 text-center">Find Your Next Role</h1>

      <form onSubmit={handleFilter} className="max-w-3xl mx-auto flex flex-wrap gap-3 mb-4 justify-center">
        <input type="text" placeholder="Job title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} className={inputClass}>
          <option value="">Any experience</option>
          <option value="fresher">Fresher</option>
          <option value="experienced">Experienced</option>
        </select>
        <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition">
          Search
        </button>
        {hasFilters && (
          <button type="button" onClick={handleReset} className="border border-gray-300 text-charcoal px-4 py-2 rounded-lg hover:bg-white transition">
            Clear
          </button>
        )}
      </form>

      <div className="max-w-3xl mx-auto mb-4 flex flex-col gap-3">
        {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
        {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
        {error && <ErrorMessage message={error} onRetry={fetchJobs} />}
      </div>

      <div className="max-w-3xl mx-auto">
        {loading ? (
          <CardSkeletons count={4} />
        ) : !error && jobs.length === 0 ? (
          <EmptyState
            title="No jobs found"
            hint={hasFilters ? 'Try different keywords or clear your filters.' : 'No jobs have been posted yet.'}
          >
            {hasFilters && (
              <button onClick={handleReset} className="text-primary underline">Clear filters</button>
            )}
          </EmptyState>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-3">{total} job{total === 1 ? '' : 's'} found</p>
            <div className="flex flex-col gap-4">
              {jobs.map((job) => {
                const saved = savedIds.has(job._id);
                const applied = appliedIds.has(job._id);
                const busy = busyId === job._id;
                return (
                  <div key={job._id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="min-w-0">
                      <Link to={`/jobs/${job._id}`} className="text-lg font-semibold text-charcoal hover:text-primary">
                        {job.title}
                      </Link>
                      <p className="text-primary font-medium">{job.company?.name}</p>
                      <p className="text-sm text-gray-500">
                        {job.city} · {job.experienceLevel} {job.yearsRequired ? `(${job.yearsRequired} yrs)` : ''}
                      </p>
                      <p className="text-sm text-charcoal mt-2 line-clamp-2">{job.jobDescription}</p>
                    </div>
                    <div className="shrink-0 flex sm:flex-col gap-2">
                      <Link to={`/jobs/${job._id}`} className="text-center border border-gray-300 text-charcoal px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                        Details
                      </Link>
                      <button
                        onClick={() => toggleSave(job._id)}
                        disabled={busy}
                        className="border border-primary text-primary px-4 py-2 rounded-lg text-sm hover:bg-primary hover:text-white transition disabled:opacity-50"
                      >
                        {saved ? 'Unsave' : 'Save'}
                      </button>
                      <button
                        onClick={() => apply(job._id)}
                        disabled={busy || applied}
                        className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-dark transition disabled:opacity-50"
                      >
                        {applied ? 'Applied ✓' : 'Apply'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="border border-primary text-primary px-4 py-2 rounded-lg text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-charcoal">Page {page} of {pages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, pages))}
                  disabled={page >= pages}
                  className="border border-primary text-primary px-4 py-2 rounded-lg text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Jobs;
