import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');

  const user = JSON.parse(localStorage.getItem('user'));

  const fetchJobs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (title) params.title = title;
      if (city) params.city = city;
      if (experienceLevel) params.experienceLevel = experienceLevel;

      const response = await axiosClient.get('/jobs', { params });
      setJobs(response.data.jobs);
    } catch (err) {
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJob = async (jobId) => {
    setSavedMessage('');
    try {
      await axiosClient.post('/saved-jobs', { userId: user.id, jobId });
      setSavedMessage('Job saved!');
    } catch (err) {
      setSavedMessage(err.response?.data?.message || 'Could not save job');
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleFilter = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-6 text-center">Find Your Next Role</h1>

      <form onSubmit={handleFilter} className="max-w-3xl mx-auto flex flex-wrap gap-3 mb-4 justify-center">
        <input
          type="text"
          placeholder="Job title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="text"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select
          value={experienceLevel}
          onChange={(e) => setExperienceLevel(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Any experience</option>
          <option value="fresher">Fresher</option>
          <option value="experienced">Experienced</option>
        </select>
        <button
          type="submit"
          className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition"
        >
          Search
        </button>
      </form>

      {savedMessage && (
        <p className="text-center text-sm text-accent font-medium mb-4">{savedMessage}</p>
      )}

      {loading && <p className="text-center text-charcoal">Loading jobs...</p>}
      {error && <p className="text-center text-red-600">{error}</p>}

      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {!loading && jobs.length === 0 && (
          <p className="text-center text-charcoal">No jobs found.</p>
        )}
        {jobs.map((job) => (
          <div key={job._id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition flex justify-between items-start gap-4">
            <div>
              <h2 className="text-lg font-semibold text-charcoal">{job.title}</h2>
              <p className="text-primary font-medium">{job.company}</p>
              <p className="text-sm text-gray-500">{job.city} · {job.experienceLevel} {job.yearsRequired ? `(${job.yearsRequired} yrs)` : ''}</p>
              <p className="text-sm text-charcoal mt-2 line-clamp-2">{job.jobDescription}</p>
            </div>
            <button
              onClick={() => handleSaveJob(job._id)}
              className="shrink-0 border border-primary text-primary px-4 py-2 rounded-lg text-sm hover:bg-primary hover:text-white transition"
            >
              Save
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Jobs;