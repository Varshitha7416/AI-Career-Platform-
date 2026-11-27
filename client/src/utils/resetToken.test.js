// Run with: npm test  (node:test; no browser, no DOM library: window is faked)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { HANDOFF_KEY, isValidToken, parseTokenFromHash, takeHandoffToken, stripFragment, getInitialToken, clearInitialToken, _setHandoffForTest } from './resetToken.js';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12'; // 43 chars like the server issues

const fakeWindow = (pathname, hash) => {
  const calls = [];
  const win = {
    location: { pathname, search: '', hash },
    history: { replaceState: (_s, _t, url) => { calls.push(url); win.location.hash = ''; } },
    calls,
  };
  return win;
};

test('parseTokenFromHash accepts a well-formed token and rejects junk', () => {
  assert.equal(parseTokenFromHash(`#token=${TOKEN}`), TOKEN);
  assert.equal(parseTokenFromHash(`#a=1&token=${TOKEN}`), TOKEN);
  for (const bad of ['', '#', '#token=', '#token=short', `#token=${TOKEN}!`, `#token=${'x'.repeat(201)}`, '#other=abc', undefined, null, '#token=<script>']) assert.equal(parseTokenFromHash(bad), '', String(bad));
  assert.equal(isValidToken(TOKEN), true);
  assert.equal(isValidToken({}), false);
});

test('takeHandoffToken reads the early token ONCE and deletes it from window', () => {
  const win = { [HANDOFF_KEY]: TOKEN };
  assert.equal(takeHandoffToken(win), TOKEN);
  assert.equal(HANDOFF_KEY in win, false);
  assert.equal(takeHandoffToken(win), '');
  assert.equal(takeHandoffToken({ [HANDOFF_KEY]: 'not a token!' }), '');
  assert.equal(takeHandoffToken(undefined), '');
});

test('stripFragment removes the fragment from the history entry and keeps path + query', () => {
  const win = fakeWindow('/reset-password', `#token=${TOKEN}`); win.location.search = '?x=1';
  assert.equal(stripFragment(win), true);
  assert.deepEqual(win.calls, ['/reset-password?x=1']);
  assert.equal(stripFragment(win), false, 'nothing left to strip');
});

test('getInitialToken prefers the early handoff, falls back to the live fragment (hashchange path), then clears', () => {
  _setHandoffForTest(TOKEN);
  assert.equal(getInitialToken(fakeWindow('/reset-password', '')), TOKEN);
  assert.equal(getInitialToken(fakeWindow('/reset-password', '')), TOKEN, 'stable across StrictMode double initialisation');
  clearInitialToken();
  assert.equal(getInitialToken(fakeWindow('/reset-password', '')), '');
  assert.equal(getInitialToken(fakeWindow('/reset-password', `#token=${TOKEN}`)), TOKEN);
});

// The inline script in index.html is the EARLIEST point the token can be handled. Execute that exact script text.
const inlineScript = () => {
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const m = /<script>\s*\/\/ EARLY RESET-TOKEN HANDLING[\s\S]*?<\/script>/.exec(html);
  assert.ok(m, 'index.html has the early reset-token script');
  return { html, code: m[0].replace(/^<script>/, '').replace(/<\/script>$/, '') };
};

test('index.html early script: on /reset-password it hands the token over and cleans the address bar before the bundle runs', () => {
  const { code } = inlineScript();
  const win = fakeWindow('/reset-password', `#token=${TOKEN}`);
  win.document = { createElement: () => ({}), head: { appendChild() {} } };
  vm.runInNewContext(code, { window: win, location: win.location, history: win.history, document: win.document });
  assert.equal(win.calls.length, 1);
  assert.equal(win.calls[0], '/reset-password');
  assert.equal(win[HANDOFF_KEY], TOKEN);
  assert.equal(Object.keys(win).includes(HANDOFF_KEY) && Object.getOwnPropertyDescriptor(win, HANDOFF_KEY).enumerable, false, 'not enumerable');
  assert.equal(takeHandoffToken(win), TOKEN);
});

test('index.html early script: other pages are untouched; a bad fragment on the reset page is still removed', () => {
  const { code } = inlineScript();
  const other = fakeWindow('/login', `#token=${TOKEN}`);
  other.document = { createElement: () => ({}), head: { appendChild() {} } };
  vm.runInNewContext(code, { window: other, location: other.location, history: other.history, document: other.document });
  assert.equal(other.calls.length, 0); assert.equal(other[HANDOFF_KEY], undefined);
  const bad = fakeWindow('/reset-password', '#token=nope');
  bad.document = other.document;
  vm.runInNewContext(code, { window: bad, location: bad.location, history: bad.history, document: bad.document });
  assert.equal(bad.calls.length, 1); assert.equal(bad[HANDOFF_KEY], undefined);
});

test('the reset page loads no third-party scripts, analytics or fonts: Google Fonts are only added on other pages', () => {
  const { html, code } = inlineScript();
  assert.ok(!/<link[^>]+(googleapis|gstatic)/.test(html), 'no static third-party <link> in index.html');
  assert.ok(!/<script[^>]+src=["']https?:/.test(html), 'no third-party script tag');
  const added = [];
  const doc = { createElement: (t) => ({ tag: t, set href(v) { this._h = v; }, get href() { return this._h; } }), head: { appendChild: (el) => added.push(el) } };
  for (const [p, expectFonts] of [['/reset-password', false], ['/login', true], ['/', true]]) {
    added.length = 0;
    const win = fakeWindow(p, '');
    vm.runInNewContext(code, { window: win, location: win.location, history: win.history, document: doc });
    assert.equal(added.length > 0, expectFonts, p);
  }
});
