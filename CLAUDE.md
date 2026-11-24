# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two independent npm projects (no root package.json); run `npm install` in each:

- `server/` — Express 5 + Mongoose 9 API (CommonJS), port 5000
- `client/` — React 19 + Vite + Tailwind v4 SPA (ESM)
- `docs/` — numbered build-log notes (decisions and lessons per step); add a new numbered doc when finishing a major step

## Commands

Server (from `server/`):
- `npm run dev` (nodemon) / `npm start` — API on `PORT` (default 5000)
- `npm run seed` — seeds 12 Companies + 48 Jobs. **Deletes all existing Companies and Jobs.** Safety guard (runs before connecting): only a local MongoDB (`localhost`/`127.0.0.1`) is allowed; a remote/Atlas URI is refused unless `SEED_ALLOW_REMOTE_DB=<exact db name>` is set *and* `--force` is passed; `NODE_ENV=production` is always refused; a non-empty DB also needs `--force`. A URI with no database name means MongoDB's default db `test`
- `npm run seed:demo-jobs` — **additive** demo dataset: 26 companies and ~192 jobs (the original 48 jobs are kept and enriched in place with missing fields only; 144 new sample listings are added, keyed by `externalId` so reruns are no-ops). Never deletes or overwrites existing values, so saved jobs / applications / history stay valid. Dry run by default; `-- --apply` backs up `jobs`/`companies`/`counters` to `server/backups/` (verified, never overwritten) before writing and then creates the Job indexes. Same guard as the other scripts (local only; remote needs `SEED_ALLOW_REMOTE_DB=<exact db name>`; refuses `NODE_ENV=production`). Generated listings are flagged `source: 'demo'`; apply links are placeholders on `example.com`, never invented employer URLs
- `npm run maintenance:orphan-saved-jobs` — finds SavedJob records whose Job was deleted. **Dry run by default** (reports saved-job orphans, and application orphans report-only; writes nothing). `-- --apply` deletes orphaned *saved jobs only*: it first writes a new timestamped, verified JSON backup to `server/backups/` (git-ignored; Extended JSON, restorable with `insertMany`), then re-checks each record is still orphaned right before deleting. Applications are never modified. Same guard principle as the seed script: refuses `NODE_ENV=production`, and refuses any non-local database unless `MAINTENANCE_ALLOW_REMOTE_DB=<exact db name>` is set (even for the dry run). Never runs automatically
- `npm test` is a placeholder; there are no automated tests

Client (from `client/`): `npm run dev` (port 5173) / `npm run build` / `npm run lint`

Env: `server/.env` needs `MONGO_URI`, `JWT_SECRET` (server exits without them), `GEMINI_API_KEY` (AI endpoints return 503 without it). Optional: `PORT`, `GEMINI_MODEL`, `CLIENT_ORIGIN` (CORS allow-list, comma separated, default `http://localhost:5173`), `ADMIN_EMAIL` (the account with this email gets `role: admin` on signup/login). See `server/.env.example`. Client: optional `VITE_API_URL` (default `http://localhost:5000/api`; see `client/.env.example`).

To test against a throwaway DB, override env at launch, e.g. `MONGO_URI=mongodb://127.0.0.1:27018/careernest_test PORT=5001 node server.js`, and `VITE_API_URL=http://localhost:5001/api npx vite`.

## Architecture

- **Server structure**: `server.js` mounts `routes/*Routes.js` under `/api/<resource>`; each route delegates to `controllers/*Controller.js`, which use `models/*.js`. Unknown routes hit `middleware/errorHandler.js` `notFound`; thrown/`next(err)` errors are normalised there (multer limits -> 413/400, Mongoose validation/cast -> 400, duplicate key -> 409, `err.status` honoured, else 500 `{message:'Server error'}`).
- **Auth**: `middleware/auth.js` `protect` verifies `Authorization: Bearer <jwt>` (401 with `code` `NO_TOKEN|INVALID_TOKEN|TOKEN_EXPIRED`) and sets `req.user = {id, role}`; `requireAdmin` gates job create/update/delete. Controllers **never trust a userId from the client**: they use `req.user.id`. Routes that still carry `:userId` (`GET /saved-jobs/:userId`, `GET /applications/:userId`) return 403 if it differs from the token user. Ownership is enforced by filtering queries on `user: req.user.id` (404 when not found). `middleware/validate.js` has `isValidId`, `isEmail`, `escapeRegex` (always escape user input used in `$regex`) and `validateIdParam`.
- **AI**: `config/gemini.js` `generateText(prompt)` is the single Gemini entry point (lazy client, model from `GEMINI_MODEL` default `gemini-3.6-flash`; maps failures to 502/503 with friendly messages). Model names get deprecated often — see `docs/02-ai-api-setup.md`. Analysis responses are fenced-JSON-stripped, parsed defensively, and the match % is clamped (null for general analysis).
- **Resume flow**: `POST /api/resumes` (multipart `resumeFile`; multer memory storage, 5MB limit, PDF only, `%PDF` magic-byte check) extracts text with `pdf-parse` v2 and stores `resumeText`. Responses never include `resumeText`. Cover letters/analyses use stored text + a populated `Job`.
- **Client**: `App.jsx` wraps pages in `ProtectedRoute` (checks `localStorage.token` and `user`) + `Layout`. Session lives in `localStorage` (`token`, `user`, `resumeId`) via `utils/auth.js`. `api/axiosClient.js` attaches the Bearer token and, on any 401 outside login/signup, clears the session and redirects to `/login?expired=1`. Shared UI in `components/Feedback.jsx` (skeletons, error/success/empty, `StatusBadge`); shared logic in `hooks/useJobActions.js` (save/unsave/apply state) and `hooks/useAllJobs.js` (pages through `/jobs` for dropdowns); `utils/errors.js` `getErrorMessage`. The `react-hooks/set-state-in-effect` lint rule is disabled inline on fetch-on-mount effects.

