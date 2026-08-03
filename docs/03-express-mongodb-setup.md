# Step 3: Express Server + MongoDB Atlas Connection

## What I was trying to do
Set up the actual backend server (not a test folder) with a proper folder structure, and connect it to MongoDB Atlas.

## My first attempt
- Created server/ with models, routes, controllers, middleware, config folders
- Installed express, mongoose, dotenv, cors, nodemon
- Wrote a basic server.js with just an Express app and a test route
- Added MONGO_URI to .env and wrote config/db.js to connect via mongoose

## What was wrong with it
- First run of node server.js after adding MongoDB connection gave: "bad auth : Authentication failed"
- Cause: likely a special character in the database user's password wasn't being read correctly in the connection string

## Final decision
- Regenerated the Atlas database user password using Atlas's auto-generate option (avoids special character issues)
- Copied a fresh connection string directly from Atlas (Connect → Drivers) instead of manually editing the old one
- Kept MONGO_URI and PORT in .env, loaded via dotenv in server.js
- Separated DB connection logic into config/db.js instead of putting it directly in server.js

## Why
- Keeping the Mongo connection logic in its own file (config/db.js) instead of server.js keeps server.js focused on just starting the app — easier to read and maintain as the project grows
- .env stores secrets (Mongo URI, port) separately from code, same reasoning as the Gemini API key earlier
- Auto-generated passwords avoid encoding issues with special characters in connection strings

## What I learned
- "bad auth" errors in MongoDB almost always mean a credentials mismatch, not a code bug — check the connection string first
- Separating concerns (server setup vs DB connection vs routes) makes debugging much easier than one big file
- Always copy connection strings directly from the source (Atlas dashboard) rather than manually editing pieces of an old one