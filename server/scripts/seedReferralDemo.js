/*
 * Referral DEMO dataset: a SEPARATE local database for trying the Referrals feature.
 *
 *   MONGO_URI=mongodb://127.0.0.1:27017/careernest_demo npm run seed:referral-demo            # dry run (default)
 *   MONGO_URI=mongodb://127.0.0.1:27017/careernest_demo npm run seed:referral-demo -- --apply # write
 *
 * Creates ~8 demo users (emails @example.com), 4 demo companies, 6 demo jobs, a resume per user and ~10 referral
 * requests in every status, in both directions for the main demo user. It never calls seed.js and never deletes.
 * Demo users are created email-verified (emailVerified: true) so the referral flow works. Idempotent: users are upserted by email, companies by name, jobs by externalId, resumes by (user, fileName) and
 * referrals by (sender, provider, job, message); reruns create nothing new and do not overwrite existing records.
 *
 * Demo login password for every user: Demo@12345
 * Main demo user: aarav.mehta.demo@example.com
 *
 * Safety: dry run by default; the database name MUST end in "_demo" (refused otherwise); refuses any non-local
 * database; refuses NODE_ENV=production. All data is fictional.
 */
require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const Job = require('../models/Job');
const Resume = require('../models/Resume');
const Referral = require('../models/Referral');
const H = require('../utils/referralHelpers');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fail = (m) => { console.error(m); process.exit(1); };
if (args.includes('--help')) { console.log('Usage: npm run seed:referral-demo [-- --apply]. See the header of scripts/seedReferralDemo.js.'); process.exit(0); }
const unknown = args.filter((a) => !['--apply', '--help'].includes(a));
if (unknown.length) fail(`Unknown argument(s): ${unknown.join(' ')}`);

const PASSWORD = 'Demo@12345';
const MAIN = 'aarav.mehta.demo@example.com';

const USERS = [
  { key: 'aarav', name: 'Aarav Mehta', email: MAIN, seekingRole: 'Backend Engineer', isReferrer: true, currentCompany: 'Zenith Cloud', currentCompanyRole: 'Software Engineer II', referralCompanies: ['Zenith Cloud'], experienceYears: 3, preferredLocation: 'Bengaluru' },
  { key: 'priya', name: 'Priya Nair', email: 'priya.nair.demo@example.com', isReferrer: true, currentCompany: 'Northwind Labs', currentCompanyRole: 'Senior Software Engineer', referralCompanies: ['Northwind Labs'], seekingRole: 'Engineering Manager', experienceYears: 8 },
  { key: 'rohan', name: 'Rohan Iyer', email: 'rohan.iyer.demo@example.com', isReferrer: true, currentCompany: 'Orbit Payments', currentCompanyRole: 'Product Manager', referralCompanies: ['Orbit Payments'], seekingRole: 'Senior Product Manager', experienceYears: 6 },
  { key: 'sneha', name: 'Sneha Kulkarni', email: 'sneha.kulkarni.demo@example.com', isReferrer: true, currentCompany: 'Zenith Cloud', currentCompanyRole: 'Engineering Manager', referralCompanies: ['Zenith Cloud', 'Northwind Labs'], seekingRole: 'Director of Engineering', experienceYears: 11 },
  { key: 'karan', name: 'Karan Shah', email: 'karan.shah.demo@example.com', isReferrer: true, currentCompany: 'Northwind Labs', currentCompanyRole: 'Data Scientist', referralCompanies: [], seekingRole: 'ML Engineer', experienceYears: 5 },
  { key: 'meera', name: 'Meera Joshi', email: 'meera.joshi.demo@example.com', seekingRole: 'Frontend Developer', experienceYears: 1, preferredLocation: 'Pune' },
  { key: 'vikram', name: 'Vikram Rao', email: 'vikram.rao.demo@example.com', seekingRole: 'Data Analyst', experienceYears: 2, preferredLocation: 'Hyderabad' },
  { key: 'ananya', name: 'Ananya Das', email: 'ananya.das.demo@example.com', isReferrer: true, currentCompany: 'Lumen Health', currentCompanyRole: 'UX Designer', referralCompanies: ['Lumen Health'], seekingRole: 'Product Designer', experienceYears: 4 },
];

const COMPANIES = ['Zenith Cloud', 'Northwind Labs', 'Orbit Payments', 'Lumen Health'].map((name) => ({ name, industry: 'Technology (demo)', location: 'India' }));

