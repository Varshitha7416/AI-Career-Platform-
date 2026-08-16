import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

function CoverLetter() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [letter, setLetter] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const user = JSON.parse(localStorage.getItem('user'));
  const resumeId = localStorage.getItem('resumeId');

  useEffect(() => {
    axiosClient.get('/jobs').then((res) => setJobs(res.data.jobs));
  }, []);

  const handleGenerate = async () => {
    setError('');
    setLetter('');
    setCopied(false);

    if (!resumeId) {
      setError('Please upload a resume first (Resume Analyzer page) before generating a cover letter.');
      return;
    }
    if (!selectedJobId) {
      setError('Please select a job.');
      return;
    }

    setGenerating(true);
    try {
      const response = await axiosClient.post('/cover-letters', {
        userId: user.id,
        resumeId,
        jobId: selectedJobId,
      });
      setLetter(response.data.coverLetter.generatedText);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate cover letter');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-8 text-center">Cover Letter Generator</h1>

      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-charcoal mb-4">Select a Job</h2>
        <select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 w-full mb-4"
        >
          <option value="">-- Choose a job --</option>
          {jobs.map((job) => (
            <option key={job._id} value={job._id}>
              {job.title} — {job.company}
            </option>
          ))}
        </select>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-primary text-white w-full py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate Cover Letter'}
        </button>
      </div>

      {error && <p className="text-center text-red-600 mb-4">{error}</p>}

      {letter && (
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-charcoal">Your Cover Letter</h2>
            <button
              onClick={handleCopy}
              className="text-sm border border-primary text-primary px-3 py-1 rounded-lg hover:bg-primary hover:text-white transition"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-charcoal whitespace-pre-line leading-relaxed">{letter}</p>
        </div>
      )}
    </div>
  );
}

export default CoverLetter;