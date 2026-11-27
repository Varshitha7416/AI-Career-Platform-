// Progress is ALWAYS derived from stored task statuses; nothing here is persisted.
const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);

const counts = (tasks) => {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
  return { total, completed, inProgress, notStarted: total - completed - inProgress, percent: pct(completed, total) };
};

const allTasks = (roadmap) => (roadmap.stages || []).flatMap((s) => s.tasks || []);
const roadmapProgress = (roadmap) => counts(allTasks(roadmap));

const skillProgress = (roadmap) => {
  const levels = new Map((roadmap.skillLevels || []).map((l) => [l.skillKey, l.level]));
  const map = new Map();
  allTasks(roadmap).forEach((t) => {
    if (!map.has(t.skillKey)) map.set(t.skillKey, { skillKey: t.skillKey, skill: t.skill, tasks: [] });
    map.get(t.skillKey).tasks.push(t);
  });
  return [...map.values()].map((s) => {
    const c = counts(s.tasks);
    return { skillKey: s.skillKey, skill: s.skill, level: levels.get(s.skillKey) || null, progress: { total: c.total, completed: c.completed, percent: c.percent } };
  });
};

const hours = (tasks) => tasks.reduce((n, t) => n + (t.estimatedHours || 0), 0);

const taskDTO = (t) => ({
  id: t.id, skill: t.skill, skillKey: t.skillKey, title: t.title, objective: t.objective || '', priority: t.priority,
  activity: t.activity || '', estimatedHours: t.estimatedHours, exercise: t.exercise || '', completionCriteria: t.completionCriteria || '',
  resource: t.resource && t.resource.type ? {
    type: t.resource.type, program: t.resource.program || null, title: t.resource.title || null, provider: t.resource.provider || null,
    url: t.resource.url || null, duration: t.resource.duration || null,
  } : null,
  status: t.status || 'not-started', notes: t.notes || '', startedAt: t.startedAt || null, completedAt: t.completedAt || null,
});

const roadmapSummary = (r) => ({
  _id: r._id, analysis: r.analysis && r.analysis._id ? r.analysis._id : r.analysis, title: r.title, targetRole: r.targetRole,
  weeklyHours: r.weeklyHours || null, progress: roadmapProgress(r), createdAt: r.createdAt, updatedAt: r.updatedAt,
});

const roadmapDTO = (r) => {
  const tasks = allTasks(r);
  return {
    ...roadmapSummary(r),
    estimateNote: r.estimateNote || '',
    totalEstimatedHours: hours(tasks),
    remainingEstimatedHours: hours(tasks.filter((t) => t.status !== 'completed')),
    stages: (r.stages || []).map((s) => ({
      id: s.id, order: s.order, title: s.title, goal: s.goal || '', progress: counts(s.tasks || []), tasks: (s.tasks || []).map(taskDTO),
    })),
    skills: skillProgress(r),
  };
};

// Status change rules: set/clear timestamps; a repeated identical status changes nothing.
const applyStatus = (task, status, now = new Date()) => {
  if (status === task.status) return false;
  task.status = status;
  if (status === 'not-started') { task.startedAt = undefined; task.completedAt = undefined; }
  else if (status === 'in-progress') { task.startedAt = task.startedAt || now; task.completedAt = undefined; }
  else { task.startedAt = task.startedAt || now; task.completedAt = now; }
  return true;
};

module.exports = { counts, pct, roadmapProgress, skillProgress, roadmapDTO, roadmapSummary, taskDTO, applyStatus, allTasks };
