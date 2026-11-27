// Deterministic roadmap skeleton: derived ONLY from the analysis' real missing / partial skills.
const { canonicalKey } = require('../ai/skillSynonyms');

const MAX_GAPS = 18; // keeps a roadmap realistic; lowest-priority gaps beyond this are left out
const MAX_TASKS_PER_STAGE = 6;
const MIN_HOURS = 2;
const MAX_HOURS = 40;

const k = canonicalKey;
// prerequisite -> dependants: learning order only applies when BOTH skills are real gaps.
const PREREQ_PAIRS = [
  ['HTML', ['CSS', 'JavaScript', 'React', 'Vue', 'Angular']],
  ['CSS', ['Tailwind CSS', 'React']],
  ['JavaScript', ['TypeScript', 'React', 'Node.js', 'Vue', 'Angular', 'Express', 'Next.js', 'React Native', 'Redux']],
  ['React', ['Next.js', 'Redux', 'React Native']],
  ['Node.js', ['Express']],
  ['Express', ['REST APIs']],
  ['Python', ['Pandas', 'NumPy', 'Django', 'Flask', 'FastAPI', 'scikit-learn', 'Machine Learning', 'TensorFlow', 'PyTorch', 'Airflow']],
  ['Java', ['Spring Boot']],
  ['SQL', ['MySQL', 'PostgreSQL', 'Data Analysis', 'ETL']],
  ['Pandas', ['Data Analysis', 'scikit-learn']],
  ['Data Analysis', ['Data Visualization']],
  ['Machine Learning', ['Deep Learning', 'Natural Language Processing', 'Computer Vision', 'TensorFlow', 'PyTorch']],
  ['Deep Learning', ['TensorFlow', 'PyTorch', 'Natural Language Processing', 'Computer Vision']],
  ['Linux', ['Docker', 'Kubernetes', 'Terraform']],
  ['Docker', ['Kubernetes']],
  ['Git', ['CI/CD']],
  ['Unit Testing', ['Test Automation', 'CI/CD']],
  ['REST APIs', ['GraphQL', 'Microservices', 'OAuth', 'Postman']],
  ['Data Structures', ['System Design']],
  ['OOP', ['System Design']],
  ['AWS', ['Terraform']],
  ['Agile', ['Jira']],
];
const PREREQS = new Map(); // dependant key -> Set(prereq key)
PREREQ_PAIRS.forEach(([pre, deps]) => deps.forEach((d) => {
  if (!PREREQS.has(k(d))) PREREQS.set(k(d), new Set());
  PREREQS.get(k(d)).add(k(pre));
}));

const FOUNDATIONAL = new Set(['HTML', 'CSS', 'JavaScript', 'Python', 'Java', 'SQL', 'Git', 'Linux', 'Data Structures', 'OOP', 'Excel', 'Agile', 'Communication', 'C', 'C++'].map(k));
const HEAVY = new Set(['Kubernetes', 'Machine Learning', 'Deep Learning', 'System Design', 'Microservices', 'Natural Language Processing', 'Computer Vision', 'Apache Spark', 'Hadoop', 'Cybersecurity', 'Terraform', 'Leadership'].map(k));
const LIGHT = new Set(['Git', 'Jira', 'Postman', 'Excel', 'Agile', 'Redux', 'Tailwind CSS', 'Figma', 'SEO', 'Firebase'].map(k));

const RANK = { high: 0, medium: 1, low: 2 };
const KIND_RANK = { required: 0, preferred: 1, recommended: 2 };
const rankOf = (p) => (RANK[p] === undefined ? 1 : RANK[p]);

const clampHours = (n) => Math.max(MIN_HOURS, Math.min(MAX_HOURS, Math.round(n)));

// Realistic, bounded estimate. Partial skills (already shown but not demonstrated) need far less time.
const estimateHours = (gap) => {
  let h = 14;
  if (HEAVY.has(gap.key)) h = 30;
  else if (LIGHT.has(gap.key)) h = 6;
  else if (FOUNDATIONAL.has(gap.key)) h = 18;
  if (gap.partial) h *= 0.5;
  if (gap.priority === 'low') h *= 0.8;
  return clampHours(h);
};

// Collect the gaps (missing first, then partial) with a priority; de-duplicate by key.
const collectGaps = (analysis) => {
  const result = (analysis && analysis.result) || {};
  const seen = new Set();
  const gaps = [];
  const add = (item, partial) => {
    if (!item || !item.skill) return;
    const key = item.key || k(item.skill);
    if (seen.has(key)) return;
    seen.add(key);
    const priority = partial ? (item.importance || 'medium') : (item.priority || item.importance || 'medium');
    gaps.push({
      skill: item.skill, key, partial: !!partial,
      priority: RANK[priority] === undefined ? 'medium' : priority,
      kind: item.kind || 'required',
      why: item.why || item.reason || item.suggestion || '',
    });
  };
  (result.missing || []).forEach((m) => add(m, false));
  (result.partial || []).forEach((p) => add(p, true));
  return gaps;
};

