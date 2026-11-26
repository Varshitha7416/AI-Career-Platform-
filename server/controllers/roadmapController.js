const SkillGapAnalysis = require('../models/SkillGapAnalysis');
const LearningRoadmap = require('../models/LearningRoadmap');
const Program = require('../models/Program');
const ProgramEnrollment = require('../models/ProgramEnrollment');
const { isValidId } = require('../middleware/validate');
const { sendAiError } = require('../middleware/aiLimiter');
const { STATUSES } = LearningRoadmap;
const { LEVELS } = SkillGapAnalysis;
const { generateRoadmapContent } = require('../utils/roadmap/generate');
const { collectGaps } = require('../utils/roadmap/skeleton');
const { indexByKey } = require('../utils/roadmap/programs');
const { roadmapDTO, roadmapSummary, roadmapProgress, counts, allTasks, applyStatus } = require('../utils/roadmap/progress');
const { compareAnalyses } = require('../utils/roadmap/compare');
const { summarize } = require('../utils/roadmap/summary');
const lock = require('../utils/roadmap/lock');

// Test hook: lets tests inject a stubbed generateJSON without touching the network.
const deps = {};
const _setDeps = (d) => { Object.keys(deps).forEach((k) => delete deps[k]); Object.assign(deps, d || {}); };

const NOTES_MAX = 1000;
const hasOpenTasks = (r) => allTasks(r).some((t) => t.status !== 'completed');

const bad = (res, message) => res.status(400).json({ message });
const notFound = (res, message, code) => res.status(404).json(code ? { message, code } : { message });
const loadRoadmap = (req) => LearningRoadmap.findOne({ _id: req.params.roadmapId, user: req.user.id });

// ---------------------------------------------------------------- overview
const getOverview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [latest, roadmaps] = await Promise.all([
      SkillGapAnalysis.findOne({ user: userId }).sort({ createdAt: -1 }).lean(),
      LearningRoadmap.find({ user: userId }).sort({ updatedAt: -1 }).limit(100).lean(),
    ]);
    const [latestSummary] = latest ? await summarize([latest], userId, roadmaps.filter((r) => String(r.analysis) === String(latest._id))) : [null];
    const active = roadmaps.find(hasOpenTasks) || null;

    const all = roadmaps.flatMap((r) => allTasks(r));
    const totals = { ...counts(all), tasks: counts(all).total };

    let nextAction = null;
    let skillsInProgress = [];
    if (active) {
      const ordered = (active.stages || []).slice().sort((a, b) => a.order - b.order)
        .flatMap((s) => (s.tasks || []).map((t) => ({ t, stage: s.title })));
      const pick = ordered.find((x) => x.t.status === 'in-progress') || ordered.find((x) => x.t.status === 'not-started');
      if (pick) {
        nextAction = { roadmapId: active._id, analysisId: active.analysis, taskId: pick.t.id, skill: pick.t.skill, title: pick.t.title, stage: pick.stage };
      }
      const bySkill = new Map();
      allTasks(active).forEach((t) => {
        if (!bySkill.has(t.skillKey)) bySkill.set(t.skillKey, { skill: t.skill, skillKey: t.skillKey, tasks: [] });
        bySkill.get(t.skillKey).tasks.push(t);
      });
      skillsInProgress = [...bySkill.values()]
        .map((s) => ({ skill: s.skill, skillKey: s.skillKey, percent: counts(s.tasks).percent, active: s.tasks.some((t) => t.status === 'in-progress') || (s.tasks.some((t) => t.status === 'completed') && s.tasks.some((t) => t.status !== 'completed')) }))
        .filter((s) => s.active)
        .map(({ skill, skillKey, percent }) => ({ skill, skillKey, percent }));
    }

    const recent = roadmaps.flatMap((r) => allTasks(r)
      .filter((t) => t.status !== 'not-started' && (t.completedAt || t.startedAt))
      .map((t) => ({ roadmapId: r._id, taskId: t.id, title: t.title, status: t.status, updatedAt: t.completedAt || t.startedAt })))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);

    res.json({
      latestAnalysis: latestSummary || null,
      activeRoadmap: active ? roadmapSummary(active) : null,
      totals, nextAction, skillsInProgress, recent,
    });
  } catch (error) { next(error); }
};

