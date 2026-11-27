const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');
const Resume = require('../models/Resume');
const Referral = require('../models/Referral');
const { notify } = require('../utils/notify');
const { cleanResumeText, extOf } = require('../utils/resumeExtract');
const { isValidId, escapeRegex } = require('../middleware/validate');
const H = require('../utils/referralHelpers');

const DAILY_SEND_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CODES = { 400: 'VALIDATION_ERROR', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 429: 'RATE_LIMIT' };
const err = (res, status, message, code) => res.status(status).json({ message, code: code || DEFAULT_CODES[status] });

// Provider matching a company name: referralCompanies match, or (no referralCompanies) currentCompany match.
const companyMatch = (company) => {
  const rx = { $regex: escapeRegex(company), $options: 'i' };
  return {
    $or: [
      { referralCompanies: rx },
      { $and: [{ $or: [{ referralCompanies: { $exists: false } }, { referralCompanies: { $size: 0 } }] }, { currentCompany: rx }] },
    ],
  };
};

const providerDto = (u) => ({
  _id: u._id,
  name: u.name,
  currentCompanyRole: u.currentCompanyRole || '',
  companies: H.effectiveCompanies(u),
  seekingRole: u.seekingRole || undefined,
  companySelfReported: true,
});

const intParam = (v, def, min, max) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
};

// ---------- discovery ----------

const getProviders = async (req, res, next) => {
  try {
    const company = String(req.query.company || '').trim().slice(0, 100);
    const q = String(req.query.q || '').trim().slice(0, 100);
    const page = intParam(req.query.page, 1, 1, 10000);
    const limit = intParam(req.query.limit, 12, 1, 50);

    const and = [{ isReferrer: true }, { _id: { $ne: req.user.id } }];
    if (company) and.push(companyMatch(company));
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: 'i' };
      and.push({ $or: [{ name: rx }, { currentCompanyRole: rx }, { currentCompany: rx }, { referralCompanies: rx }, { seekingRole: rx }] });
    }
    const filter = { $and: and };

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select('name currentCompany currentCompanyRole referralCompanies seekingRole')
        .sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    res.status(200).json({
      count: users.length, total, page, pages: Math.max(1, Math.ceil(total / limit)),
      providers: users.map(providerDto),
    });
  } catch (error) {
    next(error);
  }
};

const getCompanies = async (req, res, next) => {
  try {
    const users = await User.find({ isReferrer: true, _id: { $ne: req.user.id } })
      .select('currentCompany referralCompanies').lean();
    const byLower = new Map();
    users.forEach((u) => H.effectiveCompanies(u).forEach((c) => {
      const k = c.trim().toLowerCase();
      if (k && !byLower.has(k)) byLower.set(k, c.trim());
    }));
    const companies = [...byLower.values()].sort((a, b) => a.localeCompare(b));
    res.status(200).json({ companies });
  } catch (error) {
    next(error);
  }
};

// Legacy alias of the provider search (same response shape as before)
const findReferrers = async (req, res, next) => {
  try {
    const company = String(req.query.company || '').trim();
    if (!company) return err(res, 400, 'Company name is required');
    const referrers = await User.find({ isReferrer: true, _id: { $ne: req.user.id }, ...companyMatch(company.slice(0, 100)) })
      .select('name currentCompany currentCompanyRole');
    res.status(200).json({ count: referrers.length, referrers });
  } catch (error) {
    next(error);
  }
};

// ---------- send ----------

