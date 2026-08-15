# Step 7: Application Tracker

## What I was trying to do
Let a user track jobs they've applied to, with a status that can be updated over time (applied → interviewing → offer/rejected).

## My first attempt
- Built Application model referencing User and Job by ObjectId, with a status field (enum: applied, interviewing, rejected, offer), defaulting to 'applied'
- applyToJob controller: check for existing application first, then create
- getApplications controller: fetch all applications for a user, populate('job') for full job details
- updateApplicationStatus controller: update just the status field on an existing application by its own _id

## What was wrong with it
No major bugs this time — followed the same model → controller → routes → test pattern as SavedJob, so it went smoothly. Only friction was losing track of a generated application _id between tests and needing to regenerate test data (userId, jobId, then application _id) to retest the status update.

## Final decision
- Application stores references to User + Job (not duplicated data), plus its own status field
- Duplicate-application prevention via findOne() check, same pattern as SavedJob
- Status updates use findByIdAndUpdate with runValidators: true, so the enum restriction still applies on updates, not just on creation

## Why
- A separate status field (rather than deleting/recreating applications) lets the same application record evolve over time, which matches how job applications actually work in real life
- runValidators: true matters because Mongoose skips schema validation on updates by default — without it, someone could set status to an invalid value and the enum restriction wouldn't catch it

## What I learned
- Always copy IDs (like a newly created document's _id) into a safe scratch note immediately after a POST/create response, before running further tests that depend on it — easy to lose track of otherwise
- Features that follow an already-established pattern (model → controller → routes → test) go noticeably faster and with fewer bugs than the first time you build that pattern