# Step 11: Jobs Feature (discovery, details, apply workflow, demo dataset)

## What I was trying to do
Turn the basic job list into a complete, portfolio-quality Jobs experience that follows the supplied reference design: a discovery page with real search and filters, recommendations, saved jobs, a full job details page and an honest apply workflow, backed by a realistic (clearly labelled) demo dataset.

## My first attempt
- Old Jobs page: one title/city/experience form over ~48 seeded jobs, a Save button, and an "Apply" button that immediately wrote an application.
- Job model: title, company, city, description, a two-value `experienceLevel` and `yearsRequired`. No skills, salary, work mode, employment type, posted date, job ID or apply link.

## What was wrong with it
- **Apply recorded an application the moment it was clicked**, even though nothing had been submitted anywhere. That makes the tracker untrustworthy.
- Search could only match a title or city; no skills, company, salary, work mode, employment type, sorting or filter options.
- Too little data to feel real, and nothing to build job details, recommendations or salary filters from.
- The 12/48 seed script deletes and recreates everything, so re-running it would orphan users' saved jobs and applications.

## Final decision
**Data model (additive, so existing documents stay valid)**
- New optional `Job` fields: `jobCode` (from an atomic `Counter`), `source` (`demo|manual|api`), `externalId`, `isActive`, `postedAt`, `country`, `employmentType`, `workMode`, `experienceMinYears/MaxYears`, salary range + currency + period + a derived comparable INR value, `skills`, `preferredSkills`, `responsibilities`, `requirements`, `education`, `applyUrl` (http/https only). Search indexes added.
- `Application` gets `appliedAt` and `applyMethod` (`external` or `manual`); `User` gets optional recommendation preferences; `Company` gets `logoUrl` and `size`.

**Demo dataset** (`server/data/demoJobs.js`, `npm run seed:demo-jobs`)
- A deterministic generator (seeded PRNG, fixed ordering, stable `externalId`): 26 companies, 23 role templates with realistic skills, responsibilities, requirements and education, 144 new listings across Indian cities, a few international ones and remote roles, with realistic salary bands, internships and contract roles.
- The seed is **additive only**: it keeps all 48 existing jobs (same `_id`s, so saved jobs/applications/history stay valid) and only fills in *missing* fields, adds the new companies and listings, and never deletes or overwrites anything. Dry run by default; `--apply` takes a verified backup first; same local-only/remote-confirmation/production guard as the other scripts; idempotent (a second run does nothing).
- Everything generated is flagged `source: 'demo'` and labelled in the UI. **No real employer application URLs are invented**: where a listing has an apply link it points at the reserved placeholder domain `example.com`.

**Backend**
- `GET /jobs`: one aggregation pipeline for search + filters + sorting + pagination. `q` requires every word to match something (title, skills, company, city, job ID, work mode, type) and ranks by relevance; filters for city, experience range, work mode, employment type, minimum salary; five sort options. Old `title`/`experienceLevel` params still work.
- `GET /jobs/meta` supplies the filter options (cities with counts, types, modes, top skills) so nothing is hardcoded in the UI. `GET /jobs/recommended` and `GET /jobs/:id`.
- Recommendations are **rule-based, not AI** (target role vs title, resume skills vs job skills, experience fit, preferred city/work mode/type), with human-readable reasons and a score. With no profile signals it returns the latest jobs and says so.
- `POST /applications` accepts `applyMethod` and `appliedAt` (not in the future). Admin job writes validate the new fields, including that `applyUrl` must be http(s) (a `javascript:` URL is rejected).

**Frontend**
- Jobs discovery page rebuilt around the reference: hero with search, city, experience, Saved Jobs, six quick-search keywords, a recommended strip, filter chips and selects, sort, a results grid and numbered pagination. All state lives in the URL, so refresh, Back and shared links work.
- Job details page: header with logo/title/company/pills, Save and Apply, a sample-listing notice, description, responsibilities, required and preferred skills, requirements, education, a job overview card (ID, location, type, experience, salary, posted date), company card, more jobs from the company and shortcuts to the AI tools. Works on direct navigation and refresh.
- **Apply workflow**: with an `applyUrl` it opens the employer page in a new tab and then asks "Did you complete your application?"; the application is saved only when the user confirms. Without a link it says so plainly and offers an explicit "I applied elsewhere" entry with a date. Clicking Apply alone never writes anything. The Dashboard's saved-job button now links to the job instead of applying.
- Company logos: deterministic initials tiles in the palette (real third-party logos aren't bundled), with `logoUrl` support and a safe fallback. Inline SVG icons, no new dependencies.
- The CareerNest green palette is applied through the existing theme tokens, so every page shares it. Responsive down to phone width with a mobile menu.

## Why
- Truthful records matter more than a one-click feel: the tracker should only contain applications the user really made.
- Additive migration protects existing user data; keeping job `_id`s stable is what keeps saved jobs and history valid.
- Honest labelling (Demo badge, "rule-based, not AI") avoids presenting sample data or simple matching as something it isn't, and `source`/`externalId` leave a clean path to a real live-jobs API.
- Putting every filter in the URL and every option behind the API means the UI never shows controls that do nothing.

## What I learned
- When a script changes data, test idempotency explicitly: my first version re-enriched jobs it had already generated on the second run until I added that check.
- Mongoose model hooks make old seed scripts produce enriched documents; to simulate an older database you have to strip the new fields rather than assume the old seed still produces the old shape.
- `innerText` applies CSS `text-transform`, and a background browser tab is throttled; both caused test-only failures that looked like app bugs until investigated.

## Verification done
- API suite for the new endpoints (86 checks): auth, pagination, every search and filter, quick keywords, sorting, meta, details, recommendations with and without a profile and resume, the apply workflow, admin validation including URL safety, and ownership.
- Browser walkthrough (75 checks, no console errors): discovery page structure, keywords, search, filters, sorting, pagination with refresh and Back, save/unsave with persistence, saved view, details page, the external apply flow (new tab, nothing recorded until confirmed, then tracker), the no-link flow, personalised recommendations, logged-out redirect, and no horizontal scroll at phone width.
- Seed tested on a local copy of the pre-migration shape: original 48 jobs unchanged on their original fields, 0 orphans, 0 dangling references, unique job IDs, second run is a no-op.
- Existing-feature regression: the earlier API suite and the browser flows for resume AI, cover letters, referrals, profile and logout.
- Applied to the development Atlas database after a dry run and a verified backup: companies 12 -> 26, jobs 48 -> 192, nothing deleted. Re-checked afterwards against the backup: all original job and company fields unchanged, 0 dangling company references, 0 orphaned saved jobs or applications, 192 unique job IDs, and a rerun plans no changes.

## Known limits
- The Gemini API key is on a free tier. Heavy testing exhausted its quota (HTTP 429), after which resume analysis and cover letters show "The AI service is temporarily unavailable" until the quota resets. The app degrades gracefully; nothing is wrong with the code.
- Listings are sample data. Real company logos and verified vacancies need a licensed live job-data source (`source: 'api'` + `externalId` are the integration points).
- There is no admin screen for managing jobs; creating, editing and deleting jobs is API-only for admin accounts.
