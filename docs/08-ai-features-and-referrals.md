# Step 8: AI Resume Analyzer, Cover Letter Generator, and Referral System

## What I was trying to do
Build the final three planned backend features: an AI resume analyzer (with optional job-specific skill gap matching), an AI cover letter generator, and a referral system connecting job seekers with employees willing to refer them.

## My first attempt

**AI Resume Analyzer**
- Resume model: stores extracted resume text (not raw files) plus a fileName
- ResumeAnalysis model: references user + resume + optional job; stores matchPercentage, missingSkills, strengths, suggestions
- analyzeResumeController sends a prompt to Gemini asking for strict JSON output, strips markdown code fences from the response, then JSON.parse()s it before saving
- Prompt changes conditionally depending on whether a specific job was provided (general resume feedback vs job-specific match %)

**AI Cover Letter Generator**
- CoverLetter model: references user + job + resume (all required, since a cover letter always needs both)
- Controller sends resume text + job description to Gemini, asks for plain text output (no JSON needed, since the letter itself is the final output)

**Referral System**
- Added isReferrer and currentCompany fields to User
- Referral model: seeker (User ref) + referrer (User ref) + message + status (enum: requested/accepted/declined/referred)
- findReferrers searches users by isReferrer + company name (regex, case-insensitive)
- requestReferral creates a referral; updateReferralStatus updates just the status field

## What was wrong with it
- @google/generative-ai wasn't installed in the main project's server folder (only in the earlier standalone test folder) — caused a "Cannot find module" error
- GEMINI_API_KEY was missing from the main project's .env (only existed in the test folder's .env) — caused an "API key not valid" error from Gemini
- Referral status update returned 200 OK with updatedAt changing, but status stayed "requested" — root cause was an empty Postman request body (raw + JSON were selected correctly, but nothing was actually typed into the body editor), so req.body.status was undefined and Mongoose silently skipped updating that field
- Along the way, needed a second test user (marked isReferrer: true with a currentCompany) since a referral requires two different people

## Final decision
- Kept resume storage as extracted text only, never raw files, since AI models need text and databases aren't suited for large binary blobs
- Used strict "respond only in valid JSON" prompts for the resume analyzer so output could be reliably parsed and stored in structured fields
- Used a plain-text prompt for the cover letter generator, since no further parsing was needed
- Referral model uses two separate User references (seeker, referrer) rather than one, since it connects two different people
- Referrer discovery is company-name based only for v1 — no job-specific referrer tagging or matching algorithm

## Why
- Structured JSON prompts turn free-form AI text into usable, queryable data — critical for feature like matchPercentage or missingSkills, which the frontend will need to render individually, not as one blob of text
- Package installs and .env values from an earlier throwaway test folder don't carry over to the real project — each Node project has its own dependencies and environment variables
- An empty request body is a silent failure mode in Express — no error is thrown, but destructured fields come back undefined and get skipped by Mongoose during updates, which is why it's important to check the actual request payload, not just the response, when something updates partially

## What I learned
- When debugging "why didn't this field update," check three things in order: is the request body actually populated, is the field name spelled/cased exactly right, and is the update using runValidators if enum rules matter
- AI integrations are more fragile than plain CRUD — model responses can be wrapped in unexpected formatting (like markdown fences), so defensive cleanup before parsing is worth doing by default
- Reusing a working pattern (Gemini call → prompt → parse/save) across two different AI features (resume analysis and cover letters) was much faster the second time, since the integration shape was already understood