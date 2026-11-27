# 23. Email verification and first-admin bootstrap

Two related account-security features: proving that a user owns their email address, and creating the first admin without any
configuration-based or HTTP back door.

## A. Email verification

### Behaviour

- `User.emailVerified` (default `false`) and `emailVerifiedAt`. Accounts that existed before this feature are unverified until their
  owner verifies (see "Existing accounts" below).
- **Signup** creates the account, answers `201 { message, userId, emailVerificationRequired: true }` and, after responding, emails a
  verification link. If sending fails (or no transport exists) signup still succeeds; the user can request a new link.
- **Login, `/auth/me` and profile responses** expose `emailVerified` / `emailVerifiedAt`. Unverified users can log in and browse.
- The link is `<APP_BASE_URL>/verify-email#token=<token>`. Like the reset link, the token is in the URL **fragment** (never sent to
  servers, proxies or `Referer`). `client/index.html` copies it into a one-shot window property (`__careernestVerifyToken`, distinct
  from the reset key) before the bundle loads and cleans the address bar; `utils/verifyToken.js` takes it once. Third-party fonts are
  not requested on that page. The same platform limits documented in docs/22 apply.
- Tokens: 256 bits from `crypto.randomBytes`, only the SHA-256 hash is stored (`AuthToken`, purpose `email_verification`), expiry
  `VERIFY_TOKEN_TTL_HOURS` (default 24), single use.

### Endpoints (`/api/auth`)

| Route | Auth | Notes |
|---|---|---|
| `POST /verify-email {token}` | public | The link works from any device. Consumes the link atomically (exactly one of N concurrent requests wins), then sets `emailVerified`. Failures: `400` with `code` `INVALID_VERIFICATION_TOKEN`, `VERIFICATION_LINK_EXPIRED`, `VERIFICATION_LINK_USED`; `503 VERIFICATION_INTERRUPTED` if the link was consumed but the account update failed (request a new link; there is no un-consume). Telling "used" from "expired" reveals nothing about accounts: only a holder of the full 256-bit token reaches that branch, and the lookup is by hash AND purpose |
| `POST /verification/resend` | Bearer | For the logged-in unverified user (banner button). Honest answers: `200` (sent), `200 {alreadyVerified:true}`, `429 VERIFICATION_THROTTLED` (cooldown or hourly budget), `503 EMAIL_UNAVAILABLE` |
| `POST /verification/request {email}` | public | For an expired link when not logged in. Identical `200` for unknown, verified, unverified, throttled and failed cases (work happens after responding). `400` only for a malformed email; `503` only for global, account-independent conditions (no transport / database down). There is deliberately no per-email 429 (it would reveal accounts and let a third party lock the owner out) |

Abuse controls: per-IP in-memory limits (`AUTH_VERIFY_MAX` 20, `AUTH_VERIFY_REQUEST_IP_MAX` 10, per process); per account, in the
database and shared by all server processes: cooldown `VERIFY_COOLDOWN_SECONDS` (default 60, 30..3600) and hourly budget
`VERIFY_MAX_PER_HOUR` (default 5, 1..20), with the same reserve -> create -> email -> activate protocol as password reset (docs/22):
a link becomes usable only after its email was accepted, a throttled request never touches the existing link, and the budget never
locks out an owner who has no usable link left.

