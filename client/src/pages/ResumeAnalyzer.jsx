import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import useAllJobs from '../hooks/useAllJobs';
import { getErrorMessage } from '../utils/errors';
import { ErrorMessage, SuccessMessage, Skeleton } from '../components/Feedback';
import { FileTextIcon, CheckIcon, SparkIcon } from '../components/Icons';
import ResumeLibrary from '../components/resume/ResumeLibrary';
import JobPicker from '../components/resume/JobPicker';
import AnalysisResultView from '../components/resume/AnalysisResultView';
import AnalysisHistory from '../components/resume/AnalysisHistory';
import AnalysisCompare from '../components/resume/AnalysisCompare';
import ScoreRing from '../components/resume/ScoreRing';
import { PanelSprig, ReadyArt } from '../components/resume/Illustrations';
import { aiErrorMessage, snapshotJobLabel } from '../components/resume/resumeUtils';

const STEPS = [
  { title: 'Upload Your Resume', sub: 'Supports PDF, DOCX, TXT (Max 5MB)' },
  { title: 'AI Analysis', sub: 'Get detailed insights and suggestions' },
  { title: 'Improve & Grow', sub: 'Build a stronger resume and land more interviews' },
];

const GETS = [
  'Readiness score (CareerNest AI assessment)',
  'Keyword analysis',
  'Skills gap identification',
  'Personalized improvement tips',
];

