// Password-reset token handling (pure helpers; no React).
//
// The emailed link is /reset-password#token=<token>. The token is in the URL FRAGMENT, so it is never sent to any server,
// proxy or Referer header. index.html contains a tiny inline script that runs BEFORE the bundle, before any stylesheet or
// font request and before React: it copies the token into a one-shot, non-enumerable window property and immediately
// replaces the history entry with the clean URL. This module takes that handoff once at start-up and the page keeps the token
// in component memory only (never localStorage / sessionStorage, never rendered, never logged).
//
// Known platform limit (verified in a real browser, see docs/22): the document's PerformanceNavigationTiming entry keeps the
// ORIGINAL url, fragment included, for the lifetime of that page load. replaceState cannot rewrite it. Only same-origin
// script can read it, and this app loads no third-party scripts, analytics or fonts on the reset page. Browser history
// and sync services may also have recorded the original URL before any script ran: that cannot be controlled from here,
// which is why the link is single-use and short-lived.

export const HANDOFF_KEY = '__careernestResetToken';
const TOKEN_RE = /^[A-Za-z0-9_-]{20,200}$/;

export const isValidToken = (t) => typeof t === 'string' && TOKEN_RE.test(t);

// Parses "#token=abc" (also tolerates "#a=1&token=abc"). Returns '' when absent or malformed.
export const parseTokenFromHash = (hash) => {
  try {
    const t = new URLSearchParams(String(hash || '').replace(/^#/, '')).get('token');
    return isValidToken(t) ? t : '';
  } catch {
    return '';
  }
};

// Takes (reads and deletes) the token the inline script left on the window. Returns '' when there is none.
export const takeHandoffToken = (win) => {
  try {
    const t = win && win[HANDOFF_KEY];
    if (win) { try { delete win[HANDOFF_KEY]; } catch { /* non-configurable: ignore */ } }
    return isValidToken(t) ? t : '';
  } catch {
    return '';
  }
};

// Removes the fragment from the address bar / current history entry. Returns true when something was removed.
export const stripFragment = (win) => {
  try {
    if (!win.location.hash) return false;
    win.history.replaceState(null, '', `${win.location.pathname}${win.location.search}`);
    return true;
  } catch {
    return false;
  }
};

// Module-level one-shot: evaluated once when the app bundle loads (before any component renders), so React StrictMode's
// double-invoked state initialisers see the same value.
let handoff = typeof window !== 'undefined' ? takeHandoffToken(window) : '';

// The token the page should start with: the early handoff, else (if the inline script did not run) the live fragment.
export const getInitialToken = (win = typeof window !== 'undefined' ? window : undefined) =>
  handoff || (win ? parseTokenFromHash(win.location.hash) : '');

export const clearInitialToken = () => { handoff = ''; };

// Test hook.
export const _setHandoffForTest = (t) => { handoff = t; };
