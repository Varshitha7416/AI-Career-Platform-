# Step 4: Authentication — Signup & Login

## What I was trying to do
Build a working signup and login system: hash passwords securely on signup, verify them on login, and issue a JWT token so the user stays authenticated without re-sending credentials every time.

## My first attempt
- Built User model with fields for name, email, password, role, seekingRole, isReferrer, currentCompany, currentCompanyRole
- Built signup controller: check for existing email, hash password with bcrypt, save user
- Wired signup as a POST route under /api/auth/signup
- Added login controller: find user by email, compare password with bcrypt.compare, sign a JWT with jsonwebtoken

## What was wrong with it
- Initial middleware order bug: had auth routes registered before express.json(), which would have made req.body undefined in controllers
- While adding the login function, accidentally pasted it (and its jwt import) three times into authController.js, causing "Identifier 'jwt' has already been declared" — server wouldn't start
- Hit a MongoDB "Could not connect to any servers" error mid-session — turned out to be an IP whitelist issue in Atlas Network Access, not a code problem

## Final decision
- express.json() registered before any routes, so req.body is always available in controllers
- authController.js kept to one clean copy of signup + login, single import of bcrypt/jwt/User at the top
- JWT_SECRET stored in .env, token signed with 7-day expiry
- Atlas Network Access set to allow current IP (temporarily open during development)

## Why
- Middleware order matters in Express — anything routes depend on must be registered before the routes themselves
- bcrypt.compare() (not manual re-hashing + ===) is required to verify passwords, because each hash has a different random salt baked in; compare() extracts that salt from the stored hash before re-hashing the entered password
- JWT lets the server verify a logged-in user on future requests without hitting the database or re-checking credentials every time

## What I learned
- Copy-pasting code carefully matters — duplicate imports/functions cause real, sometimes confusing errors (the stack trace pointed at authRoutes.js, but the actual bug was in authController.js, since that's the file being loaded)
- "bad auth" and "could not connect" MongoDB errors are almost always credentials or network/IP whitelist issues, not application code bugs
- Testing both the success path (correct login) and the failure path (wrong password) is necessary to actually trust a security feature works