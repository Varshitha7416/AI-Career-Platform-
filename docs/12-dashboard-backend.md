# Dashboard backend: endpoint reference

All routes are under `/api`, require `Authorization: Bearer <jwt>`, and identify the user **only** from the token (`req.user.id`). Records that belong to someone else are answered with 404 (never 403/200), so ids cannot be probed. Errors are `{ message }`.

## Dashboard
`GET /dashboard/overview?range=30d|3m|6m|12m|all` (default `all`; anything else -> 400). One call returns everything the Dashboard shows, using one query per collection (about 10-13 database operations regardless of how much data the user has):

| field | meaning |
|---|---|
| `user` | `{ name, firstName }` |
| `stats.totalApplications` | `{ value, inProgress, link }`: all-time count of the user's applications whose job still exists; `inProgress` = applied + interviewing |
| `stats.savedJobs` | `{ value, link }` (orphans omitted) |
| `stats.upcomingInterviews` | `{ value, nextAt, link }` scheduled interviews whose time has not passed |
| `stats.careerPrograms` | `{ value, completed, link }` programs the user saved/started/completed |
| `stats.profileComplete` | `{ value (0-100), missing:[{key,label,link}], link }` |
| `applicationOverview` | `{ range, total, inProgress, interview, offer, rejected }` for the time filter (applied date). applied -> inProgress, interviewing -> interview |
| `recentActivity` | up to 8 real events, newest first: `application_created`, `status_changed`, `job_saved`, `interview_scheduled`, `referral_received`, `referral_updated`, `resume_uploaded`. Each has `id, type, title, description, at, status, company, link` |
| `careerProgress` | `{ percent, message, milestones:[{key,label,done,progress,target,hint,link}] }` |
| `recentApplications` | latest 5 `{ id, jobId, title, company, appliedAt, status, link:'/applications/:id' }` |
| `savedJobs` | latest 5 `{ id, savedAt, job:{ _id,title,city,country,workMode,company } }` |
| `upcomingInterviews` | next 3 `{ id, scheduledAt, mode, type, location, applicationId, job, company }` |
| `programs` | 3 featured programs (not-yet-enrolled first) with `enrollment` status or `null` |
| `tip` | `{ title, message, action:{label,link} }` chosen from real state |
| `unreadNotifications` | number |

**Profile completeness** (single source of truth, `utils/profileCompleteness.js`): name 10, target role 15, years of experience 10 (0 counts), preferred city 10, work mode 10, employment type 10, resume uploaded 35.

**Career progress** = mean of five milestone fractions: profile (percent/100, "done" at >= 80), resume (>= 1), apply to 10 jobs (min(n,10)/10), attend an interview (a `completed` interview, or a non-cancelled one whose time has passed), get an offer (any application with status `offer`).

**Tip priority**: no resume -> upload; resume older than 60 days -> update; profile < 80% -> complete profile; no applications -> find jobs; upcoming interview -> prepare; otherwise a rotating generic tip.

## Interviews (`Interview`: user, application, job, scheduledAt, durationMinutes, mode, type, location, notes, status)
| route | notes |
|---|---|
| `POST /interviews` | `{ applicationId, scheduledAt, mode?, type?, durationMinutes?, location?, notes?, status? }`. Application must be the user's. A scheduled interview must be in the future; use `status: 'completed'` to record a past one. If the application is `applied` it becomes `interviewing` (with a history entry). Creates a notification. |
| `GET /interviews?filter=upcoming\|past\|all` | default `upcoming` (scheduled, not yet passed, ascending); `past` = time passed or completed/cancelled (descending). Interviews whose job was deleted are hidden |
| `GET/PUT/DELETE /interviews/:id` | own only. PUT can reschedule / change status / notes; notifies on reschedule and cancel |
Enums: mode `video\|phone\|onsite`; type `screening\|technical\|hr\|managerial\|final\|other`; status `scheduled\|completed\|cancelled`. Text fields must be strings (location <= 500, notes <= 2000).

## Notifications (`Notification`: user, type application\|interview\|referral\|system, title, message, link, read)
`GET /notifications?limit=` -> `{ unreadCount, notifications }` (newest first, limit 1-50, default 20) · `PUT /notifications/:id/read` · `PUT /notifications/read-all` -> `{ updated }` · `DELETE /notifications/:id`.
Created by `utils/notify.js` (never throws; honours `User.notificationPrefs`) when: an application is added, its status changes, an interview is scheduled/rescheduled/cancelled, a referral is requested (to the referrer), a referral is accepted/declined/referred (to the seeker).

## Career programs (`Program`, `ProgramEnrollment`)
`GET /programs?category=&q=&page=&limit=` -> `{ programs, total, page, pages, categories }`; each program has `_id`, `id`, `slug, title, provider, description, category, level, duration, skills, url, theme, source` and `enrollment` (status string or `null`). `GET /programs/:id` -> `{ program, enrollment }` where `enrollment` is `{ status, startedAt, completedAt }` or `null`. `PUT /programs/:id/enrollment` `{ status: 'saved'|'in-progress'|'completed'|'none' }` (`none` removes; unique per user + program).
Content is **curated demo data** (`source: 'demo'`): real provider names, `url` is only the provider's public home page. `npm run seed:programs` (dry run by default, `-- --apply`) inserts missing programs by slug and never overwrites or deletes; same safety guard as the other scripts (local only, remote needs `SEED_ALLOW_REMOTE_DB=<exact db>`, refuses `NODE_ENV=production`).

## Applications and saved jobs (extended; existing routes unchanged)
- `Application.statusHistory` records every status change. Older records have none, so responses derive a synthetic history from `appliedAt`/`createdAt` and `updatedAt` (no migration). `appliedAt` no longer has a schema default (it would have shown "now" for old documents); the controller sets it on create and readers fall back to `createdAt`.
- `GET /applications` and `GET /saved-jobs` (token user) alias the existing `/:userId` forms (which still require the id to equal the token user). `GET /applications/item/:id` -> one application with job + company, `statusHistory` and its `interviews`. Deleting an application also removes that user's interviews for it. Reads never delete anything.

## Contact and settings
- `POST /contact` `{ subject (3-120), message (10-2000) }` (strings only). Name/email/user come from the token. At most 5 messages per user per hour (429 after).
- `GET /auth/me` and `PUT /auth/profile` expose/accept `notificationPrefs: { applications, interviews, referrals }` (booleans; defaults all true).

## Tests run (local DB only)
Backend suite of 190 checks (auth on every endpoint, user isolation, validation, overview math per range against independently computed DB values, empty user, legacy data, orphans, notifications and preferences, interviews, programs, contact, garbage input never 500), 15 extra checks (tip branches, milestone edge cases, referral notification texts) and regressions of the earlier smoke and jobs suites.
