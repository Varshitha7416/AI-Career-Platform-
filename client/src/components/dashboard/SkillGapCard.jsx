import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import SectionCard from './SectionCard';
import { ArrowRight } from './DashIcons';

// Dashboard card for Skill Gap Analysis. Reads GET /api/skill-gap/overview (real saved data only). It loads on its
// own so a failure here never blocks the rest of the dashboard.
function SkillGapCard({ className = '' }) {
  const [state, setState] = useState({ loading: true, data: null, error: false });

  useEffect(() => {
    let alive = true;
    axiosClient.get('/skill-gap/overview')
      .then((r) => { if (alive) setState({ loading: false, data: r.data, error: false }); })
      .catch(() => { if (alive) setState({ loading: false, data: null, error: true }); });
    return () => { alive = false; };
  }, []);

  const { loading, data, error } = state;
  const analysis = data?.latestAnalysis;
  const totals = data?.totals;
  const next = data?.nextAction;

  return (
    <SectionCard id="dash-skillgap" title="Skill Gap Analysis" subtitle="Your latest analysis and learning progress" viewAll={{ to: '/skill-gap-analysis' }} className={className}>
      {loading && <div className="h-24 rounded-xl bg-mint/60 animate-pulse" aria-label="Loading skill gap summary" />}
      {!loading && error && <p className="text-sm text-ink/70">We couldn&apos;t load your skill gap summary right now. <Link to="/skill-gap-analysis" className="text-primary underline">Open Skill Gap Analysis</Link>.</p>}
      {!loading && !error && !analysis && (
        <div className="text-sm text-ink/75">
          <p>You haven&apos;t run a skill gap analysis yet. Compare your resume or your skills with a target role and get a learning roadmap.</p>
          <Link to="/skill-gap-analysis" className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary text-white text-sm px-4 py-2 hover:bg-primary-dark transition">Start an analysis <ArrowRight size={14} /></Link>
        </div>
      )}
      {!loading && !error && analysis && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink/60">Latest analysis</p>
            <p className="font-semibold text-ink leading-snug">{analysis.title || analysis.targetRole}</p>
            <p className="mt-2 text-3xl font-display font-bold text-primary">{analysis.score?.value ?? '--'}<span className="text-sm font-normal text-ink/60">/100 skill match</span></p>
            <p className="text-xs text-ink/60 mt-1">{analysis.counts?.missing ?? 0} missing · {analysis.counts?.partial ?? 0} partially shown</p>
          </div>
          <div>
            {totals && totals.tasks > 0 ? (
              <>
                <p className="text-xs text-ink/60">Roadmap progress</p>
                <div className="mt-1 h-2.5 rounded-full bg-sage/30 overflow-hidden" role="progressbar" aria-valuenow={totals.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Roadmap progress">
                  <div className="h-full bg-accent" style={{ width: `${totals.percent}%` }} />
                </div>
                <p className="text-xs text-ink/70 mt-1">{totals.completed} of {totals.tasks} tasks done ({totals.percent}%)</p>
                {next && <Link to={`/skill-gap-analysis?analysis=${next.analysisId}&tab=progress`} className="focus-ring mt-3 block text-sm text-primary hover:underline">Next: {next.title}</Link>}
              </>
            ) : (
              <>
                <p className="text-xs text-ink/60">Roadmap</p>
                <p className="text-sm text-ink/75 mt-1">No learning roadmap yet for your latest analysis.</p>
                <Link to={`/skill-gap-analysis?analysis=${analysis._id}`} className="focus-ring mt-2 inline-block text-sm text-primary hover:underline">Open analysis</Link>
              </>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export default SkillGapCard;
