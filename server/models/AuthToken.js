const mongoose = require('mongoose');

// Per-link RECORD for account flows (initially `password_reset`; email verification will reuse the pattern). Only a SHA-256
// hash of the token is stored: the raw token exists solely in the link that is emailed, so a database leak cannot be turned
// into working reset links.
//
// This collection is the audit trail. Whether a link is USABLE is decided only by the AuthRecoveryState document (one atomic
// update covers "supersede", "consume" and "revoke"); see utils/authTokens.js and docs/22-password-reset-email.md.
const PURPOSES = ['password_reset', 'email_verification'];

// What we can honestly say about the email, from weakest to strongest. Never "sent to the inbox" unless a provider confirms it.
//   accepted           request accepted, link created, no email attempted yet
//   stored_local       written to the local development outbox (nobody was emailed)
//   provider_accepted  a real provider accepted the message for delivery (future)
//   delivered          the provider confirmed delivery (future, only if it supplies confirmations)
//   failed             delivery failed (or its outcome was ambiguous): the link was NOT activated
const DELIVERY_STATES = ['accepted', 'stored_local', 'provider_accepted', 'delivered', 'failed'];

const authTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: PURPOSES, required: true },
  tokenHash: { type: String, required: true }, // hex SHA-256 of the raw token
  expiresAt: { type: Date, required: true },
  seq: { type: Number }, // database-assigned reservation number (orders requests; ObjectId order is not reliable)
  tokenVersion: { type: Number }, // user's tokenVersion when issued: a later password change makes the link unusable
  delivery: { type: String, enum: DELIVERY_STATES, default: 'accepted' },
  deliveryCode: { type: String }, // failure code only (never content)
  activatedAt: { type: Date, default: null }, // set when this link became THE usable link
  usedAt: { type: Date, default: null }, // audit: set after the link was consumed (the consume itself happens in the state doc)
  revokedAt: { type: Date, default: null }, // audit: superseded, never activated, or revoked by a password change
}, { timestamps: { createdAt: true, updatedAt: false } });

authTokenSchema.index({ tokenHash: 1 }, { unique: true });
authTokenSchema.index({ user: 1, purpose: 1, createdAt: -1 });
// Housekeeping only: records are removed a week after they expire.
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('AuthToken', authTokenSchema);
module.exports.PURPOSES = PURPOSES;
module.exports.DELIVERY_STATES = DELIVERY_STATES;
