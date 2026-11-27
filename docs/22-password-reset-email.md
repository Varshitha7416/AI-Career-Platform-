# 22 — Email service and password reset

Adds a reusable **email service** (transport-independent) and the **forgot / reset password** flow. Email delivery in this
step is a **local development outbox only**: no real email is sent and **no real email provider is configured**. Real
delivery is Phase 5 work (see "Future provider integration").

Sections 1-9 describe the design as it stands **after the security remediation** (section 10 lists each finding of the
independent review, the race analysis and the trade-offs).

## 1. What was added

| Area | Files |
|---|---|
| Email service | `server/services/email/{index,config,templates}.js`, `transports/{outbox,unconfigured}.js` |
| Token records + coordination | `server/models/AuthToken.js` (per-link audit record), `server/models/AuthRecoveryState.js` (the single coordination document per account), `server/utils/authTokens.js` |
| Dev outbox storage + viewer | `server/models/OutboxEmail.js` (refuses to load outside development/test), `server/routes/devOutboxRoutes.js` |
| API | `server/controllers/passwordResetController.js`, routes in `server/routes/authRoutes.js`, limiter in `server/middleware/rateLimit.js`, revocation hook in `authController.updateProfile` |
| Test-only fault injection | `server/utils/testFaults.js` (inert unless `NODE_ENV=test`) |
| UI | `client/src/pages/{ForgotPassword,ResetPassword}.jsx`, `client/src/utils/resetToken.js`, early-token script in `client/index.html` |
| Tests | `server/tests/email/email.unit.test.js` (in `npm test`), `server/tests/passwordReset/{passwordReset,concurrency,outbox}.test.js` (`npm run test:reset`), `client/src/utils/resetToken.test.js` (`npm test` in `client/`) |

Not changed: signup, login, JWT, roles, `ADMIN_EMAIL`, referrals, any existing user data. Email verification, account
deletion and admin bootstrap are **not** part of this step.

## 2. Email service architecture

```
caller ──> sendEmail(template, to, data)        services/email/index.js   (the only thing callers use)
              ├─ render(template, data)         templates.js              pure: { subject, text, html, actionUrl }
              └─ getTransport().send(message)   transports/*.js           delivery
                    outbox        development/test only: stores the email in MongoDB (OutboxEmail); state "stored_local"
                    unconfigured  default everywhere else until Phase 5: always fails with EMAIL_NOT_CONFIGURED
```

**Transport interface** (every transport, including the future real provider, implements exactly this):

```js
{ name, available: boolean, async send({ to, from, subject, text, html, template, actionUrl }) -> { id, state } }
// state: 'stored_local' | 'provider_accepted' | 'delivered'  (the strongest fact the transport can honestly claim)
// throws Error with a string `code` on failure
```

**Delivery states** (recorded per link in `AuthToken.delivery`; never claim more than is known):

| State | Meaning |
|---|---|
| request accepted (`accepted`) | the request passed validation and a reservation was granted; no email attempted yet |
| `stored_local` | written to the local development outbox. **Nobody was emailed** |
| `provider_accepted` | a real provider accepted the message (future). Not proof of inbox delivery |
| `delivered` | the provider confirmed delivery (future; only if it supplies confirmations) |
| `failed` | the send failed or its outcome was ambiguous; the link was **not** activated |

**Configuration** (`services/email/config.js`; no credentials anywhere in the source tree):

| Variable | Default | Meaning |
|---|---|---|
| `NODE_ENV` | (unset) | **Only the exact, case-sensitive values `development` and `test` enable development-only features.** Unset, `Production`, `prod`, `staging`, typos: all treated as "not development" |
| `EMAIL_TRANSPORT` | `outbox` when `NODE_ENV` is `development`/`test`, otherwise `none` | which transport to use. `outbox` with any other `NODE_ENV` makes the server **refuse to start** |
| `DEV_OUTBOX_ENABLED` | off | must be exactly `true` to mount the outbox **viewer**. `true` with any other `NODE_ENV` makes the server refuse to start |
| `EMAIL_FROM` | `CareerNest <no-reply@careernest.local>` | sender (local placeholder) |
| `APP_BASE_URL` | first `CLIENT_ORIGIN`, else `http://localhost:5173` | origin used in links inside emails |
| `RESET_TOKEN_TTL_MINUTES` | 30 (accepted range 5..1440) | reset link lifetime |
| `RESET_COOLDOWN_SECONDS` | 60 (accepted 30..3600; `0` allowed only when `NODE_ENV=test`) | minimum time between reset emails per account |
| `RESET_MAX_PER_HOUR` | 5 (accepted 1..20; larger only when `NODE_ENV=test`) | reset-email budget per account per hour (see section 4) |