// ---------------------------------------------------------------- compare
const compare = async (req, res, next) => {
  try {
    const { a, b } = req.query;
    if (!isValidId(String(a || '')) || !isValidId(String(b || ''))) return bad(res, 'Two valid analysis ids (a and b) are required');
    const ids = [...new Set([String(a), String(b)])];
    const found = await SkillGapAnalysis.find({ _id: { $in: ids }, user: req.user.id }).lean();
    if (found.length !== ids.length) return notFound(res, 'Analysis not found');
    const byId = new Map(found.map((x) => [String(x._id), x]));
    const cmp = compareAnalyses(byId.get(String(a)), byId.get(String(b)));
    const [sa, sb] = await summarize(cmp.a === cmp.b ? [cmp.a] : [cmp.a, cmp.b], req.user.id);
    const summaries = cmp.a === cmp.b ? [sa, sa] : [sa, sb];
    res.json({
      comparable: cmp.comparable, sameTarget: cmp.sameTarget, warning: cmp.warning,
      a: summaries[0], b: summaries[1], scoreDelta: cmp.scoreDelta,
      newlySkills: cmp.newlySkills, stillMissing: cmp.stillMissing, resolvedMissing: cmp.resolvedMissing, needsImprovement: cmp.needsImprovement,
      roadmap: { a: summaries[0].roadmapPercent, b: summaries[1].roadmapPercent },
      notes: cmp.notes,
    });
  } catch (error) { next(error); }
};

// ---------------------------------------------------------------- roadmaps
const listRoadmaps = async (req, res, next) => {
  try {
    const roadmaps = await LearningRoadmap.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ count: roadmaps.length, roadmaps: roadmaps.map(roadmapSummary) });
  } catch (error) { next(error); }
};

const getRoadmap = async (req, res, next) => {
  try {
    if (!isValidId(req.params.roadmapId)) return bad(res, 'Invalid roadmapId');
    const r = await loadRoadmap(req);
    if (!r) return notFound(res, 'Roadmap not found');
    res.json({ roadmap: roadmapDTO(r) });
  } catch (error) { next(error); }
};

const updateTask = async (req, res, next) => {
  try {
    const { roadmapId, taskId } = req.params;
    if (!isValidId(roadmapId)) return bad(res, 'Invalid roadmapId');
    const { status, notes } = req.body || {};
    if (status === undefined && notes === undefined) return bad(res, 'Provide a status or notes to update');
    if (status !== undefined && !STATUSES.includes(status)) return bad(res, `status must be one of: ${STATUSES.join(', ')}`);
    if (notes !== undefined && typeof notes !== 'string') return bad(res, 'notes must be text');
    if (notes !== undefined && notes.length > NOTES_MAX) return bad(res, `notes can be at most ${NOTES_MAX} characters`);

    const r = await loadRoadmap(req);
    if (!r) return notFound(res, 'Roadmap not found');
    const task = r.stages.flatMap((s) => s.tasks).find((t) => t.id === taskId);
    if (!task) return notFound(res, 'Task not found');
    if (status !== undefined) applyStatus(task, status);
    if (notes !== undefined && notes !== task.notes) task.notes = notes;
    await r.save(); // no-op when nothing changed (idempotent)
    res.json({ message: 'Task updated', roadmap: roadmapDTO(r) });
  } catch (error) { next(error); }
};

