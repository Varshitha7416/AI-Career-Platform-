// Email-verification token handling. Same approach as the password-reset link (see resetToken.js): the emailed link is
// /verify-email#token=<token>, the token is in the URL FRAGMENT (never sent to a server, proxy or Referer header), index.html
// copies it into a one-shot window property before the bundle loads and cleans the address bar, and this module takes it once.
import { isValidToken, parseTokenFromHash, stripFragment } from './resetToken.js';

export const VERIFY_HANDOFF_KEY = '__careernestVerifyToken';
export { isValidToken, parseTokenFromHash, stripFragment };

export const takeVerifyHandoff = (win) => {
  try {
    const t = win && win[VERIFY_HANDOFF_KEY];
    if (win) { try { delete win[VERIFY_HANDOFF_KEY]; } catch { /* non-configurable: ignore */ } }
    return isValidToken(t) ? t : '';
  } catch {
    return '';
  }
};

// Evaluated once when the bundle loads, so StrictMode's double-invoked initialisers see the same value.
let handoff = typeof window !== 'undefined' ? takeVerifyHandoff(window) : '';

export const getInitialVerifyToken = (win = typeof window !== 'undefined' ? window : undefined) =>
  handoff || (win ? parseTokenFromHash(win.location.hash) : '');

export const clearInitialVerifyToken = () => { handoff = ''; };
