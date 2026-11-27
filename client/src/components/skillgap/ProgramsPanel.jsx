import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPrograms } from '../../api/skillGap';
import { Skeleton, ErrorMessage } from '../Feedback';
import { aiErrorMessage, CARD } from './skillGapUtils';

/** Real Career Programs matched to the analysis gaps. Empty state when none match (nothing is invented). */
function ProgramsPanel({ analysisId }) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPrograms(analysisId);
      setPrograms(res.programs || []);
    } catch (err) {
      setError(aiErrorMessage(err, 'Could not load recommended programs.'));
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / analysis change
    load();
  }, [load]);

  return (
    <section className={CARD} aria-labelledby="sg-programs-h">
      <h3 id="sg-programs-h" className="font-display text-xl font-bold text-primary">Recommended Career Programs</h3>
      {loading ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : error ? (
        <div className="mt-3"><ErrorMessage message={error} onRetry={load} /></div>
      ) : programs.length === 0 ? (
        <p className="text-sm text-ink/70 mt-2">
          No Career Programs in our catalogue match these skills yet. Your roadmap tasks still describe practical ways to learn them.
          {' '}<Link to="/programs" className="text-primary underline">Browse all programs</Link>
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {programs.map(({ program, matchedSkills, enrollment }) => (
            <li key={program._id} className="rounded-xl border border-sage/40 p-4 flex flex-col gap-1.5">
              <Link to={`/programs/${program._id}`} className="focus-ring font-semibold text-sm text-primary hover:underline rounded">{program.title}</Link>
              <p className="text-xs text-ink/60">{[program.provider, program.level, program.duration].filter(Boolean).join(' - ')}</p>
              {matchedSkills?.length > 0 && (
                <p className="text-xs text-ink/80">Covers: {matchedSkills.join(', ')}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
                {enrollment?.status && <span className="px-2 py-0.5 rounded-full bg-mint text-primary font-semibold">{enrollment.status}</span>}
                <Link to={`/programs/${program._id}`} className="text-primary underline">View program</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ProgramsPanel;
