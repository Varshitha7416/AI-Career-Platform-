/*
 * Admin company options (more than 50 companies) and program statistics consistency (dashboard vs programs stats).
 * Disposable local DB, port 5242.   RESUME_HISTORY_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:resume-history
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startServer } = require('./_harness');

let H;
let M;
const U = {};

before(async () => {
  H = await startServer({ port: 5242, dbName: `careernest_b2a4_cp_${process.pid}` });
  M = {
    Company: require('../../models/Company'), Job: require('../../models/Job'), User: require('../../models/User'),
    Program: require('../../models/Program'), Enrollment: require('../../models/ProgramEnrollment'),
  };
  U.admin = await H.mkUser('admin', { role: 'admin' });
  U.alice = await H.mkUser('alice');
  U.bob = await H.mkUser('bob');
  U.carol = await H.mkUser('carol');
});
after(async () => { if (H) await H.stop(); });

test('admin company options return ALL companies (>50), archived only when asked, and are admin-only', async () => {
  const docs = Array.from({ length: 75 }, (_, i) => ({ name: `Company ${String(i).padStart(3, '0')}`, isActive: i % 10 !== 0 }));
  await M.Company.insertMany(docs);
  let r = await H.call(U.admin.token, 'GET', '/admin/companies/options');
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 67); // 75 minus 8 archived (i = 0,10,...,70)
  assert.equal(r.body.truncated, false);
  assert.ok(r.body.companies.every((c) => !('isActive' in c)));
  r = await H.call(U.admin.token, 'GET', '/admin/companies/options?include=archived');
  assert.equal(r.body.count, 75);
  assert.equal(r.body.companies.filter((c) => c.isActive === false).length, 8);
  assert.equal(r.body.companies[0].name, 'Company 000');
  assert.equal(r.body.companies[74].name, 'Company 074');
  assert.equal((await H.call(U.alice.token, 'GET', '/admin/companies/options?include=archived')).status, 403);
  assert.equal((await H.call(null, 'GET', '/admin/companies/options')).status, 401);
});

test('admin jobs can be filtered by a company beyond the first 50 (including archived companies)', async () => {
  const late = await M.Company.findOne({ name: 'Company 074' });
  const archived = await M.Company.findOne({ name: 'Company 070' });
  await M.Job.create({ title: 'Late Co Job', company: late._id, city: 'Pune', jobDescription: 'd', experienceLevel: 'fresher' });
  await M.Job.create({ title: 'Archived Co Job', company: archived._id, city: 'Pune', jobDescription: 'd', experienceLevel: 'fresher' });
  const opts = (await H.call(U.admin.token, 'GET', '/admin/companies/options?include=archived')).body.companies;
  assert.ok(opts.some((c) => String(c._id) === String(late._id)));
  assert.ok(opts.some((c) => String(c._id) === String(archived._id)));
  let r = await H.call(U.admin.token, 'GET', `/admin/jobs?company=${late._id}`);
  assert.equal(r.body.total, 1);
  r = await H.call(U.admin.token, 'GET', `/admin/jobs?company=${archived._id}`);
  assert.equal(r.body.total, 1);
});

test('program stats: dashboard and programs endpoints agree; orphans and tombstoned users are excluded and reported', async () => {
  const mk = (extra) => M.Program.create({ description: 'A reasonably long description.', provider: 'P', category: 'C', level: 'Beginner', duration: '2 weeks', ...extra });
  const act1 = await mk({ slug: 'act-1', title: 'Active One' });
  const act2 = await mk({ slug: 'act-2', title: 'Active Two' });
  const inact = await mk({ slug: 'inact', title: 'Inactive', isActive: false });
  const arch = await mk({ slug: 'arch', title: 'Archived', isActive: false, archivedAt: new Date() });

  const en = (user, program, status) => ({ user: user.id, program: program._id, status });
  await M.Enrollment.insertMany([
    en(U.alice, act1, 'saved'), en(U.bob, act1, 'in-progress'), en(U.carol, act1, 'completed'),
    en(U.alice, act2, 'saved'), en(U.bob, inact, 'in-progress'), en(U.alice, arch, 'completed'),
  ]);
  // orphans: deleted program, deleted user (no document), tombstoned user
  const now = new Date();
  await M.Enrollment.collection.insertOne({ user: new mongoose.Types.ObjectId(U.alice.id), program: new mongoose.Types.ObjectId(), status: 'saved', createdAt: now, updatedAt: now });
  await M.Enrollment.collection.insertOne({ user: new mongoose.Types.ObjectId(), program: act2._id, status: 'saved', createdAt: now, updatedAt: now });
  await M.User.updateOne({ _id: U.carol.id }, { $set: { deletedAt: new Date() } }); // carol's completed enrollment becomes an orphan

  const [stats, dash] = await Promise.all([H.call(U.admin.token, 'GET', '/admin/programs/stats'), H.call(U.admin.token, 'GET', '/admin/overview')]);
  assert.equal(stats.status, 200);
  assert.equal(dash.status, 200);
  const s = stats.body;
  assert.deepEqual(s.programs, { total: 4, active: 2, inactive: 1, archived: 1 });
  assert.deepEqual(s.enrollments, { saved: 2, inProgress: 2, completed: 1, total: 5, orphaned: 3 });
  assert.equal(s.topPrograms[0].title, 'Active One');
  assert.equal(s.topPrograms[0].enrollments, 2); // carol (tombstoned) excluded

  const d = dash.body.programs;
  assert.equal(d.total, s.programs.total);
  assert.equal(d.active, s.programs.active);
  assert.equal(d.inactive, s.programs.inactive);
  assert.equal(d.archived, s.programs.archived);
  assert.equal(d.enrollments.total, s.enrollments.total);
  assert.equal(d.enrollments.orphaned, s.enrollments.orphaned);
  assert.deepEqual(d.enrollments.byStatus, { saved: s.enrollments.saved, 'in-progress': s.enrollments.inProgress, completed: s.enrollments.completed });
  assert.equal(d.enrollments.total, d.enrollments.byStatus.saved + d.enrollments.byStatus['in-progress'] + d.enrollments.byStatus.completed);
});
