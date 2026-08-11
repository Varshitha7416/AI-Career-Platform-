# Step 6: Saved Jobs & Application Tracker

## What I was trying to do
Build two related features: letting users bookmark jobs (SavedJob), and letting users track jobs they've applied to with a status that updates over time (Application).

## My first attempt
- SavedJob model: references User + Job by ObjectId; saveJob checks for duplicates before creating; getSavedJobs uses .populate('job') to return full job details
- Application model: same reference pattern, plus a status field (enum: applied/interviewing/rejected/offer, default 'applied'); applyToJob checks duplicates; getApplications populates job details; updateApplicationStatus updates just the status by the application's own _id

## What was wrong with it
- No major bugs — both features followed the already-established model → controller → routes → test pattern from Auth and Job Discovery, so they went smoothly
- Only friction: lost track of a generated application _id between Postman tests and had to regenerate userId, jobId, and reapply to get a fresh one to test the status update

## Final decision
- Both features store only references (user, job), never duplicated job data, keeping a single source of truth
- Both use a findOne() duplicate check before create() to prevent saving/applying to the same job twice
- Application's updateApplicationStatus uses runValidators: true so the status enum restriction still applies on updates, not just on creation

## Why
- A separate status field lets one Application record evolve over time (applied → interviewing → offer/rejected) instead of needing to delete and recreate records
- runValidators: true matters because Mongoose skips schema validation on updates by default — without it, an invalid status could slip through
- .populate() is the standard way to pull related data across two collections when using ObjectId references, avoiding extra manual lookups

## What I learned
- Once a pattern (model → controller → routes → test) is established, repeating it for a new feature is noticeably faster and less error-prone
- Always copy a newly created document's _id into a scratch note immediately after a POST response — easy to lose track of otherwise, especially when a later step (like updating status) depends on it
- Always run git status before committing, and Ctrl+S save files in VS Code before git add — otherwise a file can silently not exist even though you wrote its content