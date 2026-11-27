const mongoose = require('mongoose');
const ContactMessage = require('../models/ContactMessage');
const User = require('../models/User');
const { CATEGORIES, STATUSES, TRANSITIONS } = ContactMessage;
const { isValidId, escapeRegex } = require('../middleware/validate');
const { recordAdminAction } = require('../utils/adminAudit');
const { notify } = require('../utils/notify');
const { sendEmail, EmailError } = require('../services/email');
const { appBaseUrl } = require('../services/email/config');

// Audit summaries carry ids and status words only: never names, emails or message text.
const audit = (req, action, id, summary) => recordAdminAction({ actor: req.user.id, action, targetType: 'support', targetId: id, summary });

const SORTS = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, updated: { updatedAt: -1 } };

const shortUser = (u) => (u && u._id ? { id: String(u._id), name: u.name, email: u.email, deleted: Boolean(u.deletedAt) } : null);

const listView = (m) => ({
  id: String(m._id),
  category: m.category || 'other',
  subject: m.subject,
  status: m.status || 'open',
  unread: !m.adminSeenAt,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
  responseCount: (m.responses || []).length,
  assignee: shortUser(m.assignee),
  user: m.anonymizedAt ? { name: 'Deleted user', email: '', deleted: true } : shortUser(m.user),
});

const detailView = (m) => ({
  ...listView(m),
  message: m.message,
  anonymized: Boolean(m.anonymizedAt),
  responses: (m.responses || []).map((r) => ({ id: String(r._id), text: r.text, at: r.at, emailDelivery: r.emailDelivery, author: shortUser(r.author) })),
  internalNotes: (m.internalNotes || []).map((n) => ({ id: String(n._id), text: n.text, at: n.at, author: shortUser(n.author) })),
});

const populateList = (q) => q.populate('user', 'name email deletedAt').populate('assignee', 'name email');
const loadDetail = (id) => ContactMessage.findById(id).select('+internalNotes')
  .populate('user', 'name email deletedAt').populate('assignee', 'name email')
  .populate('responses.author', 'name email').populate('internalNotes.author', 'name email');

const text = (v, min, max, label) => {
  if (typeof v !== 'string') return { error: `${label} must be text` };
  const t = v.trim();
  if (t.length < min || t.length > max) return { error: `${label} must be ${min}-${max} characters` };
  return { value: t };
};

const counts = async (req, res, next) => {
  try {
    const [byStatus, unread] = await Promise.all([
      ContactMessage.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      ContactMessage.countDocuments({ adminSeenAt: null }),
    ]);
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of byStatus) if (r._id in c) c[r._id] = r.n;
    res.json({ ...c, unread, total: Object.values(c).reduce((a, b) => a + b, 0) });
  } catch (e) { next(e); }
};

const list = async (req, res, next) => {
  try {
    const { q, status, category, assignee, sort = 'newest' } = req.query;
    for (const [k, v] of Object.entries({ q, status, category, assignee, sort })) {
      if (v !== undefined && typeof v !== 'string') return res.status(400).json({ message: `Invalid ${k}` });
    }
    if (status && !STATUSES.includes(status)) return res.status(400).json({ message: `status must be one of: ${STATUSES.join(', ')}` });
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ message: `category must be one of: ${CATEGORIES.join(', ')}` });
    if (!SORTS[sort]) return res.status(400).json({ message: `sort must be one of: ${Object.keys(SORTS).join(', ')}` });
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (assignee) {
      if (assignee === 'unassigned') filter.assignee = null;
      else if (isValidId(assignee)) filter.assignee = new mongoose.Types.ObjectId(assignee);
      else return res.status(400).json({ message: 'Invalid assignee' });
    }
    if (req.query.unread === 'true') filter.adminSeenAt = null;
    if (q && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim().slice(0, 100)), 'i');
      const users = await User.find({ $or: [{ name: rx }, { email: rx }], deletedAt: null }).select('_id').limit(200).lean();
      filter.$or = [{ subject: rx }, { message: rx }, { name: rx }, { email: rx }, { user: { $in: users.map((u) => u._id) } }];
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const [total, rows] = await Promise.all([
      ContactMessage.countDocuments(filter),
      populateList(ContactMessage.find(filter).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit)),
    ]);
    res.json({ count: rows.length, total, page, pages: Math.max(1, Math.ceil(total / limit)), messages: rows.map(listView) });
  } catch (e) { next(e); }
};

const getOne = async (req, res, next) => {
  try {
    const m = await loadDetail(req.params.id);
    if (!m) return res.status(404).json({ message: 'Message not found' });
    if (!m.adminSeenAt) {
      await ContactMessage.updateOne({ _id: m._id, adminSeenAt: null }, { $set: { adminSeenAt: new Date() } }, { timestamps: false });
      m.adminSeenAt = new Date();
    }
    res.json({ message: 'ok', ticket: detailView(m), transitions: TRANSITIONS[m.status || 'open'] });
  } catch (e) { next(e); }
};

