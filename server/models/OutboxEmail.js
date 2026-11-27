const mongoose = require('mongoose');
const { isDevEnvironment } = require('../services/email/config');

// DEVELOPMENT / TEST ONLY. The local outbox transport stores every "sent" email here so it can be inspected without a mail
// provider. Rendered content (including reset links) must never be written in production. Outside NODE_ENV exactly
// "development"/"test" this module registers NO Mongoose model (so index tooling creates no collection or index for it) and
// exports an object whose every use throws. It can still be required safely (scripts load all models), just never used.
if (!isDevEnvironment(process.env)) {
  const refuse = () => { throw new Error('OutboxEmail is a development/test-only model: NODE_ENV must be exactly "development" or "test"'); };
  module.exports = new Proxy({}, { get: (_t, prop) => (prop === 'then' || typeof prop === 'symbol' ? undefined : refuse()), apply: refuse });
  return;
}

const outboxEmailSchema = new mongoose.Schema({
  to: { type: String, required: true, lowercase: true, trim: true },
  from: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  html: { type: String, required: true },
  template: { type: String, required: true },
  actionUrl: { type: String }, // the link in the email (e.g. the reset link), for convenient local testing
}, { timestamps: { createdAt: true, updatedAt: false } });

outboxEmailSchema.index({ to: 1, createdAt: -1 });
outboxEmailSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.models.OutboxEmail || mongoose.model('OutboxEmail', outboxEmailSchema);
