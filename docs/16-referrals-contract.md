# 16 — Referrals: shared contract

Binding for all agents. Routes under `/api/referrals`, Bearer token, identity ONLY from `req.user.id`. Errors `{message, code?}`. Reference UI image: `C:\Users\VARSHI~1\AppData\Local\Temp\claude\676c73eb938db9d0\4997c359-2adf-4c6f-9cc9-383a75adcedd\images\3.jpg`.

## Hard rules (all agents)
No git add/commit/push/stash/reset of any kind. Never connect to Atlas (`MONGO_URI` from `.env` must not be used; never print `.env`). Never run `server/seed.js`/`npm run seed`. Tests only on a disposable mongod you start yourself on your own free port (not 27017, not 27018) with a temp dbpath outside the repo; stop only the process you started. Do not edit unrelated features. Existing user/referral data must keep working (additive changes only).

## File ownership
| Owner | Files |
|---|---|
| Backend | `server/models/Referral.js`, `models/User.js`, `controllers/{referral,auth,dashboard}Controller.js` (auth: profile fields only; dashboard: status strings only), `routes/referralRoutes.js`, `server/scripts/migrateReferralStatuses.js`, `server/scripts/seedReferralDemo.js`, `server/tests/referrals/**`, `server/utils/referralHelpers.js`, `package.json` scripts lines only |
| Frontend | `client/src/pages/{Referrals,ReferralFind,ReferralDetails,Profile}.jsx`, `client/src/components/referrals/**`, `components/dashboard/{format.js,StatusPill.jsx}` and `components/Feedback.jsx` (status strings only) |
| Lead | `App.jsx` routes, `navConfig.js`, docs, integration |

## Data model (additive)
`User.referralCompanies: [String]` (≤10 entries, each trimmed ≤80, deduped). `isReferrer` = "open to giving referrals" (unchanged field). Effective provider companies = `referralCompanies` if non-empty else `[currentCompany]`. Profile rule: `isReferrer` requires currentCompany OR ≥1 referralCompanies. `PUT /auth/profile` accepts `referralCompanies`; user DTO returns it. Company info is **self-reported** (never called verified).

`Referral` keeps `seeker` (=sender) and `referrer` (=recipient). Status enum: `pending|accepted|referred|declined|withdrawn` (legacy `requested` is read as `pending`; keep it accepted by the enum until migration is applied). New fields: `job {jobId?, title, company, jobCode?, applyUrl?, external:Boolean, externalJobId?}` (CareerNest job: server fills from Job record, ignoring client values; external: company, title, http(s) url required), `jobKey` (`job:<id>` | `ext:<lowercased normalised url>`), `resume` ref, `resumeSnapshot {name, fileName, fileType, text}` (**`select:false`**; never in any list/detail response), `statusHistory [{status, by, at}]`, `respondedAt`. Legacy docs without job/resume still render (placeholder "Job details not recorded").
Duplicate rule: same sender may ask DIFFERENT providers for the same job, but not the same provider for the same job while an existing request is active (pending|accepted) → 409 `DUPLICATE_ACTIVE` (unique partial index + pre-check). Cannot request self, or a provider without `isReferrer` (404).

## Lifecycle (server-enforced, atomic: status guard inside the update filter)
- pending → accepted | declined : recipient only
- pending → withdrawn : sender only
- accepted → referred | declined : recipient only
- everything else → 409 `INVALID_TRANSITION`; wrong role or non-party → 404. Accept NEVER sets referred. Each change appends `statusHistory`, notifies the other party via `utils/notify.js`.

## Endpoints
| Route | Notes |
|---|---|
| `GET /providers?company=&q=&page=&limit=` | opted-in (`isReferrer`) users, not self; `{count,total,page,pages,providers:[{_id,name,currentCompanyRole,companies:[string],seekingRole?,companySelfReported:true}]}`; no email. Regex input escaped |
| `GET /companies` | distinct provider companies for the filter dropdown `{companies:[string]}` |
| `GET /find?company=` | legacy alias, same shape as before |
| `POST /` | `{providerId, jobId? \| externalJob:{company,title,url,externalJobId?}, resumeId, message (1-1000, required), acknowledgeResumeShare:true}`. Resume must belong to sender (404 otherwise); snapshot copied (cleaned text via `cleanResumeText`). Send limit 20/day/user → 429 `RATE_LIMIT`. 201 `{message, referral:DetailDTO}` |
| `GET /mine`, `GET /incoming` | `?status=&limit=&page=`; `{count,total,page,pages,referrals:[SummaryDTO],counts:{all,pending,accepted,referred,declined,withdrawn}}` |
| `GET /summary` | `{sent:{all,pending,accepted,referred,declined,withdrawn}, received:{…}}` |
| `GET /:id` | party only (404 otherwise) → `{referral:DetailDTO}` |
| `GET /:id/resume` | recipient only; blocked (403 `RESUME_ACCESS_BLOCKED`) when status declined/withdrawn; `{resume:{name,fileName,fileType,text,retainedCopy:true}}`; `?download=txt` → `text/plain` attachment |
| `PUT /:id/status` and `PUT /:id` | `{status}` per lifecycle, role derived from token; `{message, referral:DetailDTO}` |