const updateSkillLevel = async (req, res, next) => {
  try {
    const { roadmapId, skillKey } = req.params;
    if (!isValidId(roadmapId)) return bad(res, 'Invalid roadmapId');
    const body = req.body || {};
    if (!('level' in body)) return bad(res, 'level is required (beginner, intermediate, advanced or null)');
    const { level } = body;
    if (level !== null && !LEVELS.includes(level)) return bad(res, 'level must be beginner, intermediate, advanced or null');
    const r = await loadRoadmap(req);
    if (!r) return notFound(res, 'Roadmap not found');
    if (!allTasks(r).some((t) => t.skillKey === skillKey)) return notFound(res, 'Skill not found in this roadmap');
    const existing = r.skillLevels.find((l) => l.skillKey === skillKey);
    if (level === null) {
      if (existing) r.skillLevels = r.skillLevels.filter((l) => l.skillKey !== skillKey);
    } else if (!existing) {
      r.skillLevels.push({ skillKey, level, updatedAt: new Date() });
    } else if (existing.level !== level) {
      existing.level = level; existing.updatedAt = new Date();
    }
    await r.save();
    res.json({ message: 'Skill level saved', roadmap: roadmapDTO(r) });
  } catch (error) { next(error); }
};

const deleteRoadmap = async (req, res, next) => {
  try {
    if (!isValidId(req.params.roadmapId)) return bad(res, 'Invalid roadmapId');
    const r = await LearningRoadmap.findOneAndDelete({ _id: req.params.roadmapId, user: req.user.id });
    if (!r) return notFound(res, 'Roadmap not found');
    res.json({ message: 'Roadmap deleted' });
  } catch (error) { next(error); }
};

// ---------------------------------------------------------------- per-analysis
const ownAnalysis = (req) => SkillGapAnalysis.findOne({ _id: req.params.id, user: req.user.id }).lean();

const createRoadmap = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return bad(res, 'Invalid analysis id');
    const { weeklyHours, regenerate } = req.body || {};
    if (weeklyHours !== undefined && weeklyHours !== null
      && !(Number.isInteger(weeklyHours) && weeklyHours >= 1 && weeklyHours <= 60)) return bad(res, 'weeklyHours must be a whole number from 1 to 60');
    if (regenerate !== undefined && typeof regenerate !== 'boolean') return bad(res, 'regenerate must be true or false');

    const startedAt = new Date();
    const analysis = await ownAnalysis(req);
    if (!analysis) return notFound(res, 'Analysis not found');
    const findExisting = () => LearningRoadmap.findOne({ user: req.user.id, analysis: analysis._id });
    const sendExisting = (r) => res.json({ message: 'A roadmap already exists for this analysis', existing: true, roadmap: roadmapDTO(r) });
    // "Somebody already did the work this request wanted": a roadmap exists, and (for regenerate) it was written
    // after this request arrived, so generating again would only duplicate the AI call and wipe fresh progress.
    const alreadyDone = (r) => !!r && (!regenerate || r.updatedAt >= startedAt);

    let existing = await findExisting();
    if (alreadyDone(existing)) return sendExisting(existing);

    if (!collectGaps(analysis).length) {
      return res.status(422).json({ message: 'There are no missing or partially covered skills to build a roadmap from.', code: 'NOTHING_TO_LEARN' });
    }

    // Only one generation per analysis at a time (atomic DB lock, works across server processes). A concurrent
    // request waits for the holder and then returns the holder's roadmap: no second Gemini call, one consistent result.
    let token = await lock.tryAcquire(analysis._id, req.user.id);
    while (!token) {
      if (!(await lock.waitUntilFree(analysis._id, req.user.id))) {
        return res.status(409).json({ message: 'A roadmap for this analysis is still being generated. Please try again in a moment.', code: 'ROADMAP_BUSY' });
      }
      existing = await findExisting();
      if (alreadyDone(existing)) return sendExisting(existing);
      token = await lock.tryAcquire(analysis._id, req.user.id); // holder failed or went stale: this request retries itself
    }

    try {
      // Re-check inside the lock: the previous holder may have finished between our first look and the acquire.
      existing = await findExisting();
      if (alreadyDone(existing)) return sendExisting(existing);

      const programs = await Program.find({ isActive: { $ne: false } }).select('title provider url duration level skills').lean();
      let content;
      try {
        content = await generateRoadmapContent(
          { analysis, programs, weeklyHours: weeklyHours || undefined },
          { generateJSON: deps.generateJSON, consume: () => req.consumeAiCall && req.consumeAiCall() },
        );
      } catch (err) {
        if (err.code === 'NOTHING_TO_LEARN') return res.status(422).json({ message: err.message, code: err.code });
        if (sendAiError(res, err)) return undefined;
        throw err;
      }
      const { truncated, ...doc } = content; // eslint-disable-line no-unused-vars
      let saved;
      if (existing) {
        existing.set({ ...doc, skillLevels: [] });
        saved = await existing.save();
      } else {
        try {
          saved = await LearningRoadmap.create({ user: req.user.id, analysis: analysis._id, ...doc });
        } catch (err) {
          if (err && err.code === 11000) { // unique (user, analysis) index is the last line of defence
            const again = await findExisting();
            if (again) return sendExisting(again);
          }
          throw err;
        }
      }
      return res.status(201).json({ message: existing ? 'Roadmap regenerated' : 'Roadmap created', roadmap: roadmapDTO(saved) });
    } finally {
      await lock.release(analysis._id, token).catch(() => {}); // never let a release problem mask the real response
    }
  } catch (error) { return next(error); }
};

