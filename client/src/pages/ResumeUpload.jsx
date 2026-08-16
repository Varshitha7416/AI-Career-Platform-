import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resumeId, setResumeId] = useState(localStorage.getItem('resumeId') || '');
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    axiosClient.get('/jobs').then((res) => setJobs(res.data.jobs));
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('userId', user.id);
    formData.append('resumeFile', file);

    try {
      const response = await axiosClient.post('/resumes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResumeId(response.data.resume._id);
      localStorage.setItem('resumeId', response.data.resume._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    setAnalysis(null);

    try {
      const response = await axiosClient.post('/resume-analysis', {
        userId: user.id,
        resumeId,
        jobId: selectedJobId || undefined,
      });
      setAnalysis(response.data.analysis);
    } catch (err) {
      setError(err.response?.data?.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-8 text-center">Resume Analyzer</h1>

      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-charcoal mb-4">1. Upload Resume (PDF)</h2>
        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="border border-gray-300 rounded-lg px-4 py-2"
          />
          <button
            type="submit"
            disabled={uploading || !file}
            className="bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Resume'}
          </button>
        </form>
        {resumeId && <p className="text-sm text-accent mt-3">Resume ready for analysis.</p>}
      </div>

      {resumeId && (
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-charcoal mb-4">2. Analyze</h2>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 w-full mb-4"
          >
            <option value="">General analysis (no specific job)</option>
            {jobs.map((job) => (
              <option key={job._id} value={job._id}>
                {job.title} — {job.company}
              </option>
            ))}
          </select>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-accent text-white px-6 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
      )}

      {error && <p className="text-center text-red-600 mb-4">{error}</p>}

      {analysis && (
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-charcoal mb-4">Results</h2>

          {analysis.matchPercentage !== null && (
            <p className="mb-4">
              <span className="text-2xl font-bold text-primary">{analysis.matchPercentage}%</span>
              <span className="text-sm text-gray-500 ml-2">match</span>
            </p>
          )}

          <div className="mb-4">
            <h3 className="font-semibold text-charcoal mb-1">Strengths</h3>
            <ul className="list-disc list-inside text-sm text-charcoal">
              {analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold text-charcoal mb-1">Missing Skills</h3>
            <ul className="list-disc list-inside text-sm text-charcoal">
              {analysis.missingSkills.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-charcoal mb-1">Suggestions</h3>
            <ul className="list-disc list-inside text-sm text-charcoal">
              {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResumeUpload;