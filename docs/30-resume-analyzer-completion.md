# 30. Resume Analyzer completion (Batch 2, agent 4) and Batch 1 carryovers

Scope: everything around the Resume Analyzer that is NOT the AI engine (history, comparison, PDF export, resume-library integration), plus three Batch 1 carryovers (referral demo seed, admin company filter, program statistics). The AI service (`utils/ai/*`, `config/gemini.js`) was not modified.

## A. History

`GET /api/resume-analysis` keeps its contract (`{count, analyses}`, summaries without `result`, newest first, filters `resumeId`, `jobId`, `type`, `limit` max 100, default 50). Additive: `page` (1-based), and the response now also carries `total`, `page`, `pages`. The client loads 20 per page with a "Load older analyses" button, so the old 50 cap no longer limits history.

`GET /api/resume-analysis/:id` is unchanged. Ownership is by `user: req.user.id`, so another user's id is a 404. Deleted resumes and jobs never cause a 500: `toSummary` returns `resumeDeleted` / `jobDeleted` plus the stored `resumeSnapshot` / `jobSnapshot`; the UI shows "Resume no longer available" and hides "Analyze again" for deleted resumes. Older documents (no `type`, no snapshots, no `result`, no `overallScore`) read fine (type derived from `job`).

UI (inside the existing `/resume` page, no new route): history list with a per-resume filter, score, match, open, delete, "Analyze again" (re-selects the same resume and job on the workspace form, then the user presses Analyze; it never calls the AI by itself) and "PDF".

## B. Comparison

`GET /api/resume-analysis/compare?a=<id>&b=<id>` (both must be the caller's, otherwise 404; invalid or identical ids 400). Every delta is `b - a`; the client orders the two by date so a is the older analysis. Response `{comparison}`:

| Field | Meaning |
|---|---|
| `a`, `b` | id, createdAt, type, target label, resume label, `resumeDeleted`, `jobDeleted`, overallScore, matchPercentage |
| `scoreDelta`, `matchDelta` | null when either side lacks the value |
| `sameTarget`, `sameResume` | same job id, or same general/target label; same resume id |
| `strengths` | `{gained, lost, unchanged}` |
| `missingSkills` | `{resolved, new, unchanged}` |
| `matchedSkills` | `{gained, lost, unchanged}` or `null` when an analysis has no structured `result` (older format) |
| `suggestions` | `{added, removed, unchanged}` |
| `notes` | plain-language explanations of everything that is NOT comparable |

Text is compared case-insensitively after whitespace normalisation using the always-present flat arrays. Notes are generated for: one analysis general and the other job-specific (no match percentage), missing readiness score, different targets or resumes, deleted resume/job, older format without matched-skill detail. The pure logic is `utils/resumeAnalysisCompare.js`.

## C. Export

`GET /api/resume-analysis/:id/export?format=pdf` (default pdf; any other format 400; not own = 404). Built with `pdfkit` through `utils/resumeAnalysisExport.js`, reusing the cover-letter export approach (`pdfSafe` and `safePart` are now exported from `utils/coverLetterExport.js`). Content: resume, target, date, type, scores, summary, strengths, missing skills, suggestions and an advisory disclaimer. Text is drawn as plain text (no HTML), unsupported glyphs are replaced; the filename is `Resume-Analysis-<safe resume name>-<YYYY-MM-DD>.pdf` (`[A-Za-z0-9-]` only). Headers: `application/pdf`, `attachment`, `no-store`, `nosniff`. **DOCX is not offered**: the existing DOCX helper only renders plain paragraphs, which would not make a clean report.

Policy kept: `POST /resume-analysis` requires a verified email; history, detail, compare and export stay open to unverified users (tested).

## D. Library integration

Analyses can be filtered by resume (including deleted ones, via snapshot) and by `resumeId` on the API; history rows show the resume name; deleting a resume (existing behaviour) backfills snapshots first so its analyses survive; users only reach their own resumes and analyses.

## Batch 1 carryovers

1. **Referral demo seed** (`scripts/seedReferralDemo.js`): demo users are created with `emailVerified: true` + `emailVerifiedAt`; reruns repair demo users left unverified by the older version (only those two fields). Guards unchanged (local only, db name must end in `_demo`, no production, dry run by default). Verified in tests by running the script against a disposable `*_demo` database and sending a referral as a demo user.
5. **Company filter, more than 50 companies**: the public Jobs page has no company dropdown (company is searched through `q`), so only the admin Jobs page was affected. `GET /api/admin/companies/options?include=archived` now returns every company (`_id`, `name`, `isActive`; ceiling 5000 with a `truncated` flag), sorted by name; without the param it still returns active companies only (job form). `AdminJobs.jsx` uses it, so archived companies and companies beyond 50 are filterable.
6. **Career program statistics**: both `GET /admin/programs/stats` and `GET /admin/overview` now use one helper, `utils/programs/stats.js`. Program state is archived (archivedAt) > inactive (isActive false) > active, via one `$group`. Enrollments are counted via a single aggregation with `$lookup` to Program and User and only counted when the program exists and the user exists and is not tombstoned (`deletedAt`); everything else is reported as `enrollments.orphaned`. Findings before the change: the dashboard folded archived programs into "inactive" and counted orphaned enrollments (deleted programs/users) while the stats endpoint also counted them. The dashboard response gained `programs.archived` and `programs.enrollments.orphaned` (additive); the old admin overview test expectation was updated for those two fields.

## Tests

`npm run test:resume-history` (`RESUME_HISTORY_TEST_MONGO=mongodb://127.0.0.1:27017`, local only, ports 5241 to 5243, databases `careernest_b2a4_*` dropped at the end): 20 tests covering list contract and pagination, detail ownership, legacy documents, unverified access, compare (compatible, general vs job-specific, legacy, validation, ownership), export (valid PDF, headers, filename sanitising, ownership, bad format), deleted resume and job, more than 50 companies, program stats agreement with orphans/tombstones, referral demo seed. No AI is called: analyses are inserted directly.

## AI defects observed

No AI call was made in this work (by design), so nothing below was reproduced at runtime; these are observations from reading code and from building the comparison, for the later AI investigation. Nothing was changed.

- `controllers/resumeAnalysisController.js` `flatten()` collapses suggestions to `"title: detail"` strings and strengths to the `point` text. Free-text AI output rarely repeats verbatim between two runs, so the "unchanged" lists in a comparison are expected to be mostly empty and the added/removed lists noisy even for near-identical resumes. This suggests the AI output has no stable identifiers (for example a canonical skill key) to diff on.
- Missing skills of a GENERAL analysis (no job) are free-form AI text; two general analyses of the same resume may name the same gap differently ("Docker" vs "Containerisation"). The comparison cannot tell these apart. Skill normalisation (`utils/ai/skillSynonyms.js`) is not applied on the comparison path.
- The reuse window (10 minutes, `inputHash`) means a second identical request returns the cached result, so score non-determinism is hidden for short intervals; scores for the same resume on different days may differ with no change in input. Not measured here.
- `matchPercentage` is stored as null for general analyses and `overallScore` can be missing on pre-structured legacy documents, so any trend or average across history has to handle nulls.

## Limitations

- No browser verification of the new UI was done; client lint and build pass (see the final report).
- PDF only (no DOCX).
- Comparison needs the two analyses to belong to the same user; there is no cross-resume "best version" recommendation.
