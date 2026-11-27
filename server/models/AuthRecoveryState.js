const mongoose = require('mongoose');

// ONE document per (user, purpose): the single point of coordination for reset-link issuance and consumption across any number
// of server processes. Every decision that must be atomic (cooldown, hourly budget, "which link is the usable one", "consume
// it exactly once") is ONE conditional update of THIS document, so it needs neither transactions (a standalone mongod has
// none) nor a unique index (the deterministic string _id is unique by construction, so safety never depends on index builds,
// which are switched off for Atlas). See docs/22-password-reset-email.md.
//
//   _id            "<purpose>:<userId>"
//   seq            reservation counter, incremented atomically by the DATABASE: the only definition of "newer"
//   activeSeq      highest seq that was ever activated (never decreases: a late, older request can never take over)
//   active         the ONE usable link { tokenId, hash, expiresAt, tokenVersion, seq } or null
//   cooldownUntil  fixed (not sliding): throttled requests never extend it
//   windowStart / windowCount   hourly budget of reservations
// Time comparisons inside the database use $$NOW (the database clock), so processes with skewed clocks agree.
const authRecoveryStateSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, required: true },
  seq: { type: Number, default: 0 },
  activeSeq: { type: Number, default: 0 },
  active: { type: mongoose.Schema.Types.Mixed, default: null },
  cooldownUntil: { type: Date },
  windowStart: { type: Date },
  windowCount: { type: Number, default: 0 },
  consumedAt: { type: Date },
  revokedAt: { type: Date },
}, { timestamps: false, minimize: false });

// Performance only (lookup of a link by its hash). Correctness never depends on this index.
authRecoveryStateSchema.index({ purpose: 1, 'active.hash': 1 });

module.exports = mongoose.models.AuthRecoveryState || mongoose.model('AuthRecoveryState', authRecoveryStateSchema);
