# 27 - Settings completion and Batch 1 carryovers

Page: `client/src/pages/Settings.jsx`. Cards: Appearance, Notifications, Account, Security, Your data and privacy. No new API was needed except the preference categories; everything reuses existing endpoints.

## Account
Shows name, email and **email status** (Verified / Not verified, from `GET /auth/me` `emailVerified`) and links to `/profile` for everything editable (no duplicate profile API).

## Notification preferences
`User.notificationPrefs` has six independent booleans, default `true`: `applications, interviews, referrals, programs, reminders, support`. Loaded from `GET /auth/me`, saved per toggle with `PUT /auth/profile {notificationPrefs: {<key>: bool}}` (optimistic, rolled back with an error on failure, success banner on save). The API accepts booleans only and rejects unknown keys (400, `notificationPrefs` field error); omitted keys are unchanged. Users stored without the field (legacy) are treated as all-on: only an explicit `false` disables a category.

### Notification type -> preference category

Single mapping: `server/utils/notify.js` (exported `PREF_KEY`, `NOTIFICATION_CATEGORIES`, `prefCategoryFor(type)`).

| `notify(userId, {type, ...})` | Category (`notificationPrefs.<key>`) |
|---|---|
| `application` | `applications` |
| `interview` | `interviews` |
| `referral` | `referrals` |
| `program` | `programs` (Career Program save/start/complete) |
| `reminder` | `reminders` |
| `support` | `support` |
| `system` (default) / anything else | none: always delivered |

`notify()` keeps its signature and never throws. Other modules just call `notify(userId, { type, title, message, link })` with a type from the table; the preference is enforced inside. The `Notification.type` enum is `application, interview, referral, program, reminder, support, system`. `notify` also returns `null` (writes nothing) for a deleted account.

## Security
- **Change password**: `PUT /auth/profile {currentPassword, newPassword}` (current password required, policy-checked, must differ). It bumps `tokenVersion`, so every other session and any reset link stops working, and returns a fresh `token`; the UI stores it so the current session continues (other devices must log in again).
- **Sign out of all devices**: `POST /api/account/logout-all` (docs/26); the client clears its session and goes to `/login`.
- **Email verification**: status plus "Resend verification email" (`POST /auth/verification/resend`); cooldown / hourly-budget (429) and unavailable (503) messages from the API are shown as is.
- **Forgot password** pointer: sign out, then use "Forgot password" on the login page.

## Privacy
Export and deletion reuse `AccountDataSection` (docs/26). A plain-language summary (`PrivacyNotice.jsx`) restates the policy from docs/26 and makes no retention promise beyond it.

## Carryover 2: deletion hardening (in-flight writes)
Problem: a request authenticated just before the tombstone could write a row after the verification pass. Layers now:
1. `notify()` always re-reads the user and writes nothing for a tombstoned account (write-time guard for the notification path).
2. The cleanup loop already re-checks up to 3 times before marking complete.
3. **Sweep re-scan** (`completePendingDeletions`, run every 10 min by the server and by `npm run maintenance:account-deletions`): besides unfinished deletions it re-scans tombstones completed within the last 24 h (`rescanMs`), counts remaining user-owned rows (`countRemaining`) and runs the idempotent cleanup when any exist (result field `strayCleaned`).

Residual risk: a stray row landing more than 24 h after deletion is not found automatically; the user can no longer authenticate, so nothing reads such a row, and a manual run with a larger `rescanMs` removes it. Not every write path re-checks `deletedAt` at write time (only notifications do); the sweep is the safety net for the others.
Test: `settings.test.js`, "a row written after deletion verification is removed by the next sweep".

## Carryover 3: sweep index
`User` has the partial index `deleted_sweep_idx` on `{deletedAt: 1, deletionCompletedAt: 1}` with `partialFilterExpression: {deletedAt: {$type: 'date'}}` (it holds only deleted accounts). The sweep queries include `deletedAt: {$type: 'date', ...}` so the planner uses it (a test checks the winning plan). It is declared in the schema, so `npm run indexes` lists and (with `--apply`) creates it like every other index; local DBs build it automatically at startup. Existing remote DBs need `npm run indexes -- --apply` (see docs/17).

## Carryover 7: safe local workflow for legacy unverified accounts
Accounts created before email verification (Batch 1) have no `emailVerified` and count as unverified. There is deliberately NO script that marks accounts verified. Locally (`NODE_ENV=development`, local MongoDB):
1. Start the API with `DEV_OUTBOX_ENABLED=true`; note the outbox key printed at start-up.
2. Log in as the legacy user (browsing is never blocked), open Settings > Security (or the banner) and click "Resend verification email".
3. Open the dev outbox viewer (loopback only, `X-Dev-Outbox-Key`, see docs/22) and follow the verification link from the stored email.
This proves ownership the same way production will.

## Carryover 8: production policy for legacy accounts
Legacy accounts stay **unverified** until their owner proves ownership of the email through a real verification email, which needs a real email provider (Phase 5). Nobody is silently or automatically marked verified. Interim limitations: until a provider exists, production answers 503 on resend and unverified users keep the documented restrictions (applying, referrals, AI tools and contacting support unlock after verification). Optional, NOT implemented: administrator-assisted verification (an audited admin action after an out-of-band identity check) could be added later; it must be an explicit, logged, per-account action, never a bulk update.

## Tests
`SETTINGS_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:settings` (12 tests, database `careernest_b2a1_settings_<pid>`, port 5210 or `TEST_PORT`): mapping, defaults/legacy users, per-category persistence, validation, enforcement for every category plus the real program-enrollment flow, change-password session revocation, logout-all, verification status in `/auth/me`, tombstone notify guard, late-write sweep, partial index.
