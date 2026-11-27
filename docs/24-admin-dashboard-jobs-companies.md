# 24 - Admin dashboard, job and company management

## What was built
- `/admin` dashboard with live metrics, `/admin/jobs` (list, filters, pagination), `/admin/jobs/new`, `/admin/jobs/:id` (view + edit), `/admin/companies` (list, create/edit, archive/restore, delete when unused). `/admin/programs` is only a nav slot; the page belongs to the Career Programs work.
- Server APIs under `/api/admin` (`routes/adminRoutes.js`; `protect` + `requireAdmin` on the whole router, so the role always comes from the database through the token's user id, never from the client).
- Audit trail (`AdminAuditLog`, `utils/adminAudit.js`).

## Access control
- Server: every `/api/admin/*` route returns 401 without a token and 403 for non-admins. A `role` sent in a signup body, profile update or header has no effect (covered by tests).
- Client: `AdminRoute` calls `GET /auth/me` and only renders for `role === 'admin'` (otherwise redirects to `/dashboard`). The sidebar "Administration" group is shown from the stored user and is only a convenience.

## Job lifecycle (one definition, `utils/jobVisibility.js`)
| Field | Meaning |
|---|---|
| `isActive=false` | hidden (deactivated). Reversible with activate |
| `status='closed'` (+`closedAt`) | closed, no longer accepting applications. Reversible with reopen |
| `applicationDeadline` in the past | expired (derived at read time, never stored) |

Public job search, `/jobs/meta` and `/jobs/recommended` show only jobs where none of the three applies. Legacy documents without the new fields count as open (no migration). `GET /jobs/:id` returns the job with an `availability` value (`open|inactive|closed|expired`); hidden jobs return 404 unless the caller is an admin or already saved/applied to the job, so tracker and saved-job pages keep working. The job page replaces the Apply button with a notice when the job is not open (unless the user already applied).

## Model changes (all additive)
- `Job`: `status` (open|closed, default open), `closedAt`, `applicationDeadline`, `category` (max 80). New index (status, applicationDeadline).
- `Company`: `isActive` (default true), `archivedAt`.
- New `AdminAuditLog`: actor, action, targetType, targetId, summary (max 300), createdAt.

## API (all `Bearer` + admin)
- `GET /admin/overview` (users total/verified/unverified; jobs total/active/closed/inactive/expired; companies total/active/archived; programs total/active and enrollments by status, read-only counts; last 10 audit entries), `GET /admin/activity?page&limit` (limit max 50).
- Jobs: `GET /admin/jobs?q&status=all|active|inactive|closed|expired&company&city&category&page&limit` (includes hidden/closed/expired), `GET/PUT /admin/jobs/:id`, `POST /admin/jobs`, `POST /admin/jobs/:id/{activate|deactivate|close|reopen}`.
- Companies: `GET /admin/companies?q&status=all|active|archived&page&limit` (each with `jobCount`), `GET /admin/companies/options` (active only), `GET/PUT /admin/companies/:id`, `POST /admin/companies`, `POST .../archive`, `POST .../restore`, `DELETE /admin/companies/:id` (409 when any job references it).
- Existing `/api/jobs` POST/PUT/DELETE still work, now share the same validation, and are audited. One behaviour change: `isActive` must be a real boolean (the old `Boolean("false")` was `true`).

## Rules and validation
- Job: title, company, city, description required; `applyUrl` http(s) only; experience and salary ranges (max >= min); `applicationDeadline` a valid date, not in the past unless unchanged; `category` <= 80; `source` is forced to `manual` and `postedBy` comes from the token; the create/edit body cannot change `isActive` (use the action endpoints).
- A job cannot be created for, or moved to, an archived company. Editing an existing job of an archived company is allowed and jobs of archived companies keep populating and stay publicly visible (archiving only stops new use).
- Company: name 2-120 and unique case-insensitively; `website` and `logoUrl` http(s) only; hard delete only with zero jobs.
- The client mirrors these checks in `client/src/utils/adminValidation.js` (unit tested); the server stays the authority.

## Audit
`recordAdminAction({ actor, action, targetType, targetId, summary })` never throws (returns true/false). Actions: `job.created|updated|deleted|activated|deactivated|closed|reopened`, `company.created|updated|archived|restored|deleted`. Other modules (programs) can import it and use `targetType: 'program'`. Summaries contain titles and job codes only.

## Tests
- Server: `ADMIN_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:admin` (spawns the API on port 5112 against a disposable `careernest_a2_admin_<pid>` database and drops it).
- Client: `npm test` (adds `adminValidation.test.js`), `npm run lint`, `npm run build`.

## Known gaps
- The jobs filter dropdown loads the first 50 companies (alphabetical); beyond that, search by text.
- No UI to hard-delete jobs (use Close or Deactivate; the old DELETE API remains).
- `/admin/programs` page is delivered by the Career Programs work; until it lands that tab shows the 404 page.
- A bare date deadline (YYYY-MM-DD) is stored as 23:59:59.999 UTC of that day, so the job stays open through its last day; full ISO timestamps are stored as given.
