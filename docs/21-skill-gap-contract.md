# 21 — Skill Gap Analysis: audit + shared contract

Single source of truth for the three workstreams. Change a shape only via the lead.
Routes under `/api`, Bearer token, `req.user.id` only (never a client userId), errors `{message, code?}`, lists `{count, ...}`.

## 1. Audit summary

| Need | Existing | Action |
|---|---|---|
| Gemini | `config/gemini.js` `generateJSON` (retry, quota/timeout mapping, 60k prompt cap) | reuse as is; (only addition allowed: a `NODE_ENV==='test'`-guarded stub hook for API tests) |
| AI helpers | `utils/ai/common.js` (`delimit`, `newNonce`, `CAPS`, `evidenceVerified`, `str/oneOf/strList`), `grounding.js`, `resumeAnalysis.js` pattern (prompt + deterministic post-processing, `deps` injection for tests) | reuse |
| Skill synonyms | `utils/ai/skillSynonyms.js` (`canonicalKey`, `canonicalName`, `findSkillInText`, `snippetFor`, `GROUPS`) | reuse; extend ONLY additively and only if needed (e.g. more groups) — existing tests must keep passing |
| Role taxonomy | `utils/roles.js` `searchRoles(q)`, `GET /auth/roles` | reuse for the role selector |
| Resumes | `Resume` (text, name, targetRole, isDefault), `/resumes` APIs, `resumeSnapshot` pattern, `cleanResumeText` | reuse, never duplicate; analysis stores a snapshot only |
| Jobs | `Job` (`skills`, `preferredSkills`, `requirements`, `jobDescription`, `yearsRequired`), `buildJobInput` in `middleware/aiLimiter.js`, `GET /jobs/meta` top skills | reuse |
| Rate limit | `aiLimiter` (15/h/user, `req.consumeAiCall()` before a real call, `sendAiError`) | reuse |
| Programs | `Program` (`skills[]`, `url`, `level`, `duration`), `ProgramEnrollment` | reuse for resources; match via skill synonyms; never create enrollments from this feature |
| UI | `ScoreRing`, `JobPicker`, `AnalysisHistory/Compare/ResultView` patterns in `components/resume/`, `Feedback.jsx`, `useAllJobs`, `Layout`, tokens in `index.css` | reuse/mirror; do NOT edit resume components |
| User profile | `User.careerInterests`, `primaryRole`, `seekingRole`, `skills`, `experienceYears` (`GET /auth/me`) | read-only prefill |
| Missing | models, engine, scoring, roadmap, progress, compare, page, nav/feature entries | built here |

Regression risks: `skillSynonyms.js` shared with resume analysis (additive edits only); `server.js`, `App.jsx`, `navConfig.js`, `homeData.js`, `Icons.jsx` are shared (lead only).

## 2. Ownership

| Owner | Files (only these) |
|---|---|
| Lead | `server/models/{SkillGapAnalysis,LearningRoadmap}.js` (done, agents may NOT change them; request changes), `server.js`, `server/package.json` scripts, `client/src/App.jsx`, `navConfig.js`, `components/Icons.jsx`, `components/home/homeData.js`, About/SiteFooter/JobDetails/Dashboard/Profile entry points, docs |
| Agent 2 (backend/AI) | `server/utils/skillgap/**`, `server/controllers/skillGapController.js`, `server/routes/skillGapRoutes.js`, `server/tests/skillgap/**`, optional guarded stub in `config/gemini.js` |
| Agent 3 (roadmap/progress) | `server/utils/roadmap/**`, `server/controllers/roadmapController.js`, `server/routes/roadmapRoutes.js`, `server/tests/roadmap/**` |
| Agent 1 (frontend) | `client/src/pages/SkillGapAnalysis.jsx`, `client/src/components/skillgap/**`, `client/src/api/skillGap.js`, `client/src/hooks/useSkillGap*.js` |