const levelOf = (gap) => {
  if (FOUNDATIONAL.has(gap.key) && !gap.partial) return 0;
  if (gap.priority === 'low' || gap.kind === 'recommended') return 2;
  return 1;
};

const STAGE_META = [
  { title: 'Foundation', goal: 'Build the base skills the role expects, so later topics make sense.' },
  { title: 'Core role skills', goal: 'Learn the main skills this role asks for, starting with the highest priority.' },
  { title: 'Supporting and advanced skills', goal: 'Close the remaining lower-priority gaps and deepen what you already show.' },
];

const taskTitle = (gap) => (gap.partial ? `Demonstrate ${gap.skill} with real work` : `Learn ${gap.skill}`);
const defaultObjective = (gap) => (gap.partial
  ? `Turn your existing exposure to ${gap.skill} into skill you can clearly demonstrate.`
  : `Be able to use ${gap.skill} for the kind of work this role involves.`);
const defaultActivity = (gap) => `Study ${gap.skill} fundamentals, then practise on small tasks that match your target role.`;
const defaultExercise = (gap) => `Build a small project or exercise that uses ${gap.skill} the way the target role would, and write down what you learned.`;
const defaultCriteria = (gap) => `You can explain ${gap.skill} and show a working example you built yourself.`;

// -> { stages, truncated, gapCount }
const buildSkeleton = (analysis) => {
  let gaps = collectGaps(analysis);
  const total = gaps.length;
  gaps.sort((a, b) => rankOf(a.priority) - rankOf(b.priority)
    || (a.partial === b.partial ? 0 : a.partial ? 1 : -1)
    || (KIND_RANK[a.kind] ?? 3) - (KIND_RANK[b.kind] ?? 3)
    || a.skill.localeCompare(b.skill));
  gaps = gaps.slice(0, MAX_GAPS);
  const gapKeys = new Set(gaps.map((g) => g.key));

  // Prerequisite depth counted only among real gaps (cycle-safe).
  const depthOf = (key, seen = new Set()) => {
    if (seen.has(key)) return 0;
    seen.add(key);
    let d = 0;
    (PREREQS.get(key) || []).forEach((p) => { if (gapKeys.has(p)) d = Math.max(d, 1 + depthOf(p, new Set(seen))); });
    return d;
  };
  gaps.forEach((g) => { g.depth = depthOf(g.key); g.level = levelOf(g); });
  // A skill never sits in an earlier stage than its prerequisite.
  const byKey = new Map(gaps.map((g) => [g.key, g]));
  for (let i = 0; i < gaps.length + 1; i += 1) {
    gaps.forEach((g) => (PREREQS.get(g.key) || []).forEach((p) => {
      const pg = byKey.get(p);
      if (pg && pg.level > g.level) g.level = pg.level;
    }));
  }
  const order = [...gaps].sort((a, b) => a.level - b.level || a.depth - b.depth
    || rankOf(a.priority) - rankOf(b.priority) || a.skill.localeCompare(b.skill));

  const buckets = [[], [], []];
  order.forEach((g) => buckets[g.level].push(g));
  const stages = [];
  let taskN = 0;
  buckets.forEach((list, lvl) => {
    for (let i = 0; i < list.length; i += MAX_TASKS_PER_STAGE) {
      const chunk = list.slice(i, i + MAX_TASKS_PER_STAGE);
      const part = i / MAX_TASKS_PER_STAGE;
      stages.push({
        title: part ? `${STAGE_META[lvl].title} (part ${part + 1})` : STAGE_META[lvl].title,
        goal: STAGE_META[lvl].goal,
        tasks: chunk.map((g) => {
          taskN += 1;
          return {
            id: `t${taskN}`, skill: g.skill, skillKey: g.key, priority: g.priority, partial: g.partial, kind: g.kind, why: g.why,
            title: taskTitle(g), objective: defaultObjective(g), activity: defaultActivity(g), exercise: defaultExercise(g),
            completionCriteria: defaultCriteria(g), estimatedHours: estimateHours(g),
          };
        }),
      });
    }
  });
  stages.forEach((s, i) => { s.id = `s${i + 1}`; s.order = i + 1; });
  return { stages, truncated: total > gaps.length, gapCount: total };
};

const estimateNote = (stages, weeklyHours) => {
  const hours = stages.reduce((n, s) => n + s.tasks.reduce((m, t) => m + t.estimatedHours, 0), 0);
  const base = 'Estimates are rough and vary with your experience and the time you can spend; treat them as a guide, not a deadline.';
  if (!weeklyHours) return `${base} No pace was set, so there is no fixed duration.`;
  const weeks = Math.max(1, Math.ceil(hours / weeklyHours));
  return `${base} At about ${weeklyHours} hour${weeklyHours === 1 ? '' : 's'} a week, roughly ${hours} hours of work would take around ${weeks} week${weeks === 1 ? '' : 's'}.`;
};

module.exports = { buildSkeleton, collectGaps, estimateHours, estimateNote, MAX_GAPS, MAX_TASKS_PER_STAGE, MIN_HOURS, MAX_HOURS };
