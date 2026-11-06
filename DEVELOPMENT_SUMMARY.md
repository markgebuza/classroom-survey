# Development Summary — Classroom Survey Web App

**Live app:** https://classroom-survey-cky.pages.dev · **Repository:** https://github.com/markgebuza/classroom-survey

## 1. How I used the specification documents to guide the AI agent

Five Markdown documents were the source of truth: the specification, `TODO.md`, `DATABASE.md`, `API.md` and `UI.md`. Before any code, I gave the agent a rules file (`.cursor/rules/project.mdc`) with these rules:
- Follow these documents.
- Record every deviation in `DECISIONS.md`.
- Change the schema only through migration files.
- Check a TODO item only when it is implemented *and* verified.

My first prompt asked for a review with no code. The agent found 16 gaps, for example `/s/:surveyId` vs. `/s/:slug`, RPC functions that were described but never defined, and sign-ups that had to be disabled. Each gap became a numbered decision (D1–D23). After that I worked through the TODO phases one prompt at a time.

## 2. What the AI agent generated

**The agent generated:**
- All of the code: `src/`, the two SQL migrations, `supabase/tests/rls_checks.sql`, `scripts/rls-probe.ts` and 125 automated tests.
- The documentation drafts.
- Most of the setup and testing, at my request: applying the migrations to Supabase, creating the users, running the browser tests in Chrome against the live database, and the production checks.

**I did:**
- Wrote the prompts and reviewed the decisions.
- Created the Supabase and Cloudflare Pages projects.
- Typed the password on the live site.
- Did the checks that need a real device: phone QR scan, a second browser, the projector.

## 3. Database configuration

Supabase Postgres holds five tables:
- `surveys` has many `questions` and many `responses`.
- Each question has many `choices`.
- Each response has many `answers`, and each answer links to a question and the chosen choice.

Deleting a survey removes everything that belongs to it. A unique index allows only one active survey, and another blocks a second submission from the same browser.

Row Level Security is enabled on every table:
- Students (`anon`) can only read active surveys with their questions and choices.
- The instructor (`authenticated`) has full access, so public sign-ups are disabled.
- Students submit only through the `submit_survey_response` function. It checks the survey is active and every answer is valid, then saves the response and answers in one transaction.
- Activating, closing, duplicating and computing results are also database functions.

## 4. How the frontend communicates with the database

There is no custom server. The React app uses `@supabase/supabase-js` with the public anon key:
- **Students** read the active survey by its link (`/s/<slug>`) and submit through the function.
- **The instructor** logs in with email and password. Every request then carries the instructor's login token, so the database applies the instructor permissions.

Security does not depend on the frontend: `scripts/rls-probe.ts` shows that someone holding only the public key still cannot read responses or change surveys.

## 5. A problem and how it was resolved

When I opened the CSV export in Excel, the answers "1/2" and "1/3" appeared as the dates "2-Jan" and "3-Jan". Excel guesses the type of plain cells. The export now writes cells like that as `="1/2"`, which Excel and Google Sheets both show as typed. Regression tests and a re-check in Excel confirmed the fix (D23).

Two more examples:
- My first Cloudflare project was accidentally a Workers project, which rejected the SPA redirect file. Recreating it as a Pages project fixed it.
- An early security probe reported "pass" when the server was unreachable. It now has to reach the server before any check can pass.

All problems are listed in `AI_HISTORY.md`.

## 6. Deployment

The app is a static Vite build on Cloudflare Pages, connected to GitHub. Every push to `main` redeploys it. The settings:
- Build command `npm run build`, output folder `dist`.
- Environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `NODE_VERSION=22`.
- `public/_redirects` sends every path to `index.html`, so links like `/s/<slug>` work.

The database schema comes only from the migration files. On 2026-11-05 the production checks passed: login, activation with a QR code pointing to the live URL, a logged-out student submission, duplicate blocking, and correct results (`TESTING.md` row 35).

## 7. What I learned about full-stack development

Most of my prior experience had been in building and running on my own machine, but this experience helped me learn more about the deployment process for full-stack apps that incorporate databases and authentication. There were more considerations for cybersecurity in this situation as well, such as the use of RLS. However, deploying was not as scary or difficult as it had been for me in the past.
