import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import useAllJobs from '../hooks/useAllJobs';
import { getErrorMessage } from '../utils/errors';
import { ErrorMessage, EmptyState, Skeleton } from '../components/Feedback';

function CoverLetter() {
  const [searchParams] = useSearchParams();
  const { jobs } = useAllJobs();
  const [selectedJobId, setSelectedJobId] = useState(searchParams.get('job') || '');
  const [resumeId, setResumeId] = useState('');
  const [resumeChecked, setResumeChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [letter, setLetter] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [resumeRes, historyRes] = await Promise.all([
        axiosClient.get('/resumes'),
        axiosClient.get('/cover-letters'),
      ]);
      const list = resumeRes.data.resumes;
      const stored = localStorage.getItem('resumeId');
      const valid = list.find((r) => r._id === stored) || list[0];
      setResumeId(valid?._id || '');
      setHistory(historyRes.data.coverLetters);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your data'));
    } finally {
      setResumeChecked(true);
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/params change
    load();
  }, [load]);

  const handleGenerate = async () => {
    setError('');
    setLetter('');

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
      const response = await axiosClient.post('/cover-letters', { resumeId, jobId: selectedJobId });
      setLetter(response.data.coverLetter.generatedText);
      setHistory((prev) => [response.data.coverLetter, ...prev]);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate cover letter'));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers/contexts where the async clipboard API is unavailable.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-8 text-center">Cover Letter Generator ✨</h1>

      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-charcoal mb-4">Select a Job</h2>
        {resumeChecked && !resumeId && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
            You need a resume first. <Link to="/resume" className="underline font-medium">Upload one here</Link>.
          </p>
        )}
        <select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 w-full mb-4"
        >
          <option value="">-- Choose a job --</option>
          {jobs.map((job) => (
            <option key={job._id} value={job._id}>
              {job.title} — {job.company?.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-primary text-white w-full py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
        >
          {generating ? 'Generating... (this can take a few seconds)' : 'Generate Cover Letter'}
        </button>
      </div>

      {error && <div className="max-w-xl mx-auto mb-4"><ErrorMessage message={error} /></div>}

      {letter && (
        <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-charcoal">Your Cover Letter</h2>
            <button
              onClick={() => handleCopy('current', letter)}
              className="text-sm border border-primary text-primary px-3 py-1 rounded-lg hover:bg-primary hover:text-white transition"
            >
              {copiedId === 'current' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-charcoal whitespace-pre-line leading-relaxed">{letter}</p>
        </div>
      )}

      <div className="max-w-xl mx-auto">
        <h2 className="text-xl font-semibold text-charcoal mb-4">Previous cover letters</h2>
        {historyLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : history.length === 0 ? (
          <EmptyState title="No cover letters yet" hint="Generate your first one above." />
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((h) => (
              <details key={h._id} className="bg-white rounded-xl shadow-sm p-4">
                <summary className="cursor-pointer flex justify-between items-center gap-3">
                  <span>
                    <span className="font-medium text-charcoal">
                      {h.job ? `${h.job.title}${h.job.company?.name ? ` — ${h.job.company.name}` : ''}` : 'Job no longer available'}
                    </span>
                    <span className="block text-xs text-gray-500">{new Date(h.createdAt).toLocaleString()}</span>
                  </span>
                </summary>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => handleCopy(h._id, h.generatedText)}
                      className="text-sm border border-primary text-primary px-3 py-1 rounded-lg hover:bg-primary hover:text-white transition"
                    >
                      {copiedId === h._id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm text-charcoal whitespace-pre-line leading-relaxed">{h.generatedText}</p>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CoverLetter;
