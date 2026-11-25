# Step 13: Dashboard, Shared Navigation, Notifications, Interviews and Career Programs

## What I was trying to do
Replace the old "Dashboard" (which was really just a saved-jobs list plus an application tracker) with a real career dashboard, and give the whole app one consistent shell: a collapsible CareerNest sidebar, a proper top bar, a notification bell and a light/dark theme.

## My first attempt
- `/dashboard` listed saved jobs and applications. There was no overview, no interviews, no notifications, no career programs, no activity feed and no theme. Each page rendered its own navbar.

## What was wrong with it
- Nothing summarised the user's job search (counts, status mix, what happened recently, how far along they are).
- Interviews could not be recorded at all, so "upcoming interviews" had nothing real to show.
- Status changes left no history, so a real activity feed was impossible without inventing events.
- The tracker and the dashboard were the same page; navigation was a flat navbar with no sidebar.

## Final decision
**Backend (details in `docs/12-dashboard-backend.md`)**
- `GET /api/dashboard/overview` returns everything the page needs in one call (about a dozen database operations whatever the data size), always scoped to the token user: stats, application overview for a time range, recent activity built only from real records, career progress and milestones, recent applications, saved jobs, upcoming interviews, featured programs, a context-aware tip and the unread notification count.
- New models: `Interview` (tied to an application), `Notification`, `Program`, `ProgramEnrollment`, `ContactMessage`; `Application.statusHistory`; `User.notificationPrefs`. Older applications get a derived history, so no migration was needed.
- Notifications are created by one helper that never throws and honours the user's preferences (application added or changed, interview scheduled/rescheduled/cancelled, referral requested/updated).
- Profile completeness and career progress are computed server-side from real fields (profile 100 points: name 10, target role 15, experience 10, city 10, work mode 10, type 10, resume 35), never hard-coded.
- Career programs are curated **demo** content: real provider names, links only to each provider's home page; `npm run seed:programs` is additive and guarded like the other seed scripts.

**Frontend**
- One shell (`Layout`) for every protected page: top bar (Home, About, Profile, theme toggle, notification bell, Contact Us, avatar menu) and a sidebar that is collapsed to just the compact brand tile; hover or click expands it as an overlay (click pins it), leaving collapses it, Esc closes it and on mobile it is a drawer. No "Upgrade to Pro". The job page is "Job Discovery" in titles and links; the sidebar item is "Find Jobs" because the spec lists it that way.
- Dark mode works by remapping the semantic colour tokens plus a few overrides, so every existing page adapts; the choice is stored and applied before first paint to avoid a flash. Default is light.
- Dashboard page: personalised greeting, hero search that opens Job Discovery with the query, five clickable stat cards, a hand-built SVG donut with a time filter, recent activity (each row links to its record), a dark-green career progress card with milestones, and lists of applications, saved jobs, interviews and programs, plus a tip banner. Real empty, loading and error states throughout.
- New pages behind the sidebar: Application Tracker and Application Details (status timeline and scheduling), Saved Jobs, Interviews (schedule, edit, reschedule, complete, cancel with confirmation), Career Programs and details with enrolment, Settings (theme, notification preferences) and Contact Us (stored in the database).

**Process.** The work was split across parallel agents with exclusive file ownership under a written API/file contract (dashboard UI, shell/theme, backend, pages), then verified by a separate QA agent that did not build anything. Its round-one report passed all 31 checklist items with 13 low or informational defects; owners fixed them, and a second QA round re-verified the fixes and covered items it had skipped.

## Why
- One overview endpoint avoids a dozen client round trips and N+1 queries, and keeps the user-scoping logic in one place.
- Deriving history for old records and refusing to invent events keeps the feed honest.
- An overlay sidebar means the brand tile is the only permanent navigation chrome, as requested, without shifting page content.
- Semantic colour tokens make dark mode a theme change rather than a per-page rewrite.

## What I learned
- When many agents edit one tree, a written contract with file ownership matters more than the agents themselves; shared files (routes, icons, theme CSS) need exactly one owner.
- Tooling that rewrites backslashes can silently corrupt regexes (a raw backspace byte replaced `\b`); lint caught it.
- A mocked API in the browser (request interception) lets UI work proceed before the backend exists, and keeps fixtures out of the repository.
- "Timestamp = updatedAt" is wrong as soon as a record can be edited later; an event needs its own time (`statusChangedAt`).

## Verification done
- Backend: 190-check dashboard suite and 15 extras (auth on every endpoint, user isolation, validation, overview maths against independently computed values, empty user, legacy data, orphans, notifications and preferences, interviews, programs, contact), plus the earlier smoke and Jobs suites as regression.
- UI: sidebar hover/click/pin/Esc/mobile drawer, 17 routes in light and dark at 1440/1024/768/390 with no horizontal scroll or console errors, dashboard figures checked against the database for a rich and an empty user, all five time ranges, activity links, notifications (badge, read, read-all, preferences, 60-second poll), theme persistence, dark-mode contrast of every status pill, the Jobs feature and apply flow unchanged.
- Client lint and build, server syntax checks.

## Known limits
- **The Dashboard reference image was not received**, so the design follows the written spec and the Jobs visual language; visual fidelity to the image itself is unverified and a fidelity pass is still open.
- Career program content is curated demo data, not a live course catalogue; interview scheduling is manual (no calendar sync or email reminders).
- The brand tile keeps the "CareerNest" wordmark next to the logo (a deliberate choice).
- Gemini quota (HTTP 429) was exhausted by earlier testing, so the AI pages show their graceful "temporarily unavailable" message until it resets.
