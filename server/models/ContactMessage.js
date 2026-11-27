const mongoose = require('mongoose');

// Support ticket. Created by a user via POST /api/contact; managed by admins via /api/admin/support. See docs/28.
const CATEGORIES = ['account', 'jobs', 'applications', 'ai-features', 'referrals', 'bug', 'feedback', 'other'];
const STATUSES = ['open', 'in-progress', 'resolved', 'closed'];
// Allowed status changes (anything else is a 409). `closed` is final; a resolved ticket can be reopened.
const TRANSITIONS = {
  open: ['in-progress', 'resolved', 'closed'],
  'in-progress': ['open', 'resolved', 'closed'],
  resolved: ['open', 'in-progress', 'closed'],
  closed: [],
};
const DELIVERY_STATES = ['not_requested', 'stored_local', 'provider_accepted', 'delivered', 'failed', 'unavailable'];
const REMOVED = '[removed at user request]';

const responseSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // admin who wrote it (never shown to the user)
  text: { type: String, required: true, minlength: 1, maxlength: 4000 },
  at: { type: Date, default: Date.now },
  // Email copy: 'stored_local' means only written to the development outbox, NOT delivered to anyone.
  emailDelivery: { type: String, enum: DELIVERY_STATES, default: 'not_requested' },
}, { _id: true });

const noteSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, required: true, minlength: 1, maxlength: 2000 },
  at: { type: Date, default: Date.now },
}, { _id: true });

const contactMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Identity snapshot taken from the account at submit time (never from the request). Cleared on account deletion.
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  category: { type: String, enum: CATEGORIES, default: 'other' },
  subject: { type: String, required: true, minlength: 3, maxlength: 120 },
  message: { type: String, required: true, minlength: 10, maxlength: 2000 },
  status: { type: String, enum: STATUSES, default: 'open' },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  responses: { type: [responseSchema], default: [] },
  internalNotes: { type: [noteSchema], default: [], select: false }, // admin only: never selected by user-facing queries
  lastResponseAt: { type: Date, default: null },
  adminSeenAt: { type: Date, default: null }, // null = new/unread for admins
  contentHash: { type: String, default: '', select: false }, // duplicate-submit guard
  anonymizedAt: { type: Date, default: null },
}, { timestamps: true });

contactMessageSchema.index({ user: 1, createdAt: -1 });
contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.STATUSES = STATUSES;
module.exports.TRANSITIONS = TRANSITIONS;
module.exports.DELIVERY_STATES = DELIVERY_STATES;
module.exports.REMOVED = REMOVED;