**Templates** (`templates.js`): `passwordReset` and `passwordChanged`; every dynamic value is HTML-escaped, links must be `http(s)`.

**Logging rule:** the email service and the controller never log recipients, subjects, bodies, links or tokens. Failures and
throttling are logged as a code only (`password reset email failed: EMAIL_SEND_FAILED`, `password reset throttled: cooldown`).
A test asserts this.

**Errors:** `EmailError` codes `EMAIL_BAD_RECIPIENT`, `EMAIL_NOT_CONFIGURED`, `EMAIL_SEND_FAILED`, `EMAIL_OUTBOX_FORBIDDEN`.
Provider/driver messages are never forwarded.

## 3. Data model and the coordination protocol

Two collections:

* `authtokens` (`AuthToken`): one **audit record** per issued link: `user`, `purpose`, `tokenHash` (SHA-256, the raw token is
  never stored), `expiresAt`, `seq`, `tokenVersion`, `delivery`, `deliveryCode`, `activatedAt`, `usedAt`, `revokedAt`.
  It never decides whether a link is usable.
* `authrecoverystates` (`AuthRecoveryState`): **one document per (account, purpose)**, `_id = "password_reset:<userId>"`. It holds
  the cooldown, the hourly window, a database-assigned `seq` counter, `activeSeq` (highest seq ever activated, never decreases)
  and `active` = **the one usable link** `{ tokenId, hash, expiresAt, tokenVersion, seq }` or `null`.

Why this shape: a standalone mongod has no transactions, so every decision that must be atomic is **one conditional update of
one document**. The string `_id` is unique by construction, so safety never depends on index builds (index auto-creation is
off for Atlas). Time inside those updates uses the database clock (`$$NOW`). Indexes that remain are performance only
(`{tokenHash}` unique, `{purpose, active.hash}`, TTL housekeeping).

**Issue protocol** (runs after the HTTP response, identically for known and unknown addresses):

1. **Reserve** (one atomic `findOneAndUpdate` with an aggregation-pipeline update): succeeds only if `cooldownUntil <= NOW` and
   (the hourly window expired, or `windowCount < 5`, or the account has no usable link with at least 2 minutes left). It sets
   the new cooldown, bumps the window and **increments `seq`**. A throttled request modifies nothing.
