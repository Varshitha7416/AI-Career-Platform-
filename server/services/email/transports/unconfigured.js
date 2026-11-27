// Used when no real email transport is configured (the production default until Phase 5). Sending always fails safely.
//
// Phase 5 adds a real provider as another module in this folder implementing the same interface as ./outbox.js, plus one
// line in ../index.js (getTransport). No authentication code needs to change.
module.exports = {
  name: 'none',
  available: false,
  async send() {
    const err = new Error('No email transport is configured');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  },
};