`SummaryDTO` = `{_id, direction:'sent'|'received', status, job:{title,company,jobCode,jobId,applyUrl,external,externalJobId}, messagePreview (≤140), resume:{name,fileName,fileType}|null, counterpart:{name, headline, company, companySelfReported:true}, createdAt, updatedAt}` — counterpart = recipient for sent, sender for received. `DetailDTO` = Summary + `message` (full), `candidate` (for recipient: `{name, seekingRole, experienceYears, preferredLocation}`; NO email, ever), `provider` (`{name, currentCompanyRole, company, companySelfReported}`), `statusHistory:[{status,at}]`, `allowedActions: ['accept','decline','withdraw','mark-referred']` for the caller, `resumeAvailable:Boolean` (true only if caller is recipient and status not declined/withdrawn and a snapshot exists), `resumeRetentionNotice` string. Never `resumeSnapshot.text`.

## Migration + demo scripts (Backend)
`scripts/migrateReferralStatuses.js`: dry run default (counts only); `--apply` writes a verified backup JSON to `server/backups/` then `requested→pending` only (`statusHistory` seed optional); local-only guard like other scripts (refuse non-local, `NODE_ENV=production`). Must NOT be executed against anything except a disposable test DB.
`scripts/seedReferralDemo.js`: creates a SEPARATE demo dataset in a local DB whose name must end in `_demo` (refuse otherwise; refuse non-local): ~8 realistic users (demo password documented in script header, emails `@example.com`), a few Companies/Jobs created by the script itself (does not call seed.js), resumes with realistic text, ~10 referral requests in all statuses incl. both directions for the main demo user. Idempotent (upsert by email/externalId). Dry run default, `--apply` to write.

## Client contract
Routes (Lead adds): `/referrals` Referrals, `/referrals/find` ReferralFind, `/referrals/:id` ReferralDetails (default exports). UI per the reference image: heading "Referrals" + "Connect, refer and grow together!", banner with handshake inline-SVG and **Find People to Refer** (→ `/referrals/find`), two summary cards (counts from `/summary`; click focuses that list), tabs Sent/Received with count badges + "All Statuses" filter, desktop (`lg`+) both lists side by side, tablet/mobile tabs switch; request card = company logo tile (`CompanyLogo`), "Company — Title", Job ID + "View Job ↗" (CareerNest job → `/jobs/:id`, external → URL in new tab with rel noopener), one-line message preview, resume chip, status pill, date ("Sent on"/"Received on"), ⋮ menu with permitted actions, WHOLE CARD clickable to `/referrals/:id` (inner controls stop propagation); "View All … Requests" expands the list; bottom Referral Status Guide (Pending / Accepted / Referred / Declined / Withdrawn with the exact meanings from the spec). Do not add the image's sidebar items or promo card (shared shell stays). Find page: company filter + search, provider cards (name, role, companies "self-reported"), Request modal: job source toggle (CareerNest job picker via `useAllJobs`/searchable, or external company/title/URL/optional job ID), resume via `components/resume/ResumeLibrary` (compact), message textarea (1000), a checkbox/notice acknowledging the resume text copy stays attached to the request even if the original resume is deleted. Detail page: profile, full message, job + link, resume view (text, via `/resume` endpoint, with download .txt) only when `resumeAvailable`, history, only `allowedActions` with confirmations (mark-referred: "only after you've submitted the referral through your company's process"). Profile page: "I'm open to giving referrals" + companies tag input labelled self-reported. Semantic tokens/dark mode, responsive, no decorative buttons, no email shown anywhere.
