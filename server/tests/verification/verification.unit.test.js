/*
 * Email verification: pure unit tests (no database, no server). `npm test` runs these.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requireVerified } = require('../../middleware/requireVerified');
const { render } = require('../../services/email/templates');
const T = require('../../utils/authTokens');
const AuthToken = require('../../models/AuthToken');
const { secretsMatch, MIN_SECRET_LENGTH, bootstrapAdmin, BootstrapError } = require('../../utils/bootstrapAdmin');

const run = (user) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  let nexted = false;
  requireVerified('applying to jobs')({ user }, res, () => { nexted = true; });
  return { res, nexted };
};

test('requireVerified: verified users pass; unverified / missing / forged flags get 403 EMAIL_NOT_VERIFIED', () => {
  assert.equal(run({ id: '1', emailVerified: true }).nexted, true);
  for (const u of [{ id: '1', emailVerified: false }, { id: '1' }, undefined, { id: '1', emailVerified: 'true' }, { id: '1', emailVerified: 1 }]) {
    const r = run(u);
    assert.equal(r.nexted, false);
    assert.equal(r.res.statusCode, 403);
    assert.equal(r.res.body.code, 'EMAIL_NOT_VERIFIED');
    assert.match(r.res.body.message, /verify your email address before applying to jobs/i);
  }
});

test('verification email template: link with the token in the fragment, HTML escaped, no raw token in the subject', () => {
  const url = 'http://localhost:5173/verify-email#token=abc';
  const m = render('emailVerification', { name: '<b>Ada</b> Lovelace', verifyUrl: url, expiresHours: 24 });
  assert.equal(m.actionUrl, url);
  assert.ok(m.text.includes(url));
  assert.ok(!m.subject.includes('token'));
  assert.ok(!m.html.includes('<b>Ada'), 'name is escaped');
  assert.match(m.text, /24 hours/);
});

test('token purposes: separate TTLs and limits, and email_verification is a valid token purpose', () => {
  assert.ok(AuthToken.PURPOSES.includes('email_verification'));
  assert.ok(AuthToken.PURPOSES.includes('password_reset'));
  assert.equal(T.ttlMinutes({}, 'email_verification'), 24 * 60);
  assert.equal(T.ttlMinutes({ VERIFY_TOKEN_TTL_HOURS: '2' }, 'email_verification'), 120);
  assert.equal(T.ttlMinutes({ VERIFY_TOKEN_TTL_HOURS: '9999' }, 'email_verification'), 24 * 60);
  assert.equal(T.ttlMinutes({ RESET_TOKEN_TTL_MINUTES: '15' }, 'password_reset'), 15, 'reset TTL is untouched');
  assert.equal(T.ttlMinutes({ RESET_TOKEN_TTL_MINUTES: '15', VERIFY_TOKEN_TTL_HOURS: '2' }, 'password_reset'), 15);
  // cooldown / budget: own env names, clamped outside tests
  assert.deepEqual(T.limits({}, 'email_verification'), { cooldownMs: 60000, maxPerHour: 5 });
  assert.equal(T.limits({ VERIFY_COOLDOWN_SECONDS: '1' }, 'email_verification').cooldownMs, 60000, 'too small is ignored outside test');
  assert.equal(T.limits({ NODE_ENV: 'test', VERIFY_COOLDOWN_SECONDS: '0' }, 'email_verification').cooldownMs, 0);
  assert.equal(T.limits({ RESET_COOLDOWN_SECONDS: '120' }, 'email_verification').cooldownMs, 60000, 'reset knobs do not affect verification');
  assert.equal(T.limits({ VERIFY_COOLDOWN_SECONDS: '120' }, 'password_reset').cooldownMs, 60000, 'verification knobs do not affect reset');
  assert.equal(T.stateId('u1', 'email_verification') === T.stateId('u1', 'password_reset'), false);
});

test('bootstrap: constant-time secret comparison and configuration checks (no database needed)', async () => {
  assert.equal(secretsMatch('a'.repeat(30), 'a'.repeat(30)), true);
  assert.equal(secretsMatch('a'.repeat(30), 'a'.repeat(29) + 'b'), false);
  assert.equal(secretsMatch('a'.repeat(30), ''), false);
  assert.equal(secretsMatch('a'.repeat(30), 'a'), false);
  const db = { collection: () => { throw new Error('must not touch the database'); } };
  const secret = 'x'.repeat(MIN_SECRET_LENGTH);
  await assert.rejects(bootstrapAdmin({ db, email: 'a@b.co', expectedSecret: 'short', providedSecret: 'short' }), (e) => e instanceof BootstrapError && e.code === 'BAD_CONFIG');
  await assert.rejects(bootstrapAdmin({ db, email: 'a@b.co', expectedSecret: undefined, providedSecret: secret }), (e) => e.code === 'BAD_CONFIG');
  await assert.rejects(bootstrapAdmin({ db, email: 'a@b.co', expectedSecret: secret, providedSecret: 'y'.repeat(MIN_SECRET_LENGTH) }), (e) => e.code === 'BAD_SECRET' && !e.message.includes(secret));
  await assert.rejects(bootstrapAdmin({ db, email: 'a@b.co', expectedSecret: secret, providedSecret: undefined }), (e) => e.code === 'BAD_SECRET');
  await assert.rejects(bootstrapAdmin({ db, email: 'not an email', expectedSecret: secret, providedSecret: secret }), (e) => e.code === 'BAD_EMAIL');
});
