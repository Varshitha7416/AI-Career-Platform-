# 14 — Resume Analyzer + Cover Letter Generator: shared contract

Single source of truth for all agents. Do not change a shape without telling the lead.
All routes are under `/api`, need a Bearer token, and use `req.user.id` only (never a client userId). Errors: `{message, code?}`.

## File ownership (no two agents edit the same file)

| Owner | Files |
|---|---|
| Backend (A3) | `server/models/{Resume,ResumeAnalysis,CoverLetter}.js`, `server/controllers/{resume,resumeAnalysis,coverLetter}Controller.js`, `server/routes/{resume,resumeAnalysis,coverLetter}Routes.js`, `server/utils/resumeExtract.js`, `server/utils/coverLetterExport.js`, `server/middleware/aiLimiter.js`, `server/package.json` deps, `server/scripts/*` for this feature |
| AI (A4) | `server/config/gemini.js`, `server/utils/ai/**`, `server/tests/ai/**` |
| Resume UI (A1) | `client/src/pages/ResumeAnalyzer.jsx` (replaces `ResumeUpload.jsx`, which A1 deletes), `client/src/components/resume/**` |
| Cover Letter UI (A2) | `client/src/pages/CoverLetter.jsx`, `client/src/components/coverletter/**` |
| Lead | `App.jsx`, `navConfig.js`, `index.css`, docs, integration, anything shared |

Need a change in a file you don't own → ask the lead (final report), do not edit it.

## Resume (shared record, one per upload, never duplicated)

Raw files are NOT stored (existing design); only extracted text. Formats: **PDF, DOCX, TXT**, max 5 MB, text must be extractable (scanned PDFs rejected with a clear message). Legacy docs lack the new fields: DTO derives `name` from `fileName` minus extension and `fileType` from the extension.

Schema adds: `name`, `fileType` (pdf|docx|txt), `fileSize`, `isDefault`. Index `{user:1, createdAt:-1}`. First upload becomes default. Only one default per user.

`ResumeDTO` = `{_id, name, fileName, fileType, fileSize, isDefault, textLength, createdAt, updatedAt}` (never `resumeText`).

| Route | Body / result |
|---|---|
| `GET /resumes` | `{count, resumes:[ResumeDTO]}` (default first, then newest) |
| `POST /resumes` | multipart `resumeFile`, optional `name` → 201 `{message, resume:ResumeDTO}` |
| `PUT /resumes/:id` | `{name?, isDefault?:true}` → `{resume}` |
| `DELETE /resumes/:id` | → `{message, analysesKept, coverLettersKept}`. Deletes only that resume doc; history is kept via snapshots; if it was default, newest remaining becomes default |
| `GET /resumes/:id/preview` | → `{resume:ResumeDTO, textPreview (first 4000 chars)}` |

## Snapshots (history survives resume/job deletion)

`resumeSnapshot = {name, fileName, fileType}` and `jobSnapshot = {title, company, jobCode, manual:Boolean}` are stored on every analysis/letter at creation. API output for history items: `resume` = `{_id,name,fileName,fileType}` when it still exists, else `null`; always include `resumeSnapshot` and `resumeDeleted:Boolean`. Same idea for `job` / `jobSnapshot` / `jobDeleted`.

## Resume analysis

`POST /resume-analysis` `{resumeId, jobId?}` → 201 `{message, analysis}`. `type` = `job-specific` if jobId else `general`.
`GET /resume-analysis?resumeId=&jobId=&type=&limit=` → `{count, analyses:[AnalysisSummary]}` (newest first, max 100)
`GET /resume-analysis/:id` → `{analysis}` full. `DELETE /resume-analysis/:id` → `{message}`.

`AnalysisSummary` = `{_id, type, resume, resumeSnapshot, resumeDeleted, job, jobSnapshot, jobDeleted, overallScore, matchPercentage, summary, createdAt}`.