Lead mounts: `app.use('/api/skill-gap', roadmapRoutes)` FIRST, then `app.use('/api/skill-gap', skillGapRoutes)`. Both routers export an Express router as `module.exports`. Each router applies `protect` itself.

## 3. Models (see the files; shapes are final)

`SkillGapAnalysis` and `LearningRoadmap`. Skill identity everywhere = `key` from `skillSynonyms.canonicalKey(name)`; display = `canonicalName`. Statuses: `not-started | in-progress | completed`. Levels: `beginner|intermediate|advanced` (only when the user chose them).

Internal field: `SkillGapAnalysis.roadmapLock` `{token, at}` (`select: false`) is the roadmap-generation lock described in section 6; it is never returned by any API.

Retention: an analysis keeps `jobSnapshot` / `resumeSnapshot`; deleting the source resume/job never deletes or alters history (`resumeDeleted` / `jobDeleted` flags in the DTO). Deleting an analysis cascades to its roadmap (UI must confirm). Resume text is never stored or returned.

## 4. Classification and scoring (deterministic, method `v2`; the AI never classifies and never supplies a percentage)

### 4.1 Resume classification (resume mode only)
Every requirement skill is classified by fixed rules over the resume text (`utils/skillgap/matcher.js`). The resume is split into lines tagged by section (a skills section, an experience/projects section, or other).

| Class | Rule | Quote (`evidence`) |
|---|---|---|
| **matched** (`mention: 'usage'`) | the skill appears in a **usage line**: a non-list line with an action verb (built, used, developed, deployed, ...) and at least 5 words, or a line of 6+ words under Experience / Projects, or a `Tech used:` line under a project | that usage line (real slice of the resume) |
| **partial** (`mention: 'skills-list'`) | the skill appears only in a **skills list** (a skills section, a `Skills:` label, or a line with 2+ commas/semicolons/pipes that is not a finished sentence) | the real list line |
| **partial** (`mention: 'mention'`) | the skill is mentioned in prose that shows no practical use (e.g. a summary: "enthusiastic about Tableau") | the real line |
| **missing** | no line of the resume contains the skill (aliases via `skillSynonyms`, e.g. Postgres = PostgreSQL; an alias never matches as the suffix of a dotted name, so "Node.js" does not imply JavaScript) | none |

A skills-list entry is a candidate-declared skill, so it is **never** "missing": it is partial, and the reason states it plainly ("listed in your skills section, but no project, job or achievement in the resume shows how you used it"). Quotes are always real slices of the resume and are checked with `evidenceVerified`; if no quote verifies, the skill is treated as missing. **The AI cannot promote or demote any skill**: its output is limited to extra requirement names, "missing" explanations, a `suggestion` text for partial skills, an overall summary and extra strengths that really occur in the resume. Anything contradicting the resume is ignored (reported as a `corrections` entry server-side).

### 4.2 Manual classification
Manual analyses never use resume rules: a requirement is **matched** when the user listed the same canonical skill (no evidence, no `mention`), else **missing**. `partial` is not used. The level is only what the user chose.

### 4.3 Formula (unchanged from v1)
Each requirement skill `i` has weight `w = kindW x importanceW` — kindW: required 3, preferred 1.5, recommended 0.75; importanceW: high 1.5, medium 1, low 0.6. Coverage `c`:
- resume mode: matched (shown in use) = 1.0; partial (listed or mentioned only) = 0.5; missing = 0
- manual mode: matched = proficiency factor (beginner 0.6, intermediate 0.85, advanced 1.0, no level given 0.8); missing = 0
`score = round(100 x sum(w*c) / sum(w))`. Also `requiredCoverage` and `preferredCoverage` (weighted, 0-100, `null` if none of that kind). Zero requirements => `422 NO_REQUIREMENTS`. Same inputs + same requirement list => same score, regardless of the AI's wording.

