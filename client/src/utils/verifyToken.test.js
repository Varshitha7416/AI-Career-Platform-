// Run with: npm test (node:test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERIFY_HANDOFF_KEY, takeVerifyHandoff, getInitialVerifyToken } from './verifyToken.js';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12';

test('takeVerifyHandoff reads the early token once, deletes it, and rejects junk', () => {
  const win = { [VERIFY_HANDOFF_KEY]: TOKEN };
  assert.equal(takeVerifyHandoff(win), TOKEN);
  assert.equal(VERIFY_HANDOFF_KEY in win, false);
  assert.equal(takeVerifyHandoff(win), '');
  assert.equal(takeVerifyHandoff({ [VERIFY_HANDOFF_KEY]: '<script>' }), '');
  assert.equal(takeVerifyHandoff(undefined), '');
});

test('getInitialVerifyToken falls back to the live fragment', () => {
  assert.equal(getInitialVerifyToken({ location: { hash: `#token=${TOKEN}` } }), TOKEN);
  assert.equal(getInitialVerifyToken({ location: { hash: '#token=nope' } }), '');
});

test('the verify handoff key differs from the reset one (no token-purpose confusion in the browser)', async () => {
  const reset = await import('./resetToken.js');
  assert.notEqual(VERIFY_HANDOFF_KEY, reset.HANDOFF_KEY);
});