Full `analysis` = summary + `result` (null for legacy records; legacy flat fields `missingSkills[]`, `strengths[]`, `suggestions[]` (strings) are always filled — for v2 they mirror the structured result):

```
result: {
  summary: string,                       // 2-4 sentence plain explanation
  scoreExplanation: string,              // WHY the overall score / match is what it is
  overallScore: 0-100,                   // CareerNest AI readiness score (NOT a real employer ATS)
  matchPercentage: 0-100 | null,         // null for general
  matchingSkills:  [{skill, explanation, evidence, section}],        // evidence = short verbatim quote from resume; section e.g. "Experience", "Projects", "Skills"
  partialSkills:   [{skill, requirement, explanation, evidence, section}], // related but not clearly demonstrated
  missingSkills:   [{skill, explanation, importance:'high'|'medium'|'low'}],
  relevantExperience: [{title, explanation, evidence, section}],
  experienceGaps:  [{requirement, explanation}],
  qualificationMatch: {status:'met'|'partial'|'not-met'|'unclear'|'not-specified', explanation, evidence},
  strengths:       [{point, explanation, evidence}],
  structureFeedback: [{area, rating:'good'|'ok'|'needs-work', feedback}],   // areas: Structure, Clarity, Skills, Experience, Achievements, Formatting
  suggestions:     [{title, detail, section, priority:'high'|'medium'|'low', kind:'wording'|'structure'|'content-to-verify', requiresUserVerification:boolean, suggestedWording?:string}],
  disclaimer: string                     // fixed server text: CareerNest AI-generated assessment, not an employer ATS result
}
```
General analysis: job-only arrays (`partialSkills`, `missingSkills`, `experienceGaps`, `qualificationMatch`) may be empty / `not-specified`, `matchPercentage` null.
`kind:'content-to-verify'` / `requiresUserVerification:true` = a prompt for something the user may genuinely have but the resume doesn't show; it must be phrased as a question/placeholder, never as a fact.

## Cover letters

Schema (existing `generatedText` stays = text of the original AI generation; legacy docs work): adds `job` optional (manual job allowed), `jobSnapshot`, `resumeSnapshot`, `analysis` (ref, optional), `options {tone:'professional'|'confident'|'concise', length:'standard'|'detailed', instructions, userFacts, useAnalysis}`, `currentText`, `versions:[{number, text, source:'ai'|'edit'|'regeneration'|'restore', createdAt}]` (max 25, oldest non-first dropped), `editedAt`, `groundingWarnings:[string]`, `needsInfo:[string]`.
`CoverLetterDTO.currentText = doc.currentText ?? doc.generatedText`; `currentVersion = last version number (legacy: 1)`; `hasEdits = currentText !== latest AI version text`.

| Route | Body / result |
|---|---|
| `POST /cover-letters` | `{resumeId, jobId? , manualJob?:{title, company, description?}, tone?, length?, instructions?, userFacts?, analysisId?, useAnalysis?}` → 201 `{message, coverLetter}`. Needs jobId OR manualJob{title,company}. If jobId is given, title/company/description/requirements come from the Job record |
| `GET /cover-letters?resumeId=&jobId=&limit=` | `{count, coverLetters:[CoverLetterDTO without versions' text]}` |
| `GET /cover-letters/:id` | `{coverLetter}` with full `versions` |
| `PUT /cover-letters/:id` | `{text}` save edit (≤ 12000 chars, non-empty) → `{coverLetter}`; adds `edit` version if text changed, sets `editedAt` |
| `POST /cover-letters/:id/regenerate` | `{tone?, length?, instructions?, userFacts?, resumeId?, force?}` → if `hasEdits` and not `force`: **409** `{code:'HAS_EDITS', message}`. With force (or no edits): new AI text becomes `currentText` + new version; old text stays in `versions` |
| `POST /cover-letters/:id/restore` | `{versionNumber}` → `{coverLetter}` (adds `restore` version) |
| `GET /cover-letters/:id/download?format=pdf\|docx` | binary, `Content-Disposition: attachment; filename="Cover-Letter-<Company>-<Title>.<ext>"`, uses SAVED `currentText`; only the letter, no UI |
| `DELETE /cover-letters/:id` | `{message}` |