const requestReferral = async (req, res, next) => {
  try {
    const body = req.body || {};
    const providerId = body.providerId !== undefined ? body.providerId : body.referrerId; // referrerId = legacy name
    if (typeof providerId !== 'string' || !isValidId(providerId)) return err(res, 400, 'Invalid provider');
    if (providerId === req.user.id) return err(res, 400, 'You cannot request a referral from yourself');

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return err(res, 400, 'Please write a short message to the provider');
    if (message.length > 1000) return err(res, 400, 'Message must be 1000 characters or fewer');

    if (body.acknowledgeResumeShare !== true) {
      return err(res, 400, 'Please confirm that a copy of your resume text will be shared with the provider', 'RESUME_SHARE_NOT_CONFIRMED');
    }
    if (typeof body.resumeId !== 'string' || !isValidId(body.resumeId)) return err(res, 400, 'Please choose a resume to attach');

    const hasJob = body.jobId !== undefined && body.jobId !== null && body.jobId !== '';
    const hasExt = body.externalJob !== undefined && body.externalJob !== null;
    if (hasJob === hasExt) return err(res, 400, 'Provide either a CareerNest job or the details of an external job');

    // Validate the job input before touching other collections
    let ext = null;
    if (hasExt) {
      const e = body.externalJob;
      if (typeof e !== 'object' || Array.isArray(e)) return err(res, 400, 'Invalid external job');
      const company = typeof e.company === 'string' ? e.company.trim() : '';
      const title = typeof e.title === 'string' ? e.title.trim() : '';
      const url = typeof e.url === 'string' ? H.parseHttpUrl(e.url) : null;
      const externalJobId = typeof e.externalJobId === 'string' ? e.externalJobId.trim() : '';
      if (!company || company.length > 100) return err(res, 400, 'External job company is required (max 100 characters)');
      if (!title || title.length > 150) return err(res, 400, 'External job title is required (max 150 characters)');
      if (!url) return err(res, 400, 'External job link must be a valid http(s) URL');
      if (e.url.length > 500) return err(res, 400, 'External job link is too long');
      if (externalJobId.length > 60) return err(res, 400, 'External job ID must be 60 characters or fewer');
      ext = { company, title, applyUrl: url.toString(), externalJobId, key: `ext:${H.normaliseUrl(e.url)}` };
    } else if (typeof body.jobId !== 'string' || !isValidId(body.jobId)) {
      return err(res, 400, 'Invalid job');
    }

    const provider = await User.findOne({ _id: providerId, isReferrer: true })
      .select('name currentCompany currentCompanyRole referralCompanies').lean();
    if (!provider) return err(res, 404, 'Provider not found');

    const resume = await Resume.findOne({ _id: body.resumeId, user: req.user.id });
    if (!resume) return err(res, 404, 'Resume not found');

    let job;
    let jobKey;
    if (ext) {
      job = { title: ext.title, company: ext.company, applyUrl: ext.applyUrl, external: true, ...(ext.externalJobId ? { externalJobId: ext.externalJobId } : {}) };
      jobKey = ext.key;
    } else {
      const jobDoc = await Job.findById(body.jobId).populate('company', 'name').lean();
      if (!jobDoc) return err(res, 404, 'Job not found');
      // Built from the stored Job record only; client-supplied job values are ignored.
      job = {
        jobId: jobDoc._id,
        title: jobDoc.title,
        company: (jobDoc.company && jobDoc.company.name) || '',
        jobCode: jobDoc.jobCode,
        applyUrl: jobDoc.applyUrl,
        external: false,
      };
      jobKey = `job:${jobDoc._id}`;
    }

    const sentToday = await Referral.countDocuments({ seeker: req.user.id, createdAt: { $gte: new Date(Date.now() - DAY_MS) } });
    if (sentToday >= DAILY_SEND_LIMIT) {
      return err(res, 429, `You can send up to ${DAILY_SEND_LIMIT} referral requests per day. Please try again tomorrow.`, 'RATE_LIMIT');
    }

    const dupMsg = 'You already have an active request to this provider for this job.';
    if (await Referral.exists({ seeker: req.user.id, referrer: providerId, jobKey, active: true })) {
      return err(res, 409, dupMsg, 'DUPLICATE_ACTIVE');
    }

    const fileName = resume.fileName || 'resume';
    const fileType = resume.fileType || extOf(fileName) || '';
    const name = resume.name || fileName;
    let created;
    try {
      created = await Referral.create({
        seeker: req.user.id,
        referrer: providerId,
        message,
        status: 'pending',
        job,
        jobKey,
        active: true,
        resume: resume._id,
        resumeInfo: { name, fileName, fileType },
        resumeSnapshot: { name, fileName, fileType, text: cleanResumeText(resume.resumeText) },
        statusHistory: [{ status: 'pending', by: req.user.id, at: new Date() }],
      });
    } catch (e) {
      if (e && e.code === 11000) return err(res, 409, dupMsg, 'DUPLICATE_ACTIVE');
      throw e;
    }

    const sender = await User.findById(req.user.id).select(H.USER_FIELDS).lean();
    await notify(providerId, {
      type: 'referral',
      title: 'New referral request',
      message: `${sender?.name || 'Someone'} asked you for a referral for ${job.title} at ${job.company}`,
      link: `/referrals/${created._id}`,
    });

    const fresh = await Referral.findById(created._id).lean();
    res.status(201).json({ message: 'Referral requested', referral: H.toDetail(fresh, req.user.id, sender, provider) });
  } catch (error) {
    next(error);
  }
};