**Why v2:** the formula is identical to v1; v2 marks the stricter resume classification (v1 counted a skills-list mention as matched). Analyses saved under v1 keep their stored result. Comparing a v1 and a v2 resume analysis adds a note that part of the difference may come from the rule change.

### 4.4 Worked examples (all covered by unit tests)
Job: React (required), CSS (required), Docker (preferred) => weights 3 + 3 + 1.5 = 7.5.

| Resume text | React | CSS | Docker | Score |
|---|---|---|---|---|
| "Built UIs using React and CSS. Used Docker for deployments of the app." | matched | matched | matched | 7.5 / 7.5 = **100** |
| `SKILLS: React, CSS, HTML, Docker` + "Built dashboards using React and CSS at Acme." | matched | matched | partial (skills-list) | (3 + 3 + 0.75) / 7.5 = **90** |
| `SKILLS: React, CSS, Docker` only | partial | partial | partial | 3.75 / 7.5 = **50** (required coverage 50) |
| "Built UIs using React only." | matched | missing | missing | 3 / 7.5 = **40** |
| Manual: React (intermediate), Docker (no level) | 0.85 | missing | 0.8 | (2.55 + 1.2) / 7.5 = **50** |

Other classification examples: with `SKILLS: Node.js, Express, MongoDB, Git, Docker` and bullets "Built REST APIs in Node.js and Express backed by MongoDB." / "Used Git and pull requests for team collaboration.": Node.js, Express, MongoDB, Git = matched (usage); Docker = partial (skills-list); Kubernetes = missing. With `Technical Skills: Python, SQL, Tableau, Excel` and nothing else: Python, SQL, Tableau = partial; React = missing.

Requirement list: job mode => `job.skills` = required (`job-field`), `job.preferredSkills` = preferred; AI may additionally extract skills from the description/requirements text (`job-text`) and, for role-only targets, a representative set of 8-12 typical skills (`ai-role`, capped at 12). AI-added skills must be role-relevant; names pass through `canonicalKey` and are de-duplicated.

## 5. API — Agent 2 router (`routes/skillGapRoutes.js`)

All bodies validated; ids with `isValidId`; AI endpoints behind `aiLimiter`; identical request within 10 min (`inputHash`) returns the saved analysis with `reused:true` (200) without a new AI call; body cap by existing `express.json` 1mb plus field limits.

| Route | Notes |
|---|---|
| `GET /skill-gap/roles?q=` | `{count, roles:[string]}` from `searchRoles` |
| `GET /skill-gap/skills?q=&limit=` | `{count, skills:[{name,key}]}` — suggestions from synonym GROUPS canonical names + job top skills; `q` regex-escaped; also used to normalize |
| `POST /skill-gap/resume` | `{resumeId, jobId?}` OR `{resumeId, targetRole, jobDescription?, experience?}` → 201 `{message, analysis}`. 400 on validation, 404 resume/job not owned/found, 422 `NO_REQUIREMENTS`, AI errors via `sendAiError` (429/502/503) — nothing saved on failure |
| `POST /skill-gap/manual` | `{targetRole, jobId?, jobDescription?, skills:[{name, level?}] (1-60), experienceYears?, education?, domain?, projects?, goals?}` → 201 `{message, analysis}`; duplicates/aliases merged (keep highest explicit level); unknown custom skills kept as-is |
| `GET /skill-gap?page=&limit=&mode=&targetRole=` | `{count, total, page, pages, analyses:[Summary]}`, newest first, limit ≤ 50 |
| `GET /skill-gap/:id` | `{analysis: Full}` (404 if not owner) |
| `DELETE /skill-gap/:id` | deletes analysis AND its roadmap → `{message, roadmapDeleted:Boolean}` |