const JOBS = [
  { ext: 'referral-demo-job-1', title: 'Backend Engineer', company: 'Northwind Labs', city: 'Bengaluru', skills: ['Node.js', 'MongoDB', 'REST'] },
  { ext: 'referral-demo-job-2', title: 'Frontend Developer', company: 'Zenith Cloud', city: 'Pune', skills: ['React', 'CSS', 'TypeScript'] },
  { ext: 'referral-demo-job-3', title: 'Product Manager', company: 'Orbit Payments', city: 'Mumbai', skills: ['Roadmapping', 'Analytics'] },
  { ext: 'referral-demo-job-4', title: 'Data Analyst', company: 'Zenith Cloud', city: 'Hyderabad', skills: ['SQL', 'Python', 'Tableau'] },
  { ext: 'referral-demo-job-5', title: 'Product Designer', company: 'Lumen Health', city: 'Bengaluru', skills: ['Figma', 'Research'] },
  { ext: 'referral-demo-job-6', title: 'QA Engineer', company: 'Zenith Cloud', city: 'Chennai', skills: ['Selenium', 'API testing'] },
].map((j) => ({ ...j, jobDescription: `Demo listing for ${j.title} at ${j.company}. Fictional data for the referrals demo.`, experienceLevel: 'experienced', applyUrl: `https://example.com/careers/${j.ext}` }));

const resumeText = (u) => `${u.name}\n${u.email}\n\nSUMMARY\n${u.seekingRole || 'Professional'} with ${u.experienceYears ?? 1}+ years of experience delivering reliable, user-focused work (fictional demo resume).\n\nEXPERIENCE\n${u.currentCompanyRole || 'Associate'}${u.currentCompany ? ` - ${u.currentCompany}` : ''}\n- Shipped features used by thousands of users\n- Collaborated with cross-functional teams\n\nEDUCATION\nB.Tech, Demo Institute of Technology\n\nSKILLS\nCommunication, Problem solving, Teamwork`;

const REQUESTS = [
  { from: 'aarav', to: 'priya', job: 'referral-demo-job-1', status: 'pending', msg: 'Hi Priya, I have 3 years of Node.js experience and would love a referral for the Backend Engineer role.' },
  { from: 'aarav', to: 'rohan', job: 'referral-demo-job-3', status: 'accepted', msg: 'Hello Rohan, I am moving towards product work and this role fits my background in analytics.' },
  { from: 'aarav', to: 'karan', job: 'referral-demo-job-1', status: 'referred', msg: 'Hi Karan, could you refer me for the Backend Engineer opening at Northwind Labs?' },
  { from: 'aarav', to: 'ananya', job: 'referral-demo-job-5', status: 'declined', msg: 'Hi Ananya, I am keen on the design systems work at Lumen Health.' },
  { from: 'aarav', to: 'priya', ext: { company: 'Northwind Labs', title: 'Platform Engineer', url: 'https://example.com/careers/platform-engineer' }, status: 'withdrawn', msg: 'Hi Priya, sharing another role I found on your careers page.' },
  { from: 'meera', to: 'aarav', job: 'referral-demo-job-2', status: 'pending', msg: 'Hi Aarav, I am a frontend developer with a React portfolio. Would you refer me to Zenith Cloud?' },
  { from: 'vikram', to: 'aarav', job: 'referral-demo-job-4', status: 'accepted', msg: 'Hello Aarav, I work with SQL and Tableau daily and the Data Analyst role looks like a great match.' },
  { from: 'meera', to: 'aarav', job: 'referral-demo-job-6', status: 'declined', msg: 'Hi Aarav, I am also interested in QA roles at Zenith Cloud.' },
  { from: 'vikram', to: 'aarav', ext: { company: 'Zenith Cloud', title: 'Analytics Engineer', url: 'https://example.com/careers/analytics-engineer' }, status: 'referred', msg: 'Hi Aarav, here is an analytics role that is not listed on CareerNest.' },
  { from: 'meera', to: 'sneha', job: 'referral-demo-job-2', status: 'pending', msg: 'Hi Sneha, as an engineering manager at Zenith Cloud could you refer me for the Frontend Developer role?' },
];

