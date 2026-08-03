## Step 1: Data Modeling

## What I was trying to do
Figure out what entities the AI Career Platform needs to store, and how they connect to each other, before writing any code.

## My first attempt
User: name, password, email, user job profile, user resume, user seeking role
Login: username, password
Sign up: username, password, email
User profile
Jobs: search, filters, save to jobs
Resume analyzer: AI integration, user resume, analysis reports
Job matching: skill gap, % match with JD
Cover letter generator: generate company-specific cover letter
Application tracker: track applications
Referrals

## What was wrong with it
- Mixed up actions (Login, Signup) with actual entities — those are operations on User, not separate things to store
- Resume and Analysis reports were listed as fields on User, but they needed to be their own entities since a user can have multiple resumes/analyses
- SavedJob wasn't modeled as its own connector between User and Job

## Final decision
- User: name, email, password, role, seekingRole, isReferrer, currentCompany, currentCompanyRole, createdAt
- Resume: belongs to User; fileUrl, uploadedAt
- Job: title, company, city, JD, experienceLevel, postedAt
- Application: belongs to User + Job; status, appliedAt
- SavedJob: belongs to User + Job; savedAt
- ResumeAnalysis: belongs to User + Resume + Job (optional); matchPercentage, missingSkills[], strengths[], suggestions[], analyzedAt
- CoverLetter: belongs to User + Job + Resume; generatedText, createdAt
- Referral: seeker (User), referrer (User), message, status, createdAt

## Why
- Resume and ResumeAnalysis needed to be separate entities because a user can have multiple resumes and multiple analyses over time
- SavedJob and Application both needed to be separate "join" entities since they represent a relationship between two other entities, not a property of either one alone
- Referral needed two User references (seeker + referrer) since it connects two different people, not just a user and a job

## What I learned
- An entity is anything the app needs to remember on its own — if it has its own fields and exists independently, it's an entity, not a field on something else
- When two entities are connected (like User saving a Job, or applying to one), that connection usually needs its own join entity
- Actions like Login/Signup are operations performed on an entity, not entities themselves