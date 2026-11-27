# 31 - Optional email verification

**Decision:** email verification is optional. Anyone can register, log in and use every normal CareerNest feature without verifying.

## What changed
- Removed every `requireVerified(...)` call from the routes: applications (POST), interviews (POST/PUT), referrals (request, referrer actions, referral resume), resume analysis, cover letters (generate, regenerate), skill gap (resume, manual, roadmap) and contact (POST). Each keeps `protect`, ownership filters, validation and its rate limiter (including `aiLimiter`).
- `middleware/requireVerified.js` is unchanged in behaviour and kept (with its unit test) for a future action that needs a proven address; nothing uses it now.
- Client wording only: the banner, Settings > Security and the post-signup message now say verification is optional.
- Tests that asserted `403 EMAIL_NOT_VERIFIED` (contact, tracker, verification API) now assert the opposite.

## Unchanged
- Signup still emails a verification link; `/verify-email`, `/auth/verification/resend|request`, the banner and the Settings status all work.
- `emailVerified` is never set automatically; no user record was touched or migrated.
- First-admin bootstrap still requires a verified account (admin power should rest on a proven address).
- Password reset: the link is emailed to the account address and only the inbox owner can use it, so it needs no extra flag.
- JWT auth, bcrypt, ownership checks, rate limits, Gemini integration: untouched.

## Remaining email-provider needs
No real provider is configured (docs/22). Until one is, verification and reset emails cannot be delivered (reset answers 503; in production there is no outbox). Optional verification means this no longer blocks anyone from using the app.