// ---------- lists ----------

const countsFor = async (match) => {
  const rows = await Referral.aggregate([{ $match: match }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const counts = H.emptyCounts();
  rows.forEach((r) => {
    const s = H.normStatus(r._id);
    if (s in counts) { counts[s] += r.n; counts.all += r.n; }
  });
  return counts;
};

const listFor = (direction) => async (req, res, next) => {
  try {
    const mine = direction === 'sent' ? 'seeker' : 'referrer';
    const baseMatch = { [mine]: new mongoose.Types.ObjectId(req.user.id) };
    const filter = { [mine]: req.user.id };
    const statusQ = req.query.status ? String(req.query.status).toLowerCase() : '';
    if (statusQ && statusQ !== 'all') {
      if (!H.STATUS_LIST.includes(statusQ)) return err(res, 400, `Status must be one of: ${H.STATUS_LIST.join(', ')}`);
      filter.status = { $in: H.dbStatuses(statusQ) };
    }
    const page = intParam(req.query.page, 1, 1, 10000);
    const limit = intParam(req.query.limit, 20, 1, 50);

    const [total, docs, counts] = await Promise.all([
      Referral.countDocuments(filter),
      Referral.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      countsFor(baseMatch),
    ]);

    const ids = new Set();
    docs.forEach((d) => { ids.add(String(d.seeker)); ids.add(String(d.referrer)); });
    const users = await User.find({ _id: { $in: [...ids] } }).select(H.USER_FIELDS).lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    const referrals = docs.map((d) => H.toSummary(d, req.user.id, byId.get(String(d.seeker)), byId.get(String(d.referrer))));
    res.status(200).json({ count: referrals.length, total, page, pages: Math.max(1, Math.ceil(total / limit)), referrals, counts });
  } catch (error) {
    next(error);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const [sent, received] = await Promise.all([
      countsFor({ seeker: new mongoose.Types.ObjectId(req.user.id) }),
      countsFor({ referrer: new mongoose.Types.ObjectId(req.user.id) }),
    ]);
    res.status(200).json({ sent, received });
  } catch (error) {
    next(error);
  }
};

// ---------- detail / resume ----------

// Loads a referral the caller is a party of (404 for everyone else).
const loadParty = async (req, extraSelect = '') => {
  const doc = await Referral.findOne({ _id: req.params.id, $or: [{ seeker: req.user.id }, { referrer: req.user.id }] })
    .select(extraSelect).lean();
  return doc;
};

const detailFor = async (doc, viewerId) => {
  const users = await User.find({ _id: { $in: [doc.seeker, doc.referrer] } }).select(H.USER_FIELDS).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return H.toDetail(doc, viewerId, byId.get(String(doc.seeker)), byId.get(String(doc.referrer)));
};

const getReferral = async (req, res, next) => {
  try {
    const doc = await loadParty(req);
    if (!doc) return err(res, 404, 'Referral not found');
    res.status(200).json({ referral: await detailFor(doc, req.user.id) });
  } catch (error) {
    next(error);
  }
};

const safeFileName = (s) => String(s || 'resume').replace(/\.[a-z0-9]+$/i, '').replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 80) || 'resume';

const getReferralResume = async (req, res, next) => {
  try {
    // Only the recipient may read the snapshot; everyone else gets 404 (no information leak).
    const doc = await Referral.findOne({ _id: req.params.id, referrer: req.user.id }).select('+resumeSnapshot').lean();
    if (!doc) return err(res, 404, 'Referral not found');
    const status = H.normStatus(doc.status);
    if (status === 'declined' || status === 'withdrawn') {
      return err(res, 403, 'The resume is no longer available for this request.', 'RESUME_ACCESS_BLOCKED');
    }
    const snap = doc.resumeSnapshot;
    if (!snap || !snap.text) return err(res, 404, 'No resume was attached to this request', 'RESUME_NOT_FOUND');

    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.query.download === 'txt') {
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${safeFileName(snap.name || snap.fileName)}.txt"`);
      return res.status(200).send(snap.text);
    }
    res.status(200).json({
      resume: { name: snap.name || snap.fileName || 'Resume', fileName: snap.fileName || '', fileType: snap.fileType || '', text: snap.text, retainedCopy: true },
    });
  } catch (error) {
    next(error);
  }
};

