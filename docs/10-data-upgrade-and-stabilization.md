# Step 10: Data Upgrade (Companies + Seed Data) and Stabilization

## What I was trying to do
Make the job data realistic (real companies, many jobs, cities) and then make the whole app reliable end to end: real authentication on the API, complete flows on the frontend, and no leftover debug code.

## My first attempt
**Data upgrade**
- Added a `Company` model (name, industry, location, description, website) and changed `Job.company` from a plain string to an ObjectId reference to `Company`
- Wrote `server/seed.js`: 12 companies (Infosys, TCS, Zoho, Razorpay, ...) x 4 random job templates each = 48 jobs across 7 cities
- Updated job/saved-job/application queries to `populate` the company, and updated the frontend to read `job.company.name`

**Frontend/feature work**
- Added About and Profile pages, a Navbar with Home/About/Profile links, and a Layout wrapper

## What was wrong with it
- **The API trusted the client.** JWTs were issued but never verified; every controller read `userId` from the request body or URL, so anyone could read or change anyone's saved jobs, applications, resumes or referrals, and anyone could create/delete jobs
- **Dashboard blank page.** The file itself was valid. The crash came at runtime: after re-seeding (or deleting a job), saved jobs and applications whose job no longer exists populate as `null`, and `saved.job.title` threw during render, which unmounts the whole React tree
- Cover letter prompt used `${job.company}`; after the Company upgrade that is an ObjectId, so Gemini was told the company was `65f...`
- No input validation (signup, jobs), no pagination, regex built from raw user input (a search for `(` would error), no PDF/size/empty-file checks, unguarded `JSON.parse` of the AI response
- No way to unsave a job, edit a profile, become a referrer, see incoming referral requests, or see history of analyses and cover letters
- Leftover `DEBUG:` error strings on the Jobs and Referrals pages; hardcoded referral message; API URL hardcoded; no `/` route

## Final decision
**Backend**
- `middleware/auth.js` (`protect`, `requireAdmin`), `middleware/errorHandler.js`, `middleware/validate.js`. All data routes require a Bearer token; controllers use `req.user.id` and filter queries by owner, so other users' records come back as 403/404
- Job create/update/delete are admin-only (`User.role === 'admin'`, granted automatically to the `ADMIN_EMAIL` account)
- Jobs: pagination (`page`, `limit`), `GET /jobs/:id`, validation, escaped regex filters
- New endpoints: `GET /auth/me`, `PUT /auth/profile`, `DELETE /saved-jobs/:jobId`, `DELETE /applications/:id`, `GET /resumes`, `GET /resume-analysis` (+`/:id`), `GET /cover-letters` (+`/:id`), `GET /referrals/mine`, `GET /referrals/incoming`
- Referrals: seeker comes from the token, custom message, one pending request per referrer, only the referrer can accept/decline/mark referred
- `config/gemini.js` is the one Gemini entry point (model from `GEMINI_MODEL`), mapping failures to friendly 502/503; resume upload limited to 5MB, PDF only (extension + `%PDF` magic bytes), empty/unreadable PDFs rejected
- Unique (user, job) indexes on SavedJob and Application; saved/applied entries whose job was deleted are omitted from the lists. **Reads never delete**: `GET /saved-jobs/:userId` only filters out orphans (an earlier draft of this step also deleted them on read; that was removed because a GET must not modify data and a reseed would have silently destroyed users' saved jobs)
- `npm run maintenance:orphan-saved-jobs` is the only way orphaned saved jobs are removed: dry run by default, `--apply` required to delete, a new verified timestamped JSON backup in `server/backups/` (git-ignored) before any delete, each record re-checked as still orphaned immediately before deletion, applications report-only (never modified), refuses `NODE_ENV=production`, and refuses non-local databases unless `MAINTENANCE_ALLOW_REMOTE_DB=<exact db name>` is set
- `seed.js` has a safety guard that runs before any connection: local MongoDB only; a remote URI needs `SEED_ALLOW_REMOTE_DB=<exact db name>` plus `--force`; `NODE_ENV=production` is always refused; a non-empty DB needs `--force`. (An Atlas URI without a database name resolves to the default db `test`, so the guard treats any non-local host as protected regardless of name.)
- `.gitignore` now covers `.env`, `.env.*` (but not `.env.example`) at the root, in `server/` and in `client/`
- `.env.example`, `CORS` limited to `CLIENT_ORIGIN`, `npm start/dev/seed` scripts

**Frontend**
- `axiosClient` reads `VITE_API_URL`, attaches the token, and handles 401 by clearing the session and returning to login
- New: Job Details page, Save/Unsave and Apply on list and details, pagination, skeleton/empty/error/success states, status dropdown on the dashboard, analysis and cover-letter history, referral tabs (find / my requests / incoming with accept/decline), editable profile with referrer registration, signup success banner, active nav highlighting, 404 page
- Dashboard and lists are null-safe, so a deleted job can no longer blank the page; `useJobActions` also ignores null jobs defensively when building the saved/applied id sets

## Why
- Authorization must live on the server: the browser is untrusted, so "which user is this?" can only come from a verified token, never from a field the client sends
- Filtering a query by owner (`{_id, user: req.user.id}`) is simpler and safer than fetching a record and then checking ownership, and it avoids leaking whether other users' records exist
- A reference to `Company` keeps one source of truth (rename a company once) at the cost of a `populate` on every job query
- Rendering code must assume references can be dangling (`null`) once documents can be deleted independently

## What I learned
- A blank React page almost always means a render-time exception; check for `null.something` on data that comes from a populate before suspecting syntax
- When a field's type changes (string -> ObjectId), grep for every place that used it as text, including AI prompts
- Testing against a throwaway database (a local `mongod` here) lets you run the destructive seed and "delete a job a user saved" scenarios safely
- The newer `react-hooks/set-state-in-effect` lint rule flags the common fetch-on-mount pattern; I suppressed it inline on those effects rather than restructuring every page

## Verification done
- API smoke script against a local test DB (never the Atlas DB): 76 checks (auth, validation, ownership, admin gating, pagination/filters, save/unsave, applications, PDF edge cases, real Gemini analysis and cover letter, referrals end to end)
- Headless-browser walkthrough: signup -> login -> browse/search/filter -> save/unsave/apply -> job details -> dashboard (including the deleted-job scenario) -> resume upload + AI analysis -> cover letter + copy -> referrer registration -> referral request/accept -> profile edit -> logout
- `npm run lint` and `npm run build` pass in `client/`
- Duplicate prevention re-checked: sequential duplicates return 400, 12 parallel requests leave exactly one row (the unique index turns the race losers into 409, not 500), and a raw insert is rejected with E11000