function ResumeAnalyzer() {
  const [searchParams] = useSearchParams();
  const initialResume = searchParams.get('resume') || '';
  const initialJob = searchParams.get('job') || '';
  const initialAnalysis = searchParams.get('analysis') || '';

  const [resumeId, setResumeId] = useState(initialResume);
  const [hasResumes, setHasResumes] = useState(true);
  const [jobId, setJobId] = useState(initialJob);
  const { jobs, loading: jobsLoading, error: jobsError } = useAllJobs();

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [compareIds, setCompareIds] = useState(null);

  const resultsRef = useRef(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await axiosClient.get('/resume-analysis');
      setHistory(res.data.analyses || []);
    } catch (err) {
      setHistoryError(getErrorMessage(err, 'Could not load your analysis history.'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    loadHistory();
  }, [loadHistory]);

  const scrollToResults = () => {
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const openAnalysis = useCallback(async (id, { scroll = true } = {}) => {
    setOpening(true);
    setError('');
    setNotice('');
    try {
      const res = await axiosClient.get(`/resume-analysis/${id}`);
      setAnalysis(res.data.analysis);
      if (scroll) scrollToResults();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open that analysis.'));
    } finally {
      setOpening(false);
    }
  }, []);

  // ?analysis=<id> opens that saved analysis on arrival.
  useEffect(() => {
    if (initialAnalysis) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- open linked analysis on mount
      openAnalysis(initialAnalysis, { scroll: false });
    }
  }, [initialAnalysis, openAnalysis]);

  const handleAnalyze = async () => {
    if (!resumeId) return;
    setAnalyzing(true);
    setError('');
    setNotice('');
    setCompareIds(null);
    try {
      const res = await axiosClient.post('/resume-analysis', { resumeId, jobId: jobId || undefined });
      const saved = res.data.analysis;
      setAnalysis(saved);
      setHistory((prev) => [saved, ...prev.filter((h) => h._id !== saved._id)]);
      if (res.data.reused) setNotice('You analysed this exact resume and job a few minutes ago, so we are showing that saved result.');
      scrollToResults();
    } catch (err) {
      setError(aiErrorMessage(err, 'Analysis failed. Please try again.'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleted = (id) => {
    setHistory((prev) => prev.filter((h) => h._id !== id));
    if (analysis?._id === id) setAnalysis(null);
    setCompareIds((c) => (c && c.includes(id) ? null : c));
  };

  const canAnalyze = !!resumeId && !analyzing;

  return (
    <div className="min-h-screen bg-bg px-4 sm:px-6 py-6">
      <div className="max-w-[1400px] mx-auto grid gap-5 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* 1. Intro panel */}
        <aside className="lg:row-span-2 rounded-2xl bg-forest text-leaf p-6 relative overflow-hidden flex flex-col min-h-0">
          <span className="self-start text-[11px] tracking-[0.18em] uppercase px-3 py-1 rounded-full bg-sidebar-hover text-leaf-muted border border-leaf-muted/30">Resume Analyzer</span>
          <h1 className="font-display text-3xl font-bold mt-4 text-leaf flex items-center gap-2">
            Boost Your Resume <FileTextIcon size={22} className="text-leaf-muted" />
          </h1>
          <p className="text-sm text-leaf-muted mt-2">Get AI-powered feedback on your resume, identify strengths and areas of improvement.</p>

          <ol className="mt-7 flex flex-col gap-6 relative">
            <span className="absolute left-[15px] top-4 bottom-4 w-px bg-leaf-muted/40" aria-hidden="true" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex items-start gap-3">
                <span className="relative z-10 w-8 h-8 shrink-0 rounded-full bg-leaf text-forest text-sm font-bold flex items-center justify-center">{i + 1}</span>
                <span>
                  <span className="block text-sm font-semibold text-leaf">{s.title}</span>
                  <span className="block text-xs text-leaf-muted mt-0.5">{s.sub}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="hidden lg:block flex-1 min-h-[120px]" />
          <PanelSprig className="hidden lg:block w-full max-w-[260px] -mb-6 -ml-6 pointer-events-none" />
        </aside>

        {/* 2. Workspace */}
        <section aria-labelledby="workspace-title" className="flex flex-col gap-4 min-w-0">
          <h2 id="workspace-title" className="sr-only">Upload and analyze</h2>
          <ResumeLibrary
            selectedId={resumeId}
            onSelect={(r) => { setResumeId(r?._id || ''); }}
            onResumesChange={(list) => setHasResumes(list.length > 0)}
            allowManage
          />

          <div className="bg-white rounded-2xl border border-sage/30 shadow-sm p-4 flex flex-col gap-4">
            <JobPicker jobs={jobs} loading={jobsLoading} error={jobsError} value={jobId} onChange={setJobId} />
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="focus-ring w-full inline-flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-full text-sm font-semibold hover:bg-primary-dark transition disabled:opacity-50"
            >
              <SparkIcon size={16} />
              {analyzing ? 'Analyzing... this can take up to a minute' : jobId ? 'Analyze against this job' : 'Analyze my resume'}
            </button>
            {!resumeId && !analyzing && (
              <p className="text-xs text-ink/60 text-center -mt-2">{hasResumes ? 'Select a resume above to continue.' : 'Upload a resume to get started.'}</p>
            )}
          </div>
          {error && <ErrorMessage message={error} onRetry={resumeId && !analyzing ? handleAnalyze : undefined} />}
        </section>

        {/* 3. Results card (summary / empty state). Full report renders below. */}
        <section aria-labelledby="results-title" className="bg-white rounded-2xl border border-sage/30 shadow-sm p-5 flex flex-col min-w-0">
          <h2 id="results-title" className="font-display text-lg font-bold text-primary flex items-center gap-2">
            <FileTextIcon size={18} /> Resume Analysis Results
          </h2>

          {analyzing || opening ? (
            <div className="mt-6 flex flex-col items-center text-center" role="status" aria-live="polite">
              <ReadyArt className="w-52 opacity-80" />
              <p className="font-semibold text-ink mt-4">{analyzing ? 'Analyzing your resume...' : 'Opening analysis...'}</p>
              <p className="text-sm text-ink/60 mt-1">We are reading your resume carefully. Please keep this page open.</p>
              <Skeleton className="h-3 w-2/3 mt-4" />
            </div>
          ) : analysis ? (
            <div className="mt-4 flex flex-col items-center text-center">
              <div className="flex flex-wrap justify-center gap-6">
                <ScoreRing value={analysis.result?.overallScore ?? analysis.overallScore} label="AI readiness score" size={120} />
                {(analysis.type === 'job-specific' || analysis.job || analysis.jobSnapshot?.title) && (
                  <ScoreRing value={analysis.matchPercentage} label="Job match" size={120} />
                )}
              </div>
              <p className="text-sm text-ink/70 mt-3">{snapshotJobLabel(analysis) || 'General analysis'}</p>
              <p className="text-xs text-ink/60 mt-1">CareerNest AI assessment. The full report is below.</p>
              <button type="button" onClick={scrollToResults} className="focus-ring mt-3 text-sm px-4 py-2 rounded-full text-primary border border-sage/60 hover:bg-mint">
                View full report
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center text-center">
              <ReadyArt className="w-64 max-w-full" />
              <p className="font-display text-lg font-bold text-ink mt-4">Your resume is ready for analysis!</p>
              <p className="text-sm text-ink/70 mt-1 max-w-sm">Upload or select a resume to get detailed feedback on your skills, experience, and how to improve it for better opportunities.</p>
              <div className="w-full mt-5 rounded-xl bg-mint/70 p-4 text-left">
                <p className="text-sm font-semibold text-primary mb-2">What you&rsquo;ll get:</p>
                <ul className="flex flex-col gap-2">
                  {GETS.map((g) => (
                    <li key={g} className="flex items-center gap-2 text-sm text-ink">
                      <CheckIcon size={15} className="text-accent shrink-0" /> {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* Full results, history, compare: span the workspace + results columns */}
        <div ref={resultsRef} className="lg:col-span-2 flex flex-col gap-5 min-w-0 scroll-mt-20">
          {notice && <SuccessMessage message={notice} />}
          {analysis && !analyzing && !opening && <AnalysisResultView analysis={analysis} />}
          {compareIds && <AnalysisCompare ids={compareIds} onClose={() => setCompareIds(null)} />}
          <AnalysisHistory
            analyses={history}
            loading={historyLoading}
            error={historyError}
            onRetry={loadHistory}
            activeId={analysis?._id}
            onOpen={(id) => openAnalysis(id)}
            onDeleted={handleDeleted}
            onCompare={setCompareIds}
          />
        </div>
      </div>
    </div>
  );
}

export default ResumeAnalyzer;