// ---------- status changes ----------

const NOTIFY = {
  accepted: { title: 'Referral request accepted', verb: 'accepted your referral request' },
  declined: { title: 'Referral request declined', verb: 'declined your referral request' },
  referred: { title: 'You have been referred', verb: 'marked you as referred' },
  withdrawn: { title: 'Referral request withdrawn', verb: 'withdrew their referral request' },
};

const updateReferralStatus = async (req, res, next) => {
  try {
    const target = String((req.body && req.body.status) || '').toLowerCase();
    const rule = H.TRANSITIONS[target];
    if (!rule) return err(res, 400, `Status must be one of: ${Object.keys(H.TRANSITIONS).join(', ')}`);

    // Non-parties and the wrong role both get 404.
    const partyField = rule.by === 'recipient' ? 'referrer' : 'seeker';
    const doc = await Referral.findOne({ _id: req.params.id, [partyField]: req.user.id }).select('seeker referrer status jobKey job').lean();
    if (!doc) return err(res, 404, 'Referral not found');

    const fromDb = rule.from.flatMap(H.dbStatuses);
    const now = new Date();
    const set = { status: target, active: Boolean(doc.jobKey) && target === 'accepted' };
    if (rule.by === 'recipient') set.respondedAt = now;

    // Atomic: the status guard lives inside the update filter, so concurrent changes cannot both win.
    const updated = await Referral.findOneAndUpdate(
      { _id: doc._id, [partyField]: req.user.id, status: { $in: fromDb } },
      // Pipeline update: legacy documents without stored history get their "pending" entry seeded in the same atomic step.
      [{
        $set: {
          ...Object.fromEntries(Object.entries(set).map(([k, v]) => [k, { $literal: v }])),
          updatedAt: { $literal: now },
          statusHistory: {
            $concatArrays: [
              { $cond: [{ $gt: [{ $size: { $ifNull: ['$statusHistory', []] } }, 0] }, '$statusHistory', [{ status: 'pending', at: '$createdAt' }]] },
              [{ status: { $literal: target }, by: { $literal: new mongoose.Types.ObjectId(req.user.id) }, at: { $literal: now } }],
            ],
          },
        },
      }],
      { returnDocument: 'after', updatePipeline: true }
    ).lean();
    if (!updated) {
      return err(res, 409, `This request can no longer be changed to "${target}" (current status: ${H.normStatus(doc.status)}).`, 'INVALID_TRANSITION');
    }

    const actor = await User.findById(req.user.id).select('name').lean();
    const otherId = rule.by === 'recipient' ? updated.seeker : updated.referrer;
    const j = updated.job || {};
    await notify(otherId, {
      type: 'referral',
      title: NOTIFY[target].title,
      message: `${actor?.name || 'The other person'} ${NOTIFY[target].verb}${j.title ? ` (${j.title}${j.company ? ` at ${j.company}` : ''})` : ''}`,
      link: `/referrals/${updated._id}`,
    });

    res.status(200).json({ message: 'Referral status updated', referral: await detailFor(updated, req.user.id) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProviders, getCompanies, findReferrers, requestReferral,
  getMyRequests: listFor('sent'), getIncomingRequests: listFor('received'),
  getSummary, getReferral, getReferralResume, updateReferralStatus,
};