const setStatus = async (req, res, next) => {
  try {
    const to = req.body && req.body.status;
    if (typeof to !== 'string' || !STATUSES.includes(to)) return res.status(400).json({ message: `status must be one of: ${STATUSES.join(', ')}` });
    const m = await ContactMessage.findById(req.params.id).select('status user subject');
    if (!m) return res.status(404).json({ message: 'Message not found' });
    const from = m.status || 'open';
    if (!TRANSITIONS[from].includes(to)) {
      return res.status(409).json({ message: `A ${from} request cannot be moved to ${to}.`, code: 'INVALID_TRANSITION', allowed: TRANSITIONS[from] });
    }
    // compare-and-set so two admins cannot both apply a transition from the same state
    const r = await ContactMessage.updateOne({ _id: m._id, status: from }, { $set: { status: to } });
    if (!r.modifiedCount) return res.status(409).json({ message: 'This request was just changed by someone else. Reload and try again.', code: 'CONFLICT' });
    await audit(req, 'support.status', m._id, `Status ${from} -> ${to}`);
    if (['resolved', 'closed'].includes(to)) {
      await notify(m.user, { type: 'support', title: `Your support request was marked ${to}`, message: m.subject, link: `/contact/history/${m._id}` });
    }
    const fresh = await loadDetail(m._id);
    res.json({ message: 'Status updated', ticket: detailView(fresh), transitions: TRANSITIONS[to] });
  } catch (e) { next(e); }
};

const setAssignee = async (req, res, next) => {
  try {
    const a = req.body ? req.body.assignee : undefined;
    let value = null;
    if (a !== null && a !== undefined && a !== '') {
      if (!isValidId(a)) return res.status(400).json({ message: 'Invalid assignee' });
      const admin = await User.findOne({ _id: a, role: 'admin', deletedAt: null }).select('_id');
      if (!admin) return res.status(400).json({ message: 'The assignee must be an active administrator' });
      value = admin._id;
    }
    const r = await ContactMessage.updateOne({ _id: req.params.id }, { $set: { assignee: value } });
    if (!r.matchedCount) return res.status(404).json({ message: 'Message not found' });
    await audit(req, 'support.assign', req.params.id, value ? `Assigned to admin ${value}` : 'Unassigned');
    res.json({ message: 'Assignee updated', ticket: detailView(await loadDetail(req.params.id)) });
  } catch (e) { next(e); }
};

const addNote = async (req, res, next) => {
  try {
    const t = text(req.body && req.body.text, 1, 2000, 'Note');
    if (t.error) return res.status(400).json({ message: t.error });
    const r = await ContactMessage.updateOne({ _id: req.params.id }, { $push: { internalNotes: { author: req.user.id, text: t.value } } });
    if (!r.matchedCount) return res.status(404).json({ message: 'Message not found' });
    await audit(req, 'support.note', req.params.id, 'Added an internal note');
    res.status(201).json({ message: 'Note added', ticket: detailView(await loadDetail(req.params.id)) });
  } catch (e) { next(e); }
};

// Public response: saved in-app first (the source of truth), then a notification, then an optional email copy.
const respond = async (req, res, next) => {
  try {
    const t = text(req.body && req.body.text, 1, 4000, 'Response');
    if (t.error) return res.status(400).json({ message: t.error });
    const wantEmail = !(req.body && req.body.sendEmail === false);
    const m = await ContactMessage.findById(req.params.id).select('status user subject anonymizedAt');
    if (!m) return res.status(404).json({ message: 'Message not found' });
    if (m.status === 'closed') return res.status(409).json({ message: 'This request is closed. Ask the user to submit a new request.', code: 'CLOSED' });
    if (m.anonymizedAt) return res.status(409).json({ message: 'The account behind this request was deleted, so a response cannot be delivered.', code: 'ANONYMIZED' });

    const response = { author: req.user.id, text: t.value, at: new Date(), emailDelivery: 'not_requested' };
    const set = { lastResponseAt: response.at };
    if ((m.status || 'open') === 'open') set.status = 'in-progress';
    await ContactMessage.updateOne({ _id: m._id }, { $push: { responses: response }, $set: set });
    const saved = (await ContactMessage.findById(m._id).select('responses')).responses.slice(-1)[0];

    await notify(m.user, { type: 'support', title: 'CareerNest Support replied to your request', message: m.subject, link: `/contact/history/${m._id}` });

    let delivery = 'not_requested';
    if (wantEmail) {
      const user = await User.findById(m.user).select('name email deletedAt');
      if (!user || user.deletedAt || !user.email) {
        delivery = 'unavailable';
      } else {
        try {
          const sent = await sendEmail('supportReply', user.email, { name: user.name, subject: m.subject, replyText: t.value, supportUrl: `${appBaseUrl()}/contact/history/${m._id}` });
          delivery = sent.state; // 'stored_local' (dev outbox, NOT delivered) | 'provider_accepted' | 'delivered'
        } catch (err) {
          delivery = err instanceof EmailError && err.code === 'EMAIL_NOT_CONFIGURED' ? 'unavailable' : 'failed';
        }
      }
      await ContactMessage.updateOne({ _id: m._id, 'responses._id': saved._id }, { $set: { 'responses.$.emailDelivery': delivery } });
    }
    await audit(req, 'support.respond', m._id, `Public response added (email: ${delivery})`);
    res.status(201).json({ message: 'Response saved', emailDelivery: delivery, ticket: detailView(await loadDetail(m._id)) });
  } catch (e) { next(e); }
};

module.exports = { counts, list, getOne, setStatus, setAssignee, addNote, respond };
