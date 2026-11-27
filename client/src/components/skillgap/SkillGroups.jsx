import { CARD, PRIORITY_STYLE, kindLabel, levelLabel } from './skillGapUtils';

const ORDER = { high: 0, medium: 1, low: 2 };
const byPriority = (a, b) => (ORDER[a.priority || a.importance] ?? 3) - (ORDER[b.priority || b.importance] ?? 3);

function Group({ title, subtitle, count, tone, empty, children }) {
  return (
    <section className={CARD} aria-label={title}>
      <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${tone}`} aria-hidden="true" />
        {title} <span className="text-sm font-normal text-ink/60">({count})</span>
      </h3>
      {subtitle && <p className="text-xs text-ink/70 mt-1">{subtitle}</p>}
      {count === 0 ? <p className="text-sm text-ink/60 mt-2">{empty}</p> : <ul className="mt-3 flex flex-col gap-2.5">{children}</ul>}
    </section>
  );
}

function Tag({ children, className = 'border border-sage/60 text-primary' }) {
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${className}`}>{children}</span>;
}

function PriorityTag({ p }) {
  return p ? <Tag className={PRIORITY_STYLE[p] || PRIORITY_STYLE.low}>{p} priority</Tag> : null;
}

/** Matched / partial / missing / additional groups plus the priority order. */
function SkillGroups({ analysis }) {
  const r = analysis.result || {};
  const matched = r.matched || [];
  const partial = r.partial || [];
  const missing = [...(r.missing || [])].sort(byPriority);
  const additional = r.additional || [];
  const pri = r.priorities || {};
  const hasPriorities = ['high', 'medium', 'low'].some((k) => (pri[k] || []).length);
  const isResume = analysis.mode === 'resume';

  return (
    <div className="flex flex-col gap-4">
      {hasPriorities && (
        <section className={CARD} aria-label="Learning priorities">
          <h3 className="font-display text-lg font-bold text-primary">What to learn first</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {['high', 'medium', 'low'].map((k) => (
              <div key={k}>
                <p className="mb-1.5"><PriorityTag p={k} /></p>
                {(pri[k] || []).length ? (
                  <ul className="flex flex-wrap gap-1.5">{pri[k].map((s) => <li key={s} className="text-xs px-2.5 py-1 rounded-full bg-mint text-ink">{s}</li>)}</ul>
                ) : <p className="text-xs text-ink/65">None</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Group
          title={isResume ? 'Skills shown in use' : 'Skills you have'}
          subtitle={isResume ? 'Your resume shows these in a project, job or achievement.' : 'Skills you entered that this target lists. They are self-reported, not verified.'}
          count={matched.length}
          tone="bg-accent"
          empty="No listed skills were matched yet."
        >
          {matched.map((m) => (
            <li key={m.key || m.skill} className="rounded-lg border border-sage/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{m.skill}</span>
                <Tag>{kindLabel(m.kind)}</Tag>
                <Tag className="bg-mint text-primary">{m.source === 'resume' ? 'Shown in use' : 'Manual input'}</Tag>
                {m.level && <Tag>{levelLabel(m.level)}</Tag>}
              </div>
              {m.evidence && <p className="text-xs text-ink/70 mt-1.5 break-words"><span className="not-italic font-medium">In your resume: </span><span className="italic">&ldquo;{m.evidence}&rdquo;</span></p>}
            </li>
          ))}
        </Group>

        {isResume && (
          <Group
            title="Partially demonstrated"
            subtitle="Your resume lists or mentions these, but does not show practical use. They count half toward the score."
            count={partial.length}
            tone="bg-amber-500"
            empty="Every skill your resume names is also shown in use."
          >
            {partial.map((p) => (
              <li key={p.key || p.skill} className="rounded-lg border border-sage/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{p.skill}</span>
                  <Tag>{kindLabel(p.kind)}</Tag>
                  <Tag className={PRIORITY_STYLE.medium}>{p.mention === 'skills-list' ? 'Listed in skills section' : 'Mentioned only'}</Tag>
                  <PriorityTag p={p.importance} />
                </div>
                {p.reason && <p className="text-xs text-ink/70 mt-1.5">{p.reason}</p>}
                {p.evidence && <p className="text-xs text-ink/70 mt-1 break-words"><span className="not-italic font-medium">In your resume: </span><span className="italic">&ldquo;{p.evidence}&rdquo;</span></p>}
                {p.suggestion && <p className="text-xs text-primary mt-1">Tip: {p.suggestion}</p>}
              </li>
            ))}
          </Group>
        )}

        <Group title="Skills to build" count={missing.length} tone="bg-red-500" empty="No gaps found against this target.">
          {missing.map((m) => (
            <li key={m.key || m.skill} className="rounded-lg border border-sage/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{m.skill}</span>
                <Tag>{kindLabel(m.kind)}</Tag>
                <PriorityTag p={m.priority || m.importance} />
              </div>
              {m.why && <p className="text-xs text-ink/70 mt-1.5">{m.why}</p>}
            </li>
          ))}
        </Group>

        <Group title="Extra strengths" count={additional.length} tone="bg-primary" empty="No additional skills were noted.">
          {additional.map((a) => (
            <li key={a.key || a.skill} className="rounded-lg border border-sage/40 p-3">
              <span className="text-sm font-semibold text-ink">{a.skill}</span>
              {a.note && <p className="text-xs text-ink/70 mt-1">{a.note}</p>}
            </li>
          ))}
        </Group>
      </div>
    </div>
  );
}

export default SkillGroups;
