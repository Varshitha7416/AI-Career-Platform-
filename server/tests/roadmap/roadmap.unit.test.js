/* Pure-logic roadmap tests (node:test). No database, no network: AI is stubbed. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { canonicalKey } = require('../../utils/ai/skillSynonyms');
const { buildSkeleton, collectGaps, estimateNote, MIN_HOURS, MAX_HOURS, MAX_TASKS_PER_STAGE } = require('../../utils/roadmap/skeleton');
const { indexByKey, resourceFor } = require('../../utils/roadmap/programs');
const { generateRoadmapContent, validateAiOutput } = require('../../utils/roadmap/generate');
const { counts, roadmapDTO, applyStatus, skillProgress } = require('../../utils/roadmap/progress');
const { compareAnalyses } = require('../../utils/roadmap/compare');

const m = (skill, priority = 'medium', kind = 'required') => ({ skill, key: canonicalKey(skill), kind, importance: priority, priority, why: 'needed', category: 'x' });
const p = (skill, importance = 'medium') => ({ skill, key: canonicalKey(skill), kind: 'required', importance });
const analysis = (missing, partial = [], extra = {}) => ({ _id: new mongoose.Types.ObjectId(), targetRole: 'Full Stack Developer', result: { missing, partial, matched: [] }, ...extra });
const allTasks = (sk) => sk.stages.flatMap((s) => s.tasks);

// ---------------------------------------------------------------- skeleton
test('skeleton: tasks come only from real missing/partial skills, one per skill', () => {
  const a = analysis([m('React', 'high'), m('Docker', 'low')], [p('SQL')]);
  const sk = buildSkeleton(a);
  const names = allTasks(sk).map((t) => t.skill).sort();
  assert.deepEqual(names, ['Docker', 'React', 'SQL']);
});

test('skeleton: aliases are de-duplicated by canonical key', () => {
  const a = analysis([m('React', 'high'), { ...m('ReactJS'), key: canonicalKey('ReactJS') }], [p('react.js')]);
  assert.equal(allTasks(buildSkeleton(a)).length, 1);
});

test('skeleton: prerequisites come first (HTML/JavaScript before React before Next.js)', () => {
  const a = analysis([m('Next.js', 'high'), m('React', 'high'), m('JavaScript', 'medium'), m('HTML', 'medium')]);
  const order = allTasks(buildSkeleton(a)).map((t) => t.skill);
  assert.ok(order.indexOf('HTML') < order.indexOf('JavaScript'));
  assert.ok(order.indexOf('JavaScript') < order.indexOf('React'));
  assert.ok(order.indexOf('React') < order.indexOf('Next.js'));
});

test('skeleton: prerequisite never sits in a later stage than its dependant', () => {
  const a = analysis([m('Kubernetes', 'high'), m('Docker', 'low'), m('Linux', 'low')]);
  const sk = buildSkeleton(a);
  const stageOf = (name) => sk.stages.find((s) => s.tasks.some((t) => t.skill === name)).order;
  assert.ok(stageOf('Linux') <= stageOf('Docker'));
  assert.ok(stageOf('Docker') <= stageOf('Kubernetes'));
});

test('skeleton: priority orders independent skills (high before low) within a stage', () => {
  const a = analysis([m('Figma', 'low'), m('Redis', 'high')]);
  const sk = buildSkeleton(a);
  const order = allTasks(sk).map((t) => t.skill);
  // different stages are ordered; high-priority core skill must not come after the low one
  assert.ok(order.indexOf('Redis') < order.indexOf('Figma'));
});

test('skeleton: 1-6 tasks per stage, ids unique, stages renumbered, no empty stage', () => {
  const names = ['React', 'Vue', 'Angular', 'Redis', 'MongoDB', 'GraphQL', 'Kafka', 'Terraform', 'Jira', 'Flask'];
  const sk = buildSkeleton(analysis(names.map((n) => m(n, 'high'))));
  sk.stages.forEach((s) => assert.ok(s.tasks.length >= 1 && s.tasks.length <= MAX_TASKS_PER_STAGE));
  const ids = allTasks(sk).map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(sk.stages.map((s) => s.order), sk.stages.map((_, i) => i + 1));
});

test('skeleton: hour estimates are bounded 2-40 and partial skills are cheaper', () => {
  const sk = buildSkeleton(analysis([m('Kubernetes', 'high'), m('Git', 'low'), m('Machine Learning', 'high')], [p('Kafka'), p('Jira', 'low')]));
  allTasks(sk).forEach((t) => assert.ok(t.estimatedHours >= MIN_HOURS && t.estimatedHours <= MAX_HOURS, `${t.skill}=${t.estimatedHours}`));
  const kafkaPartial = allTasks(sk).find((t) => t.skill === 'Kafka').estimatedHours;
  const kafkaFull = allTasks(buildSkeleton(analysis([m('Kafka', 'high')])))[0].estimatedHours;
  assert.ok(kafkaPartial < kafkaFull);
});

test('skeleton: caps the number of skills and reports truncation', () => {
  const many = Array.from({ length: 30 }, (_, i) => m(`Custom Skill ${i}`, 'medium'));
  const sk = buildSkeleton(analysis(many));
  assert.equal(allTasks(sk).length, 18);
  assert.equal(sk.truncated, true);
});

test('skeleton: no gaps -> no stages', () => {
  assert.equal(buildSkeleton(analysis([], [])).stages.length, 0);
  assert.equal(collectGaps({ result: {} }).length, 0);
});

test('estimateNote: no fixed duration without weeklyHours, scaled with weeklyHours', () => {
  const sk = buildSkeleton(analysis([m('React', 'high')]));
  assert.match(estimateNote(sk.stages, undefined), /no fixed duration/i);
  assert.doesNotMatch(estimateNote(sk.stages, undefined), /\d+ weeks?/);
  const withPace = estimateNote(sk.stages, 5);
  assert.match(withPace, /vary with your experience/i);
  assert.match(withPace, /5 hours a week/);
  assert.match(withPace, /around \d+ weeks?/);
});

// ---------------------------------------------------------------- programs
const PROGRAMS = [
  { _id: new mongoose.Types.ObjectId(), title: 'Web Foundations', provider: 'freeCodeCamp', url: 'https://www.freecodecamp.org', duration: '12 weeks', level: 'Beginner', skills: ['HTML', 'CSS', 'JavaScript', 'React'] },
  { _id: new mongoose.Types.ObjectId(), title: 'Advanced React', provider: 'Acme', url: 'https://acme.example', duration: '4 weeks', level: 'Advanced', skills: ['ReactJS'] },
];

test('programs: matched through synonym keys, copied from the catalogue; "no matching program" -> null', () => {
  const idx = indexByKey(PROGRAMS, [canonicalKey('React'), canonicalKey('Kubernetes')]);
  const r = resourceFor(idx.get(canonicalKey('React')));
  assert.equal(r.type, 'program');
  assert.equal(r.title, 'Web Foundations'); // beginner preferred for a brand-new skill
  assert.equal(r.url, 'https://www.freecodecamp.org');
  assert.equal(String(r.program), String(PROGRAMS[0]._id));
  assert.equal(resourceFor(idx.get(canonicalKey('Kubernetes'))), null);
});

test('programs: partial skills prefer the deeper program', () => {
  const key = canonicalKey('React');
  const idx = indexByKey(PROGRAMS, [key], new Set([key]));
  assert.equal(resourceFor(idx.get(key)).title, 'Advanced React');
});

// ---------------------------------------------------------------- AI validation
const sk0 = () => allTasks(buildSkeleton(analysis([m('React', 'high'), m('Docker', 'medium')])));
const goodEntry = (t, extra = {}) => ({ id: t.id, skill: t.skill, objective: 'Build things.', activity: 'Study and practise.', exercise: 'Make a small app.', completionCriteria: 'App works.', ...extra });

test('validateAiOutput: accepts valid entries and caps lengths', () => {
  const tasks = sk0();
  const out = validateAiOutput({ tasks: [goodEntry(tasks[0], { objective: 'x'.repeat(2000) }), goodEntry(tasks[1])] }, tasks);
  assert.equal(out.size, 2);
  assert.ok(out.get(tasks[0].id).objective.length <= 400);
});

test('validateAiOutput: drops hallucinated skills / unknown ids / URLs', () => {
  const tasks = sk0();
  const out = validateAiOutput({ tasks: [
    goodEntry(tasks[0]),
    { ...goodEntry(tasks[1]), skill: 'Quantum Basket Weaving' },
    { ...goodEntry(tasks[0]), id: 't99', skill: 'React' },
    { id: tasks[1].id, skill: tasks[1].skill, objective: 'Read https://evil.example/course now', activity: 'Study at www.udemy.com', exercise: 'Make a thing.', completionCriteria: 'Done.' },
  ] }, tasks);
  assert.equal(out.size, 2);
  assert.equal(out.get(tasks[0].id).objective, 'Build things.');
  const second = out.get(tasks[1].id);
  assert.equal(second.objective, undefined); // URL-bearing text rejected
  assert.equal(second.activity, undefined);
  assert.equal(second.exercise, 'Make a thing.');
});

test('validateAiOutput: malformed output throws AI_BAD_RESPONSE', () => {
  const tasks = sk0();
  for (const bad of [null, {}, { tasks: 'x' }, { tasks: [] }, { tasks: [{ id: 'zz', skill: 'Nope' }] }]) {
    assert.throws(() => validateAiOutput(bad, tasks), (e) => e.code === 'AI_BAD_RESPONSE' && e.status === 502);
  }
});

// ---------------------------------------------------------------- generation (stubbed AI)
test('generateRoadmapContent: AI text merged, resources only from catalogue, AI-supplied links ignored', async () => {
  const a = analysis([m('React', 'high'), m('Kubernetes', 'medium')]);
  let consumed = 0;
  const generateJSON = async (prompt) => {
    assert.match(prompt, /<<<BEGIN_TARGET_ROLE_/);
    const tasks = [...prompt.matchAll(/id=(t\d+) \| skill=([^|]+?) \|/g)].map((x) => ({ id: x[1], skill: x[2], objective: `Obj ${x[2]}`, activity: 'Act', exercise: 'Ex', completionCriteria: 'Crit', resource: { url: 'https://fake.example' }, url: 'https://fake.example' }));
    return { tasks };
  };
  const c = await generateRoadmapContent({ analysis: a, programs: PROGRAMS, weeklyHours: 6 }, { generateJSON, consume: () => { consumed += 1; } });
  assert.equal(consumed, 1);
  const tasks = c.stages.flatMap((s) => s.tasks);
  const react = tasks.find((t) => t.skill === 'React');
  const kube = tasks.find((t) => t.skill === 'Kubernetes');
  assert.equal(react.objective, 'Obj React');
  assert.equal(react.resource.url, 'https://www.freecodecamp.org');
  assert.equal(kube.resource, null);
  assert.equal(c.weeklyHours, 6);
  assert.equal(c.stages[0].tasks[0].status, 'not-started');
});

test('generateRoadmapContent: AI failure propagates and nothing is returned; NOTHING_TO_LEARN without calling AI', async () => {
  const a = analysis([m('React', 'high')]);
  const err = Object.assign(new Error('quota'), { status: 429, code: 'AI_QUOTA' });
  await assert.rejects(generateRoadmapContent({ analysis: a, programs: [] }, { generateJSON: async () => { throw err; } }), (e) => e.code === 'AI_QUOTA');
  let called = false;
  await assert.rejects(
    generateRoadmapContent({ analysis: analysis([], []), programs: [] }, { generateJSON: async () => { called = true; return {}; } }),
    (e) => e.code === 'NOTHING_TO_LEARN' && e.status === 422,
  );
  assert.equal(called, false);
  await assert.rejects(generateRoadmapContent({ analysis: a, programs: [] }, { generateJSON: async () => ({ tasks: [{ id: 't1', skill: 'Made Up' }] }) }), (e) => e.code === 'AI_BAD_RESPONSE');
});

// ---------------------------------------------------------------- progress math
const T = (status, skillKey = 'a', hours = 10) => ({ id: Math.random().toString(), skill: skillKey, skillKey, title: 't', priority: 'medium', estimatedHours: hours, status });

test('progress: counts and rounding', () => {
  assert.deepEqual(counts([]), { total: 0, completed: 0, inProgress: 0, notStarted: 0, percent: 0 });
  const c = counts([T('completed'), T('in-progress'), T('not-started')]);
  assert.deepEqual(c, { total: 3, completed: 1, inProgress: 1, notStarted: 1, percent: 33 });
  assert.equal(counts([T('completed'), T('completed'), T('not-started')]).percent, 67);
});

test('progress: roadmap DTO derives stage/skill/overall progress and remaining hours; levels are user-stated only', () => {
  const r = {
    _id: 'r1', analysis: 'a1', title: 'T', targetRole: 'R', stages: [
      { id: 's1', order: 1, title: 'S1', tasks: [T('completed', 'x', 10), T('in-progress', 'y', 20)] },
      { id: 's2', order: 2, title: 'S2', tasks: [T('not-started', 'y', 5)] },
    ], skillLevels: [{ skillKey: 'y', level: 'beginner' }],
  };
  const d = roadmapDTO(r);
  assert.equal(d.progress.percent, 33);
  assert.equal(d.stages[0].progress.percent, 50);
  assert.equal(d.totalEstimatedHours, 35);
  assert.equal(d.remainingEstimatedHours, 25);
  const y = d.skills.find((s) => s.skillKey === 'y');
  assert.deepEqual(y.progress, { total: 2, completed: 0, percent: 0 });
  assert.equal(y.level, 'beginner');
  assert.equal(d.skills.find((s) => s.skillKey === 'x').level, null);
  assert.equal(skillProgress(r).length, 2);
});

test('applyStatus: timestamps set/cleared, repeated updates are no-ops', () => {
  const t = { status: 'not-started' };
  const t1 = new Date('2026-01-01'); const t2 = new Date('2026-01-02');
  assert.equal(applyStatus(t, 'in-progress', t1), true);
  assert.equal(t.startedAt, t1); assert.equal(t.completedAt, undefined);
  assert.equal(applyStatus(t, 'in-progress', t2), false);
  assert.equal(t.startedAt, t1);
  applyStatus(t, 'completed', t2);
  assert.equal(t.completedAt, t2); assert.equal(t.startedAt, t1);
  assert.equal(applyStatus(t, 'completed', new Date()), false);
  assert.equal(t.completedAt, t2);
  applyStatus(t, 'in-progress', new Date()); // reopen
  assert.equal(t.completedAt, undefined); assert.equal(t.startedAt, t1);
  applyStatus(t, 'not-started', new Date());
  assert.equal(t.startedAt, undefined);
  applyStatus(t, 'completed', t2); // straight to completed sets both
  assert.ok(t.startedAt && t.completedAt);
});

// ---------------------------------------------------------------- compare
const an = (over) => ({
  _id: new mongoose.Types.ObjectId(), targetRole: 'Data Analyst', targetKind: 'role-only', basis: 'resume-verified',
  createdAt: new Date('2026-01-01'), score: { value: 40 }, requirements: [1, 2, 3],
  result: { matched: [{ skill: 'SQL' }], partial: [{ skill: 'Python' }], missing: [{ skill: 'Tableau', priority: 'high' }, { skill: 'Excel', priority: 'low' }] }, ...over,
});

test('compare: same target computes score delta and skill changes; older is baseline', () => {
  const older = an({});
  const newer = an({ createdAt: new Date('2026-02-01'), score: { value: 70 }, result: {
    matched: [{ skill: 'SQL' }, { skill: 'Tableau' }, { skill: 'Excel' }], partial: [{ skill: 'Python' }], missing: [{ skill: 'Statistics', priority: 'medium' }] } });
  const c = compareAnalyses(newer, older); // order of arguments must not matter
  assert.equal(c.a, older); assert.equal(c.b, newer);
  assert.equal(c.sameTarget, true);
  assert.equal(c.scoreDelta, 30);
  assert.deepEqual(c.newlySkills.map((x) => x.skill).sort(), ['Excel', 'Tableau']);
  assert.deepEqual(c.resolvedMissing.map((x) => x.skill).sort(), ['Excel', 'Tableau']);
  assert.deepEqual(c.stillMissing, []); // Statistics is new, not "still"
  assert.deepEqual(c.needsImprovement, [{ skill: 'Python' }]);
  assert.equal(c.warning, null);
});

test('compare: stillMissing lists gaps present in both', () => {
  const c = compareAnalyses(an({}), an({ createdAt: new Date('2026-02-01'), result: { matched: [], partial: [], missing: [{ skill: 'Tableau', priority: 'high' }] } }));
  assert.deepEqual(c.stillMissing, [{ skill: 'Tableau', priority: 'high' }]);
});

test('compare: different targets -> sameTarget false, warning, no progress claims', () => {
  const c = compareAnalyses(an({}), an({ targetRole: 'Backend Developer', createdAt: new Date('2026-02-01'), score: { value: 90 } }));
  assert.equal(c.sameTarget, false);
  assert.match(c.warning, /different targets/i);
  assert.equal(c.scoreDelta, null);
  assert.deepEqual(c.newlySkills, []);
  assert.doesNotMatch(`${c.warning} ${c.notes.join(' ')}`, /progress|improv/i);
});

test('compare: job targets compare by job id; different basis adds a note', () => {
  const j1 = new mongoose.Types.ObjectId(); const j2 = new mongoose.Types.ObjectId();
  assert.equal(compareAnalyses(an({ job: j1 }), an({ job: j1, createdAt: new Date('2026-02-01') })).sameTarget, true);
  assert.equal(compareAnalyses(an({ job: j1 }), an({ job: j2, createdAt: new Date('2026-02-01') })).sameTarget, false);
  assert.equal(compareAnalyses(an({ job: j1 }), an({ createdAt: new Date('2026-02-01') })).sameTarget, false);
  const c = compareAnalyses(an({}), an({ basis: 'manual-input', createdAt: new Date('2026-02-01') }));
  assert.ok(c.notes.some((n) => /different bases/i.test(n)));
});

test('compare: resume analyses scored under different classification versions carry an explanatory note', () => {
  const old = an({ basis: 'resume-verified', score: { value: 80, method: 'v1' } });
  const cur = an({ basis: 'resume-verified', createdAt: new Date('2026-02-01'), score: { value: 60, method: 'v2' } });
  const c = compareAnalyses(old, cur);
  assert.ok(c.notes.some((n) => /different resume rules/i.test(n)));
  const same = compareAnalyses(an({ basis: 'resume-verified', score: { value: 80, method: 'v2' } }), cur);
  assert.ok(!same.notes.some((n) => /different resume rules/i.test(n)));
});
