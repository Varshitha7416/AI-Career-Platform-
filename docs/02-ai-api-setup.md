# Step 2: AI API Setup (Gemini)

## What I was trying to do
Confirm I could connect to an AI API (Gemini) and get a working response, before integrating it into the actual project features (resume analyzer, cover letter generator, skill gap analyzer).

## My first attempt
- Signed up for a free API key on Google AI Studio
- Set up a standalone test folder with @google/generative-ai and dotenv
- Stored the key in .env, called generateContent() with model: 'gemini-1.5-flash'

## What was wrong with it
- gemini-1.5-flash returned a 404 — model no longer supported
- Switched to gemini-2.5-flash — also 404'd, since it's closed to new API keys
- Learned that Google frequently deprecates/rotates model names, so a model name from an old tutorial isn't guaranteed to work

## Final decision
- Used model: 'gemini-3.6-flash' — Google's current stable flash model
- Kept the API key in .env, excluded from git via .gitignore

## Why
- .env keeps the API key out of GitHub history — hardcoding it in a committed file would expose it permanently, even after deletion, since old commits still contain it
- Picking a current, actively-supported model matters more than following an old tutorial exactly — model availability changes over time

## What I learned
- Always verify the AI API's current model names before assuming a tutorial's model name still works
- Test AI API integration in isolation first (a throwaway test folder) before wiring it into the real project — makes debugging much easier
- Secrets (API keys) always go in .env + .gitignore, never directly in code