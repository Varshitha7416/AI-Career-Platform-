import { Link } from 'react-router-dom';
import ProgressRing from './ProgressRing';
import { ForestLeaves } from './Botanical';
import { CheckCircle, OpenCircle, TargetIcon } from './DashIcons';
import { clampPercent } from './format';

// Dark forest-green card: message, circular goal progress and the milestone checklist.
// Fixed forest/mint colours on purpose: it is the one dark surface and must read well in both themes.
function CareerProgressCard({ progress, className = '' }) {
  const pct = clampPercent(progress.percent);
  const done = progress.milestones.filter((m) => m.done).length;

  return (
    <section aria-labelledby="progress-heading" className={`relative overflow-hidden rounded-2xl bg-[#0B2B26] text-[#DAF1DE] shadow-lg p-5 sm:p-6 border border-[#235347] ${className}`}>
      <ForestLeaves className="absolute right-0 bottom-0 w-40 h-32 sm:w-64 sm:h-52 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 text-[#8EB69B] text-xs font-semibold tracking-[0.12em]">
          <TargetIcon size={16} /> CAREER PROGRESS
        </div>
        <h2 id="progress-heading" className="font-display text-xl font-bold text-white mt-1 leading-snug">{progress.message}</h2>

        <div className="mt-5 flex items-center gap-5">
          <ProgressRing percent={pct} size={104} stroke={11} trackClass="text-[#235347]" barClass="text-[#8EB69B]" label={`Career goal ${pct}% complete`}>
            <span className="font-display text-3xl font-bold text-white leading-none">{pct}<span className="text-base">%</span></span>
            <span className="text-[10px] text-[#8EB69B] mt-1">of your goal</span>
          </ProgressRing>
          <p className="text-sm text-[#DAF1DE]/90">
            <strong className="text-white">{done} of {progress.milestones.length}</strong> milestones completed. Keep going — every step counts.
          </p>
        </div>

        <ul className="mt-5 space-y-1.5">
          {progress.milestones.map((m) => {
            const partial = !m.done && m.target > 1 && m.progress > 0;
            return (
              <li key={m.key}>
                <Link
                  to={m.link}
                  title={m.hint}
                  className="focus-ring flex items-start gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-[#235347]/60 transition"
                >
                  {m.done ? <CheckCircle size={20} className="text-[#8EB69B] shrink-0 mt-0.5" /> : <OpenCircle size={20} className="text-[#8EB69B]/70 shrink-0 mt-0.5" />}
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${m.done ? 'text-white' : 'text-[#DAF1DE]/90'}`}>
                      {m.label}
                      {m.target > 1 && <span className="text-[#8EB69B] text-xs ml-1.5">{Math.min(m.progress, m.target)}/{m.target}</span>}
                    </span>
                    {partial && (
                      <span className="block mt-1 h-1 rounded-full bg-[#235347] overflow-hidden" role="presentation">
                        <span className="block h-full rounded-full bg-[#8EB69B]" style={{ width: `${clampPercent((m.progress / m.target) * 100)}%` }} />
                      </span>
                    )}
                    {!m.done && m.hint && <span className="block text-xs text-[#8EB69B] mt-0.5">{m.hint}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default CareerProgressCard;
