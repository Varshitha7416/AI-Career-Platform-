# 20 — Pre-production improvements (recorded, not yet done)

Items found during the final review of the auth and Home/About/Profile phases. None blocks local development; each should be resolved or consciously accepted before a production release.

| Item | Detail |
|---|---|
| PDF export and non-Latin text | Cover-letter PDF export uses a standard PDF font, so text outside Latin-1 (Hindi, Chinese, Cyrillic, emoji) is rendered as `?`. DOCX export keeps such text correctly. Fix: bundle a Unicode font for `pdfkit` (check its licence and the size impact) or fall back to DOCX with a visible warning. |
| Legal review | `/terms` and `/privacy` describe the app's actual behaviour but are an unreviewed draft (both pages say so). Have them reviewed before launch; the wording naming MongoDB Atlas hosting and Google Fonts should be confirmed. |
| Account deletion and data export | Not implemented (the privacy page says so and points to `/contact`). Referral requests keep a resume-text copy even after the source resume is deleted, with no erase control. |
| Atlas rollout | Add the new Resume index (`user`, `targetRoleKey`) with `npm run indexes` after taking a backup (see `docs/17-index-management.md`). Atlas has not been touched by any of this work. |
| Role-resume assignment | There is no concurrency lock when two requests assign resumes to roles at the same moment. |
| Dev dependency audit | `npm audit` (server) reports two moderate findings in `minimatch` through `nodemon` (dev-only); the suggested fix is a breaking `nodemon` change. |
| Live AI quality | Resume analysis and cover-letter generation were tested with stubbed AI only; live Gemini output quality and quota behaviour are unverified. |
| Rate limits | Auth and AI rate limiters are in-memory (reset on restart, not shared between instances). |