const getAnalysisRoadmap = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return bad(res, 'Invalid analysis id');
    const analysis = await SkillGapAnalysis.exists({ _id: req.params.id, user: req.user.id });
    if (!analysis) return notFound(res, 'Analysis not found');
    const r = await LearningRoadmap.findOne({ user: req.user.id, analysis: req.params.id });
    if (!r) return notFound(res, 'No roadmap has been created for this analysis yet', 'NO_ROADMAP');
    res.json({ roadmap: roadmapDTO(r) });
  } catch (error) { next(error); }
};

const getPrograms = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return bad(res, 'Invalid analysis id');
    const analysis = await ownAnalysis(req);
    if (!analysis) return notFound(res, 'Analysis not found');
    const gaps = collectGaps(analysis);
    const programs = gaps.length ? await Program.find({ isActive: { $ne: false } }).lean() : [];
    const hits = indexByKey(programs, gaps.map((g) => g.key), new Set(gaps.filter((g) => g.partial).map((g) => g.key)));
    const matched = new Map(); // programId -> {program, skills[]}
    gaps.forEach((g) => (hits.get(g.key) || []).forEach((p) => {
      const e = matched.get(String(p._id)) || { program: p, skills: [] };
      if (!e.skills.includes(g.skill)) e.skills.push(g.skill);
      matched.set(String(p._id), e);
    }));
    const entries = [...matched.values()].sort((a, b) => b.skills.length - a.skills.length || String(a.program.title).localeCompare(String(b.program.title))).slice(0, 20);
    const enrollments = entries.length
      ? await ProgramEnrollment.find({ user: req.user.id, program: { $in: entries.map((e) => e.program._id) } }).select('program status').lean()
      : [];
    const enrollmentBy = new Map(enrollments.map((e) => [String(e.program), e.status]));
    res.json({
      count: entries.length,
      programs: entries.map(({ program: p, skills }) => ({
        program: { _id: p._id, slug: p.slug, title: p.title, provider: p.provider, level: p.level, duration: p.duration || null, url: p.url || null, skills: p.skills || [] },
        matchedSkills: skills,
        enrollment: enrollmentBy.has(String(p._id)) ? { status: enrollmentBy.get(String(p._id)) } : null,
      })),
    });
  } catch (error) { next(error); }
};

module.exports = {
  getOverview, compare, listRoadmaps, getRoadmap, updateTask, updateSkillLevel, deleteRoadmap,
  createRoadmap, getAnalysisRoadmap, getPrograms, _setDeps, roadmapProgress,
};
