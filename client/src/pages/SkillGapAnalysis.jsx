import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import useSkillGapAnalysis from '../hooks/useSkillGapAnalysis';
import { Skeleton, ErrorMessage } from '../components/Feedback';
import Tabs from '../components/skillgap/Tabs';
import AnalyzeTab from '../components/skillgap/AnalyzeTab';
import ResultsView from '../components/skillgap/ResultsView';
import ProgressTab from '../components/skillgap/ProgressTab';
import HistoryTab from '../components/skillgap/HistoryTab';

const TAB_IDS = ['analyze', 'progress', 'history'];

function SkillGapAnalysis() {
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.includes(params.get('tab')) ? params.get('tab') : 'analyze';
  const analysisId = params.get('analysis') || '';
  const [jobSeed, setJobSeed] = useState(() => params.get('job') || '');

  const sg = useSkillGapAnalysis();
  const { open } = sg;
  const shownId = useRef('');
  useEffect(() => { shownId.current = sg.analysis?._id || ''; }, [sg.analysis]);

  // ?analysis=<id> opens that saved analysis.
  useEffect(() => {
    if (analysisId && shownId.current !== analysisId) {
      open(analysisId);
    }
  }, [analysisId, open]);

  const goTab = (id) => {
    const next = { tab: id };
    if (id === 'analyze' && sg.analysis) next.analysis = sg.analysis._id;
    setParams(next);
  };

  const openAnalysis = (id) => setParams({ tab: 'analyze', analysis: id });

  const startNew = () => {
    sg.clear();
    setJobSeed('');
    setParams({ tab: 'analyze' });
  };

  const submit = async (kind, body) => {
    const created = await sg.create(kind, body);
    if (created) {
      setJobSeed('');
      setParams({ tab: 'analyze', analysis: created._id });
    }
  };

  const onDeleted = (id) => {
    if (sg.analysis?._id === id || analysisId === id) {
      sg.clear();
      setParams({ tab: 'history' });
    }
  };

  const showingResult = tab === 'analyze' && (analysisId || sg.analysis);

  return (
    <div className="min-h-screen bg-bg px-4 sm:px-6 py-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-5">
        <header className="rounded-2xl bg-forest text-leaf p-6 sm:p-8">
          <span className="inline-block text-[11px] tracking-[0.18em] uppercase px-3 py-1 rounded-full bg-sidebar-hover text-leaf-muted border border-leaf-muted/30">Skill Gap Analysis</span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-4 text-leaf">Close the gap to your next role</h1>
          <p className="text-sm sm:text-base text-leaf-muted mt-2 max-w-2xl">
            Understand where you are today, discover the skills your target role requires, and build a clear roadmap to get there.
          </p>
        </header>

        <Tabs value={tab} onChange={goTab} />

        <div id="sg-panel" role="tabpanel" aria-labelledby={`sg-tab-${tab}`} className="min-w-0">
          {tab === 'analyze' && (
            showingResult ? (
              sg.opening || (!sg.analysis && !sg.error) ? (
                <div className="flex flex-col gap-4" role="status" aria-live="polite">
                  <Skeleton className="h-40" /><Skeleton className="h-64" />
                </div>
              ) : sg.analysis ? (
                <ResultsView analysis={sg.analysis} notice={sg.notice} onNew={startNew} />
              ) : (
                <div className="flex flex-col gap-3">
                  <ErrorMessage message={sg.error} />
                  <button type="button" onClick={startNew} className="focus-ring self-start px-4 py-2 rounded-full text-sm text-primary border border-sage/60 hover:bg-mint">Start a new analysis</button>
                </div>
              )
            ) : (
              <AnalyzeTab initialJob={jobSeed} busy={sg.busy} error={sg.error} onSubmit={submit} />
            )
          )}
          {tab === 'progress' && <ProgressTab onOpenAnalysis={openAnalysis} onStart={startNew} />}
          {tab === 'history' && <HistoryTab onOpen={openAnalysis} onDeleted={onDeleted} onStart={startNew} />}
        </div>
      </div>
    </div>
  );
}

export default SkillGapAnalysis;
