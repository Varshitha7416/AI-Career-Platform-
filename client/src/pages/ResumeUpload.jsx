import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import useAllJobs from '../hooks/useAllJobs';
import { getErrorMessage } from '../utils/errors';
import { ErrorMessage, SuccessMessage, EmptyState, Skeleton } from '../components/Feedback';

const MAX_SIZE = 5 * 1024 * 1024;

function List({ title, items }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold text-charcoal mb-1">{title}</h3>
      {items?.length ? (
        <ul className="list-disc list-inside text-sm text-charcoal">
          {items.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">None</p>
      )}
    </div>
  );
}

function AnalysisResult({ analysis }) {
  return (
    <div>
      {analysis.matchPercentage !== null && analysis.matchPercentage !== undefined && (
        <p className="mb-4">
          <span className="text-2xl font-bold text-primary">{analysis.matchPercentage}%</span>
          <span className="text-sm text-gray-500 ml-2">match</span>
        </p>
      )}
      <List title="Strengths" items={analysis.strengths} />
      <List title="Missing Skills" items={analysis.missingSkills} />
      <List title="Suggestions" items={analysis.suggestions} />
    </div>
  );
}

function ResumeUpload() {
  const [searchParams] = useSearchParams();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resumeId, setResumeId] = useState('');
  const [resumes, setResumes] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(searchParams.get('job') || '');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [openHistoryId, setOpenHistoryId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { jobs } = useAllJobs();

  const loadResumesAndHistory = useCallback(async () => {
    try {
      const [resumeRes, historyRes] = await Promise.all([
        axiosClient.get('/resumes'),
        axiosClient.get('/resume-analysis'),
      ]);
      setResumes(resumeRes.data.resumes);
      setHistory(historyRes.data.analyses);

      // Reuse the remembered resume if it still exists, otherwise the newest one.
      const stored = localStorage.getItem('resumeId');
      const list = resumeRes.data.resumes;
      const valid = list.find((r) => r._id === stored) || list[0];
      if (valid) {
        setResumeId(valid._id);
        localStorage.setItem('resumeId', valid._id);
      } else {
        localStorage.removeItem('resumeId');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your resumes'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/params change
    loadResumesAndHistory();
  }, [loadResumesAndHistory]);

  const handleFileChange = (e) => {
    setError('');
    setSuccess('');
    const f = e.target.files[0];
    if (!f) return setFile(null);
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setFile(null);
      e.target.value = '';
      return setError('Only PDF files are supported.');
    }
    if (f.size > MAX_SIZE) {
      setFile(null);
      e.target.value = '';
      return setError('File is too large. Maximum size is 5MB.');
    }
    setFile(f);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('resumeFile', file);

    try {
      const response = await axiosClient.post('/resumes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newResume = response.data.resume;
      setResumeId(newResume._id);
      setResumes((prev) => [newResume, ...prev]);
      localStorage.setItem('resumeId', newResume._id);
      setSuccess('Resume uploaded successfully.');
      setFile(null);
      e.target.reset();
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    setSuccess('');
    setAnalysis(null);

    try {
      const response = await axiosClient.post('/resume-analysis', {
        resumeId,
        jobId: selectedJobId || undefined,
      });
      setAnalysis(response.data.analysis);
      setHistory((prev) => [response.data.analysis, ...prev]);
    } catch (err) {
      setError(getErrorMessage(err, 'Analysis failed'));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-8 text-center">Resume Analyzer</h1>

      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-charcoal mb-4">1. Upload Resume (PDF, max 5MB)</h2>
        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
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
        {resumeId && (
          <p className="text-sm text-accent mt-3">
            Using: {resumes.find((r) => r._id === resumeId)?.fileName || 'your resume'}
          </p>
        )}
        {resumes.length > 1 && (
          <select
            value={resumeId}
            onChange={(e) => {
              setResumeId(e.target.value);
              localStorage.setItem('resumeId', e.target.value);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 w-full mt-3 text-sm"
            aria-label="Choose resume"
          >
            {resumes.map((r) => (
              <option key={r._id} value={r._id}>
                {r.fileName} ({new Date(r.createdAt).toLocaleDateString()})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="max-w-xl mx-auto mb-6 flex flex-col gap-3">
        {error && <ErrorMessage message={error} />}
        {success && <SuccessMessage message={success} />}
      </div>

      {resumeId && (
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-charcoal mb-4">2. Analyze ✨</h2>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 w-full mb-4"
          >
            <option value="">General analysis (no specific job)</option>
            {jobs.map((job) => (
              <option key={job._id} value={job._id}>
                {job.title} — {job.company?.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-accent text-white px-6 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {analyzing ? 'Analyzing... (this can take a few seconds)' : 'Run Analysis'}
          </button>
        </div>
      )}

      {analysis && (
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-charcoal mb-4">Results</h2>
          <AnalysisResult analysis={analysis} />
        </div>
      )}

      <div className="max-w-xl mx-auto">
        <h2 className="text-xl font-semibold text-charcoal mb-4">Previous analyses</h2>
        {historyLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : history.length === 0 ? (
          <EmptyState title="No analyses yet" hint="Run your first analysis above." />
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((h) => (
              <div key={h._id} className="bg-white rounded-xl shadow-sm p-4">
                <button
                  onClick={() => setOpenHistoryId(openHistoryId === h._id ? null : h._id)}
                  className="w-full flex justify-between items-center text-left gap-3"
                >
                  <span>
                    <span className="font-medium text-charcoal">
                      {h.job ? `${h.job.title}${h.job.company?.name ? ` — ${h.job.company.name}` : ''}` : 'General analysis'}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {h.resume?.fileName} · {new Date(h.createdAt).toLocaleString()}
                    </span>
                  </span>
                  <span className="text-primary font-bold shrink-0">
                    {h.matchPercentage !== null && h.matchPercentage !== undefined ? `${h.matchPercentage}%` : '—'}
                  </span>
                </button>
                {openHistoryId === h._id && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <AnalysisResult analysis={h} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResumeUpload;
