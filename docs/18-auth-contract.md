# 18 — Login/Signup redesign + authentication security: shared contract

Binding for both agents. Existing auth architecture stays (bcrypt, JWT `{userId}` HS256 7d, `Authorization: Bearer`, token+user in `localStorage` via `client/src/utils/auth.js`, axios 401 interceptor). Improve, don't rebuild.

## Hard rules (both agents)
No git add/commit/stash/reset/push. Never connect to Atlas: `server/.env` MONGO_URI points at Atlas, so NEVER use it and never print .env values; always set `MONGO_URI` explicitly in the process env (dotenv does not override it). Never run `seed.js`, migrations, or index creation. No destructive DB operations. No edits to files owned by the other agent. Do not touch Home/About/Profile pages, Layout/TopBar/Sidebar/ThemeProvider/index.css (lead owns; ask), or other features.

## Ownership
| Owner | Files |
|---|---|
| Agent 2 Backend | `server/**` (auth routes/controllers/middleware/models/config/server.js/package.json/lockfile/tests), `server/tests/auth/**`, `server/.env.example` (document new optional vars only) |
| Agent 1 Frontend | `client/src/pages/Login.jsx`, `client/src/pages/Signup.jsx`, `client/src/components/auth/**`, `client/src/utils/auth.js`, `client/src/api/axiosClient.js` (429 handling only) |
| Lead | `client/src/App.jsx`, `client/src/index.css`, shared components, client dependencies (`client/package*.json`), docs, integration, final test run |

## API contract (all under `/api/auth`)
Responses are JSON. Errors: `{message, code?, errors?}`; never stack traces, never password hashes.

**Password policy** (signup and password change; NOT enforced on login so existing short-password accounts still log in): 8–72 characters (bcrypt truncates at 72 bytes, so >72 BYTES rejected), at least one letter and one number, not one of a small list of very common passwords, must not contain the email local-part or be identical to the name. Change of password additionally requires `currentPassword` and a new password different from the current one.

| Route | Behaviour |
|---|---|
| `POST /signup` `{name, email, password}` (+ optional `acceptTerms:true`, stored as `termsAcceptedAt` when true; not required by the API) | 201 `{message, userId}` (unchanged shape). 400 `{message, code:'VALIDATION_ERROR', errors:{name?, email?, password?}}` with field-specific messages. 409 `{message, code:'EMAIL_EXISTS'}`. 429 rate limited. Only `name, email, password` are read from the body (no mass assignment, `role` never settable). Email lower-cased/trimmed (max 254), name 2–80 chars. Non-string values rejected (no NoSQL operator objects) |
| `POST /login` `{email, password}` | 200 `{message, token, user}` unchanged. 400 missing fields. 401 `{message:'Invalid email or password', code:'INVALID_CREDENTIALS'}` identical for unknown email and wrong password, with a dummy bcrypt compare when the user is unknown (timing). 429 `{message, code:'RATE_LIMITED', retryAfterSeconds}` + `Retry-After` header |
| `GET /me` | unchanged `{user}` (no password) |
| `PUT /profile` | unchanged profile fields; password change uses the policy above; a successful password change bumps `User.tokenVersion` so older tokens stop working (new token returned as `{token}` so the current session continues) |
| `POST /logout` | NOT added: JWTs are stateless; logout = client clears session. Password change revokes older tokens (see above). Documented limitation: a stolen token stays valid up to 7 days unless the password is changed |
| Forgot / reset password | Implemented in docs/22 (local development outbox only; no real email provider is configured, so production cannot deliver reset emails yet). See the "Password reset" section below |
| Email verification, social login | NOT implemented. Frontend must NOT show any Google/social button |

Rate limits (per process memory; resets on restart; document): login 10 failed attempts / 15 min per IP and per email, signup 5 / hour per IP; `429` as above; successful logins don't consume the failed-attempt budget. Do not set `trust proxy` blindly (document how to when behind a proxy).

Token: payload stays `{userId}` plus optional `tv` (tokenVersion; a token without `tv` is treated as version 0, so existing sessions keep working). Verify with `algorithms:['HS256']`. `JWT_SECRET` validation at startup: missing → exit (existing); too weak (<32 chars or placeholder like `change-me`) → loud warning in development, exit when `NODE_ENV=production`. Never hard-fail an existing dev `.env` with a short secret.

Security headers (`helmet`), CORS allow-list unchanged, auth routes get a small JSON body limit, generic error handler must keep hiding internals (and may pass through a safe `code`).

## Frontend contract
Two-column Login/Signup (form left, illustration right, stacked on mobile), CareerNest palette tokens, light + dark, show/hide password, password strength meter (mirrors the policy above; the server is the source of truth and its `errors` map must be shown per field), confirm-password, required terms checkbox (no links unless real pages exist — none do yet), loading/success/error states, 429 message with retry time, `?expired=1` banner and "account created" banner kept. No Google button, no forgot-password link. Illustration: original inline SVG (woman at laptop, friendly AI robot, leaves, floating cards: Resume Score, Job Matches, Skills, Interview Prep); no external image paths.

## Password reset (added in docs/22)

Two public endpoints, both under `/api/auth` (10 KB body limit, no new auth state on the client):

* `POST /forgot-password` `{ email }` -> `200` with the same "request accepted" message for any well-formed address (registered, unknown or throttled; it never claims an email was sent); `400 VALIDATION_ERROR` only for a malformed address; `503 EMAIL_UNAVAILABLE` / `503 SERVICE_UNAVAILABLE` when no email transport / database is available (global, account-independent); `429 RATE_LIMITED` per IP only (no per-email 429, which would let a third party lock the owner out). The reset email is created after the response is sent; per-account cooldown/budget are database-backed and silent.
* `POST /reset-password` `{ token, password, confirmPassword }` -> `200` and the password changes, `tokenVersion` is incremented (every older JWT stops working), the token is consumed atomically and can never become usable again (a failure after the consume answers `503 RESET_INTERRUPTED`); a password change through `PUT /profile` also revokes outstanding reset links; the caller is **not** logged in. Any bad token (unknown, expired, used, revoked, wrong purpose) -> `400 INVALID_RESET_TOKEN`; a weak password or mismatched confirmation -> `400 VALIDATION_ERROR` without consuming the token.

Tokens are stored only as SHA-256 hashes in `authtokens` (single use, 30 minute default lifetime, TTL index for cleanup). Full design, security table and local outbox instructions: `docs/22-password-reset-email.md`.
