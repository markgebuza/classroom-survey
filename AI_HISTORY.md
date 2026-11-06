# AI History

Log of every prompt given to the AI coding agent while building the Classroom Survey Web App, what the agent did, which files changed, and the problems found and fixed. The first three sections summarise the whole build; the detailed session log follows.

## Overview

The app was built in one working day (2026-11-02) by giving an AI coding agent a fixed sequence of prompts. The five specification documents were the source of truth; every gap or deviation was written to `DECISIONS.md` (D1–D22). Manual steps (Supabase project, users, running SQL in the dashboard, Cloudflare, GitHub, phone/projector tests, screenshots) are done by me, the student, and are listed as pending where they are not done yet.

| Session | Prompt | Result |
|---|---|---|
| 1 | 0 — Project rules | `.cursor/rules/project.mdc` with 7 rules; `TODO (1).md` renamed to `TODO.md` |
| 2 | 1 — Spec review, gaps, plan | Architecture + data flows; 16 decisions (D1–D16); all 164 pre-checked TODO items unchecked (no code existed) |
| 3 | 2 — Scaffold (Phase 1) | Vite + React + TS + Tailwind + Router + supabase-js + Recharts + qrcode, ESLint/Prettier, routes, `_redirects` |
| 4 | 3 — Database (Phase 2) | Schema + RLS migration, RPC migration (6 functions), `rls_checks.sql`; verified on PostgreSQL (PGlite), 23/23 PASS |
| 5 | 4 — Auth (Phase 3) | AuthProvider, login page, ProtectedRoute, logout |
| 6 | 5 — Dashboard (Phases 4, 10, 12) | Typed API, cards with status actions, filters, accessible confirm dialog, duplicate |
| 7 | 6 — Editor (Phase 5) | Full editor, delete-and-reinsert save, locking rules, unsaved-changes guard |
| 8 | 7 — Present (Phase 6) | QR, URL, 5 s polling count, close/download/fullscreen |
| 9 | 8 — Student page (Phases 7–8) | `/s/:slug`, required answers, token, duplicate handling |
| 10 | 9 — Results (Phases 9–10) | `get_survey_results`, bar charts + numeric tables |
| 11 | 10 — CSV (Phase 11) | RFC 4180, BOM, injection guard, summary section |
| 12 | 11 — Polish & a11y (Phase 13) | Layouts, skip link, code splitting, measured WCAG contrast |
| 13 | 12 — Testing & security (Phase 14) | `TESTING.md`, `scripts/rls-probe.ts`, secret scan |
| 14 | 13 — README + GitHub (Phase 15) | `README.md`, git commands (not run by the agent) |
| 15 | 15 — Final audit | Rubric checklist, not-found error fix, this summary |
| 16 | 16 — Development summary | `DEVELOPMENT_SUMMARY.md` draft |
| — | 14 — Production verification | **Not done yet** — needs the deployed site |

## Problems & Fixes

Every failure or bug met during the build, in order. Details are in the session entries.

| # | Session | Problem | Root cause | Fix |
|---|---|---|---|---|
| 1 | 2 | `TODO.md` had every item checked although no code existed | Template file shipped pre-checked | Unchecked all items; only verified items are checked since |
| 2 | 3 | Current `create-vite` template uses oxlint and TypeScript 7 | `typescript-eslint` supports only TS < 6.1 | Used ESLint as required and pinned TypeScript 6.0.3 |
| 3 | 4 | `rls_checks.sql` ended with `select …; rollback;` | Supabase SQL Editor shows only the last statement's output | Results in a session temp table; script cleans up, commits, then selects |
| 4 | 4 | `rls_checks.sql` 22/23 on first run | Test data bug: seeded response had no answer row | Seeded an answer; 23/23 PASS |
| 5 | 5 | Multi-file Bash heredoc failed to parse; nothing written | Shell quoting in a very long command | Wrote files individually with the editor tool |
| 6 | 5 | 6/9 auth tests failed: "multiple elements with role heading" | Vitest globals off → Testing Library could not auto-register `cleanup` | `afterEach(cleanup)` in `src/test/setup.ts` |
| 7 | 6 | 2 dashboard tests failed | Test bugs (regex role query; ambiguous button) | Fixed queries (`within(dialog)`) |
| 8 | 7 | `useBlocker` needed for unsaved-changes warning | Only works with a data router | Migrated to `createBrowserRouter`; routes in `src/routes.tsx` |
| 9 | 7 | Possible self-blocking redirect after first save | "Allow navigation" flag reset synchronously after `navigate()` | Reset the flag when the route id changes |
| 10 | 8 | Production bundle never grew (~260 kB) | Without env vars `supabase.ts` throws at import, bundler drops the app | Build-time warning in `vite.config.ts`; env vars must be set before building (D19) |
| 11 | 9 | `crypto.randomUUID` missing on phones using `http://<LAN IP>` | Only available in secure contexts | `getRandomValues` fallback + test |
| 12 | 9 | 4/10 student tests failed | In-memory "submitted" set survives between tests in one module | Fresh survey id per test (app behaviour correct) |
| 13 | 11 | Wrong expectation in a CSV injection test; a helper script aborted half-way; a `\r\n` became real line breaks | Test/edit-script mistakes | Fixed the test; re-applied edits one by one |
| 14 | 12 | Bundle over 500 kB, students downloading Recharts | No code splitting | `React.lazy` for instructor pages (Results chunk loads on demand) |
| 15 | 13 | `rls-probe.ts` reported PASS when the server was unreachable | Any error was treated as "permission denied" | Preflight call + only `42501`/0 rows count as PASS (D22) |
| 16 | 15 | Bad survey id in an instructor URL showed "Something went wrong" | `PGRST116` / `22P02` not mapped | Mapped to "Survey not found." + 16 error-mapping tests |

## Testing summary

- **Automated:** 112 Vitest tests in 13 files, all passing (`npm test -- --run`); `npm run lint` 0 problems; `npm run build` passes. See `TESTING.md` §1.
- **Database:** migrations and `supabase/tests/rls_checks.sql` executed on PostgreSQL 18 (PGlite) with Supabase-style roles — 23/23 PASS, plus extra checks for every function. Still to do in the real Supabase project.
- **Accessibility:** WCAG contrast measured from the compiled CSS (22/22 pairs pass AA); keyboard behaviour of dialogs and skip link covered by tests.
- **Manual (pending, by me):** the 35-row plan in `TESTING.md` §3, `rls_checks.sql` + `rls-probe.ts` in Supabase, phone/projector/two-browser checks, screenshots 1–3, production verification (Prompt 14).

---

## Session 1 — 2026-11-02 — Prompt 0: Project rules

**What I asked:** Create `.cursor/rules/project.mdc` (alwaysApply) with the seven project rules (specs are the source of truth, stack, no secrets, migrations only, TODO/AI_HISTORY upkeep, friendly errors, build+lint after each change).

**What the agent did:**
- Renamed `TODO (1).md` to `TODO.md` (the rules and later prompts refer to `TODO.md`).
- Created `.cursor/rules/project.mdc` with the seven rules.

**Files changed:** `.cursor/rules/project.mdc` (new), `TODO.md` (renamed).

**Problems / fixes:** None.

---

## Session 2 — 2026-11-02 — Prompt 1: Spec review, gaps, plan (no code)

**What I asked:** Review the five spec files, explain the architecture and data flows, list inconsistencies/missing decisions with recommended resolutions (write them to `DECISIONS.md`), give a phased plan, audit `TODO.md`, create `AI_HISTORY.md`.

**What the agent did:**
- Architecture summary:
  - **Frontend:** React + TypeScript SPA built by Vite, served as static files from Cloudflare Pages (`_redirects` sends every path to `index.html`).
  - **Backend:** Supabase — Auth (email/password for instructors), PostgREST (auto REST API over tables, called through `supabase-js`), and Postgres RPC functions for operations that must be atomic or must run with elevated rights.
  - **Database:** five Postgres tables protected by Row Level Security. `anon` (students) may only read active surveys and call `submit_survey_response`; `authenticated` (instructor) has full access.
  - **(a) Instructor creates a survey:** login → JWT in browser → editor inserts `surveys`, `questions`, `choices` via PostgREST as `authenticated` → `rpc('activate_survey')` closes any active survey, creates the slug, sets `active`.
  - **(b) Student submits:** QR → `/s/:slug` → anon PostgREST select of the active survey + nested questions/choices → `rpc('submit_survey_response')` (SECURITY DEFINER) validates and inserts `responses` + `answers` in one transaction.
  - **(c) Instructor views results:** `rpc('get_survey_results')` aggregates counts/percentages in SQL and returns JSON; Recharts renders it; CSV export reads raw rows as `authenticated`.
- Found and resolved 16 gaps/inconsistencies (D1–D16 in `DECISIONS.md`), including `/s/:surveyId` vs `/s/:slug`, undefined RPCs, Present-page count under RLS, disabled sign-ups, required questions and T/F storage, editing active/closed surveys with responses, and the date filter.
- Phased plan: Phase 1 scaffold → Phase 2 migrations + RLS + RPCs → Phase 3 auth → Phase 4 dashboard (+ Phase 10 filters, Phase 12 duplicate) → Phase 5 editor → Phase 6 present page → Phases 7–8 student page → Phases 9–10 results → Phase 11 CSV → Phase 13 polish → Phase 14 testing → Phase 15 README/deploy.
- Audited `TODO.md`: every item was pre-checked although the repo had no code. Unchecked all 164 items.

**Files changed:** `DECISIONS.md` (new), `AI_HISTORY.md` (new), `TODO.md`.

**Problems / fixes:** `TODO.md` claimed work that did not exist (all boxes checked) — fixed by unchecking everything.

---

## Session 3 — 2026-11-02 — Prompt 2: Scaffold (TODO Phase 1)

