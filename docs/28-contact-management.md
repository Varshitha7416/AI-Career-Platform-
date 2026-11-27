# 28 - Contact / support management

Support lives inside the authenticated app (no public contact page). Users send requests, see replies; admins run an inbox.

## Model (`ContactMessage`, additive)
`category` (account, jobs, applications, ai-features, referrals, bug, feedback, other; old rows read as `other`), `status` (open, in-progress, resolved, closed; default open), `assignee` (admin), `responses[]` (public replies: author, text, `emailDelivery`), `internalNotes[]` (`select: false`, admin only), `lastResponseAt`, `adminSeenAt` (null = unread for admins), `contentHash` (`select: false`, duplicate guard), `anonymizedAt`. Identity (`name`, `email`) is a snapshot taken from the token user, never from the request.

## User APIs (`/api/contact`, token required)
- `POST /` `{category?, subject, message}`: trimmed, strings only, subject 3-120, message 10-2000, category from the enum (default `other`). Requires a verified email (403 `EMAIL_NOT_VERIFIED`). 5 per user per hour (429). Identical content from the same user within 10 minutes is refused (409 `DUPLICATE_SUBMISSION`). Returns 201 with `ticket`.
- `GET /?page=&limit=` own requests, newest first (`{count,total,page,pages,messages}`), with status, category and latest reply preview.
- `GET /:id` own thread: the user's message and public replies (shown as "CareerNest Support"). 404 for anyone else's. Never contains internal notes, admin ids/names, assignee or email delivery data.
Client: `/contact` (form with category), `/contact/history`, `/contact/history/:id`.

## Admin APIs (`/api/admin/support`, `protect` + `requireAdmin` on everything; mounted before `/api/admin`)
`GET /counts`, `GET /?q&status&category&assignee(id|unassigned)&unread&sort(newest|oldest|updated)&page&limit` (search = subject, message, name, email, user name/email, regex-escaped), `GET /:id` (marks read), `PUT /:id/status`, `PUT /:id/assignee` (must be an active admin or null), `POST /:id/notes`, `POST /:id/responses` `{text, sendEmail?}`.
Client: `/admin/support`, `/admin/support/:id`, "Support" in the admin sub-navigation.

## Status transitions
open -> in-progress | resolved | closed; in-progress -> open | resolved | closed; resolved -> open | in-progress | closed (reopen allowed); closed is final. Anything else is 409 `INVALID_TRANSITION`. Applied with a compare-and-set on the current status. A first public reply moves open -> in-progress. Replies to closed requests are refused (409 `CLOSED`).

## Responses, notifications, email honesty
The reply is stored in-app first (source of truth). Then a `support` notification (link `/contact/history/<id>`, preference-aware via `utils/notify.js`; the reply text is not copied into it). Then, unless `sendEmail:false`, the `supportReply` template is sent through `services/email`. The resulting state is stored per reply in `emailDelivery`: `stored_local` (development outbox: saved locally, NOT delivered), `provider_accepted`, `delivered`, `failed`, `unavailable` (no transport), `not_requested`. The admin UI shows the honest wording; the user UI only says "Reply saved in your CareerNest inbox". Emails never contain internal notes. A failure to email never fails the reply.

## Audit
Every admin change calls `recordAdminAction` with `targetType: 'support'` and actions `support.status|assign|note|respond`. Summaries hold status words and ids only (no names, emails or text).

## Account deletion and export
Policy changed from delete to **anonymize** (`utils/account/policy.js`, `deletion.js`): the user's subject/message become `[removed at user request]`, `name`/`email`/`contentHash` are cleared and `anonymizedAt` set. Category, status, admin replies and internal notes are kept as operational records; admins see the requester as "Deleted user"; replies to such a ticket are refused (409 `ANONYMIZED`). The data export includes the user's own tickets and public replies, never internal notes or admin identity.

## Tests
`CONTACT_TEST_MONGO=mongodb://127.0.0.1:27017 npm run test:contact` (12 tests: validation, identity from token, duplicate/rate limit/verification, ownership, history pagination, admin authz 401/403, filters/search/sort/pagination/counts, transitions, assignee, notes and no leakage, notifications, email delivery state, audit, anonymization on delete). `test:account` covers the changed deletion policy.

## Limitations
No real email provider yet (replies are never actually emailed in development); users cannot reply back inside a thread (one message plus admin replies); no attachments; no admin dashboard count (not added to `adminDashboardController`); no automatic assignment or SLA timers.