Generation response includes `groundingWarnings` (letter contains claims not supported by resume/userFacts after the one automatic strict retry) and `needsInfo` (questions the AI says it needs the user to answer, e.g. "Which project best shows your React experience?").

## AI errors (all AI routes)

`429 {code:'AI_QUOTA'}` quota exhausted ("The AI service has reached its usage limit. Please try again later."), `503 {code:'AI_UNAVAILABLE'}` not configured, `502 {code:'AI_BAD_RESPONSE'}` invalid output after one retry, `502 {code:'AI_ERROR'}` other. Per-user limiter on AI routes: 15 AI calls / hour / user → `429 {code:'RATE_LIMIT'}`. Never fabricate a result on failure; never save a record on failure. Same analysis (same resume+job+resume text hash) within 10 min returns the saved one instead of calling Gemini again (`reused:true`).

## AI module interface (A4 implements, A3 calls)

```js
// server/utils/ai/resumeAnalysis.js
analyzeResumeWithAI({ resumeText, job /* null | {title, company, description, requirements[], responsibilities[], skills[], preferredSkills[], education, experienceLevel} */ })
  -> { result /* the `result` object above minus disclaimer */, overallScore, matchPercentage }
// server/utils/ai/coverLetter.js
generateCoverLetterWithAI({ resumeText, job /* {title, company, description, requirements[], skills[]} */, candidateName, tone, length, instructions, userFacts, analysisInsights /* null | {strengths[], matchingSkills[], suggestions[]} */, strict /* bool */ })
  -> { text, needsInfo: string[], groundingWarnings: string[] }
```
Both throw errors with `.status` and `.code` per the table above. `config/gemini.js` keeps exporting `generateText(prompt, opts?)` (backwards compatible) and adds `generateJSON(prompt, opts)`.

Anti-fabrication (A4, enforced in code not only in prompts): resume text / job text / user instructions are wrapped as delimited untrusted data; evidence quotes must be found (normalised) in the resume else the item is demoted/dropped; skills are synonym-aware (JS≈JavaScript, Node≈Node.js, k8s≈Kubernetes, Postgres≈PostgreSQL, ReactJS≈React, ML≈Machine Learning …) before being called missing; suggestions can't state new facts; cover letters are checked deterministically (tech terms, numbers/percentages, years-of-experience claims, certifications, employers not in resume+userFacts) with one strict regeneration then warnings.

## Cross-feature links (client)

- Analyzer → letter: `/cover-letter?job=<jobId>&resume=<resumeId>&analysis=<analysisId>`
- Letter → analyzer: `/resume?resume=<resumeId>&job=<jobId>` ; open a saved analysis: `/resume?analysis=<id>`; open a saved letter: `/cover-letter?letter=<id>`
- Shared resume component (A1 builds first, A2 imports, nobody else edits): `components/resume/ResumeLibrary.jsx` default export, props `{selectedId, onSelect(resume|null), onResumesChange?(list), compact?:boolean, allowManage?:boolean}`: lists the user's resumes (fetches `GET /resumes`), shows selected + default, upload (drag/drop + button, progress, validation), and when `allowManage` rename / set default / delete-with-confirm. Auto-selects the default resume when `selectedId` is empty. Persist selection in `localStorage.resumeId` (validated against the list).

## Design rules

Shared `Layout` only (no new header/nav). Semantic tokens only (`bg-white`, `text-ink`, `text-primary`, `border-sage/..`, `bg-mint`, `bg-forest` …, see `index.css`) so dark mode works; Fraunces headings via existing classes; reuse `components/Feedback.jsx` and `utils/errors.js`. No decorative buttons. Responsive: mobile single column, tablet, desktop two-pane. Inline-SVG botanical illustrations (no image deps). The score is always labelled "CareerNest AI assessment", never "ATS result".