**What I asked:** Implement Phase 1: Vite + React + TS in the repo root, Tailwind, React Router, supabase-js, Recharts, qrcode, folder structure, `src/lib/supabase.ts`, `.env.example`, `.gitignore`, ESLint + Prettier, placeholder routes from UI.md §1, `public/_redirects`, landing page.

**What the agent did:**
- Generated a `create-vite` react-ts template in a scratch folder and copied the tsconfig files into the repo root (the spec `.md` files stay in the root).
- Installed exact-pinned dependencies: React 19, react-router-dom 7, supabase-js 2, recharts 3, qrcode 1.5 (+ `@types/qrcode`), Tailwind 4 (`@tailwindcss/vite`), ESLint 10 + typescript-eslint + react-hooks/react-refresh plugins, Prettier, Vitest + Testing Library + jsdom, tsx.
- Created `src/lib/supabase.ts` (single client; throws a clear error when env vars are missing), `.env.example` (names only), `.gitignore` (`.env`, `.env.local`, `.env.*.local`, `node_modules`, `dist`), `public/_redirects` (`/* /index.html 200`).
- Created all UI.md §1 routes with placeholder pages, including `/s/:slug`, plus a 404 page; landing page matches the UI.md §2 wireframe.
- Added `lint`, `format`, `test` scripts.