## Product

AI Career Platform for job seekers: job discovery (search/filter/save), application tracking, AI resume analysis (general or against a job), AI cover letter generation, and a referral marketplace (find employees at a company who will refer you). Stack: MongoDB Atlas + Mongoose, Express 5, React 19, Tailwind v4 (theme tokens `primary`, `primary-dark`, `accent`, `bg`, `charcoal` in `client/src/index.css`), Gemini for AI. The `docs/` files are step-by-step build journals (data modelling → AI setup → Express/Mongo → auth → jobs → saved jobs/applications → AI features/referrals → frontend). `docs/07` largely duplicates `docs/06`; `docs/01` describes an early data model that has since changed (e.g. Resume stores `resumeText`, not `fileUrl`).

## Data model (`server/models/`)

All schemas use `timestamps: true`; relations are ObjectId refs, populated in controllers.

- `User`: name, email (unique), bcrypt `password`, `role` (default `jobseeker`), `seekingRole`, `isReferrer`, `currentCompany`, `currentCompanyRole`, optional recommendation preferences (`preferredLocation`, `preferredWorkMode`, `preferredEmploymentType`, `experienceYears`)
- `Company`: name (unique), industry, location, description, website, logoUrl (optional; UI falls back to an initials tile), size. `server.js` requires it explicitly so `populate('company')` always has the model registered.
- `Job`: original fields (title, `company` ref **Company**, city, jobDescription, `experienceLevel` fresher|experienced, `yearsRequired`, `postedBy`) plus additive, optional fields: `jobCode` (CN-000123, from the atomic `Counter` model), `source` (`demo|manual|api`), `externalId` (future live-data feed), `isActive`, `postedAt`, `country`, `employmentType` (full-time|part-time|contract|internship), `workMode` (onsite|hybrid|remote), `experienceMinYears/MaxYears`, `salaryMin/Max/Currency/Period` + derived `salaryMaxInr` (fixed demo FX rates in `utils/salary.js`, for comparing/sorting only), `skills`, `preferredSkills`, `responsibilities`, `requirements`, `education`, `applyUrl` (http(s) only). A `pre('validate')` hook derives experience/salary fields and assigns `jobCode`; admin updates use load+save so these stay in sync
- `Resume`: user, fileName, `resumeText` (extracted text only; raw files are never stored)
- `ResumeAnalysis`: user, resume, optional job, matchPercentage, missingSkills[], strengths[], suggestions[]
- `CoverLetter`: user, job, resume, generatedText
- `SavedJob`: user + job. `Application` (status enum `applied|interviewing|rejected|offer`): user + job + `appliedAt` + `applyMethod` (`external` = user confirmed applying via the employer link, `manual` = user recorded an application made elsewhere). Duplicates are prevented by a `findOne` check plus a unique (user, job) index on both
- `Referral`: seeker, referrer (both User), message, status enum `requested|accepted|declined|referred`

## API surface (all under `/api`; everything except signup/login needs a Bearer token)

