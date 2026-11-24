import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import useJobActions from '../hooks/useJobActions';
import { getErrorMessage } from '../utils/errors';
import { Skeleton, ErrorMessage, SuccessMessage } from '../components/Feedback';

function JobDetails() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { savedIds, appliedIds, feedback, busyId, toggleSave, apply } = useJobActions();

  const fetchJob = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosClient.get(`/jobs/${id}`);
      setJob(response.data.job);
    } catch (err) {
      setError(err.response?.status === 404 ? 'This job no longer exists.' : getErrorMessage(err, 'Could not load job'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/params change
    fetchJob();
  }, [fetchJob]);

  const saved = job && savedIds.has(job._id);
  const applied = job && appliedIds.has(job._id);
  const busy = job && busyId === job._id;

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link to="/jobs" className="text-sm text-primary hover:underline">← Back to jobs</Link>

        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-6 mt-4">
            <Skeleton className="h-7 w-1/2 mb-3" />
            <Skeleton className="h-4 w-1/4 mb-6" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {!loading && error && <div className="mt-4"><ErrorMessage message={error} onRetry={fetchJob} /></div>}

        {!loading && job && (
          <div className="bg-white rounded-xl shadow-sm p-6 mt-4">
            <h1 className="text-2xl font-bold text-charcoal">{job.title}</h1>
            <p className="text-primary font-medium text-lg">{job.company?.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              {job.city} · {job.experienceLevel} {job.yearsRequired ? `(${job.yearsRequired}+ yrs)` : ''}
            </p>

            <div className="flex flex-wrap gap-3 mt-5">
              <button
                onClick={() => apply(job._id)}
                disabled={busy || applied}
                className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
              >
                {applied ? 'Applied ✓' : 'Apply'}
              </button>
              <button
                onClick={() => toggleSave(job._id)}
                disabled={busy}
                className="border border-primary text-primary px-6 py-2 rounded-lg hover:bg-primary hover:text-white transition disabled:opacity-50"
              >
                {saved ? 'Unsave' : 'Save'}
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {feedback?.type === 'success' && <SuccessMessage message={feedback.text} />}
              {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
            </div>

            <h2 className="text-lg font-semibold text-charcoal mt-6 mb-2">Job description</h2>
            <p className="text-charcoal whitespace-pre-line leading-relaxed">{job.jobDescription}</p>

            {job.company?.description && (
              <>
                <h2 className="text-lg font-semibold text-charcoal mt-6 mb-2">About {job.company.name}</h2>
                <p className="text-charcoal">{job.company.description}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {[job.company.industry, job.company.location].filter(Boolean).join(' · ')}
                  {job.company.website && (
                    <>
                      {' · '}
                      <a href={job.company.website} target="_blank" rel="noreferrer" className="text-primary underline">Website</a>
                    </>
                  )}
                </p>
              </>
            )}

            <div className="mt-8 border-t border-gray-100 pt-5">
              <h2 className="text-sm font-semibold text-charcoal mb-3">✨ AI tools for this job</h2>
              <div className="flex flex-wrap gap-3">
                <Link to={`/resume?job=${job._id}`} className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 transition">
                  Check my resume match
                </Link>
                <Link to={`/cover-letter?job=${job._id}`} className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 transition">
                  Write a cover letter
                </Link>
                <Link to="/referrals" className="border border-accent text-accent px-4 py-2 rounded-lg text-sm hover:bg-accent hover:text-white transition">
                  Find a referral
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobDetails;
