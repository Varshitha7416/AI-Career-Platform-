const crypto = require('crypto');
const ContactMessage = require('../models/ContactMessage');
const User = require('../models/User');
const { CATEGORIES } = ContactMessage;
const { isValidId } = require('../middleware/validate');
const { notify } = require('../utils/notify');

const MAX_PER_HOUR = 5;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

// What a USER may see of a ticket: never internal notes, admin identity, assignee or email delivery details.
const userView = (m, { thread = false } = {}) => {
  const responses = m.responses || [];
  const last = responses[responses.length - 1];
  const out = {
    id: String(m._id),
    category: m.category || 'other',
    subject: m.subject,
    status: m.status || 'open',
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    responseCount: responses.length,
    latestResponse: last ? { text: last.text.length > 160 ? `${last.text.slice(0, 157)}...` : last.text, at: last.at } : null,
  };
  if (thread) {
    out.message = m.message;
    out.responses = responses.map((r) => ({ id: String(r._id), text: r.text, at: r.at, from: 'CareerNest Support' }));
  }
  return out;
};

const createMessage = async (req, res, next) => {
  try {
    const { subject: rawSubject, message: rawMessage, category: rawCategory } = req.body || {};
    if (typeof rawSubject !== 'string' || typeof rawMessage !== 'string') {
      return res.status(400).json({ message: 'Subject and message must be text' });
    }
    if (rawCategory !== undefined && typeof rawCategory !== 'string') {
      return res.status(400).json({ message: 'Category must be text' });
    }
    const category = rawCategory === undefined || rawCategory === '' ? 'other' : rawCategory.trim();
    const subject = rawSubject.trim();
    const message = rawMessage.trim();
    const errors = [];
    if (!CATEGORIES.includes(category)) errors.push(`Category must be one of: ${CATEGORIES.join(', ')}`);
    if (subject.length < 3 || subject.length > 120) errors.push('Subject must be 3-120 characters');
    if (message.length < 10 || message.length > 2000) errors.push('Message must be 10-2000 characters');
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    const recent = await ContactMessage.countDocuments({ user: req.user.id, createdAt: { $gte: new Date(Date.now() - 3600000) } });
    if (recent >= MAX_PER_HOUR) {
      return res.status(429).json({ message: 'You have sent several messages recently. Please try again later.' });
    }

    // Duplicate-submit guard (double click / retry): same content from the same user within 10 minutes.
    const contentHash = crypto.createHash('sha256').update(`${req.user.id}\n${category}\n${subject.toLowerCase()}\n${message.toLowerCase()}`).digest('hex');
    const dup = await ContactMessage.findOne({ user: req.user.id, contentHash, createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } }).select('_id');
    if (dup) {
      return res.status(409).json({ message: 'You already sent this exact message a moment ago. We have it, so there is no need to send it again.', code: 'DUPLICATE_SUBMISSION', id: String(dup._id) });
    }

    // Name and email always come from the authenticated account, never from the request body.
    const user = await User.findById(req.user.id).select('name email');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const doc = await ContactMessage.create({ user: user._id, name: user.name, email: user.email, category, subject, message, contentHash });
    res.status(201).json({ message: 'Thanks! Your message has been sent.', ticket: userView(doc) });
  } catch (error) {
    next(error);
  }
};

// GET /api/contact?page=&limit=  (own submissions, newest first)
const listMine = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filter = { user: req.user.id };
    const [total, rows] = await Promise.all([
      ContactMessage.countDocuments(filter),
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ]);
    res.json({ count: rows.length, total, page, pages: Math.max(1, Math.ceil(total / limit)), messages: rows.map((m) => userView(m)) });
  } catch (error) {
    next(error);
  }
};

const getMine = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
    const m = await ContactMessage.findOne({ _id: req.params.id, user: req.user.id });
    if (!m) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'ok', ticket: userView(m, { thread: true }) });
  } catch (error) {
    next(error);
  }
};

module.exports = { createMessage, listMine, getMine, userView };
