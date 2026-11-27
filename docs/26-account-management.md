# 26 - Account management (export, sign out everywhere, deletion)

API under `/api/account` (all require a Bearer token), controller `controllers/accountController.js`, logic in `utils/account/`, UI in `client/src/components/account/AccountDataSection.jsx` (a card on the Settings page).

| Endpoint | Purpose |
|---|---|
| `GET /api/account/export` | The caller's data as JSON (`Content-Disposition: attachment`, `Cache-Control: no-store`). 5 per hour per user (`ACCOUNT_EXPORT_MAX_PER_HOUR`). |
| `POST /api/account/logout-all` | Atomically `$inc` of `tokenVersion`: every token issued so far is rejected by `protect` (`INVALID_TOKEN`). |
| `POST /api/account/delete` `{password, confirmation: "DELETE"}` | Re-authenticates, then anonymizes the account. 5 failed attempts per 15 min per user. |

Validation failures are 400 (never 401/403), because the client treats any 401 as an expired session.

## Logout from all sessions

Decision: the response is a plain success and the client clears its session and goes to `/login` with a "signed out of all devices" notice (no fresh token is issued, so the user re-authenticates everywhere, including the current device). No password is required: the action only ends sessions and grants nothing, and it is exactly what someone needs when a token is lost; requiring a password would not stop an attacker from doing anything harmful. Ordinary logout stays client-side and is untouched. A password change already bumps `tokenVersion` the same way.

## Account deletion: anonymize, not hard-delete

The `User` document stays as a tombstone so references and counterparties stay consistent: name `Deleted user`, email `deleted+<id>@deleted.invalid` (non-routable, unique, so the original email can sign up again as a brand-new account), password replaced by a non-bcrypt random string, `role` jobseeker, `isReferrer` false, `emailVerified` false, notification prefs all off, `tokenVersion` incremented, `deletedAt` set. Every other schema field is `$unset` (derived from the schema, so profile fields added later are wiped too). `protect` rejects accounts with `deletedAt`; login treats them exactly like an unknown email (same `INVALID_CREDENTIALS` response); forgot/reset-password ignore them.

### Per-collection policy (`utils/account/policy.js`)

| Collection | Policy | Notes |
|---|---|---|
| User | anonymize | tombstone as above |
| Application, Interview, SavedJob | delete | the user's own tracking |
| Resume | delete | removes `resumeText` |
| ResumeAnalysis, CoverLetter, SkillGapAnalysis, LearningRoadmap (+ task progress) | delete | the user's own generated content |
| ProgramEnrollment | delete | includes progress |
| Notification | delete | |
| ContactMessage | anonymize | support history is kept: subject and message become `[removed at user request]`, the name/email snapshot is cleared, `anonymizedAt` is set; category, status, admin responses and internal notes stay (see docs/28) |
| AuthToken (reset and verification records), AuthRecoveryState | delete | all links revoked/removed |
| OutboxEmail (dev/test only) | delete by original email | before the email is replaced; also expires after 24h |
| Referral (seeker or referrer) | anonymize | see below |
| Job.postedBy | retain | job listings outlive their poster; the reference points at the tombstone |
| AdminAuditLog.actor | retain | audit integrity; points at the tombstone |

Referral: open requests (`requested/pending/accepted`) are closed so the counterparty is not left waiting (deleted seeker -> `withdrawn`, deleted referrer -> `declined`, `active=false`, history entry added). When the deleted user was the seeker, the message text and resume copy (`message`, `resumeSnapshot`, `resumeInfo`, `resume`) are removed. The counterparty keeps a usable record (their own message and resume copy, status, job, dates); the deleted person shows as "Deleted user" and is no longer findable as a referrer.

A test (`every schema path referencing User has a deletion policy`) fails if any model gains a `ref: 'User'` path without a policy entry, and the server logs a warning at start-up.

### Order, partial failure and recovery (no transactions; works on standalone MongoDB)

1. Password and confirmation checked. Admins: take a short DB lock (`accountlocks`, 30 s expiry), then refuse with `409 LAST_ADMIN` if no other active admin exists (the lock serializes two admins deleting at once).
2. ONE atomic update turns the user into the tombstone. From here the account cannot log in and no old JWT works.
3. Cleanup of the other collections runs (idempotent `deleteMany`/`updateMany` by user id), then a verification pass counts what is left. Only when it is zero does the user get `deletionCompletedAt`.
4. API result: `200` only after verification; otherwise `503 DELETION_INCOMPLETE` (account already locked; the client shows "closed, cleanup finishing" and logs out).
5. Anything unfinished is found by `deletedAt` set and `deletionCompletedAt` unset and completed by `completePendingDeletions`: run by a sweep in the server (first run 30 s after start, then every 10 min, skipping tombstones younger than 2 min) and by `npm run maintenance:account-deletions` (refuses production unless `ACCOUNT_MAINTENANCE_ALLOW_PRODUCTION=true`; refuses a non-local DB unless `MAINTENANCE_ALLOW_REMOTE_DB=<db>`).

Logs contain user ids and step names only (never emails or names). Residual risk: a request already past authentication when the tombstone is written could insert a row after the verification pass; the sweep only revisits users not marked complete, so such a stray row would remain until a later manual cleanup (the window is milliseconds and the cleanup loop re-checks up to 3 times before marking complete). **Update (docs/27):** the sweep now also re-scans tombstones completed in the last 24 h and removes stray rows, `notify()` refuses tombstoned users, and a partial index `deleted_sweep_idx` serves the sweep queries.

## Data export

Everything is queried by the authenticated user's id (capped at 5000 rows per collection, reported in `meta.truncated`). Top-level keys: `meta` (`schemaVersion` 1, `generatedAt`, counts, notes), `profile` (allow-list), `settings` (notification preferences; the theme lives in the browser), `applications` (with status history and a job summary), `savedJobs`, `referrals`, `resumes` (metadata AND `resumeText`: it is the user's own extracted upload), `resumeAnalyses`, `coverLetters` (all versions), `skillGapAnalyses`, `learningRoadmaps` (tasks and progress), `notifications`, `interviews`, `programEnrollments`, `contactMessages`.

Never included: password hash, `tokenVersion`, token hashes or recovery state, `inputHash`, role/admin information, audit logs, other users' rows. Referrals involve other people, so each row has only `direction` (sent/received), the counterparty's display `name`/`company`/`role` (already visible in the app; no email, phone, resume or id), status, job and dates. The message text is included only for requests the user sent; text written by the other person, and the resume copy attached to a request, are not exported. Own-content collections use a deny-list (new benign fields appear automatically); profile and referrals use an allow-list. Tests check that A's export contains none of B's markers, ids or emails and no secret field names.

## Tests

`ACCOUNT_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:account` (11 tests, own database `careernest_a4_account_<pid>`, dropped at the end): policy completeness, auth required, logout-all, export shape and privacy (A vs B), deletion rejection cases, full anonymization with counterparties intact, token/login/email reuse, last-admin guard (and a concurrent two-admin race), idempotent re-run, and a fault-injected failure mid-cleanup (`AUTH_TEST_FAULT` point `account.cleanup.<Model>`, `NODE_ENV=test` only) finished by the background sweep.