const run = async () => {
  const m = (process.env.MONGO_URI || '').match(/^(mongodb(?:\+srv)?):\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/);
  if (!m) fail('Refusing to run: MONGO_URI is missing or not a valid MongoDB URI.');
  const hosts = m[2].split(',').map((h) => h.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase());
  const dbName = m[3] || 'test';
  if (process.env.NODE_ENV === 'production') fail('Refusing to run: NODE_ENV is "production".');
  if (!(m[1] === 'mongodb' && hosts.every((h) => ['localhost', '127.0.0.1', '::1'].includes(h)))) fail('Refusing to run: only a local MongoDB is allowed for the referral demo.');
  if (!dbName.endsWith('_demo')) fail(`Refusing to run: database name "${dbName}" must end in "_demo" so the demo data can never mix with real data.`);
  console.log(`Target: host=${hosts.join(',')} database=${dbName} (local)`);
  console.log(APPLY ? 'Mode: APPLY (additive, idempotent)' : 'Mode: DRY RUN (nothing will be written)');
  await mongoose.connect(process.env.MONGO_URI);

  const existingEmails = new Set((await User.find({ email: { $in: USERS.map((u) => u.email) } }).select('email').lean()).map((u) => u.email));
  const existingCompanies = new Set((await Company.find({ name: { $in: COMPANIES.map((c) => c.name) } }).select('name').lean()).map((c) => c.name));
  const existingJobs = new Set((await Job.find({ externalId: { $in: JOBS.map((j) => j.ext) } }).select('externalId').lean()).map((j) => j.externalId));
  console.log(`\nUsers: ${USERS.length - existingEmails.size} to create (${existingEmails.size} exist)`);
  console.log(`Companies: ${COMPANIES.length - existingCompanies.size} to create | Jobs: ${JOBS.length - existingJobs.size} to create | Referral requests: up to ${REQUESTS.length}`);
  if (!APPLY) { console.log('\nDry run complete. Nothing was written. Re-run with --apply.'); return; }

  const hash = await bcrypt.hash(PASSWORD, 10);
  const userDocs = {};
  for (const u of USERS) {
    const { key, ...fields } = u;
    const verifiedAt = new Date();
    userDocs[key] = (await User.findOne({ email: u.email })) || (await User.create({ ...fields, password: hash, emailVerified: true, emailVerifiedAt: verifiedAt }));
    // Demo accounts must be verified or they cannot send referral requests (requireVerified). Only the verification flag of
    // these fictional demo users is touched; nothing else on an existing record is overwritten.
    if (userDocs[key].emailVerified !== true) {
      await User.updateOne({ _id: userDocs[key]._id }, { $set: { emailVerified: true, emailVerifiedAt: verifiedAt } });
      userDocs[key].emailVerified = true;
    }
  }
  const companyDocs = {};
  for (const c of COMPANIES) {
    companyDocs[c.name] = (await Company.findOne({ name: c.name })) || (await Company.create(c));
  }
  const jobDocs = {};
  for (const j of JOBS) {
    let doc = await Job.findOne({ externalId: j.ext });
    if (!doc) {
      doc = await Job.create({
        title: j.title, company: companyDocs[j.company]._id, city: j.city, jobDescription: j.jobDescription,
        experienceLevel: j.experienceLevel, skills: j.skills, source: 'demo', externalId: j.ext, applyUrl: j.applyUrl,
        isActive: true, employmentType: 'full-time', workMode: 'hybrid',
      });
    }
    jobDocs[j.ext] = { doc, company: j.company };
  }
  const resumeDocs = {};
  for (const u of USERS) {
    const fileName = `${u.name.split(' ')[0]}_Resume_Demo.txt`;
    resumeDocs[u.key] = (await Resume.findOne({ user: userDocs[u.key]._id, fileName }))
      || (await Resume.create({ user: userDocs[u.key]._id, fileName, name: `${u.name} - Resume`, fileType: 'txt', resumeText: resumeText(u), isDefault: true }));
  }

  let created = 0;
  for (let i = 0; i < REQUESTS.length; i += 1) {
    const r = REQUESTS[i];
    let job; let jobKey;
    if (r.job) {
      const { doc, company } = jobDocs[r.job];
      job = { jobId: doc._id, title: doc.title, company, jobCode: doc.jobCode, applyUrl: doc.applyUrl, external: false };
      jobKey = `job:${doc._id}`;
    } else {
      job = { title: r.ext.title, company: r.ext.company, applyUrl: r.ext.url, external: true };
      jobKey = `ext:${H.normaliseUrl(r.ext.url)}`;
    }
    if (await Referral.exists({ seeker: userDocs[r.from]._id, referrer: userDocs[r.to]._id, jobKey, message: r.msg })) continue;

    const sent = new Date(Date.now() - (REQUESTS.length - i) * 36 * 3600 * 1000);
    const responded = new Date(sent.getTime() + 6 * 3600 * 1000);
    const history = [{ status: 'pending', by: userDocs[r.from]._id, at: sent }];
    if (['accepted', 'referred'].includes(r.status)) history.push({ status: 'accepted', by: userDocs[r.to]._id, at: responded });
    if (r.status === 'referred') history.push({ status: 'referred', by: userDocs[r.to]._id, at: new Date(responded.getTime() + 24 * 3600 * 1000) });
    if (r.status === 'declined') history.push({ status: 'declined', by: userDocs[r.to]._id, at: responded });
    if (r.status === 'withdrawn') history.push({ status: 'withdrawn', by: userDocs[r.from]._id, at: responded });
    const res = resumeDocs[r.from];
    try {
      await Referral.create({
        seeker: userDocs[r.from]._id, referrer: userDocs[r.to]._id, message: r.msg, status: r.status, job, jobKey,
        active: r.status === 'pending' || r.status === 'accepted',
        resume: res._id,
        resumeInfo: { name: res.name, fileName: res.fileName, fileType: 'txt' },
        resumeSnapshot: { name: res.name, fileName: res.fileName, fileType: 'txt', text: res.resumeText },
        statusHistory: history,
        respondedAt: r.status === 'pending' ? undefined : history[history.length - 1].at,
        createdAt: sent,
      });
      created += 1;
    } catch (e) {
      if (e.code !== 11000) throw e; // an equivalent active request already exists
    }
  }
  await Referral.createIndexes();
  console.log(`\nDone. Referral requests created this run: ${created}.`);
  console.log(`Demo login: ${MAIN} / ${PASSWORD} (same password for all demo users).`);
};

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((e) => { console.error('Demo seed failed:', e.message); mongoose.disconnect().finally(() => process.exit(1)); });
