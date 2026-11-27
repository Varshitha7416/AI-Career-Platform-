# 29. Application tracker, interview preparation and reminders

Batch 2, agent 3. Everything here is additive: no migration, no new collection, no new status system (applications are still
`applied | interviewing | rejected | offer`).

## Audit (what existed)

CRUD for applications (create, list, item with status history and interviews, status PUT, delete that also deletes the
user's interviews) and interviews (create, list upcoming/past/all, get, edit, delete, cancel/complete through `status`).
Notifications were created on events only. Nothing stored notes, follow-ups, reminders, the resume/cover letter used, or
interview preparation, and there was no way to be reminded.

## Application tracker

New optional fields on `Application`: `notes` (2000), `followUpAt`, `nextAction {text (200), dueAt}`, `externalUrl`
(http/https only, parsed with `URL`, no credentials, 500), `resume` / `coverLetter` (refs), `reminderAt`,
`reminderNotifiedAt`.

`PUT /applications/:id` still accepts `{status}` exactly as before and now also any of
`appliedAt, applyMethod, notes, externalUrl, followUpAt, reminderAt, nextAction, resumeId, coverLetterId, statusDate`.
`null` or `''` clears an optional field. Rules:

- applied date: valid, not in the future (1 minute skew), cannot be cleared. Editing it also moves the first (`applied`) history entry.
- `statusDate` (with `status`): date the transition really happened; not in the future, not more than a day before the applied date. Default is now.
- `resumeId` / `coverLetterId` must belong to the caller; another user's id and a missing id give the same 400 (no existence leak).
- `reminderAt` must be in the future unless it equals the stored value; changing or clearing it clears `reminderNotifiedAt` (it starts over).
- `nextAction` needs text; a due date alone is rejected.
- Validation errors return 400 with a joined message. Ownership is `user: req.user.id`, 404 otherwise.

`GET /applications/item/:id` additionally returns `resume {_id,name}` / `coverLetter {_id,title}` (or `{_id, missing: true}` if
deleted since, `null` if never set) and the interviews with all prep fields. Old records keep their synthetic status history.

Email-verification policy (docs/23): creating applications and creating/editing interviews still need a verified email.
Editing your own tracker data (notes, dates, reminders, status) does not, consistent with the original status PUT. A
reminder only creates an in-app notification for the owner.

Client: `ApplicationDetails` has a "Tracker notes" card (read-only summary + "Edit details" modal), a status timeline with dates,
resume and cover-letter links (page links; "Deleted since" when missing) and a confirmed "Remove from tracker" (states how many
interviews go with it). `Applications` shows indicators from real data (`utils/tracker.js trackerFlags`): follow-up overdue /
due within 2 days, next action overdue, reminder set, no update in 14+ days (open applications only).

## Interviews

New optional fields: `round` (1-20), `roundLabel` (80), `prepNotes` (4000), `debrief` (4000, notes during/after),
`prepResources [{title, url}]` (max 10, http/https only; user-owned list, the app never invents links), `prepChecklist
[{text, done}]` (max 20), `remindAt`, `reminderOffsetMinutes`, `reminderNotifiedAt`. The existing `type` enum is unchanged.

Reminder input: `reminderOffsetMinutes` in `15,30,60,120,1440,2880` (follows the interview when it is rescheduled; if the new
time would already be past it is cleared) or an explicit `remindAt` (must be before `scheduledAt` and not in the past when set).
`null` removes it. Setting or changing it clears `reminderNotifiedAt`.

`GET /interviews?filter=upcoming|past|completed|cancelled|all` now also returns `counts {upcoming, past, completed, cancelled, all}`.
The Interviews page has those tabs with counts, a preparation card (checklist toggles, links, notes), "Add notes" on completed
interviews, and the form has round, reminder, preparation and notes sections. Cancel and delete keep their confirmations.

## Reminders (database-backed)

No timer per reminder. Due times live on the records; `server/utils/reminders.js` `materialiseDue({userId?})` turns due ones into
`Notification` rows of type `reminder` (preference category `reminders`, through `notify()`, never bypassing prefs):

- Application: `reminderAt <= now`, `reminderNotifiedAt` empty, status not `rejected`.
- Interview: `remindAt <= now`, status `scheduled`, interview not yet started (a started one is just marked handled).

Exactly-once: `notify()` accepts a `dedupeKey` (`app-reminder:<id>:<dueMs>`, `interview-reminder:<id>:<dueMs>`) and
`Notification.dedupeKey` has a unique sparse index, so concurrent or repeated runs cannot create a second row (the duplicate-key
error is swallowed). Afterwards `reminderNotifiedAt` is set conditionally on the same due time, so a reminder edited in the
meantime is untouched. Editing the time changes the key, so it can fire once more. If the user turned the `reminders` category off,
nothing is created and the record is marked handled.

Triggers: lazily on `GET /notifications` and `GET /dashboard/overview` for that user, and a poller `startSweep()` started from
`server.js` (every 5 minutes, first run 20 s after the DB opens, `unref`'d, batches of 100). It is a poller only, so a restart
loses nothing. In `NODE_ENV=test` it is off unless `REMINDER_SWEEP_INTERVAL_MS` is set.

## Deletion policy

No new collections or user refs were added (`Application`, `Interview`, `Notification` already delete by `user`). `npm run test:account` passes.

## Tests

`TRACKER_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:tracker` (disposable database, real server child process, default port
5231, override with `TEST_PORT`): 15 tests covering existing flows (duplicate application, future date, deletion cleaning interviews),
edit validation, ownership, resume/cover-letter ownership and deleted refs, status-history dates and legacy records, URL
validation, interview round/prep/notes/reminder validation and rescheduling, list counts, exactly-once under concurrency (12
parallel materialisers plus lazy API calls), reminder edit/removal, rejected/cancelled/completed/started not firing,
preferences, the poller firing with no request, and the unchanged verified-email policy.

## Known limitations

- The Dashboard page itself does not yet show follow-ups/reminders (only the lazy materialisation was added to the overview endpoint). Due reminders appear through the notification bell.
- Reminder delivery is in-app only (no email/push); the bell polls every 60 s, so a reminder shows up within about a minute of the poll that creates it.
- Between claiming and marking, a crash can leave a notification without the marker; the next run is deduplicated by key, so this is safe.
- Follow-up and next-action dates are calendar days (stored at local midday); "overdue" means before today in the viewer's time zone.
- Status date is only settable through the API (no UI field yet).
- No browser verification of the new UI was done; lint and production build pass.
