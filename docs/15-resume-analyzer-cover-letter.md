# 15 — Resume Analyzer + Cover Letter Generator

Contract and ownership: `14-resume-cover-letter-contract.md`.

## What was built
- Multi-resume library (PDF/DOCX/TXT, 5 MB, text only stored), rename / default / delete (history kept via snapshots).
- General and job-specific AI analysis with structured, evidence-backed output (matching / partial / missing skills, relevant experience, gaps, qualification match, strengths, structure feedback, suggestions) saved to history, with compare.
- Cover letters: generate (CareerNest job or manual job), edit + save, versions + restore, regenerate (409 `HAS_EDITS` unless forced), history, PDF/DOCX download of the saved text.
- `NEEDS_INFO` (422): the AI asks questions instead of inventing facts.

## Anti-fabrication (enforced in code, `server/utils/ai/`)
Untrusted text is nonce-delimited; evidence quotes must be verbatim in the resume; synonym-aware skill matching; suggestions or free text with unsupported numbers/skills/certs/employers become "needs your verification" or are dropped; scores are capped by verified content; letters are grounding-checked with one strict retry, then warnings.

## Limits and lessons
- AI behaviour verified only with stubbed model output (`npm test`, 51 tests); live Gemini was not exercised (quota). Run a manual live check when quota is back.
- PDF export uses a built-in font: non-Latin-1 text becomes `?` (₹ becomes `INR`). DOCX is unaffected.
- Grounding checks are heuristic.
- pdf-parse v2 injects `-- N of M --` page markers; they are stripped on upload and on read.
- QA caught a dead manual-job Generate button that API tests could not see — browser testing is needed.