| Route | Notes |
|---|---|
| `POST /auth/signup`, `POST /auth/login` | validated (name >=2, email format, password >=6); 409 on duplicate email, generic 401 on bad credentials; login returns `{token, user}` (7d JWT) |
| `GET /auth/me`, `PUT /auth/profile` | profile fields: name, seekingRole, isReferrer, currentCompany, currentCompanyRole (company required for referrers), optional `currentPassword`+`newPassword`. User objects never contain the password hash |
| `GET /jobs` | search + filters + sorting + pagination, one aggregation pipeline: `q` (every word must match title, skills, company, city, job ID, work mode or type; relevance-ranked), `city`, `experience` (`fresher|entry|1-2|2-4|4-6|6-10|10+` = range overlap), `workMode` / `employmentType` (comma lists), `minSalaryLpa`, `sort` (`relevance|newest|salary-high|salary-low|experience-low`), `page`, `limit` (max 50); legacy `title` / `experienceLevel` still work -> `{jobs (company populated), count, total, page, pages}`. `GET /jobs/meta` (filter options: cities, types, modes, top skills, counts), `GET /jobs/recommended?limit=` (rule-based, see below), `GET /jobs/:id`. Fixed paths are declared before `/:id` |
| `POST /jobs`, `PUT/DELETE /jobs/:id` | admin only; validated (incl. `applyUrl` must be http(s), salary/experience ranges, enums); `company` must be an existing Company id; sets `postedBy`; `source` defaults to `manual` |
| `POST /saved-jobs`, `GET /saved-jobs/:userId`, `DELETE /saved-jobs/:jobId` | unsave takes the **job** id. `GET` is read-only: saved entries whose job no longer exists are omitted from the response (shape unchanged) but **never deleted** by a read. Orphans are removed only by the maintenance script (see Commands) |
| `POST /applications`, `GET /applications/:userId`, `PUT/DELETE /applications/:id` | POST `{jobId, applyMethod?: external\|manual, appliedAt?}` (date can't be in the future) — the client only calls it **after the user confirms** they applied. PUT `{status}` in applied/interviewing/rejected/offer; unique index on (user, job) |
| `GET/POST /resumes` | list own resumes (id, fileName, createdAt) / upload |
| `POST/GET /resume-analysis`, `GET /resume-analysis/:id` | `{resumeId, jobId?}`; GET lists own history (newest first, max 50) |
| `POST/GET /cover-letters`, `GET /cover-letters/:id` | `{resumeId, jobId}`; history |
| `GET /referrals/find?company=`, `POST /referrals`, `GET /referrals/mine`, `GET /referrals/incoming`, `PUT /referrals/:id` | find excludes self and needs `company`; POST `{referrerId, message}` (seeker from token, one pending request per referrer); only the referrer may PUT `{status}` in accepted/declined/referred |

Controllers: validate input, query with ownership filters, respond `{message, ...data}`, forward errors with `next(error)`. Lists return `{count, <plural>}`.

## Jobs feature notes

- **Recommendations are rule-based, not AI.** `GET /jobs/recommended` scores active jobs (excluding ones the user applied to) on: target role (`User.seekingRole`) vs job title (up to 40), skills from the user's latest resume matched against job skills (up to 40), experience fit (10), preferred city (10), work mode (5), employment type (5). Each result carries `matchScore` and human-readable `matchReasons`. With no usable profile signal it returns the latest jobs with `personalized: false` and says so; the UI labels the two cases "Matched to your profile" vs "Latest jobs".
- **Apply workflow** (`client/src/components/ApplyFlow.jsx`): with an `applyUrl` it opens the employer page in a new tab and then asks "Did you complete your application?"; the application is recorded (`applyMethod: external`) only when the user confirms. Without a link it states that plainly and offers an explicit "I applied elsewhere" manual entry (`applyMethod: manual`, with a date). Clicking Apply alone never writes anything. The Dashboard's saved-job button links to the job page instead of applying.
- **Demo data**: all generated listings are `source: 'demo'` and the UI shows a "Demo" badge and a disclaimer; they are not verified live vacancies. `externalId` + `source: 'api'` are the hooks for a future live-data integration.

## Client structure

Routes: `/` (redirects), `/login`, `/signup` (public; logged-in users are bounced to `/home`); protected: `/home`, `/jobs`, `/jobs/:id` (JobDetails), `/dashboard`, `/resume`, `/cover-letter`, `/referrals` (tabs: find / my requests / incoming), `/about`, `/profile` (editable, includes "register as referrer"); `*` renders a 404. Navbar uses `NavLink` active highlighting. `?job=<id>` on `/resume` and `/cover-letter` preselects a job (linked from JobDetails). `ResumeUpload` keeps the chosen resume id in `localStorage.resumeId`, validated against `GET /resumes` on load.

Jobs UI: `pages/Jobs.jsx` is driven entirely by URL params (`q, city, experience, workMode, employmentType, minSalaryLpa, sort, page, view=saved`) so refresh, Back and shared links work; `JobCard`, `Pagination`, `HeroArt`, `CompanyLogo` (initials tile; real third-party logos are not bundled), `Icons` (inline SVG, no icon library) live in `components/`; formatting helpers in `utils/jobs.js`. Theme: the CareerNest green palette (#051F20 #0B2B26 #163832 #235347 #8EB69B #DAF1DE) is set as tokens in `src/index.css` (`primary`, `accent`, `bg`, `charcoal`, plus `ink`, `forest`, `sage`, `mint`), so every page shares it; headings use the Fraunces display font (Google Fonts, with a Georgia fallback).

## Known gaps / gotchas

- Unique (user, job) indexes on SavedJob/Application are built on startup; a DB that already holds duplicate pairs will log an index error until they are removed.
- No automated test suite; verification so far is manual (API smoke script + headless-browser walkthrough, see `docs/10`).
- Referral status transitions are not constrained beyond the allowed set (referrer can move accepted <-> declined).
- Jobs have no UI for admins to create/edit/delete (API only).
- `seed.js` **deletes all Companies and Jobs**; see the guard described under Commands. Saved/applied entries pointing at removed jobs are hidden by the API.
- The uploaded `.env` (gitignored) holds real credentials — never print or commit it.
