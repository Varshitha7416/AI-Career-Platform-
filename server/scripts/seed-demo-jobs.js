/*
 * Seed / enrich the CareerNest demo job dataset (ADDITIVE ONLY: this script never deletes anything).
 *
 *   npm run seed:demo-jobs               # dry run (default): prints the plan, writes nothing
 *   npm run seed:demo-jobs -- --apply    # backs up, then applies the plan
 *
 * What it does
 *  - Companies: inserts the demo companies that do not exist yet (matched case-insensitively by name) and fills
 *    in missing optional fields (size) on existing ones. Existing company documents keep their _id and values.
 *  - Existing jobs: keeps every existing job (same _id, so saved jobs / applications / history stay valid) and
 *    only WRITES FIELDS THAT ARE MISSING (job code, work mode, skills, salary, ...). Existing values, including
 *    title, description, company and city, are never changed.
 *  - New jobs: inserts the generated demo listings, skipping any whose externalId already exists (idempotent).
 *  - All generated listings are flagged source: 'demo'. Apply links, where present, use the placeholder domain
 *    example.com; no real employer application URLs are invented.
 *
 * Safety: dry run by default; --apply required to write; verified timestamped JSON backup of the jobs, companies
 * and counters collections before any write; refuses NODE_ENV=production; refuses any non-local database unless
 * SEED_ALLOW_REMOTE_DB=<exact database name> is set (even for the dry run).
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Company = require('../models/Company');
const Job = require('../models/Job');
const Counter = require('../models/Counter');
const { toAnnualInr } = require('../utils/salary');
const { COMPANIES, buildDemoJobs, enrichmentFor } = require('../data/demoJobs');

const { EJSON } = mongoose.mongo.BSON;
const args = process.argv.slice(2);
const KNOWN_FLAGS = ['--apply', '--help'];
const APPLY = args.includes('--apply');

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
if (args.includes('--help')) {
  console.log('Usage: npm run seed:demo-jobs [-- --apply]\nDry run by default. See the header of scripts/seed-demo-jobs.js.');
  process.exit(0);
}
const unknown = args.filter((a) => !KNOWN_FLAGS.includes(a));
if (unknown.length) fail(`Unknown argument(s): ${unknown.join(' ')}. Allowed: ${KNOWN_FLAGS.join(' ')}`);

// ---- Safety guard: runs BEFORE any database connection is opened ----
const describeTarget = () => {
  const uri = process.env.MONGO_URI || '';
  const m = uri.match(/^(mongodb(?:\+srv)?):\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/);
  if (!m) return null;
  const hosts = m[2].split(',').map((h) => h.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase());
  const isLocal = m[1] === 'mongodb' && hosts.every((h) => ['localhost', '127.0.0.1', '::1'].includes(h));
  return { hosts, dbName: m[3] || 'test', isLocal }; // no db in the URI => MongoDB default "test"
};
const assertSafeTarget = () => {
  const target = describeTarget();
  if (!target) fail('Refusing to run: MONGO_URI is missing or not a valid MongoDB URI.');
  if (process.env.NODE_ENV === 'production') fail('Refusing to run: NODE_ENV is "production".');
  console.log(`Target: host=${target.hosts.join(',')} database=${target.dbName} (${target.isLocal ? 'local' : 'REMOTE'})`);
  if (!target.isLocal) {
    if (process.env.SEED_ALLOW_REMOTE_DB !== target.dbName) {
      fail(`Refusing to connect to a REMOTE database. If you really mean it, set SEED_ALLOW_REMOTE_DB=${target.dbName} (the exact database name).`);
    }
    console.warn(`WARNING: remote database "${target.dbName}" explicitly confirmed.`);
  }
  return target;
};

const backupDir = path.join(__dirname, '..', 'backups');
const writeVerifiedBackup = (target, collections) => {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(backupDir, `seed-demo-jobs-${target.dbName}-${stamp}-${crypto.randomBytes(3).toString('hex')}.json`);
  const payload = EJSON.stringify({ createdAt: new Date().toISOString(), database: target.dbName, host: target.hosts.join(','), collections }, { relaxed: false }, 2);
  fs.writeFileSync(file, payload, { flag: 'wx' }); // never overwrites
  const parsed = EJSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [name, docs] of Object.entries(collections)) {
    if (!parsed.collections[name] || parsed.collections[name].length !== docs.length) throw new Error(`Backup verification failed for "${name}".`);
  }
  return { file, bytes: Buffer.byteLength(payload) };
};

const missing = (v) => v === undefined || v === null || (Array.isArray(v) && v.length === 0);
const code = (n) => `CN-${String(n).padStart(6, '0')}`;

const run = async () => {
  const target = assertSafeTarget();
  console.log(APPLY ? 'Mode: APPLY (additive writes after a verified backup)' : 'Mode: DRY RUN (nothing will be written)');
  await mongoose.connect(process.env.MONGO_URI);

  // ------------------------------------------------------------ read current state
  const existingCompanies = await Company.collection.find({}).toArray();
  const existingJobs = await Job.collection.find({}).sort({ createdAt: 1, _id: 1 }).toArray();
  const companyByName = new Map(existingCompanies.map((c) => [c.name.toLowerCase(), c]));
  const companyById = new Map(existingCompanies.map((c) => [String(c._id), c]));
  const existingExternalIds = new Set(existingJobs.map((j) => j.externalId).filter(Boolean));
  const [savedCount, appCount] = await Promise.all([
    mongoose.connection.collection('savedjobs').countDocuments(),
    mongoose.connection.collection('applications').countDocuments(),
  ]);

  // ------------------------------------------------------------ plan: companies
  const companiesToInsert = [];
  const companyPatches = []; // { _id, set }
  for (const c of COMPANIES) {
    const found = companyByName.get(c.name.toLowerCase());
    if (!found) {
      companiesToInsert.push({ name: c.name, industry: c.industry, location: c.location, description: c.description, website: c.website, size: c.size });
    } else {
      const set = {};
      for (const f of ['size', 'industry', 'location', 'description', 'website']) if (missing(found[f]) && c[f]) set[f] = c[f];
      if (Object.keys(set).length) companyPatches.push({ _id: found._id, name: found.name, set });
    }
  }

  // ------------------------------------------------------------ plan: enrich existing jobs (missing fields only)
  const jobPatches = []; // { _id, set, needsCode, withApplyLink }
  const fieldCounts = {};
  for (const job of existingJobs) {
    if (job.externalId) continue; // generated demo listings are already complete
    const raw = enrichmentFor(job, companyById.get(String(job.company)));
    const { withApplyLink, ...fields } = raw;
    const set = {};
    for (const [k, v] of Object.entries(fields)) if (missing(job[k])) set[k] = v;
    if (set.salaryMax !== undefined || (!missing(job.salaryMax) && missing(job.salaryMaxInr))) {
      const sMax = set.salaryMax ?? job.salaryMax;
      const cur = set.salaryCurrency ?? job.salaryCurrency ?? 'INR';
      const per = set.salaryPeriod ?? job.salaryPeriod ?? 'year';
      const inr = toAnnualInr(sMax, cur, per);
      if (inr !== null) set.salaryMaxInr = inr;
    }
    const needsCode = missing(job.jobCode);
    const wantsLink = withApplyLink && needsCode && missing(job.applyUrl); // decided once, at first enrichment
    if (Object.keys(set).length || needsCode || wantsLink) {
      jobPatches.push({ _id: job._id, set, needsCode, wantsLink });
      Object.keys(set).forEach((k) => (fieldCounts[k] = (fieldCounts[k] || 0) + 1));
      if (needsCode) fieldCounts.jobCode = (fieldCounts.jobCode || 0) + 1;
      if (wantsLink) fieldCounts.applyUrl = (fieldCounts.applyUrl || 0) + 1;
    }
  }

  // ------------------------------------------------------------ plan: new jobs
  const generated = buildDemoJobs();
  const newJobs = generated.filter((j) => !existingExternalIds.has(j.externalId));

  const codesNeeded = jobPatches.filter((p) => p.needsCode).length + newJobs.length;

  console.log('\n=== Current state');
  console.log(`  companies: ${existingCompanies.length} | jobs: ${existingJobs.length} | saved jobs: ${savedCount} | applications: ${appCount}`);
  console.log('\n=== Plan (additive only: nothing is deleted, no existing value is overwritten)');
  console.log(`  companies to INSERT: ${companiesToInsert.length}${companiesToInsert.length ? ` (${companiesToInsert.map((c) => c.name).join(', ')})` : ''}`);
  console.log(`  existing companies getting missing fields: ${companyPatches.length}`);
  console.log(`  existing jobs to ENRICH (missing fields only): ${jobPatches.length} of ${existingJobs.length}`);
  if (Object.keys(fieldCounts).length) console.log('    fields to add:', Object.entries(fieldCounts).map(([k, n]) => `${k} x${n}`).join(', '));
  console.log(`  new demo jobs to INSERT: ${newJobs.length} (already present: ${generated.length - newJobs.length})`);
  console.log(`  job IDs to assign: ${codesNeeded}`);
  console.log(`  saved jobs / applications referencing existing jobs stay valid (job _ids never change): ${savedCount} / ${appCount}`);

  if (!APPLY) {
    console.log('\nDry run complete. Nothing was written. Re-run with --apply to perform the plan above.');
    return;
  }
  if (!companiesToInsert.length && !companyPatches.length && !jobPatches.length && !newJobs.length) {
    console.log('\nNothing to do: the database already contains the demo dataset.');
    return;
  }

  // ------------------------------------------------------------ apply
  const counters = await Counter.collection.find({}).toArray();
  const backup = writeVerifiedBackup(target, { companies: existingCompanies, jobs: existingJobs, counters });
  console.log(`\nBackup written and verified: ${backup.file} (${backup.bytes} bytes)`);

  if (companiesToInsert.length) {
    const res = await Company.insertMany(companiesToInsert);
    res.forEach((c) => companyByName.set(c.name.toLowerCase(), c.toObject()));
    console.log(`Inserted ${res.length} companies.`);
  }
  if (companyPatches.length) {
    await Company.collection.bulkWrite(companyPatches.map((p) => ({ updateOne: { filter: { _id: p._id }, update: { $set: p.set } } })));
    console.log(`Updated ${companyPatches.length} existing companies (missing fields only).`);
  }

  // Reserve one contiguous block of job IDs atomically, assigned in a stable order (existing jobs, then new jobs).
  let nextCode = 0;
  if (codesNeeded) nextCode = (await Counter.next('jobCode', codesNeeded)) - codesNeeded + 1;

  if (jobPatches.length) {
    const ops = jobPatches.map((p) => {
      const set = { ...p.set };
      let jobCode;
      if (p.needsCode) {
        jobCode = code(nextCode++);
        set.jobCode = jobCode;
      }
      if (p.wantsLink) set.applyUrl = `https://example.com/apply/${jobCode || existingJobs.find((j) => String(j._id) === String(p._id)).jobCode}`;
      return { updateOne: { filter: { _id: p._id }, update: { $set: set } } };
    });
    const res = await Job.collection.bulkWrite(ops);
    console.log(`Enriched ${res.modifiedCount} existing jobs.`);
  }

  if (newJobs.length) {
    const docs = newJobs.map((j) => {
      const { companyName, roleKey, withApplyLink, ...fields } = j;
      const company = companyByName.get(companyName.toLowerCase());
      const jobCode = code(nextCode++);
      return {
        ...fields,
        company: company._id,
        jobCode,
        salaryMaxInr: toAnnualInr(fields.salaryMax, fields.salaryCurrency, fields.salaryPeriod),
        ...(withApplyLink ? { applyUrl: `https://example.com/apply/${jobCode}` } : {}),
      };
    });
    const res = await Job.insertMany(docs);
    console.log(`Inserted ${res.length} new demo jobs.`);
  }

  await Job.createIndexes(); // adds the search indexes (never drops anything)
  await Company.createIndexes();
  const [companiesAfter, jobsAfter] = await Promise.all([Company.countDocuments(), Job.countDocuments()]);
  console.log(`\nDone. companies: ${existingCompanies.length} -> ${companiesAfter} | jobs: ${existingJobs.length} -> ${jobsAfter}. Nothing was deleted.`);
};

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
