// Per-provider circuit breaker with automatic recovery.
//   closed    -> normal use
//   open      -> skipped until `openUntil` (quota: immediately; transient: after `threshold` consecutive failures;
//                auth/config: long cooldown so a bad key is not hammered)
//   half-open -> cooldown elapsed: the next request is a live probe; success closes the breaker, failure re-opens it
// State is in memory (one process); `now` is injectable for tests.

const MAX_COOLDOWN_MS = 15 * 60 * 1000;

class Breaker {
  constructor({ threshold = 3, cooldownMs = 60000, longCooldownMs = 10 * 60 * 1000, now = Date.now } = {}) {
    this.threshold = Math.max(1, threshold);
    this.cooldownMs = cooldownMs;
    this.longCooldownMs = longCooldownMs;
    this.now = now;
    this.reset();
  }

  reset() {
    this.failures = 0;
    this.openUntil = 0;
    this.opened = false;
    this.lastError = null; // { status, code, message } of the failure that opened it (no secrets)
    this.lastErrorClass = null;
    this.lastSuccessAt = null;
    this.lastFailureAt = null;
  }

  state() {
    if (!this.opened) return 'closed';
    return this.now() < this.openUntil ? 'open' : 'half-open';
  }

  allow() {
    return this.state() !== 'open';
  }

  success() {
    this.failures = 0;
    this.opened = false;
    this.openUntil = 0;
    this.lastSuccessAt = this.now();
  }

  // `trip` comes from errors.RULES: 'now' | 'count' | 'long' | false.
  failure(cls, trip, { retryAfterMs, error } = {}) {
    this.lastFailureAt = this.now();
    this.lastErrorClass = cls;
    if (error) this.lastError = { status: error.status, code: error.code, message: error.message };
    if (!trip) return;
    if (this.state() === 'half-open') {
      // the probe failed: straight back to open
      this.open(trip === 'long' ? this.longCooldownMs : Math.max(this.cooldownMs, retryAfterMs || 0));
      return;
    }
    this.failures += 1;
    if (trip === 'now') this.open(Math.max(this.cooldownMs, retryAfterMs || 0));
    else if (trip === 'long') this.open(this.longCooldownMs);
    else if (this.failures >= this.threshold) this.open(this.cooldownMs);
  }

  open(ms) {
    this.opened = true;
    this.openUntil = this.now() + Math.min(ms, MAX_COOLDOWN_MS);
  }
}

module.exports = { Breaker, MAX_COOLDOWN_MS };
