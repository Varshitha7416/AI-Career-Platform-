# Step 5: Job Discovery

## What I was trying to do
Let users create, search/filter, update, and delete job listings — full CRUD on the Job entity.

## My first attempt
- Built Job model: title, company, city, jobDescription, experienceLevel (enum: fresher/experienced), yearsRequired, postedBy (ObjectId ref to User)
- createJob controller to add new jobs
- getJobs controller with query-param based filtering (title, city, experienceLevel) using $regex for partial case-insensitive matches
- updateJob and deleteJob controllers using findByIdAndUpdate / findByIdAndDelete

## What was wrong with it
- First test of experienceLevel with a value like "2 year experience" failed validation, since the schema only allows 'fresher' or 'experienced' as enum values — years belong in the separate yearsRequired field instead

## Final decision
- Kept experienceLevel as a strict two-value enum (fresher/experienced) and yearsRequired as a separate numeric field, rather than one free-text field
- Search/filter built dynamically — only adding filter conditions for query params actually provided, so /api/jobs with no params returns everything
- Used $regex with case-insensitive option so partial searches (e.g. "hyder") still match full values ("Hyderabad")
- postedBy references User via ObjectId, not a plain text name, so job postings stay linked to a real account

## Why
- Splitting category (experienceLevel) from a specific number (yearsRequired) keeps validation strict while still capturing detail — a free-text field would've allowed inconsistent data like "2 yrs", "two years", etc.
- Referencing users by ObjectId instead of copying their name into every job keeps a single source of truth, same reasoning as the User reference used elsewhere

## What I learned
- Enum validation errors are the schema doing its job, not a bug — the fix is to send valid data, not loosen the schema
- Query params (req.query) are the right tool for optional filters on a GET request, versus req.body which is for data being sent to create/update something