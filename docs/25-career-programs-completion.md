# 25. Career Programs completion

Scope: discovery filters, My Programs, enrollment/progress tracking, notifications, admin program management. Additive only; no migration.

## Model changes (all additive/optional)
- `Program`: `durationWeeks` (derived from the free-text `duration` in a pre-validate hook; null when no week/month/day figure), `milestones [{title, order}]`, `enrollmentInfo`, `resources [{title, url}]` (admin-entered, http/https only), `archivedAt` (soft archive; archived programs are also `isActive: false`).
- `ProgramEnrollment`: `progress` (0-100), `completedMilestones [Number]` (Program milestone `order` values). Old documents without these fields read as progress 0, or 100 if completed.
- `Notification.type` enum gains `program` (client bell maps it to the graduation icon). No pref key exists for it, so these are always delivered.

## Duration buckets
`duration` is free text, so the filter uses `durationWeeks`: `short` <= 4 weeks, `medium` 5-12, `long` > 12 (months = 4.345 weeks, ranges use the upper bound). Programs whose duration cannot be parsed (e.g. "Self-paced") match no duration bucket. Programs created before the field existed are backfilled once per process on the first duration-filtered request (additive `$set`); `seed:programs` and admin saves set it directly.

## Public API (`/api/programs`, Bearer token)
- `GET /` filters: `q`, `category`, `level` (Beginner|Intermediate|Advanced, case-insensitive), `duration` (short|medium|long), `enrollment` (saved|in-progress|completed|not-started), `page`, `limit` (max 50, clamped). Unknown values, repeated keys, and non-positive/non-numeric page/limit return 400 (never silently ignored). Inactive and archived programs are hidden. Items carry `enrollment` (status string, as before), `enrollmentProgress`, `available`.
- `GET /mine?status=all|saved|in-progress|completed&sort=updated|title|progress&q&page&limit` -> `{items:[{program, enrollment}], counts, total, page, pages}`. Includes programs that are no longer available (`program.available: false`).
- `GET /:id` -> `{program, enrollment}`; an unavailable program is 404 unless the user has a record for it.
- `PUT /:id/enrollment` body `{status?, progress?, completedMilestones?}`; `status: 'none'` removes the record (still works on unavailable programs). Old `{status}` contract unchanged; the response `enrollment` now also has `progress`, `completedMilestones`, `updatedAt`.

### Progress rules (`utils/programs/progress.js`, pure + unit tested)
- `progress` must be an integer 0-100 (400 otherwise). With milestones, manual `progress` is rejected and progress = completed/total (stale orders removed by an admin are ignored at read time); without milestones `completedMilestones` is rejected.
- completed => progress 100 and `completedAt` set; progress 100 (or all milestones) => completed; progress > 0 => in-progress; saved => progress 0. Contradictory input (e.g. completed + progress 40) is 400. Lowering progress on a completed program moves it back to in-progress; `status: in-progress` on a completed program resumes it (99%, or last milestone unchecked).
- Enrolling in an unavailable program: 409 `PROGRAM_UNAVAILABLE`.
- Writes are compare-and-set (upsert for the first write; update guarded by the previous state and `updatedAt`, a few retries), so concurrent identical requests produce one change and one notification.

## Notifications
`utils/notify.js` with type `program`: new record (saved/started/completed), status changes (started, resumed, completed, saved). Sent only by the request that wins the transition; repeated identical requests and progress-only changes send nothing.

## Admin API (`/api/admin/programs`, protect + requireAdmin, mounted before the generic `/api/admin` router)
`GET /` (state all|active|inactive|archived, q, category, level, page, limit <= 100; includes `enrollmentCounts`), `GET /stats`, `GET /:id`, `POST /`, `PUT /:id`, `PUT /:id/state {state: active|inactive|archived}`. Validation: required title/provider/description/category, enums, http(s)-only `url` and resource URLs, <= 20 resources, <= 30 milestones with unique positive orders (existing orders are kept, new items get the next free number), slug unique (409). No hard delete; archive is soft and restore = activate. Every change calls `recordAdminAction` (`program.created|updated|active|inactive|archived`).
Roadmaps only recommend programs where `isActive != false` and `archivedAt` is unset (`roadmapController`).

## Client
- `/programs`: level, duration and status selects (URL params), clear filters, "My Programs" link; cards show progress for in-progress programs.
- `/programs/mine` (`MyPrograms.jsx`): status tabs with counts, sort, pagination, "No longer available" marker.
- `/programs/:id`: progress bar, manual percent input or milestone checklist, resume, enrollment info, admin resources, unavailable banner.
- `/admin/programs` (`AdminPrograms.jsx`): inside Agent 2's `AdminProtected`/`AdminRoute` shell; list, filters, create/edit form, activate/deactivate/archive/restore, learner counts.

## Tests
- `npm test` includes `tests/programs/programs.unit.test.js` (duration parsing, state machine).
- `PROGRAMS_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:programs`: spawns the API against a disposable `careernest_a3_programs_<pid>` database (dropped afterwards): filters/combos/pagination, invalid params, contract, progress and milestones, idempotent/concurrent notifications, inactive handling, My Programs, admin 401/403/CRUD/validation/URL safety/audit, legacy documents.

## Not done / limits
- Not an LMS: no lesson content, quizzes or certificates. No email notifications for programs. No per-user notification preference for the `program` type (User.notificationPrefs is shared).
- Admin UI was lint/build checked but not exercised in a browser by this change.