`Summary` = `{_id, title, mode, basis, targetKind, targetRole, score:{value,method}, counts:{matched,partial,missing,required,preferred}, job:{_id,title,company}|null, jobDeleted, resume:{_id,name}|null, resumeDeleted, resumeSnapshot, jobSnapshot, hasRoadmap, roadmapId|null, roadmapPercent|null, createdAt}` (roadmap join via `LearningRoadmap`, one extra query for the page, no N+1).
`Full` = Summary + `{input, requirements, result, score (full), jobDescriptionProvided:Boolean, disclaimer, methodNote}`. Each `result.partial[]` item carries `mention: 'skills-list' | 'mention'`, the real `evidence` line, a deterministic `reason` and a `suggestion`. `jobDescriptionText` is NOT returned in lists; returned in Full only as `jobDescriptionProvided` plus `jobDescriptionPreview` (first 500 chars).

## 6. API — Agent 3 router (`routes/roadmapRoutes.js`, same `/skill-gap` prefix, mounted first)

Fixed paths are declared before anything param-based.

| Route | Notes |
|---|---|
| `GET /skill-gap/overview` | `{latestAnalysis:Summary\|null, activeRoadmap:RoadmapSummary\|null, totals:{tasks,total,completed,inProgress,notStarted,percent} (`total` is an alias of `tasks`, kept for the progress-object naming used elsewhere), nextAction:{roadmapId,analysisId,taskId,skill,title,stage}\|null, skillsInProgress:[{skill,skillKey,percent}], recent:[{roadmapId,taskId,title,status,updatedAt}]}` — everything from real records; nulls/empty arrays when none. "Active roadmap" = most recently updated roadmap with open tasks |
| `GET /skill-gap/compare?a=&b=` | both must be the caller's analyses. `{comparable:Boolean, sameTarget:Boolean, warning:string\|null, a:Summary, b:Summary, scoreDelta, newlySkills:[{skill}], stillMissing:[{skill,priority}], resolvedMissing:[{skill}], needsImprovement:[{skill}], roadmap:{a:percent\|null,b:percent\|null}, notes:[string]}`. Order by `createdAt` internally (older = baseline). Different targetRole/job ⇒ `sameTarget:false` with an explicit warning and no "progress" wording; comparing different `basis` also adds a note |
| `GET /skill-gap/roadmaps` | `{count, roadmaps:[RoadmapSummary]}` newest first |
| `GET /skill-gap/roadmaps/:roadmapId` | `{roadmap: Roadmap}` |
| `PUT /skill-gap/roadmaps/:roadmapId/tasks/:taskId` | `{status?, notes?}` (at least one) → `{roadmap}`; sets/clears `startedAt`/`completedAt` (completed→in-progress/not-started reopens and clears completedAt); idempotent; notes ≤ 1000 chars |
| `PUT /skill-gap/roadmaps/:roadmapId/skills/:skillKey` | `{level: beginner\|intermediate\|advanced\|null}` → user-stated level stored in `skillLevels`; never changes the analysis score or marks anything mastered |
| `DELETE /skill-gap/roadmaps/:roadmapId` | `{message}` (analysis kept) |
| `POST /skill-gap/:id/roadmap` | `{weeklyHours?: 1-60, regenerate?: bool}` → 201 `{message, roadmap}`; if one exists and not `regenerate` → 200 `{roadmap, existing:true}`; regenerate replaces and RESETS progress (UI must confirm); needs ≥1 missing or partial skill else 422 `NOTHING_TO_LEARN`; AI via `aiLimiter`; AI output validated, nothing saved on failure |
| `GET /skill-gap/:id/roadmap` | `{roadmap}` or 404 `{code:'NO_ROADMAP'}` |
| `GET /skill-gap/:id/programs` | `{count, programs:[{program:{_id,slug,title,provider,level,duration,url,skills}, matchedSkills:[string], enrollment:{status}\|null}]}` — real Career Programs matched to the analysis's missing/partial skills via synonym keys; empty list when none (no fakes) |