2. **Create** the link record (`seq`, user's current `tokenVersion`, delivery `accepted`). Not usable yet.
3. **Send** the email. On failure or an *ambiguous* outcome the link is marked `failed` and is never activated.
4. **Activate**: compare-and-set `activeSeq < seq` -> `active = this link`. It replaces the previous usable link in the same
   update. If a newer seq was already activated, this one is refused and the newer link stays.

**Consume** is one atomic `findOneAndUpdate` on the state document (`active.hash == hash`, unexpired) that sets `active = null`.
Exactly one of any number of simultaneous requests wins. There is **no un-consume operation anywhere in the code** (a test greps
for one).

**Race analysis (what the design guarantees):**

| Situation | Outcome |
|---|---|
| 30 simultaneous requests across 3 processes | the atomic cooldown admits exactly one reservation; one token, one email |
| cooldown 0 (stress): ordering inverted, an older request records its token or activates **after** a newer one | activation compare-and-set on the DB-assigned `seq` refuses it; the newer link survives. (The previous design compared ObjectIds, which follow insert order and can invert) |
| delayed insert | irrelevant: order comes from `seq` (reserved first), not from when the record appears |
| email send fails / is ambiguous (stored but the caller saw an error) | link never activated; the owner's existing usable link is untouched |
| process crash after reserve | nothing created; old link intact; the only cost is the cooldown (<= 60 s) |
| crash after create / before send | an inactive orphan record nobody received |
| crash after send / before activate | the owner holds a link that never activates (**safe failure**; old link still works; ask again after the cooldown) |
| two requests whose emails arrive out of order | the owner may receive an older, already dead link after a newer one: it simply fails; the newer one works |
| a password change (profile or reset) while a request is in flight | the in-flight link carries the old `tokenVersion` and is refused when used |

## 4. API contract

Both endpoints are public, JSON, under `/api/auth`, limited to 10 KB bodies.

### `POST /api/auth/forgot-password`   `{ email }`
* `400 { code: "VALIDATION_ERROR", errors: { email } }` malformed address (same for every address).
* `503 { code: "EMAIL_UNAVAILABLE" }` when **no email transport can accept mail at all**; `503 { code: "SERVICE_UNAVAILABLE" }` when the
  database is not connected. Both are global and account-independent, so they reveal nothing about any address, and they
  do **not** pretend anything was or will be sent.
* `200 { message: "If an account exists for this email address, we will send password reset instructions shortly." }` for every
  well-formed address, registered or not, including throttled ones. The wording says the request was **accepted**; it never says an
  email "has been sent". Later failures (e.g. the provider rejects the message) cannot be reported on this response, they are
  recorded as `delivery: failed` and logged as a code.
* `429 RATE_LIMITED` only from the **per-IP** limiter (10 / hour, `AUTH_FORGOT_IP_MAX`), counting registered and unknown
  addresses alike. **There is no per-email 429** (see "Recovery lockout" below).

**Recovery lockout policy (decision and trade-offs).** The previous per-email 429 let anyone lock the legitimate owner out of
recovery by hammering the address, and the silent hourly cap had the same effect. Now:
* Per-account limits live in the database (one shared state document, so any number of server processes agree) and are **silent**
  (identical response, nothing modified, existing link untouched).
* The **cooldown is fixed, not sliding**: throttled requests never extend it, so continuous hammering cannot keep it closed.
* Any email an attacker triggers goes to the **owner's mailbox**, so one valid link is always available to the owner within a cooldown.
* The **hourly budget (5)** applies only while the owner holds a usable link (>= 2 min left). Once that link has expired or been used,
  the owner can request a new one even if the budget was burned. Worst case emails per hour per account stay bounded: budget (5) plus
  at most one extra per link lifetime.
* Trade-offs accepted: an attacker can still cause up to 5 emails/hour to a victim (annoyance, bounded; the per-IP limit slows them);
  during a cooldown the owner waits up to 60 s; with a hanging email transport longer than the cooldown, extra reservations can be
  granted while no link is active yet (still bounded by 1/cooldown). The per-IP limiter is in memory per process (see section 9),
  so N processes allow N times its budget; the per-account limits are exact across processes.

### `POST /api/auth/reset-password`   `{ token, password, confirmPassword }`
1. Unknown / malformed / expired / used / revoked / superseded / other-purpose token, an account that no longer exists, or a link
   issued before a later password change (`tokenVersion` mismatch) -> `400 { code: "INVALID_RESET_TOKEN" }`, one identical answer.
2. Password policy failure or `confirmPassword` mismatch -> `400 VALIDATION_ERROR`; the token is **not** consumed.
3. bcrypt hash (cost 12) -> **atomic consume** -> **one** user-document update:
   `findOneAndUpdate({ _id, tokenVersion: <the version the link was issued for> }, { $set: { password }, $inc: { tokenVersion: 1 } })`
   -> `200`. The password and `tokenVersion` always change together. The user is not logged in. A "password changed" notice is sent afterwards.
4. **No compensation.** If anything fails after the consume (before, during or after the write, including ambiguous outcomes where
   the database committed but the caller saw an error, timeouts, failover, crashes) the link **stays dead**. The caller gets
   `503 { code: "RESET_INTERRUPTED" }`: "try logging in with your new password; if that does not work, request a new link".
   Failing safe (one more link request) was chosen over any possibility of reusing a consumed token.
5. `429`: 10 attempts / 15 minutes per IP (`AUTH_RESET_MAX`).

**Password change through the profile** (`PUT /api/auth/profile` with `newPassword`) revokes every outstanding reset link, before
and after the save, and bumps `tokenVersion` as before (older JWTs stop working; the response carries the new token). A *failed*
change (wrong current password, weak password) revokes nothing. Defence in depth: even if a pre-change link were somehow still
active, its `tokenVersion` no longer matches and it is refused.

### Local-only: `GET /api/dev/outbox?to=<email>[&limit=1..10]`
Returns `{ count, emails: [{ to, subject, template, text, actionUrl, createdAt }] }` (newest first, no HTML). See section 6.

## 5. Frontend

| Route | Page | Notes |
|---|---|---|
| `/login` | existing | adds "Forgot password?" and a success banner after a reset |
| `/forgot-password` | `ForgotPassword.jsx` | "Request received" state (never says an email was sent); shows the 503 message when email is globally unavailable |
| `/reset-password` | `ResetPassword.jsx` | new password + confirm, success, invalid/expired state, and an "interrupted" state for `RESET_INTERRUPTED` |

**Token exposure** (verified in a real headless Edge against the production build, see `docs/22` section 10, finding 7):

* `client/index.html` starts with a tiny inline script, **before** any stylesheet, font or bundle. On `/reset-password` it moves the
  token from the fragment into a one-shot, non-enumerable `window` property and replaces the history entry with the clean URL;
  `utils/resetToken.js` takes (reads and deletes) it once at bundle start. The token then lives in component state only (never
  storage, never rendered). The `hashchange` behaviour (opening a newer link in the same tab) is preserved.
* **No third-party resources on the reset page**: Google Fonts are no longer in static HTML; the same inline script adds them for every
  other page and skips `/reset-password`. No third-party scripts or analytics exist anywhere in the app. Verified: the reset page makes
  zero cross-origin requests.
* **Remaining platform limitation (verified, not removable from page code):** `PerformanceNavigationTiming.name` keeps the **original
  URL including the `#token=`** for the lifetime of that page load, even after `history.replaceState`. Only same-origin script can
  read it. Browser history entries, session-restore data, extensions and browser sync may also have recorded the original URL
  before any script ran; this was **not** examined and cannot be ruled out. The mitigations are the single-use, 30-minute,
  newest-wins link and revocation after any password change. A reload-based "scrub" was rejected: it would have to park the token in
  `sessionStorage`, trading a bounded exposure for a different one.

## 6. Local development: reading the "email"

1. Set in `server/.env` (this file is yours; nothing here edits it): `NODE_ENV=development` and `DEV_OUTBOX_ENABLED=true`.
   Without `NODE_ENV=development` there is **no** outbox transport and forgot-password answers `503` (this is deliberate: an
   unset `NODE_ENV` is treated as not-development).
2. Start the API. It prints once: `Dev outbox viewer enabled. Send header X-Dev-Outbox-Key: <key> (this process only)`.
3. Submit `/forgot-password`, then read the link:
   `curl -H "X-Dev-Outbox-Key: <key>" "http://localhost:5000/api/dev/outbox?to=you@example.com"` and open `actionUrl`.

The viewer answers (otherwise an identical `404`) only when **all** hold: `DEV_OUTBOX_ENABLED` is exactly `true`; `NODE_ENV` is
exactly `development`/`test`; the transport is `outbox`; the method is `GET` (HEAD, which Express would route to a GET handler, is
refused); `Host` is `localhost`/`127.0.0.1`/`[::1]` **with this server's own port** (DNS-rebinding defence); no proxy or client-IP
header of any kind is present (`X-Forwarded-*`, `Forwarded`, `X-Real-IP`, `CF-*`, `True-Client-IP`, `Via`, ...); no `Origin` header and no
cross-site fetch metadata; the TCP peer is loopback (necessary, **not** relied on alone); and the per-process random key matches.
The guard is router-level, so path variants (`/api/DEV/outbox`, trailing slashes, encodings) cannot bypass it. One recipient is
required, so nothing can be listed; HTML is never returned. The `OutboxEmail` model throws on load unless `NODE_ENV` is `development`/`test`.

## 7. Security considerations (and the test that proves each)

| Threat | Measure | Tests |
|---|---|---|
| Account enumeration | identical response for known/unknown/throttled; work after the response; 503s are global; generic invalid-token answer | `passwordReset`, `concurrency` |
| Database leak -> takeover | only SHA-256 hashes stored; 256-bit tokens | `passwordReset` |
| Replay / double use | atomic single-use consume in the state document; 8 simultaneous resets -> one success | `passwordReset`, `concurrency` |
| Two usable links / out-of-order issuance | atomic reservation + seq compare-and-set; multi-process bursts and forced inversion | `concurrency` |
| Consumed link reused after an ambiguous failure | no compensation path; failure/crash/disconnect injection around the password write | `concurrency` |
| Recovery lockout by a third party | no per-email 429; fixed cooldown; budget yields when no usable link | `concurrency` |
| Reset link surviving a password change | revoked on profile change; `tokenVersion` binding | `concurrency` |
| Outbox exposure | explicit opt-in, exact env allow-list, Host/header/method/key checks, model refuses to load | `outbox`, `email.unit` |
| Token leakage in the browser | early extraction, no third-party resources on the page, never stored | `client resetToken.test.js` + real-browser check |
| Weak new password / oversized bodies / CSRF | unchanged (policy, 10 KB limit, bearer tokens) | `passwordReset` |

## 8. Testing

```
cd server
npm test                                                          # unit tests incl. tests/email (no database)
RESET_TEST_MONGO=mongodb://127.0.0.1:<port> npm run test:reset    # real server processes, disposable standalone mongod
cd ../client && npm test && npm run lint && npm run build
```
`test:reset` runs `passwordReset.test.js` (API behaviour), `concurrency.test.js` (3 real server processes on one standalone mongod,
fault injection: delays, thrown errors, lost DB connection, hard crashes at every step of issue and consume) and `outbox.test.js`
(Host / header / method / path / env-value matrix, production start-up). It refuses non-local databases and drops its own databases.
Fault injection (`AUTH_TEST_FAULT`, `utils/testFaults.js`) exists only when `NODE_ENV=test`; a unit test proves it is inert otherwise.

## 9. Limitations and future provider integration (Phase 5)

* No real email is sent. In production (and any non-development environment) with no transport configured, forgot-password answers
  `503 EMAIL_UNAVAILABLE` and the server warns at start-up.
* Adding a provider = one module in `services/email/transports/` implementing the interface above (`available`, `send -> { id, state }`),
  one line in `getTransport`, configuration through environment variables. Authentication code does not change. To settle then:
  provider account and key (environment only), verified sender domain (SPF/DKIM/DMARC), bounce/complaint handling, retry/queue policy,
  delivery webhooks (the only way to reach the `delivered` state), `APP_BASE_URL` set to the real HTTPS origin.
* The per-IP limiters are in-memory and per process (login/signup behave the same way); a shared store is a Phase 5 item. The per-account
  limits are database-backed and exact across processes.
* A reset email that is stored/accepted but whose activation fails (process crash in that window) leaves the owner with a dead link until
  they ask again. This is the deliberate safe failure.
* The link is single-use but is held in the browser's navigation-timing entry for that page load (section 5).
* Email verification (next task) will reuse `AuthToken` (new purpose), the templates, `sendEmail` and the state-document pattern.

## 10. Remediation of the independent security review

| # | Finding | Fix |
|---|---|---|
| 1 | Outbox viewer relied on loopback socket + default-on flag; `NODE_ENV` unset / `Production` / `prod` allowed the outbox; HEAD, Host and proxy headers not handled | opt-in flag (exactly `true`), exact `development`/`test` allow-list for the transport, the viewer **and** the model, Host+port check, proxy/client-IP header refusal, GET only, no Origin / cross-site, per-process key, start-up refusal for unsafe combos |
| 2 | Concurrent forgot-password requests could leave several usable links: newest was decided by ObjectId order, cooldown was check-then-update | one state document per account; atomic reservation (cooldown + budget + DB `seq`); activation compare-and-set on `seq`; link usable only after the email was accepted |
| 3 | Token compensation could clear `usedAt` after the password change had committed | compensation removed entirely; consume is one atomic update that nothing can undo; `503 RESET_INTERRUPTED` safe failure; password + `tokenVersion` in one conditional document update |
| 4 | Per-email 429 / silent hourly cap let a third party lock the owner out | no per-email 429; fixed cooldown; budget only applies while the owner has a usable link; throttled requests never touch the existing link |
| 5 | Generic success implied sending even with no transport / no database | accepted-wording; global `503`s; internal delivery states (`accepted`, `stored_local`, `provider_accepted`, `delivered`, `failed`) |
| 6 | Reset links survived a profile password change | revoked on profile change (before and after save) + `tokenVersion` binding |
| 7 | `PerformanceNavigationTiming.name` retains the token URL | **confirmed in a real browser**; token moved out of the address bar earlier (inline script before bundle/fonts), no third-party resources on the reset page; the entry itself cannot be rewritten and is documented as a limitation |
