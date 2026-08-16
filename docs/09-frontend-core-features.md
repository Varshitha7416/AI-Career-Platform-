# Step 9: Frontend Core Features (React)

## What I was trying to do
Build the React frontend: project setup, auth pages, protected routes, and UI for all 5 remaining features (Job Discovery, Dashboard, Resume Analyzer, Cover Letter Generator, Referrals), connecting each to the already-built backend.

## My first attempt
- Set up Vite + React + Tailwind CSS, custom indigo/blue theme via @theme in index.css
- Built Login/Signup pages with axios calls to /api/auth, JWT stored in localStorage
- Built ProtectedRoute component to guard pages behind a valid token
- Built Job Discovery (list, search/filter, save), Dashboard (saved jobs + applications with Promise.all), Resume Upload + AI Analyzer (multer + pdf-parse for real PDF upload), Cover Letter Generator, and Referrals (search by company, request referral) — each following the same fetch/display/action pattern

## What was wrong with it
- CORS error on first login attempt: backend had no cors() middleware, and when added, app.use(cors()) was written before const app = express() existed
- pdf-parse v2 changed its API from a plain function to a PDFParse class — old code (const pdfParse = require('pdf-parse')) failed with "pdfParse is not a function"; fixed by importing { PDFParse } and using new PDFParse({ data }).getText()
- Several React syntax errors from copy-paste mistakes (stray bracket, duplicated function declarations) caused blank pages or Vite parse errors
- Realized the app felt like disconnected standalone pages rather than a cohesive site — no shared navigation, no home page, Login dropped straight into the Jobs page

## Final decision
- Centralized API calls through a shared axiosClient instead of repeating base URLs
- Used FormData + multipart/form-data specifically for the resume upload request, since file uploads can't go through plain JSON
- Started a Navbar + Layout + Home page structure to fix the disconnected-pages problem, but paused this mid-way to first nail down a clearer plan for overall site navigation and design before continuing

## Why
- Middleware order in Express (app must exist before app.use(cors())) is a recurring gotcha worth remembering
- Debugging via on-page error output (temporarily printing the raw response/error in the UI) was more effective than DevTools Network tab, which was confusing to navigate — a good fallback debugging technique
- A portfolio project needs to feel like one connected product, not a set of isolated demo pages — worth pausing feature work to get navigation/UX right rather than bolting it on at the end

## What I learned
- Package APIs can change between major versions in ways that break old tutorial code silently (no import error, just a runtime "is not a function") — checking the installed version's actual docs beats assuming an older pattern still applies
- When debugging feels harder via browser DevTools than it should, printing raw responses directly on the page is a valid, simpler alternative
- It's worth stepping back to plan structure (navigation, layout, flow) explicitly rather than continuing to add pages ad hoc, once the disconnected feeling becomes noticeable