**Concurrency (roadmap generation).** At most one generation runs per analysis at a time. The lock is an atomic update of `roadmapLock` on the analysis document (owner token; locks older than 3 minutes are treated as stale and taken over), so it holds across several server processes. A concurrent request waits (up to 2 minutes) and then returns the holder's roadmap as `200 {existing:true}`: no second Gemini call, no duplicate roadmap, existing progress untouched. For `regenerate:true`, a roadmap written after the request arrived counts as already regenerated, so simultaneous regenerations reset progress once. If the holder fails (AI error), a waiting request retries itself. If a live holder outlasts the wait, the response is `409 {code:'ROADMAP_BUSY'}` with no AI call. A waiter never releases a lock it does not own. The unique (user, analysis) index remains the last line of defence.

`RoadmapSummary` = `{_id, analysis, title, targetRole, weeklyHours, progress:{total,completed,inProgress,notStarted,percent}, createdAt, updatedAt}`.
`Roadmap` = RoadmapSummary + `{estimateNote, totalEstimatedHours, remainingEstimatedHours, stages:[{id,order,title,goal,progress, tasks:[Task]}], skills:[{skillKey,skill,level|null,progress:{total,completed,percent}}]}`; `Task` as in the model. All progress derived from statuses at read time; `percent = round(completed/total*100)`.

Roadmap generation: deterministic skeleton (ordering by priority and a prerequisite-aware order, stages built from the actual gaps, 1–6 tasks/stage, hour estimates bounded per task (2–40h) and scaled realistically, program resources from the catalogue only) + AI-written objective/activity/exercise/criteria text, validated (every task skill must be in the analysis' missing/partial set, no invented URLs/providers: `resource` is always taken from the DB, never from AI). Stage names are chosen from the gaps (e.g. Foundation, Core role skills, Practical application, Job readiness), not forced.

## 7. Frontend contract (Agent 1)

Route `/skill-gap-analysis` (lead registers it; page is the default export of `pages/SkillGapAnalysis.jsx`). Query params: `?job=<jobId>` starts a resume-based analysis preselecting the job; `?analysis=<id>` opens a saved analysis; `?tab=analyze|history|progress`. Uses `axiosClient` only; existing `GET /resumes`, `GET /auth/me`, `GET /auth/roles` (check actual route), `useAllJobs`. Sections: intro, method chooser (resume / manual), forms, results, roadmap, resources, history (+ compare), progress. Must follow tokens in `index.css`, light + dark, mobile/tablet/desktop, honest empty/loading/error states (AI errors shown verbatim from `message`; never fake results). Page title in the top bar is not an h1; page has one h1.

## 8. Test conventions

Backend unit tests with `node:test` and stubbed AI (`deps` injection or `generateJSON` stub); API tests follow `tests/profile/profile.test.js` (disposable local mongod via env var, child server, own DB dropped afterwards, local only). Scripts: `npm test` (AI + pure-logic suites, no database), `test:skillgap` (`SKILLGAP_TEST_MONGO`), `test:roadmap` (`ROADMAP_TEST_MONGO`, plus `ROADMAP_MP_TEST_MONGO` for the multi-process lock tests, which spawn real `server.js` processes). All database tests refuse non-local URIs and use their own dropped database.

**Test-only hooks (all gated on `NODE_ENV === 'test'`, covered by tests that prove they are inert otherwise):** `GEMINI_TEST_FIXTURE=<json file>` makes `config/gemini.js` read its answer from a file (`response`, `responseText`, `error`, optional `delayMs` and `failFirstCalls`) and count calls in `<file>.calls`; `ROADMAP_LOCK_STALE_MS` / `ROADMAP_LOCK_MAX_WAIT_MS` shorten the lock timing. `_setRawGenerate`, `_setDeps`, `_setSleep` and `_setMaxWait` are programmatic test helpers, not reachable over HTTP.

**One Summary contract:** `utils/skillgap/dto.js` `toSummary` and `utils/roadmap/summary.js` `summarize` both build the analysis Summary; a test asserts they return identical objects (list, overview and compare).