**Files changed:** `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.env.example`, `index.html`, `public/_redirects`, `public/favicon.svg`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`, `src/lib/supabase.ts`, `src/test/setup.ts`, `src/pages/*.tsx`, `TODO.md`.

**Verification:** `npm run build` passed; `npm run lint` passed (0 problems); `dist/_redirects` present.

**Problems / fixes:**
- The current `create-vite` template ships `oxlint` and TypeScript 7, but the prompt requires ESLint and `typescript-eslint` only supports TypeScript `<6.1`. Fixed by using ESLint and pinning TypeScript 6.0.3.
- `npm audit` reports a moderate advisory (minimatch ReDoS) inside the ESLint dev toolchain. Dev-only, not shipped to the browser; the suggested "fix" downgrades typescript-eslint, so left as is.
- Phase 15 "Configure SPA routing" is implemented (`_redirects`) but left unchecked until verified on Cloudflare Pages.

---

## Session 4 — 2026-11-02 — Prompt 3: Database migration (TODO Phase 2)

**What I asked:** Create `<timestamp>_initial_schema.sql` implementing DATABASE.md (tables, FKs, checks, indexes, `updated_at` trigger, one-active-survey index, duplicate-response index, RLS + anon/authenticated policies) and `<timestamp>_rpc_functions.sql` with `activate_survey`, `close_survey`, `submit_survey_response`, `get_survey_results`, `duplicate_survey` (explicit GRANT/REVOKE). Also `supabase/tests/rls_checks.sql`, and explain every policy/function in DECISIONS.md.

**What the agent did:**
- Wrote `supabase/migrations/20261102000100_initial_schema.sql` (wrapped in a transaction, re-runnable with IF NOT EXISTS / DROP … IF EXISTS). Added unique `(survey_id, position)` and `(question_id, position)` (safe with the delete-and-reinsert save strategy, D8). Revoked Supabase's default anon table privileges and granted back only SELECT on surveys/questions/choices.
- Wrote `supabase/migrations/20261102000200_rpc_functions.sql` with the five requested functions plus `get_survey_status_by_slug` (D10). Each function revokes EXECUTE from public/anon/authenticated before granting.
- Wrote `supabase/tests/rls_checks.sql`: creates test data in a transaction, uses `set local role anon;` / `set local role authenticated;`, records 23 PASS/FAIL checks in a temp table, cleans up, commits, then selects the results.
- No local Postgres was installed, so the agent ran the SQL in **PGlite** (PostgreSQL 18 compiled to WebAssembly) in a scratch folder, recreating Supabase's `anon`/`authenticated` roles and default privileges.
- Added "Policies and functions explained" to `DECISIONS.md`.

**Files changed:** `supabase/migrations/20261102000100_initial_schema.sql`, `supabase/migrations/20261102000200_rpc_functions.sql`, `supabase/tests/rls_checks.sql` (all new), `DECISIONS.md`, `TODO.md`.

**Verification:** Both migrations applied cleanly, and applied cleanly a second time (idempotent). `rls_checks.sql`: 23/23 PASS after one fix (below). Extra ad-hoc checks: zero-response results return 0%, activation without questions → `SURVEY_HAS_NO_QUESTIONS`, re-activation keeps the slug, bad UUID → `INVALID_QUESTION`, blank token → `INVALID_TOKEN`, `close_survey` idempotent, draft close → `SURVEY_NOT_ACTIVE`, `duplicate_survey` copies 1 question + 2 choices as draft with null slug, second active survey → `only_one_active_survey` violation, `updated_at` trigger fires, bogus status → CHECK violation, duplicate position → unique violation, anon cannot execute `duplicate_survey`.

**Problems / fixes:**
- First draft of `rls_checks.sql` ended with `select …; rollback;`. The Supabase SQL Editor only shows the output of the last statement, so the results would have been hidden. Fixed: results go into a session temp table; the script deletes its own test data, re-activates the previously active survey, commits, and the final statement is the SELECT.
- The first PGlite run gave 22/23: "authenticated gets results (True = 50%)" failed because the seeded "existing-token" response had no answer row (test-data bug, not a function bug). Fixed by seeding an answer for that response; 23/23 PASS.
- An ad-hoc `duplicate_survey` check first showed 0 copied questions: the check queried the new rows in the same statement that called the function (same snapshot). Re-checked with separate statements: correct.
- Not verified against the real Supabase project (none exists yet): the four Phase 2 "Verify …" items stay unchecked until the student runs the migrations and `rls_checks.sql` in Supabase.

---

## Session 5 — 2026-11-02 — Prompt 4: Auth (TODO Phase 3)

**What I asked:** AuthProvider (getSession + onAuthStateChange) exposing session/user/loading/signIn/signOut; `/login` per UI.md §3 with pending state and friendly errors, redirect to `/dashboard` or the originally requested page; `ProtectedRoute` around `/dashboard` and `/surveys/*` with a loading state; `/` and `/s/:slug` public; email + Logout in the dashboard header; no sign-up page.

**What the agent did:**
- `src/lib/auth.ts` (context + `useAuth`), `src/components/AuthProvider.tsx`, `src/components/ProtectedRoute.tsx` (layout route with `<Outlet/>`; shows "Checking your login..." until the session resolves, then redirects with `state.from`).
- `src/pages/LoginPage.tsx`: labeled Email/Password, button disabled + "Logging in..." while pending, friendly "Incorrect email or password.", returns to `state.from` or `/dashboard`; already-logged-in users are redirected.
- `src/components/InstructorLayout.tsx` (header with "Signed in as <email>" + Logout), `LoadingState`, `ErrorMessage`, shared button/input styles in `index.css`.
- `src/lib/errors.ts`: single mapping from RPC codes / auth / network errors to UI.md messages (D15). `src/lib/types.ts`: shared types matching API.md.
- Tests: `src/test/auth.test.tsx` with a fake Supabase client (`src/test/supabaseMock.ts`).

**Files changed:** `src/App.tsx`, `src/index.css`, `src/lib/{auth,errors,types}.ts`, `src/components/{AuthProvider,ProtectedRoute,InstructorLayout,LoadingState,ErrorMessage}.tsx`, `src/pages/{LoginPage,DashboardPage,NotFoundPage}.tsx`, `src/test/*`, `TODO.md`.

**Verification:** `npm test -- --run`: 9/9 passed (5 protected routes redirect to login, landing page public, bad-credentials message, return to requested page after login, email shown + logout). `npm run lint`: 0 problems. `npm run build`: passed.

**Problems / fixes:**
- A long Bash heredoc that wrote several source files failed to parse (`unexpected EOF while looking for matching '`), so nothing was written. Switched to writing each file with the editor tool.
- First test run: 6/9 failed with "Found multiple elements with the role heading". Root cause: Vitest globals are disabled, so Testing Library could not register its automatic `afterEach(cleanup)` and renders from earlier tests stayed in the DOM. Fixed by calling `cleanup()` in `src/test/setup.ts`; 9/9 pass.
- "Connect login to Supabase Auth" is left unchecked: the code calls `signInWithPassword`, but it was only tested against a fake client. Needs a manual login against the real project.

---

## Session 6 — 2026-11-02 — Prompt 5: Dashboard (TODO Phase 4, Phase 10 filters, Phase 12)

**What I asked:** Typed API module (`listSurveys`, `getSurvey`, `createSurvey`, `updateSurvey`, `deleteSurvey`, `archiveSurvey`, `activateSurvey`, `closeSurvey`, `duplicateSurvey`), shared types, dashboard cards with text status badges and status-dependent actions, search + status + created-date filters, empty states, accessible confirm dialog (stronger delete warning with response count), activate-with-confirm when another survey is active, duplicate → editor, disabled buttons and inline errors.

**What the agent did:**
- `src/lib/api/surveys.ts` (plus `countResponses`); `listSurveys` embeds `responses(count)` (D17). `getSurvey` loads nested questions + choices and sorts them by position.
- `src/lib/filters.ts` — pure `filterSurveys` (title search, status, inclusive local created-date range), `formatDate`.
- `src/components/ConfirmDialog.tsx` — `role="dialog"`, `aria-modal`, labelled/described, focus moves to Cancel, Tab is trapped, Escape cancels, focus returns to the trigger.
- `src/components/StatusBadge.tsx` — text label + border/colour (not colour-only).
- `src/pages/DashboardPage.tsx` — cards (title, "Status:" badge, created date, response count), exact action sets per status, filters with "Showing X of Y" + Clear filters, UI.md §10 empty states, confirm dialogs for Delete/Archive/Close/Activate-replace, friendly inline errors.
- Tests: `src/lib/filters.test.ts` (6) and `src/test/dashboard.test.tsx` (10).

**Files changed:** `src/lib/api/surveys.ts`, `src/lib/filters.ts`, `src/lib/filters.test.ts`, `src/components/{ConfirmDialog,StatusBadge}.tsx`, `src/pages/DashboardPage.tsx`, `src/test/dashboard.test.tsx`, `DECISIONS.md`, `TODO.md`.

**Verification:** `npm test -- --run`: 25/25 passed. `npm run lint`: 0 problems. `npm run build`: passed.

**Problems / fixes:**
- Lint warning (react-refresh) because `StatusBadge.tsx` exported a constant next to the component — made the constant private.
- Two new tests failed on the first run, both test bugs: `getAllByRole(/button|link/)` (Testing Library does not accept a regex role) and an ambiguous "Activate" query that matched both the card button and the dialog button. Fixed by querying `a, button` elements and scoping to the dialog with `within`.
- "Load surveys from Supabase" is left unchecked: the query is only exercised against a mocked API module and needs a check against the real project.

---

## Session 7 — 2026-11-02 — Prompt 6: Survey editor (TODO Phase 5)

**What I asked:** Editor at `/surveys/new` and `/surveys/:id/edit`: title/description, add/delete/reorder questions and choices (keyboard accessible), Multiple Choice / True-False types (T/F read-only True/False, confirm before discarding choices), validation next to fields, Save Draft with a documented strategy, Activate = save → `activate_survey` → present page, active surveys read-only, surveys with responses protected, Saving.../Saved feedback, unsaved-changes warning.

**What the agent did:**
- `src/lib/editor.ts`: draft model, `validateDraft`, `moveItem`, `changeType`, `hasCustomChoices`, `draftSnapshot` (dirty check).
- `src/lib/api/surveys.ts`: `replaceSurveyQuestions` (delete-and-reinsert with client-generated question UUIDs, D12) and `getOtherActiveSurvey`.
- `src/pages/SurveyEditorPage.tsx`: full editor; active/archived surveys read-only with "Close this survey to edit it."; surveys with responses: questions locked, title/description still editable (D6); focus management after add/move/delete/validation; `role="status"` save feedback; confirm dialogs for delete question, type switch, activate-replace, leave-without-saving.
- Switched from `<BrowserRouter>` to `createBrowserRouter` + `RouterProvider` (routes moved to `src/routes.tsx`) because `useBlocker` only works with a data router; updated the auth tests accordingly.
- Tests: `src/lib/editor.test.ts` (9) and `src/test/editor.test.tsx` (10), including the "2 MC + 1 T/F, reorder, save" flow and checking the exact payload sent to `replaceSurveyQuestions`.

**Files changed:** `src/lib/editor.ts`, `src/lib/editor.test.ts`, `src/lib/api/surveys.ts`, `src/lib/types.ts`, `src/pages/SurveyEditorPage.tsx`, `src/routes.tsx` (new), `src/App.tsx`, `src/test/auth.test.tsx`, `src/test/editor.test.tsx`, `DECISIONS.md` (D18), `TODO.md`.

**Verification:** `npm test -- --run`: 44/44 passed. `npm run lint`: 0 problems. `npm run build`: passed.

**Problems / fixes:**
- Needed in-app navigation blocking; `useBlocker` throws outside a data router. Fixed by migrating to `createBrowserRouter` (no behaviour change for other routes; auth tests re-run green).
- First version reset the "allow navigation" flag right after `navigate()`; because a data-router navigation is not guaranteed to have evaluated blockers synchronously, this could block the editor's own redirect after the first save. Fixed by resetting the flag in an effect when the route `id` changes.
- Lint flagged an unused `eslint-disable` comment; removed.
- "Save a survey as Draft" and "Load an existing survey for editing" stay unchecked: tested against a mocked API only. Manual check: create 2 MC + 1 T/F questions, save, refresh, and inspect the `surveys`/`questions`/`choices` tables in Supabase (Screenshot 2).

---

## Session 8 — 2026-11-02 — Prompt 7: Activation & Present page (TODO Phase 6)

**What I asked:** `/surveys/:id/present` per UI.md §6: public URL from `VITE_PUBLIC_SITE_URL ?? window.location.origin`, large high-contrast QR (error correction M), readable monospace URL + Copy, response count polled every 5 s with the "No responses yet…" message, View Results / Close Survey (confirm) / Download QR (`<slug>-qr.png`) / Fullscreen, projector-friendly, and a not-active state with an activate button.

**What the agent did:**
- `src/lib/urls.ts` (`publicSurveyUrl`, `qrFileName`); added `VITE_PUBLIC_SITE_URL` to `.env.example` with a comment.
- `src/pages/PresentPage.tsx`: QR via `qrcode.toDataURL` shown as an `<img>` with descriptive alt text, URL in large monospace, Copy link with status text, polling with `setInterval` (cleared on unmount / when not active), close-with-confirm, activate (with "This will close …" confirm), Fullscreen toggle via the Fullscreen API, no header.
- `vite.config.ts`: warns when building without the Supabase env vars (see problem below).
- Tests: `src/test/present.test.tsx` (8): URL helper (3), QR/URL/download/empty state, 5-second polling with fake timers, close flow, activate flow, copy link.
- Checked the real `qrcode` package with the same options in Node: produced a valid PNG data URL.

**Files changed:** `src/lib/urls.ts`, `src/pages/PresentPage.tsx`, `src/test/present.test.tsx`, `.env.example`, `vite.config.ts`, `DECISIONS.md` (D19), `TODO.md`.

**Verification:** `npm test -- --run`: 52/52 passed. `npm run lint`: 0 problems. `npm run build`: passed (with the new env warning, since there is no `.env.local`).

**Problems / fixes:**
- **Found:** the production bundle stayed at ~260 kB no matter how much code was added. Root cause: with no `.env.local`, `import.meta.env.VITE_SUPABASE_URL` is inlined as `undefined`, so `src/lib/supabase.ts` throws unconditionally and the bundler drops all app code after it. A build with placeholder values produced the full 590 kB bundle containing every page. Fix: `vite.config.ts` now prints a clear warning; README/DECISIONS (D19) say the Cloudflare env vars must be set before building. Follow-up: the full bundle is over Vite's 500 kB warning — to be addressed with route-level code splitting in the polish phase.
- Changed `??` to `||` for `VITE_PUBLIC_SITE_URL` so the empty value in `.env.example` falls back to the origin (documented in D19).
- Not verified: scanning the QR with a phone, the actual PNG download, fullscreen on a projector (manual). Phase 13 "Improve QR-code presentation for classroom projection" stays unchecked until checked on a projector.

---

## Session 9 — 2026-11-02 — Prompt 8: Student page + duplicate protection (TODO Phases 7–8)

**What I asked:** `/s/:slug` (not id): load by slug with nested questions/choices; "Survey not found." vs closed message (decide on `get_survey_status_by_slug`); mobile-first single column, no header, full-width ≥44 px radio labels, fieldset/legend; all questions required with highlight + scroll to first; `crypto.randomUUID()` token in localStorage with try/catch + memory fallback; remember submitted surveys locally; submit via RPC with error mapping; no raw errors; disabled "Submitting..." and double-click protection; thank-you screen.

**What the agent did:**
- `src/lib/api/student.ts` (`getPublicSurvey`, `getSurveyStatusBySlug`, `submitSurveyResponse`), `src/lib/token.ts` (token + submitted-survey memory), `src/lib/answers.ts` (missing-answer helpers).
- `src/pages/StudentSurveyPage.tsx`: states loading / load error (retry) / not found / closed / already submitted / form / success; fieldset + legend per question; radio labels `min-h-12` full width; unanswered questions get a red border + "Please choose an answer." and the first one is scrolled to and focused.
- Kept the `get_survey_status_by_slug` function from Prompt 3 and documented the behaviour (D20).
- Tests: `src/lib/token.test.ts` (6) and `src/test/student.test.tsx` (10).

**Files changed:** `src/lib/api/student.ts`, `src/lib/token.ts`, `src/lib/token.test.ts`, `src/lib/answers.ts`, `src/pages/StudentSurveyPage.tsx`, `src/test/student.test.tsx`, `DECISIONS.md` (D20), `TODO.md`.

**Verification:** `npm test -- --run`: 68/68 passed. `npm run lint`: 0 problems. `npm run build`: passed.

**Problems / fixes:**
- Noticed while writing the token code that `crypto.randomUUID()` is undefined on plain-HTTP non-localhost pages (e.g. a phone opening `http://192.168.x.x:5173`). Added a `getRandomValues` fallback and a test for it.
- First test run: 4/10 student tests failed ("Unable to find role radio"). Root cause: `token.ts` keeps submitted ids in a module-level in-memory set (intended fallback for blocked storage), which survives between tests in the same file, so after the success test the same survey id was treated as already submitted. Fixed the tests to use a fresh survey id per test (the app behaviour is correct).
- Left unchecked until tested against Supabase: "Load the requested active survey", "Store response and answers in Supabase" (RPC verified only in PGlite), "Make the entire experience mobile friendly" (needs a real phone, Screenshot 3).

---

## Session 10 — 2026-11-02 — Prompt 9: Results + historical (TODO Phases 9–10)

**What I asked:** `/surveys/:id/results` via `rpc('get_survey_results')`: header with title, status badge, "N responses"; per question a horizontal Recharts bar chart plus visible count + percentage text for every choice; "No answers" for empty questions; Refresh / Export CSV / Present QR (active only) / Back to Dashboard; works for active, closed, archived; loading and error states; Vitest tests for percentage/aggregation helpers.

**What the agent did:**
- `src/lib/api/surveys.ts`: `getSurveyResults`.
- `src/lib/results.ts`: `percentage` (same rounding as the SQL), `formatPercent` (always 1 decimal), `pluralize`, `truncate`, `chartRows` (chart labels + "45 (86.5%)" display text).
- `src/components/ResultsChart.tsx`: horizontal `BarChart` (layout vertical), labels at the bar ends, tooltip with the full choice text; `aria-hidden` because the same numbers are in a real table.
- `src/pages/ResultsPage.tsx`: loads survey + results in parallel, header, per-question card with chart and a Choice / Count / Percent table, "No answers", "No responses yet.", Refresh with "Updated <time>", Present QR only when active.
- `src/test/setup.ts`: `ResizeObserver` stub for Recharts in jsdom.
- Tests: `src/lib/results.test.ts` (6) and `src/test/results.test.tsx` (4).
- The Export CSV button is added in the next prompt together with `src/lib/csv.ts`.

**Files changed:** `src/lib/api/surveys.ts`, `src/lib/results.ts`, `src/lib/results.test.ts`, `src/components/ResultsChart.tsx`, `src/pages/ResultsPage.tsx`, `src/test/results.test.tsx`, `src/test/setup.ts`, `TODO.md`.

**Verification:** `npm test -- --run`: 78/78 passed. `npm run lint`: 0 problems. `npm run build`: passed.

**Problems / fixes:**
- None failed. Limitation: jsdom gives the chart container zero size, so the tests verify the text/table output, not the drawn bars. "Add bar charts using Recharts" stays unchecked until the chart is looked at in a browser with real data. "Preserve all historical response data" also stays unchecked until verified in the real database (nothing in the app deletes responses except an explicit, confirmed Delete).

---

## Session 11 — 2026-11-02 — Prompt 10: CSV export (TODO Phase 11)

**What I asked:** `src/lib/csv.ts` per API.md §12: fetch survey/questions/choices/responses/answers; header `response_id,submitted_at,<question texts>`; one row per response with chosen choice text; survey metadata (pick a layout that opens cleanly); RFC 4180 escaping, UTF-8 BOM, formula-injection guard; ISO timestamps; file name `<slug>-results-<yyyy-mm-dd>.csv`; Vitest tests.

**What the agent did:**
- `src/lib/csv.ts`: `escapeCell`, `toCsv`, `slugify`, `csvFileName`, `buildResultsCsv` (header + rows + blank line + "Survey summary" section, D11), `downloadCsv` (Blob with BOM).
- `src/lib/api/surveys.ts`: `listResponsesWithAnswers` (nested `answers(...)`, paged by 1000).
- Results page: "Export CSV" button with "Exporting..." state and friendly error.
- Tests: `src/lib/csv.test.ts` (14: quoting, CRLF, 6 injection cases, slug/file name, layout, empty survey) and an export test in `src/test/results.test.tsx` (checks BOM bytes `EF BB BF`, file name, content).
- Extra check: generated a CSV with commas, quotes, newlines, `=1+1`, accents and an emoji, and parsed it with Python's `csv` module — every cell round-tripped exactly; summary rows intact.

**Files changed:** `src/lib/csv.ts`, `src/lib/csv.test.ts`, `src/lib/api/surveys.ts`, `src/pages/ResultsPage.tsx`, `src/test/results.test.tsx`, `DECISIONS.md` (D21), `TODO.md`.

**Verification:** `npm test -- --run`: 93/93 passed. `npm run lint`: 0 problems. `npm run build`: passed.

**Problems / fixes:**
- One injection test expectation was wrong (expected a tab-containing cell to be quoted; RFC 4180 does not require quoting tabs). Fixed the test, not the code.
- A Python helper script used to apply several edits stopped at its first failed assertion, so none of its later edits were applied; re-did them one by one with the editor tool and re-ran the full suite.
- A test string with `\r\n` was written with real line breaks by the helper script, breaking the TypeScript parse (`Unterminated string literal`); fixed by hand.
- "Test export with spreadsheet applications" stays unchecked: needs opening a real export in Excel and Google Sheets (the Python parse is only a proxy).

---

## Session 12 — 2026-11-02 — Prompt 11: UI polish & accessibility (TODO Phase 13)

**What I asked:** Consistent instructor layout, minimal layout for student/present pages; audit loading/empty/error states (API.md §13–14); keyboard access, visible focus, dialogs trap focus/Escape/return focus; labels, headings, aria-live; WCAG AA contrast on badges/buttons; layouts at 375/768/1440 px; give me a verified vs. manual checklist.

**What the agent did:**
- New `src/components/MinimalLayout.tsx` (no header/nav) used by the student page and the Present page; `InstructorLayout` used by Dashboard, Editor, Results.
- Skip link ("Skip to main content") as the first focusable element on instructor pages; `<main id="main">`.
- Page titles (`document.title`) per page, e.g. "Dashboard – Classroom Survey", student page uses the survey title.
- Every student screen now has exactly one `<h1>` (notices such as "Survey not found." are the h1). "Submitting..." is announced through a `role="status"` region instead of `aria-live` on the button.
- Route-level code splitting: Dashboard, Editor, Present and Results load with `React.lazy` inside a `<Suspense>` in `ProtectedRoute`, so students do not download Recharts/qrcode (Results chunk 355 kB → only for instructors). ESLint's react-refresh rule turned off for `src/routes.tsx` only (route table, not a component module).
- Contrast: wrote a script that reads the real OKLCH colour values from the built CSS, converts them to sRGB and computes WCAG ratios for 22 foreground/background pairs (buttons, hover states, badges, errors, notices, focus ring, input borders). All pass: lowest text pair 6.42:1 (white on red-700), focus ring 6.82:1, input border 4.77:1.
- Ran `npm run format` (Prettier) over `src`.
- Tests: `src/test/a11y.test.tsx` (3) — dialog is labelled/described, Tab and Shift+Tab are trapped, Escape ignored while pending, skip link first in tab order, one h1, page title.

**Checklist — verified by me (tests/scripts):**
- [x] Loading state on every async page: login check, dashboard, editor, present, results, student (tests assert "Loading results...", "Checking your login...", etc.).
- [x] Empty states: no surveys, no search matches, no responses (present + results), "No answers".
- [x] Error states with friendly text and retry: dashboard, editor load/save, present, results, student load/submit; raw DB text never shown (student test asserts "foreign key" is not displayed).
- [x] Mutation buttons disabled while pending: login, dashboard actions, editor save/activate, present close/activate, student submit (double-click test), export.
- [x] Dialogs: focus moves in, Tab/Shift+Tab trapped, Escape closes, focus returns to the trigger (dashboard + a11y tests).
- [x] Inputs have connected `<label>`s (tests find every field by label); radios grouped with fieldset/legend; validation errors linked with `aria-describedby` + `aria-invalid`.
- [x] Live regions: editor "Saving.../Saved/Unsaved changes", present count, copy status, student submitting, results count.
- [x] Status badges show text, not only colour; charts have a numeric table next to them.
- [x] WCAG AA contrast for all badge/button/text pairs (script above).
- [x] Focus indicator: global `:focus-visible` 3 px blue outline (6.82:1 against white).

**Checklist — the student must verify manually:**
- [ ] Tab through every page with only the keyboard (landing, login, dashboard incl. filters and every card action, editor incl. reorder buttons, present, results, student page) and confirm the focus ring is always visible.
- [ ] Use the skip link; open/close each dialog with the keyboard.
- [ ] Browser responsive mode at 375 px, 768 px and 1440 px: dashboard cards and action buttons wrap, editor stays one column, results chart readable at 375 px (choice labels are truncated in the chart, full text in the table), student page single column with large tap targets.
- [ ] Real phone: scan the QR, answer, submit, see "Thank you!"; reopen the link → already-submitted message.
- [ ] Projector (or large screen from the back of a room): QR scannable, URL readable, Fullscreen works.
- [ ] Optional: run Lighthouse / axe DevTools accessibility audit on each page.

**Files changed:** `src/components/{MinimalLayout,InstructorLayout,ProtectedRoute}.tsx`, `src/routes.tsx`, `src/pages/{StudentSurveyPage,PresentPage,LoginPage}.tsx`, `src/test/a11y.test.tsx`, `eslint.config.js`, Prettier formatting across `src`, `TODO.md`.

**Verification:** `npm test -- --run`: 96/96 passed. `npm run lint`: 0 problems. `npm run build`: passed. Build with placeholder env vars: main chunk 542 kB (158 kB gzip, React + Router + supabase-js), Results chunk 355 kB (Recharts) loaded only on demand; Vite still prints its 500 kB chunk-size warning for the main chunk.

**Problems / fixes:**
- Lazy page declarations produced 4 react-refresh lint warnings in `src/routes.tsx`; disabled that rule for that single file.
- Could not test real viewports, keyboard-only use or a screen reader here (no browser with live data) — listed above as manual. TODO items "Improve mobile responsiveness", "Improve QR-code presentation for classroom projection" and "Test accessibility and keyboard navigation" stay unchecked until those manual checks are done.

---

## Session 13 — 2026-11-02 — Prompt 12: End-to-end testing & security check (TODO Phase 14)

**What I asked:** (1) `TESTING.md` manual test plan table (Test, Steps, Expected, Result, Notes) covering Phase 14 and the database verification list; (2) automated tests for login redirect, student form validation and the CSV helper; (3) `scripts/rls-probe.ts` using only the anon key (select responses/answers, insert/update surveys, select drafts, call `get_survey_results`, submit twice → `DUPLICATE_RESPONSE`), printing PASS/FAIL; (4) confirm no service-role key in the repo and `.env*` ignored.

**What the agent did:**
- `TESTING.md`: automated test inventory (96 tests / 12 files), database permission tests, and a 35-row manual plan including "creating a survey stores it", "adding questions creates records", "submissions persist", "results come from the DB", "data survives refresh". Result/Notes columns left blank for the student.
- Automated tests already existed from earlier prompts (Vitest + RTL chosen over Playwright, D16): login redirect for all 5 protected routes (`auth.test.tsx`), student validation (`student.test.tsx`), CSV helper (`csv.test.ts`).
- `scripts/rls-probe.ts`: 9 checks + optional `--submit` double-submission check; also checks delete and `activate_survey`; loads `.env.local` with `process.loadEnvFile`; exit code 1 on any FAIL, 2 on configuration problems.
- Secret scan (grep for `service_role`, `service-role`, `eyJ…`, `sbp_`, `SUPABASE_SERVICE`, `password=`) across the repo excluding `node_modules`/`dist`: only matches are the warning sentences in `.cursor/rules/project.mdc`, `.env.example` and the probe's header comment. No `.env`/`.env.local` exists; `.gitignore` covers `.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.development` (`.env.example` is intentionally not ignored).

**Files changed:** `TESTING.md` (new), `scripts/rls-probe.ts` (new), `DECISIONS.md` (D22), `TODO.md`.

**Verification:** `npm test -- --run`: 96/96 passed. `npm run lint`: 0 problems. `npm run build`: passed. `npx tsc -b` type-checks the probe (included in `tsconfig.node.json`). Probe without env vars → clear message, exit 2. Probe against an unreachable URL → "Cannot run the probe", exit 2. **Not run against a live database** (none exists yet).

**Problems / fixes:**
- **Bug found in my own probe:** the first version, pointed at an unreachable URL, printed `PASS` for 6 of the 9 checks ("rejected: TypeError: fetch failed"), because any error was treated as "access denied". An invalid API key (HTTP 401) would have produced the same false passes. Fix: a preflight call that anon must be allowed to make, and only `42501 permission denied` or zero rows count as PASS (D22). Re-ran: exits 2 with a clear message.
- The double-submission check writes a real response, so it was put behind `--submit` (documented in TESTING.md and D22).
- Phase 14 items stay unchecked except "Test results calculations" (unit tests + SQL results verified in PGlite) and "Test CSV export" (unit tests + export test + Python parse); the rest need the live app.

---

## Session 14 — 2026-11-02 — Prompt 13: README + GitHub (TODO Phase 15, part 1)

**What I asked:** README with overview, features, Mermaid architecture diagram, schema summary with relationships and RLS, local setup, Cloudflare Pages deployment, Testing link, Grader access (credentials via HuskyCT only), links to all docs; final secret scan; confirm `.gitignore`; give me the exact git commands to create and push `classroom-survey` (do not run them).

**What the agent did:**
- Wrote `README.md`: features, Mermaid flowchart (browser ↔ Cloudflare Pages SPA ↔ Supabase Auth / PostgREST / RPC ↔ Postgres), Mermaid ER diagram + table summary, RLS explanation, 7-step local setup (migrations in order, `rls_checks.sql`, disable sign-ups, create instructor), Cloudflare Pages steps (build `npm run build`, output `dist`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL`, `NODE_VERSION`, Supabase URL Configuration), Testing, Grader access, documentation links, project structure.
- Added `"engines": { "node": ">=22.12" }` to `package.json` and a `.node-version` file (`22`) because Vite 8 requires Node `^20.19 || >=22.12` and Cloudflare's build image reads `.node-version`.
- Did not invent a license: README says to add a LICENSE file (the spec asks for open source).
- Final secret scan: no `service_role` key, no JWT-looking strings (`eyJ…`), no `sbp_` tokens, no hard-coded passwords. The only password-like strings are fake values (`'secret'`, `'wrong'`) in `src/test/auth.test.tsx`. Only `.env.example` exists; `.gitignore` ignores `.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.development`, `node_modules`, `dist`.
- **No git commands were run.** Note: this folder currently sits inside a larger git repository (the user's home folder), so `git init` must be run inside `survey_app` to give the project its own repository.

**Git commands for the student (run from the `survey_app` folder):**
```bash
git init
git add .
git status                      # confirm .env.local, node_modules/ and dist/ are NOT listed
git commit -m "Initial commit: Classroom Survey web app"
git branch -M main
# Option A – GitHub CLI (creates the repo and pushes):
gh repo create classroom-survey --public --source=. --remote=origin --push
# Option B – create an empty repo named classroom-survey on github.com (no README), then:
git remote add origin https://github.com/<your-username>/classroom-survey.git
git push -u origin main
```

**Files changed:** `README.md` (new), `package.json`, `.node-version` (new).

**Verification:** `npm test -- --run`: 96/96. `npm run lint`: 0 problems. `npm run build`: passed.

**Problems / fixes:** None. "Push the project to GitHub" and the other Phase 15 items stay unchecked until the student pushes and deploys.

---

## Session 15 — 2026-11-02 — Prompt 15: Final audit against the rubric

**What I asked:** Audit the repo against the assignment requirements, report gaps as a checklist with file references, fix code/doc gaps, list what needs me, and make AI_HISTORY.md a clean summary suitable for Deliverable D.

**Audit checklist**

*Required in repo*
- [x] Source code — `src/` (pages, components, lib), `scripts/rls-probe.ts`
- [x] The 5 spec docs — `Classroom_Survey_Web_App_Specification.md`, `TODO.md`, `DATABASE.md`, `API.md`, `UI.md`
- [x] Updated `TODO.md` with only verified items checked (111 checked; unchecked ones need the live DB, a browser/phone, or deployment)
- [x] Migration/schema files — `supabase/migrations/20261102000100_initial_schema.sql`, `supabase/migrations/20261102000200_rpc_functions.sql`, `supabase/tests/rls_checks.sql`
- [x] README with setup + deployment — `README.md`
- [x] No committed secrets — secret scan clean; `.gitignore` covers `.env*` (Session 14)

*Instructor*
- [x] Log in — `src/pages/LoginPage.tsx`, `src/components/AuthProvider.tsx`, `src/components/ProtectedRoute.tsx`
- [x] Create survey, MC + T/F questions, edit drafts — `src/pages/SurveyEditorPage.tsx`, `src/lib/editor.ts`, `replaceSurveyQuestions` in `src/lib/api/surveys.ts`
- [x] List surveys — `src/pages/DashboardPage.tsx`
- [x] Activate / close — `activate_survey` / `close_survey` in the RPC migration; dashboard, editor, present page
- [x] Results with counts + percentages — `get_survey_results`, `src/pages/ResultsPage.tsx`, `src/components/ResultsChart.tsx`
- [x] CSV export — `src/lib/csv.ts`, Export CSV on the results page
- [x] Only one active survey — `only_one_active_survey` index + `activate_survey`

*Student*
- [x] URL/QR access — `/s/:slug` (`src/routes.tsx`), QR in `src/pages/PresentPage.tsx`
- [x] View questions, select, submit, confirmation, no login — `src/pages/StudentSurveyPage.tsx`
- [x] Duplicate-submission protection — `src/lib/token.ts`, `responses_unique_student_per_survey`, `DUPLICATE_RESPONSE` in `submit_survey_response`

*Present page*
- [x] Title, QR, URL, response count, projector-friendly — `src/pages/PresentPage.tsx`, `src/components/MinimalLayout.tsx`

*Database*
- [x] 5 tables with PK/FK relationships — initial schema migration
- [x] RLS preventing students from modifying surveys or reading results — policies + revoked anon privileges; `rls_checks.sql` (23/23 PASS on PGlite)

*Docs*
- [x] `DECISIONS.md` (D1–D22 + policy/function explanations)
- [x] `AI_HISTORY.md` (overview, problems & fixes, testing summary, session log)
- [ ] `TESTING.md` **with results filled in** — automated results are filled in; the manual Result column must be filled in by me after testing

**Gaps found and fixed in this session**
- Opening an instructor page with an unknown or malformed survey id showed "Something went wrong. Please try again." — `.single()` returns PostgREST `PGRST116`, a malformed UUID returns `22P02`. Both now map to "Survey not found." (`src/lib/errors.ts`), with a new table-driven test file `src/lib/errors.test.ts` (16 cases).
- `TESTING.md` test counts updated (112 tests / 13 files).
- Added the Overview, Problems & Fixes and Testing summary sections at the top of this file (session entries unchanged).

**Needs me (in order)**
1. Create the Supabase project; put URL + anon key in `.env.local`; disable public sign-ups; create the instructor and grader users.
2. Run both migrations in order in the SQL Editor, then `supabase/tests/rls_checks.sql` (all PASS — Screenshot 1); run `npx tsx scripts/rls-probe.ts` (and `--submit` on a test survey).
3. `npm run dev`: create a survey with 2 MC + 1 T/F question, save, refresh, check the tables (Screenshot 2).
4. Phone test via QR: submit, duplicate, closed survey (Screenshot 3); keyboard-only pass; 375/768/1440 px; two browsers; projector.
5. Fill in the Result column of `TESTING.md`; check off the remaining TODO items I verified.
6. `git init` inside `survey_app`, commit, push to GitHub (`classroom-survey`); create the Cloudflare Pages site with the env vars; set Supabase Site URL.
7. Prompt 14: production verification. Fill in `[MY REFLECTION]` placeholders in `DEVELOPMENT_SUMMARY.md`. Send grader credentials via HuskyCT.

**Files changed:** `src/lib/errors.ts`, `src/lib/errors.test.ts` (new), `TESTING.md`, `AI_HISTORY.md`.

**Verification:** `npm test -- --run`: 112/112 passed. `npm run lint`: 0 problems. `npm run build`: passed.

**Problems / fixes:** the not-found mapping gap above. Nothing else blocked.

---

## Session 16 — 2026-11-02 — Prompt 16: Draft the development summary (Deliverable C)

**What I asked:** Using AI_HISTORY.md, DECISIONS.md, TESTING.md and the code, draft `DEVELOPMENT_SUMMARY.md` (~1–2 pages, first person) with the seven required headings; leave `[MY REFLECTION]` placeholders instead of inventing personal reflection.

**What the agent did:**
- Wrote `DEVELOPMENT_SUMMARY.md` with the seven headings: spec usage, agent vs. manual work, database configuration, frontend ↔ database communication, problems (three real entries from the Problems & Fixes table), deployment, learning.
- Left `[MY REFLECTION]` placeholders for personal reflection and `[FILL IN]` placeholders for facts that only exist after my manual steps (completed manual tests, production/GitHub URLs, deployment date, Prompt 14 results). Nothing about deployment is claimed as done.

**Files changed:** `DEVELOPMENT_SUMMARY.md` (new), `AI_HISTORY.md`.

**Verification:** documentation only; `npm test -- --run` 112/112, `npm run lint` 0 problems, `npm run build` passed (final run of the session).

**Problems / fixes:** None.

---

## Session 17 — 2026-11-05 — git init inside survey_app (TODO Phase 15, part 1)

**What I asked:** "git init inside survey_app"

**What the agent did:**
- Found that the only git repo was my home folder (`C:\Users\mgebu`), so pushing from there could have uploaded `.ssh`, `.claude.json`, and other private files.
- Ran `git init -b main` inside `survey_app` so the project has its own repo.
- Confirmed with `git check-ignore` that `.gitignore` excludes `.env.local`, `node_modules`, and `dist`.
- Made no commit and set no remote; I'll do those myself.

**Files changed:** `.git/` (new), `AI_HISTORY.md`.

**Verification:** `git status` lists only project files as untracked; no `.env` files. Before this session: `npm run lint` 0 problems, `npm test -- --run` 112/112, `npm run build` passed.

**Problems / fixes:** The home-folder repo issue above. None otherwise.

---

## Session 18 — 2026-11-05 — Commit and push to GitHub (TODO Phase 15)

**What I asked:** "commit and push it to github"

**What the agent did:**
- Staged all 80 project files and scanned them for secrets (JWTs, service-role keys, GitHub tokens, real Supabase URLs). The only match was an npm package checksum. `.env.example` lists variable names only, and `.env.local` is git-ignored.
- Made the first commit on `main`.
- Created the public repo `markgebuza/classroom-survey` with `gh repo create` and pushed `main`. I chose public so the grader and Cloudflare Pages can access it.

**Files changed:** `AI_HISTORY.md` (this entry).

**Verification:** `git status` was clean after the push, and `gh repo view` confirmed the repo. Before this session: `npm run lint` 0 problems, `npm test -- --run` 112/112, `npm run build` passed.

**Problems / fixes:** None.

---

## Session 19 — 2026-11-05 — Commit TODO update (TODO Phase 15)

**What I asked:** "commit the TODO change and push"

**What the agent did:**
- Committed the checked-off "Push the project to GitHub" item in `TODO.md` (verified with `gh repo view` in Session 18), along with this entry.
- Pushed to `origin/main`.

**Files changed:** `TODO.md`, `AI_HISTORY.md`.

**Verification:** `git status` was clean and up to date with `origin/main` after the push.

**Problems / fixes:** None.

---

## Session 20 — 2026-11-05 — Supabase secret check

**What I asked:** "check for supabase secrets"

**What the agent did:**
- Searched every file in every commit, plus the working folder (ignored and untracked files included, `node_modules` excluded), for JWT keys (`eyJ…`), `sb_secret_`/`sb_publishable_` keys, `sbp_` access tokens, real `*.supabase.co` project URLs, Postgres connection strings with passwords, and `SUPABASE_*=` lines with values.
- Checked for `.env` files and for any mention of `service_role`.
- Checked that `src/lib/supabase.ts` reads the URL and key only from `import.meta.env`.

**Files changed:** `AI_HISTORY.md` (this entry).

**Verification:** No secrets found. Every match was a placeholder (`https://<project-ref>.supabase.co` in the README) or a warning sentence in the docs. `.env.example` is the only env file. Local `HEAD` and `origin/main` are the same commit (`93d481f`), so GitHub has the same content.

**Problems / fixes:** None.

---

## Session 21 — 2026-11-05 — Create .env.local

**What I asked:** "make an env local and update it with env example"

**What the agent did:**
- Copied `.env.example` to `.env.local`. It has the same comments and the three variable names (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL`), with all values empty.

**Files changed:** `.env.local` (new, git-ignored), `AI_HISTORY.md`.

**Verification:** `git check-ignore` matches `.env.local` (`.gitignore` line 8), and `git status` doesn't list it.

**Problems / fixes:** None. I still need to fill in the values from my Supabase project.

---

## Session 22 — 2026-11-05 — Review .env.example commit made on GitHub

**What I asked:** "i made a commit to env example through the website"

**What the agent did:**
- Fetched and reviewed my GitHub commit `6b16e83` ("Add Supabase URL and anon key to .env.example"). It puts the real project URL and the `sb_publishable_…` key into `.env.example` in the public repo.
- Pulled the commit (fast-forward) and copied the values into the git-ignored `.env.local` so the app can connect.

**Files changed:** `.env.local` (values filled in, git-ignored), `AI_HISTORY.md`.

**Verification:** `git status` shows only `AI_HISTORY.md` as changed; `.env.local` is still ignored.

**Problems / fixes:** The publishable key is meant to be public (it ships in the frontend bundle, and RLS protects the data), so this is not a security leak. It does break project rule 3 and the README, which both say `.env.example` lists variable names only, and a grader checking for "no committed secrets" may flag it. Open: blank the values in `.env.example` with a new commit (the key stays in git history, which is acceptable for a publishable key; rewriting history would need a force-push to main).

**Follow-up (same session):** I chose to clear the values. The agent blanked `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.example` and committed and pushed that together with these log entries. `.env.local` keeps the real values.

---

## Session 23 — 2026-11-05 — Supabase setup: sign-ups, migrations, RLS checks (TODO Phases 2 and 14)

**What I asked:** "yes" (let the agent do steps 1–3: Supabase settings, migrations, RLS checks/probe), then gave a Supabase personal access token.

**What the agent did:**
- Saved the token to `C:\Users\mgebu\supabase-token.txt` (outside the repo) and used it only through the Supabase Management API. I pasted the token into the chat, so it must be revoked when setup is finished.
- Turned off public sign-ups (`PATCH /config/auth`, `disable_signup: true`). Checked it: a sign-up request with the anon key returned 422 `signup_disabled`.
- Ran `20261102000100_initial_schema.sql` and then `20261102000200_rpc_functions.sql` through the `database/query` endpoint. The database was empty before. Afterwards it has 5 tables, 7 functions and 8 RLS policies.
- Ran `supabase/tests/rls_checks.sql`: 23/23 PASS. The script cleaned up after itself (0 surveys, responses and answers left).
- Ran `npx tsx scripts/rls-probe.ts` with the anon key only: 8 passed, 0 failed, 2 skipped (no active survey yet; the submit check needs `--submit`).
- Recorded the results in `TESTING.md` (marked "Pass (agent)") and checked off in `TODO.md`: Create a Supabase project, the four Phase 2 "Verify" items, and "Test database Row Level Security".

**Files changed:** `TODO.md`, `TESTING.md`, `AI_HISTORY.md`. Database: schema and functions applied to project `tpdwyxoazhifwhmghfma`; auth setting `disable_signup` changed.

**Verification:** rls_checks 23/23 PASS; probe 8/0/2; sign-up blocked (422).

**Problems / open issues:**
- The instructor and grader users are not created yet; waiting for the two email addresses.
- Screenshot 1 (rls_checks in the SQL Editor) still has to be taken by me. Running the script again in the SQL Editor is safe because it cleans up after itself.
- The SQL was run through the Management API instead of the SQL Editor or `supabase db push`, so the Supabase migration history table is empty. The schema still comes only from the migration files.

---

## Session 24 — 2026-11-05 — Create instructor and grader users

**What I asked:** "mgebuza31@gmail.com and grader@example.com"

**What the agent did:**
- Created two pre-confirmed Supabase Auth users with the Auth admin API: instructor `mgebuza31@gmail.com` and grader `grader@example.com`. The script fetched the admin key in memory through the Management API; the key was never printed or written to disk.
- Generated random 16-character passwords and saved both logins to `C:\Users\mgebu\survey-app-credentials.txt`, outside the repo.
- Deleted `C:\Users\mgebu\supabase-token.txt`.

**Files changed:** `AI_HISTORY.md`. Outside the repo: `survey-app-credentials.txt` created, `supabase-token.txt` deleted.

**Verification:** Both accounts logged in through the password endpoint using only the anon key (HTTP 200, session returned). Not yet tested through the app's login page, so "Connect login to Supabase Auth" stays unchecked.

**Problems / open issues:** I still need to revoke the `claude-setup` access token in Supabase (it was pasted into the chat). Changing the Supabase Site URL after deployment is now a dashboard step for me, because the agent no longer has the token.

---

## Session 25 — 2026-11-05 — rls_checks in the SQL Editor, commit

**What I asked:** "how do i run rls_checks", then "all 23 passed, commit and push"

**What the agent did:**
- Copied `supabase/tests/rls_checks.sql` to my clipboard and gave me the SQL Editor steps. I ran it myself: 23/23 PASS.
- Updated the two rls_checks rows in `TESTING.md` from "Pass (agent)" to "Pass", noting both runs.
- Committed Sessions 23–25 (`TODO.md`, `TESTING.md`, `AI_HISTORY.md`) and pushed to `origin/main`.

**Files changed:** `TESTING.md`, `AI_HISTORY.md` (plus the Session 23 changes to `TODO.md`).

**Verification:** My SQL Editor run: 23/23 PASS. `git status` was clean and matched `origin/main` after the push.

**Problems / open issues:** None.

---

## Session 26 — 2026-11-05 — Local create/save test in Chrome (TESTING.md step 4)

**What I asked:** "you do it in chrome"

**What the agent did:**
- Started `npm run dev` (port 5173) and logged in through `/login` in Chrome as the instructor (`mgebuza31@gmail.com`).
- Created "Test Survey - Fractions Check" with 2 multiple-choice questions (3 choices each) and 1 true/false question, then clicked Save Draft. The page showed "Saved" and moved to `/surveys/<id>/edit`.
- Reloaded the editor; every field came back the same.
- Queried the database through the REST API as the instructor: 1 survey (`draft`), 3 questions (positions 1–3: MC, MC, T/F), 8 choices.
- Saved a dashboard screenshot to `C:\Users\mgebu\Downloads\survey-app-screenshots\screenshot2-dashboard-draft.jpg` (outside the repo).
- Filled in `TESTING.md` rows 1, 6, 7 and 10 as "Pass (agent)" and checked off in `TODO.md`: Connect login to Supabase Auth, Load surveys from Supabase, Save a survey as Draft, Load an existing survey for editing, Test instructor login, Test survey creation.

**Files changed:** `TESTING.md`, `TODO.md`, `AI_HISTORY.md`.

**Verification:** Browser flow and database query as described above. No code changed, so lint, tests and build were not re-run.

**Problems / open issues:**
- `TESTING.md` asks for Screenshot 2 of the Supabase Table Editor (`surveys`/`questions`/`choices`); I still need to take that.
- The test survey stays in the database as a draft so it can be used for the activation and phone tests.

---

## Session 27 — 2026-11-05 — Step 5 browser tests in Chrome (TESTING.md section 3)

**What I asked:** "do step 5 in chrome"

**What the agent did:**
- Instructor steps ran on `localhost:5173`. Student steps ran on `[::1]:5173`, which the browser treats as a separate site with no login, so the student requests went out as `anon`.
- Activated the test survey (slug `3vaf37qh`), checked the active survey's editor is locked, submitted with a question blank (validation), then submitted 3 student responses with fresh browser tokens (Q1: 1/2, 1/2, 1/3).
- Duplicate test: reopened the link, then deleted only `classroom-survey.submitted-surveys` and submitted again. The server rejected it.
- Closed the survey while a student form was open; checked closed and unknown links; checked the results page numbers and charts.
- Screen widths: loaded each page in a frame at 375/768/1440 px and measured horizontal scrolling and tap-target heights. Resizing the Chrome window had no effect, so this replaced it.
- Keyboard: tab order and focus rings on the student page, arrow keys in radio groups, skip link, Escape and focus return in the close dialog.
- Logged-out checks: protected-route redirects, wrong password, return to the page I asked for after login, logout.
- Reactivated the survey for the layout test, then closed it again. Final state: closed, 3 responses.
- Saved screenshots to `C:\Users\mgebu\Downloads\survey-app-screenshots\` (outside the repo).
- Filled 15 rows in `TESTING.md` (14 "Pass (agent)", row 30 "Partial (agent)"). Checked off 9 `TODO.md` items: Phase 7 load active survey, store response, mobile friendly; Phase 9 bar charts; Phase 14 activation, closing, student submissions, duplicate prevention, unauthorized access.

**Files changed:** `TESTING.md`, `TODO.md`, `AI_HISTORY.md`.

**Verification:** Database check as the instructor: 3 responses, 3 distinct tokens, 3 answers each; survey status `closed`. No code changed, so lint, tests and build were not re-run.

**Problems / open issues:**
- Row 30 is only partial: instructor text inputs and selects are 41–42 px tall, and the header "Classroom Survey" link is 28 px, below the 44 px tap-target goal. Not fixed; that would be a small CSS change if I want it.
- Not done (need me or my OK): real phone QR scan (15), QR download (16) and CSV export (29), because downloads need my approval; second browser (31); projector; rows 9, 11, 13 and 24–28.
- "Test mobile layout" and "Test accessibility and keyboard navigation" are left unchecked in `TODO.md` because they need a real phone and the 44 px fix.

---

## Session 28 — 2026-11-05 — Commit, then the remaining Chrome tests

**What I asked:** "commit and push then continue for next steps"

**What the agent did:**
- Committed and pushed the Session 26–27 results (`b023f5c`).
- In Chrome:
  - Editor validation (8).
  - Created "Test 2", tested the unsaved-changes dialog (11), then edited and reordered it, saved, and reloaded (9).
  - Edited the closed Fractions survey, which has responses: questions locked, description saved (26).
  - Activated Fractions, then Test 2, to check that only one survey can be active (13).
  - Submitted one student response to Test 2 and compared the results page with database counts, including Refresh (24).
  - Closed and deleted Test 2 with its response (28).
  - Duplicated the Fractions survey, then deleted the empty copy (27).
  - Archived the Fractions survey and checked its results plus the status and date filters (25).
- Filled 9 more `TESTING.md` rows ("Pass (agent)") and checked off "Test survey editing" and "Preserve all historical response data" in `TODO.md`.

**Files changed:** `TESTING.md`, `TODO.md`, `AI_HISTORY.md`.

**Verification:** Database query as the instructor matched the results page. Final data: one survey, "Test Survey - Fractions Check", archived, 3 responses. No code changed, so lint, tests and build were not re-run.

**Problems / open issues:**
- Row 11: the browser's own prompt on tab close was not tested, because a native dialog would block the automation.
- Row 24 compared against a REST query, not the SQL Editor.
- Still open: QR download (16) and CSV export (29) need my OK to download files; phone QR scan (15); a second browser (31); projector; the 41–42 px instructor inputs (row 30); deployment (Phase 15).

---

## Session 29 — 2026-11-05 — QR/CSV downloads and input height fix

**What I asked:** "do the downloads and fix the input sizes"

**What the agent did:**
- `src/index.css`: added `min-h-11` (44 px) to the shared `.input` class, used by every text input, select and textarea, to match the buttons. Before, instructor inputs and selects were 41–42 px tall.
- Re-measured the dashboard and editor at 375/768/1440 px in Chrome: all inputs, selects and buttons are now ≥ 44 px, with no horizontal scrolling. The header "Classroom Survey" link (28 px) is still below 44 px; I left it alone because I only asked about inputs.
- CSV: Export CSV on the archived Fractions survey downloaded `C:\Users\mgebu\Downloads\test-survey-fractions-check-results-2026-11-05.csv` (708 bytes). Checked the file: UTF-8 BOM, header with the question texts, 3 rows matching the submissions, summary section.
- QR: Download QR only shows for an active survey, so the agent duplicated the Fractions survey, activated the copy (slug `4wv66ttj`), downloaded `C:\Users\mgebu\Downloads\4wv66ttj-qr.png` (1024×1024 PNG), then closed and deleted the copy.
- Updated `TESTING.md` rows 16 and 29 ("Partial (agent)") and row 30 (still partial because of the header link).

**Files changed:** `src/index.css`, `TESTING.md`, `AI_HISTORY.md`.

**Verification:** `npm run lint` 0 problems; `npm test -- --run` 112/112 passed; `npm run build` passed. Chrome measurement as above. No regression test was added: jsdom does not calculate layout, so it can't measure element heights. The Chrome measurement is the check.

**Problems / open issues:**
- Whether the QR PNG scans is not verified: there is no QR decoder on this PC (no OpenCV), and Chrome's BarcodeDetector is not available on Windows.
- Still for me: open the CSV in Excel and Google Sheets, and scan the PNG with a phone.
- Database is back to one survey: "Test Survey - Fractions Check", archived, 3 responses.

---

## Session 30 — 2026-11-05 — Header link tap target, commit

**What I asked:** "fix the header link too, then commit and push"

**What the agent did:**
- `src/components/InstructorLayout.tsx`: the header "Classroom Survey" link now has `inline-flex min-h-11 items-center`, so its tap area is 44 px instead of 28 px. Ran Prettier on the two files changed in Sessions 29–30.
- Re-measured the dashboard, editor and results pages at 375/768/1440 px in Chrome: no horizontal scrolling, and every visible tap target is ≥ 44 px. The skip link is 24 px when shown; it is for keyboard users only, so I left it.
- `TESTING.md` row 30 is now "Pass (agent)". Checked off "Improve mobile responsiveness" in `TODO.md`.
- Committed Sessions 29–30 and pushed to `origin/main`.

**Files changed:** `src/components/InstructorLayout.tsx`, `src/index.css` (Session 29), `TESTING.md`, `TODO.md`, `AI_HISTORY.md`.

**Verification:** `npm run lint` 0 problems; `npm test -- --run` 112/112 passed; `npm run build` passed; `prettier --check` clean on both changed files. Chrome measurement as above.

**Problems / open issues:** `prettier --check` first flagged `InstructorLayout.tsx` because the new class string made the line too long; Prettier wrapped it. A check after `git stash` also flagged both files, but only because Git had rewritten their line endings, not because of the code. No regression test, same reason as Session 29.

---

## Session 31 — 2026-11-05 — First Cloudflare deploy failed: diagnosis

**What I asked:** "the build failed" (pasted the Cloudflare build log)

**What the agent found:**
- The build itself succeeded: `npm run build` passed and the bundle matches a local build with `.env.local` (`index-*.js` 542 KB), with no "VITE_SUPABASE_* not set" warning, so the environment variables were set.
- The failure came from the deploy step. The project was created as a **Cloudflare Workers** project, not a **Pages** project: the log shows `Executing user deploy command: npx wrangler deploy`, and Wrangler auto-generated a `wrangler.jsonc` inside the build container. Workers static assets reject `public/_redirects` (`/* /index.html 200`) with "Infinite loop detected in this rule" (code 100324). Cloudflare Pages accepts this file; it is the standard Pages SPA fallback.
- Recommended fix: delete the Workers project and create a **Pages** project from the same repo (the spec, TODO Phase 15, README and DECISIONS all say Cloudflare Pages). No repo change needed.
- Alternative, not taken: keep Workers, commit a `wrangler.jsonc` with `assets.not_found_handling: "single-page-application"` and remove `_redirects`. That would contradict the spec and need a DECISIONS entry.

**Files changed:** `AI_HISTORY.md`.

**Verification:** Local `npm run build` gives the same bundle sizes as the Cloudflare log.

**Problems / open issues:** Waiting for me to recreate the project as Pages.

---

## Session 32 — 2026-11-05 — Production verification (Prompt 14, TODO Phase 15)

**What I asked:** "its deployed at https://classroom-survey-cky.pages.dev/", then "logged in" (twice)

**What the agent did:**
- I recreated the project as a Cloudflare **Pages** project (see Session 31); it deployed to `https://classroom-survey-cky.pages.dev`.
- curl: `/`, `/login`, `/dashboard` and `/s/doesnotexist` all return 200 HTML (the SPA fallback through `_redirects` works). The main bundle contains the Supabase project URL, and the "Missing Supabase configuration" branch was removed by the build, so the env vars are set. `VITE_PUBLIC_SITE_URL` is not set; QR links use `window.location.origin`, which is the production URL.
- Chrome:
  - Logged out, `/s/doesnotexist` → "Survey not found." and `/dashboard` → `/login`.
  - I logged in myself; the agent does not type passwords into the live site.
  - The agent duplicated the archived Fractions survey, renamed it "Production Test", saved and activated it. The Present page showed `https://classroom-survey-cky.pages.dev/s/93nb9237`.
  - Logged out and submitted as a student (no Supabase session in local storage) → "Thank you!"; reopening the link → "already submitted".
  - I logged in again; it returned to the results page: 1 response, all counts and percentages correct.
- Filled `TESTING.md` row 35 ("Pass (agent)"). Checked off 9 Phase 15 items in `TODO.md` (Pages site, GitHub connection, env vars, deploy, SPA routing, production login, QR URL, production submissions, production results).
- Screenshots: `production-present-qr.jpg`, `production-student-thank-you.jpg`, `production-results.jpg` in `C:\Users\mgebu\Downloads\survey-app-screenshots\`.

**Files changed:** `TESTING.md`, `TODO.md`, `AI_HISTORY.md`.

**Verification:** As above. No code changed.

**Problems / open issues:**
- "Production Test" is left **active** with 1 response so I can scan its QR with my phone (row 15). Close or archive it afterwards.
- "Connect Cloudflare Pages to the GitHub repository" is checked on the basis that I set the project up as a Git import. The agent cannot see the Cloudflare dashboard; the deployed bundle matches a build of `main`.
- Still for me: phone QR scan, a second browser, the projector, opening the CSV in Excel and Google Sheets, the Supabase SQL Editor and Table Editor screenshots, the Supabase Site URL setting, the `[MY REFLECTION]` / `[FILL IN]` parts of `DEVELOPMENT_SUMMARY.md`, and sending the grader login through HuskyCT.
- Note: the first attempt to update `TESTING.md` row 35 failed and changed nothing. The file had Windows `\r\n` line endings from the earlier `git stash` round trip, so the row pattern did not match. It was rerun with a pattern that allows `\r`; `git diff` shows only row 35 changed.

---

## Session 33 — 2026-11-05 — Fill in DEVELOPMENT_SUMMARY.md facts, commit

**What I asked:** "yes, fill in the summary then commit and push"

**What the agent did:**
- `DEVELOPMENT_SUMMARY.md` section 2: replaced the outdated "Done by me" list, which said I did the Supabase setup and all manual tests. It now separates what I did from the setup and testing the agent did at my request. Filled the `[FILL IN]` with dates and the things that behaved differently (Chrome window resize, tap-target fixes, Workers-vs-Pages, `.env.example` values).
- Section 6: corrected the deployment paragraph (`VITE_PUBLIC_SITE_URL` is not set and isn't needed). Filled the `[FILL IN]` with the production URL, GitHub URL, deploy date and the Prompt 14 results.
- Updated the draft note at the top. No `[FILL IN]` placeholders remain. The 5 `[MY REFLECTION]` placeholders are untouched; they need my own words.
- Committed Sessions 32–33 (`TESTING.md`, `TODO.md`, `DEVELOPMENT_SUMMARY.md`, `AI_HISTORY.md`) and pushed to `origin/main`.

**Files changed:** `DEVELOPMENT_SUMMARY.md`, `AI_HISTORY.md` (plus the Session 32 changes to `TESTING.md` and `TODO.md`).

**Verification:** `grep` finds 0 `[FILL IN]` placeholders and 5 `[MY REFLECTION]` placeholders. Documentation only, so lint, tests and build were not re-run.

**Problems / open issues:** The summary does not say the Supabase token was revoked, because I haven't confirmed that yet.

---

## Session 34 — 2026-11-05 — Screenshots, Site URL, Excel check

**What I asked:** "go, you can change the site URL and upload the CSV"

**What the agent did:**
- **Excel:** opened the exported CSV with Excel 16 from PowerShell (Excel stayed hidden) and read the cells. The layout, header, 3 response rows and summary are correct, but **Excel converts the answers "1/2" and "1/3" into the dates "2-Jan" and "3-Jan"**. "75%" becomes 0.75 (still shown as 75%) and "True" becomes TRUE. Not fixed yet; waiting for my decision. Root cause: the CSV writes answers as plain text, and Excel guesses the type of each cell when it opens a CSV.
- **Screenshot 1:** pasted `supabase/tests/rls_checks.sql` into the Supabase SQL Editor in my logged-in Chrome and ran it. Supabase warned about destructive operations and new tables without RLS; both come from the script's temporary results tables, so it ran with "Run without RLS". Result: 23/23 PASS. Saved `screenshot1-rls-checks-rows-1-11.jpg` and `screenshot1-rls-checks-rows-12-23.jpg`. The query was not saved in Supabase.
- **Screenshot 2:** Table Editor screenshots of `surveys` (2 rows), `questions` (6 rows) and `choices` (16 rows): `screenshot2-table-surveys.jpg`, `screenshot2-table-questions.jpg`, `screenshot2-table-choices.jpg`. All screenshots are in `C:\Users\mgebu\Downloads\survey-app-screenshots\`.
- **Site URL:** changed Supabase Authentication → URL Configuration → Site URL from `http://localhost:3000` to `https://classroom-survey-cky.pages.dev`. After a reload it shows the new value.
- **Google Sheets:** not done. Drive's upload and the Sheets Import → Upload box both use a file picker or Google frame that the browser tools can't reach. This left an empty "Untitled spreadsheet" in my Google Drive.
- **Production Test:** left active. It still has 1 response, so my phone scan hasn't happened yet.
- `TESTING.md` row 29 is now "Fail (agent)" because of the Excel date conversion.

**Files changed:** `TESTING.md`, `AI_HISTORY.md`.

**Verification:** rls_checks 23/23 PASS in the SQL Editor; Site URL shows the new value after reload; Excel cell values as listed above.

**Problems / open issues:** Excel date conversion (needs a fix); Google Sheets check; the empty "Untitled spreadsheet" in my Drive; phone scan; closing "Production Test" afterwards.

---

## Session 35 — 2026-11-05 — Fix: Excel turns CSV answers like 1/2 into dates

**What I asked:** "yes fix the csv bug, then commit and push"

**Root cause:** `escapeCell` in `src/lib/csv.ts` already guarded against formula injection, but wrote answer text like `1/2` as a plain cell. When Excel opens a CSV it guesses each plain cell's type, so `1/2` became 2 January ("2-Jan"), `75%` became 0.75, and `True` became a TRUE/FALSE value.

**What the agent did:**
- Tests first: added a table-driven `escapeCell (spreadsheet type guessing)` group to `src/lib/csv.test.ts` (11 values that must stay text; ordinary text, ISO timestamps and real numbers left alone; formula guard still first). Updated the `buildResultsCsv` expectation for the "True" answer. Before the fix, 12 tests failed.
- Fix: `escapeCell` now writes a text value matching `SPREADSHEET_COERCES` (numbers, fractions, percents, dates, times, currency, true/false) as `="text"`, then applies the usual RFC 4180 quoting. It only applies to string values, so counts stay numbers.
- Two existing tests changed: in `src/test/results.test.tsx` the exported "False" answer is now `"=""False"""` (intended), and the `toCsv` CRLF test now uses `'c'` instead of the string `'1'` so it stays focused on line joining.
- Checked in real Excel 16: generated a CSV with the fixed code and opened it hidden through COM. "1/2", "1/3", "75%", "True", "007", "2026-11-05" and "Café" are shown as typed (String), 3 stays a number (Double), and `=1+1` shows as `'=1+1`.
- Added `DECISIONS.md` D23. Updated `TESTING.md` row 29 to "Partial (agent)" (Excel passes; Google Sheets not tested).
- Committed Sessions 34–35 and pushed. Cloudflare redeploys from `main` automatically.

**Files changed:** `src/lib/csv.ts`, `src/lib/csv.test.ts`, `src/test/results.test.tsx`, `DECISIONS.md`, `TESTING.md`, `AI_HISTORY.md`.

**Verification:** `npm test -- --run` 125/125 passed (13 files; 112 before plus 13 new); `npm run lint` 0 problems; `npm run build` passed; `prettier --check` clean on the changed files; Excel check as above.

**Problems / open issues:** Google Sheets still needs a manual check (File → Import → Upload the CSV). A plain-text reader will see `="1/2"` (accepted in D23). Month-name dates like "Jan 2" are not covered; unlikely in answer choices.