**Purpose isolation.** The coordination document id is `<purpose>:<userId>`, every lookup/consume is keyed by purpose, and the
`AuthToken` record enum is checked, so a reset token can never verify an email and a verification token can never reset a password
(neither attempt consumes the other's link; covered by tests). A password change does **not** invalidate a verification link
(it would not be a security gain: the link only proves email ownership); it does keep revoking reset links as before.

### Policy: which actions need a verified email

Enforced on the server by `middleware/requireVerified.js` (`requireVerified('doing x')`, after `protect`), reading the flag from
the database on every request (so verifying takes effect on the same session immediately). Answer: `403` with
`code: 'EMAIL_NOT_VERIFIED'` and a message such as "Please verify your email address before applying to jobs. ...". The client
shows the server message as-is (`getErrorMessage`), and the verification banner explains the situation on every page.

| Area | Route(s) | Needs verified email |
|---|---|---|
> **SUPERSEDED (docs/31): email verification is now OPTIONAL.** No route below is gated any more; the table is kept as the history of the earlier policy. `requireVerified` still exists but no route uses it.

| Applications | `POST /applications` | **Yes** (status update / delete / reads: no) |
| Interviews | `POST /interviews`, `PUT /interviews/:id` | **Yes** (reads, delete: no) |
| Referrals | `POST /referrals` (request), `PUT /referrals/:id`, `PUT /referrals/:id/status`, `GET /referrals/:id/resume` (referrer actions) | **Yes** (find/list/summary reads: no) |
| AI | `POST /resume-analysis`, `POST /cover-letters`, `POST /cover-letters/:id/regenerate`, `POST /skill-gap/resume`, `POST /skill-gap/manual`, `POST /skill-gap/:id/roadmap` | **Yes** (these call the paid AI service; checked before the AI rate limiter) |
| Contact | `POST /contact` | **Yes** |
| Browsing jobs, job details, recommendations | `GET /jobs*` | No |
| Saved jobs | `/saved-jobs` | No |
| Profile editing, resume upload/list | `PUT /auth/profile`, `/resumes` | No |
| Dashboard, notifications, programs (browse + enrolment) | `/dashboard`, `/notifications`, `/programs` | No |
| Reading history (analyses, cover letters, roadmaps, referrals, interviews) | `GET` routes | No |
| Account deletion / data export / logout-all (other module) | | No (by policy; must stay reachable for unverified users) |
| Verification itself | `/auth/verify-email`, `/auth/verification/*` | No |

Rationale: the gated actions either contact another person on the user's behalf (referrals, support), create records that imply a
reachable owner (applications, interviews), or cost money / can be scripted at scale (AI). Everything else is reading or
managing the user's own data. Other modules that add sensitive routes should use `requireVerified` and add a row here.

### Frontend

- `/verify-email` (`pages/VerifyEmail.jsx`, public): handles success, already used, expired, invalid, missing token and generic
  error; the failure states offer "send a new verification email" (logged-in: calls `resend`; logged out: asks for the email and
  calls the non-enumerating `request`).
- `components/VerifyEmailBanner.jsx` is rendered by `Layout` for logged-in users whose `emailVerified` is not true (sessions stored
  before this feature carry no flag, so the banner confirms the real status once through `/auth/me`). It states what unlocks and
  has a "Resend verification email" button that shows the server's cooldown message. After verification elsewhere the page fires
  `careernest:email-verified`.

### Existing accounts

There is no automatic migration: legacy users are `emailVerified: false`. They keep logging in and browsing, and must verify (via the
banner) before using the gated actions. In production this needs a working email provider first (Phase 5, see docs/22). To
grandfather trusted legacy users deliberately, an operator can run a reviewed one-off update, e.g.
`db.users.updateMany({ emailVerified: { $ne: true } }, { $set: { emailVerified: true, emailVerifiedAt: new Date() } })`; this
trades the ownership proof for convenience and is not done by default.

## B. Secure first-admin bootstrap

### What was removed

`ADMIN_EMAIL` auto-promotion (anyone registering, or an existing user logging in, with that address became admin: an unverified
address was enough to take over the admin role). `applyAdminEmail` and its calls in signup/login are gone; `.env.example` and
CLAUDE.md were updated. Setting `ADMIN_EMAIL` now does nothing (tested).

### The bootstrap command

```
BOOTSTRAP_ADMIN_SECRET=<random 24+ chars>  npm run bootstrap:admin -- --email you@example.com
```

Design: **promote an existing account whose email is verified**. Ownership of the address is proven by the verification link, and the
operator proves control of the deployment by knowing the one-time secret.

1. The operator generates a secret (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`) and sets
   `BOOTSTRAP_ADMIN_SECRET` for this command only. It must be 24+ characters.
2. Interactive run: the same secret is typed at a **hidden prompt**, then the target email must be typed again. Non-interactive
   (CI, tests): `BOOTSTRAP_ADMIN_SECRET_INPUT` plus `--yes`. The secret is never accepted as a command-line argument (shell
   history / process list) and is never printed or stored. Comparison is constant time (SHA-256 digests + `timingSafeEqual`).
3. The target must exist, be active (`deletedAt` empty) and have `emailVerified: true`.
4. It refuses if **any** admin already exists.
5. Atomicity: a sentinel document `{_id: 'first-admin'}` in the `adminbootstrap` collection is claimed with `insertOne` **before**
   the role change. A fixed `_id` is unique by construction (no index build needed, which matters because index building is off for
   Atlas), so of N simultaneous runs exactly one wins; the rest get `BOOTSTRAP_CLAIMED`/`ADMIN_EXISTS`. A run that crashes between
   claim and promotion leaves a `claimed` sentinel with no admin; it can be taken over (compare-and-set) after 5 minutes. A
   `completed` sentinel blocks any later bootstrap, even if the admin was removed by hand; re-bootstrapping then needs a conscious
   edit of that sentinel document.
6. The promotion `updateOne` is guarded on the account still being verified, active and not already an admin, and bumps
   `tokenVersion` so older sessions are retired (the admin logs in again).
7. There is **no HTTP endpoint**; the library (`utils/bootstrapAdmin.js`) is only called by the script.

Environment guard (same principle as the other scripts, checked before connecting): local MongoDB only; a remote/Atlas URI needs
`BOOTSTRAP_ALLOW_REMOTE_DB=<exact db name>` (a URI with no db name means `test`); `NODE_ENV=production` is refused unless
`BOOTSTRAP_ALLOW_PRODUCTION=true` (unlike the seed scripts, a first production admin is the legitimate use case, so it is allowed
only with this explicit acknowledgement). The script never prints the URI or driver error text (credentials could be inside).

### Local setup

1. `npm run dev` in `server/` (`NODE_ENV=development`, local MongoDB). Sign up in the app.
2. Verify the email: the verification mail is in the local outbox, never sent. With `DEV_OUTBOX_ENABLED=true` use the viewer
   (docs/22), or read the `outboxemails` collection and open its `actionUrl`.
3. `BOOTSTRAP_ADMIN_SECRET=... npm run bootstrap:admin -- --email <that address>`; log in again.

### Future production setup

1. Configure a real email provider (Phase 5) so users can verify.
2. Sign up the owner account in production and verify it.
3. From a trusted machine with the production `MONGO_URI` in the environment of that one command:
   `BOOTSTRAP_ADMIN_SECRET=... BOOTSTRAP_ALLOW_REMOTE_DB=<db> BOOTSTRAP_ALLOW_PRODUCTION=true NODE_ENV=production npm run bootstrap:admin -- --email <owner>`.
   Do not put the `BOOTSTRAP_*` variables in the application's runtime configuration. Discard the secret afterwards.
4. Further admins: not supported by this command (by design). Add a separate, audited admin-management feature later if needed.

### Admin authorization audit

- **Server**: `role` is only ever written by `scripts/bootstrapAdmin.js` (and the seed/demo scripts do not set it). Signup reads
  only `name, email, password, acceptTerms`; `updateProfile` reads a whitelist that excludes `role`, `email`, `tokenVersion`,
  `emailVerified`, `deletedAt`; the `User` schema enum is `jobseeker|admin`. A client sending `role: 'admin'` to signup or profile
  is ignored (tested). Admins cannot be demoted or elevated through the profile API for the same reason.
- `protect` loads `role` from the database on every request (not from the JWT), so a promotion/demotion takes effect immediately.
- `requireAdmin` (403 for everyone else) is applied to `POST /jobs`, `PUT /jobs/:id`, `DELETE /jobs/:id`. Other modules added in
  this batch must apply it to their admin routes. No other server file checks `role`.
- **Client**: no component grants or relies on `role` for security (there is no admin UI in the original codebase; any UI hiding
  is cosmetic and the server is the authority).
- Remaining weaknesses (not changed): there is no audit log of admin actions, no way to list/revoke admins from the app, and admin
  accounts do not require a second factor.

## Tests

- `npm test` (in `server/`): unit tests including `tests/verification/verification.unit.test.js` (gate, template, token purposes,
  limits, secret comparison).
- `VERIFY_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:verify`: API tests against a disposable local MongoDB with real server
  processes and the local outbox (`verification.api.test.js`: issue, hashed storage, verify, expiry, reuse, concurrency, purpose
  confusion, resend cooldown/budget, enumeration safety, policy gating of every gated route; `bootstrap.api.test.js`: success,
  wrong secret, second admin, concurrent library calls and CLI processes, stale claim, environment guard, no secret in output).
- Compatibility: `RESET_TEST_MONGO=... npm run test:reset` (password reset suite) still passes.
- Existing suites whose fixtures needed verified users under the new policy: referrals (`mkUser` marks the user verified in the
  database), skill gap API, roadmap API and roadmap multi-process (users created `emailVerified: true`).
- Client: `npm test` in `client/` (adds `verifyToken.test.js`).
