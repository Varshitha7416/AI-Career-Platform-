// Pure unit tests (no DB): duration parsing and the enrollment state machine.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseDurationWeeks } = require('../../utils/programs/duration');
const { computeNext, effectiveEnrollment, sameState } = require('../../utils/programs/progress');

const NOW = new Date('2026-01-01T00:00:00Z');
const plain = { milestones: [] };
const ms = { milestones: [{ title: 'A', order: 1 }, { title: 'B', order: 2 }, { title: 'C', order: 3 }, { title: 'D', order: 4 }] };

test('duration: parses weeks, months, ranges and rejects free text', () => {
  assert.equal(parseDurationWeeks('12 weeks'), 12);
  assert.equal(parseDurationWeeks('3 months'), 13);
  assert.equal(parseDurationWeeks('6 months (flexible)'), 26);
  assert.equal(parseDurationWeeks('4-6 weeks'), 6);
  assert.equal(parseDurationWeeks('10 days'), 1 + 0); // 10/7 rounds to 1
  assert.equal(parseDurationWeeks('Self-paced'), null);
  assert.equal(parseDurationWeeks(undefined), null);
});

test('progress: input validation', () => {
  for (const progress of [-1, 101, 1.5, '50', null, NaN]) {
    assert.ok(computeNext(null, plain, { progress }, NOW).error, `progress ${progress} must be rejected`);
  }
  assert.ok(computeNext(null, plain, {}, NOW).error);
  assert.ok(computeNext(null, plain, { status: 'bogus' }, NOW).error);
  assert.ok(computeNext(null, plain, { completedMilestones: [1] }, NOW).error, 'no milestones defined');
  assert.ok(computeNext(null, ms, { progress: 10 }, NOW).error, 'milestone programs reject manual progress');
  assert.ok(computeNext(null, ms, { completedMilestones: [9] }, NOW).error);
  assert.ok(computeNext(null, ms, { completedMilestones: [1.5] }, NOW).error);
});

test('progress: status consistency for manual programs', () => {
  let r = computeNext(null, plain, { progress: 40 }, NOW).state;
  assert.deepEqual([r.status, r.progress], ['in-progress', 40]);
  assert.ok(r.startedAt);
  r = computeNext(null, plain, { status: 'completed' }, NOW).state;
  assert.deepEqual([r.status, r.progress], ['completed', 100]);
  assert.ok(r.completedAt);
  r = computeNext(null, plain, { status: 'saved' }, NOW).state;
  assert.deepEqual([r.status, r.progress, r.startedAt], ['saved', 0, null]);
  // progress 100 completes; lowering it resumes
  r = computeNext({ status: 'in-progress', progress: 90, startedAt: NOW }, plain, { progress: 100 }, NOW).state;
  assert.equal(r.status, 'completed');
  r = computeNext({ status: 'completed', progress: 100, startedAt: NOW, completedAt: NOW }, plain, { progress: 50 }, NOW).state;
  assert.deepEqual([r.status, r.progress, r.completedAt], ['in-progress', 50, null]);
  // resume without explicit progress never leaves in-progress at 100
  r = computeNext({ status: 'completed', progress: 100, startedAt: NOW, completedAt: NOW }, plain, { status: 'in-progress' }, NOW).state;
  assert.deepEqual([r.status, r.progress], ['in-progress', 99]);
  // saved + progress 0 stays saved; contradictory combinations are rejected
  r = computeNext({ status: 'saved', progress: 0 }, plain, { progress: 0 }, NOW).state;
  assert.equal(r.status, 'saved');
  assert.ok(computeNext(null, plain, { status: 'completed', progress: 50 }, NOW).error);
  assert.ok(computeNext(null, plain, { status: 'saved', progress: 10 }, NOW).error);
  assert.ok(computeNext(null, plain, { status: 'in-progress', progress: 100 }, NOW).error);
});

test('progress: milestones derive progress and completion', () => {
  let r = computeNext(null, ms, { completedMilestones: [1, 2, 2] }, NOW).state;
  assert.deepEqual([r.status, r.progress, r.completedMilestones], ['in-progress', 50, [1, 2]]);
  r = computeNext({ status: 'in-progress', progress: 50, completedMilestones: [1, 2], startedAt: NOW }, ms, { completedMilestones: [1, 2, 3, 4] }, NOW).state;
  assert.deepEqual([r.status, r.progress], ['completed', 100]);
  r = computeNext(null, ms, { status: 'completed' }, NOW).state;
  assert.deepEqual(r.completedMilestones, [1, 2, 3, 4]);
  r = computeNext({ status: 'completed', progress: 100, completedMilestones: [1, 2, 3, 4], startedAt: NOW, completedAt: NOW }, ms, { status: 'in-progress' }, NOW).state;
  assert.deepEqual([r.status, r.progress, r.completedMilestones], ['in-progress', 75, [1, 2, 3]]);
});

test('progress: effective view ignores milestones an admin removed; sameState detects no-ops', () => {
  const eff = effectiveEnrollment({ status: 'in-progress', progress: 80, completedMilestones: [1, 9] }, ms);
  assert.deepEqual([eff.progress, eff.completedMilestones], [25, [1]]);
  const prev = { status: 'in-progress', progress: 40, completedMilestones: [], startedAt: NOW };
  const next = computeNext(prev, plain, { status: 'in-progress', progress: 40 }, NOW).state;
  assert.ok(sameState(prev, next));
  assert.ok(!sameState(prev, computeNext(prev, plain, { progress: 41 }, NOW).state));
});
