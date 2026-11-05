# Decisions

This file records choices where the five spec documents (`Classroom_Survey_Web_App_Specification.md`, `TODO.md`, `DATABASE.md`, `API.md`, `UI.md`) are silent, inconsistent, or deliberately deviated from. Each entry: date, decision, reason, alternatives considered.

---

## Part 1 — Gaps and inconsistencies found in the spec review (Prompt 1)

### D1. Public student route: `/s/:slug`, not `/s/:surveyId`
- **Date:** 2026-11-02
- **Issue:** `TODO.md` Phase 7 says `/s/:surveyId`; `UI.md` §1, `API.md` §9 and `DATABASE.md` §6 use `/s/:slug`.
- **Decision:** Use `/s/:slug` where `slug` is `surveys.public_slug`. The TODO wording is superseded; the TODO item is checked off against the `/s/:slug` route.
- **Reason:** Three of four documents agree; slugs are short (easier to type from a projector), non-sequential and not guessable.
- **Alternatives:** Raw UUID in the URL (allowed by DATABASE.md §6 for v1) — rejected because it is long and hard to read aloud.

### D2. RPC functions are described but never defined in SQL
- **Date:** 2026-11-02
- **Issue:** `activate_survey`, `close_survey`, `submit_survey_response` and a results RPC/view are described (API.md §7, §8, §10, §11; DATABASE.md §5, §9, §11) but no SQL is given.
- **Decision:** Define them in a second migration, `supabase/migrations/20261102000200_rpc_functions.sql`, together with `duplicate_survey` and `get_survey_status_by_slug` (see D10). Every function has explicit `GRANT/REVOKE EXECUTE`.
- **Reason:** Rule 4 (all schema changes in migrations). Keeping RPCs in their own file keeps the table schema readable.
- **Alternatives:** Doing activation/results in the frontend — rejected: activation must be atomic (only one active survey) and results aggregation is simpler and faster in SQL.

### D3. Present page response count under RLS
- **Date:** 2026-11-02
- **Issue:** `anon` cannot read `responses`, so how does the Present page show a count?
- **Decision:** The Present page is an instructor route (`/surveys/:id/present`) behind `ProtectedRoute`, so it runs as the `authenticated` role, which may read `responses`. It uses `select('id', { count: 'exact', head: true })` (count only, no rows transferred), polled every 5 s.
- **Reason:** Confirmed fine — the projector screen is driven by the instructor's logged-in browser. Students never see the count.
- **Alternatives:** A `SECURITY DEFINER` count function callable by anon — unnecessary and leaks data.

### D4. "Any authenticated user = instructor" requires disabled public sign-ups
- **Date:** 2026-11-02
- **Issue:** DATABASE.md §10 grants full access to any `authenticated` user. If public sign-ups are enabled, anyone could create an account and read all results.
- **Decision:** Public sign-ups **must be disabled** in Supabase (Authentication → Sign In / Providers → "Allow new users to sign up" off). Instructor and grader accounts are created manually in the dashboard (Authentication → Users → Add user). The app has no sign-up page.
- **Reason:** Simplest secure model for a single-instructor MVP.
- **Alternatives:** An `instructors` allow-list table checked in every policy — better for multiple instructors (post-MVP), more complex.

### D5. Required questions and True/False storage
- **Date:** 2026-11-02
- **Issue:** Specs never say whether questions are required, nor how True/False options are stored.
- **Decision:** Every question is required (one choice per question). `submit_survey_response` raises `MISSING_REQUIRED_ANSWER` if any question of the survey has no answer. True/False questions store **two rows in `choices`**: `"True"` (position 1) and `"False"` (position 2). The editor creates them automatically and shows them read-only.
- **Reason:** Storing T/F as normal choices means results, CSV export and submission validation work the same for both question types (one code path).
- **Alternatives:** Optional questions (more UI states, partial answers); storing T/F as `text_answer` (needs a second aggregation path).

### D6. Editing active surveys and closed surveys that have responses
- **Date:** 2026-11-02
- **Issue:** TODO Phase 5 says "prevent editing an active survey unless it is first closed" but says nothing about closed surveys with responses. Rewriting questions/choices of such a survey would cascade-delete answers.
- **Decision:**
  - **Active** surveys open read-only in the editor with "Close this survey to edit it."
  - **Draft or closed surveys with 0 responses:** fully editable.
  - **Any survey with ≥1 response:** structural edits (questions, choices, types, order) are **blocked**; only title and description can be changed. The editor explains this and points to **Duplicate** to make a changed version.
  - Editing a closed survey does **not** change its status (it stays `closed`; it does not silently become a draft). A closed survey can be re-activated from the editor or the Present page.
- **Reason:** Protects historical data (DATABASE.md §13: responses are never automatically deleted).
- **Alternatives:** Warn and allow destructive rewrite (data loss); versioned questions (too complex for MVP).

### D7. Date filter for historical results
- **Date:** 2026-11-02
- **Issue:** TODO Phase 10 asks for "filtering by date" without saying which date or where.
- **Decision:** The dashboard has a "Created from / to" date-range filter on `surveys.created_at` (inclusive, local time), combined with the title search and status filter. Filtering is done client-side on the already-loaded survey list. Historical results are viewed by opening Results on any closed/archived survey.
- **Reason:** One instructor will have tens to hundreds of surveys — client-side filtering is instant and simple.
- **Alternatives:** Server-side filtering with `.gte/.lte` (only needed at much larger scale); filtering by response `submitted_at` (less intuitive for finding a survey).

### D8. Unique `(survey_id, position)` / `(question_id, position)` constraints
- **Date:** 2026-11-02
- **Decision:** **Added.** The editor saves with a delete-and-reinsert strategy (D12) and positions are recomputed 1..n on every save, so swapping positions never updates rows in place and the constraints cannot be violated mid-reorder.
- **Reason:** Guarantees deterministic ordering in the student page, results and CSV.
- **Alternatives:** Deferrable constraints (needed only for in-place updates); no constraint.

### D9. Public slug format
- **Date:** 2026-11-02
- **Decision:** 8 characters from the 31-character alphabet `abcdefghjkmnpqrstuvwxyz23456789` (no `i`, `l`, `o`, `0`, `1` to avoid misreading from a projector), derived from the random bytes of `gen_random_uuid()` (≈ 39 bits of randomness). Generated by `activate_survey` the first time a survey is activated; retried on collision; kept on re-activation so printed QR codes stay valid.
- **Alternatives:** UUID (long), `random()` (not cryptographically random), `pgcrypto.gen_random_bytes` (extension lives in the `extensions` schema on Supabase, complicating `search_path`).

### D10. Closed-survey message for anonymous students
- **Date:** 2026-11-02
- **Issue:** anon RLS only returns active surveys, so a closed survey looks identical to a non-existent one.
- **Decision:** Add `get_survey_status_by_slug(p_slug text) returns text` — `SECURITY DEFINER`, `set search_path = public`, granted to anon/authenticated. It returns **only** the status string (or null). The student page shows "This survey is no longer accepting responses." for `closed`/`archived`, "Survey not found." otherwise.
- **Reason:** Better UX for students who scan an old QR code; leaks only the status of a slug they already have.
- **Alternatives:** Always show "Survey not found." (confusing after the instructor closes the survey).

### D11. CSV metadata placement
- **Date:** 2026-11-02
- **Decision:** The CSV starts with the header row (`response_id,submitted_at,<question 1 text>,...`) followed by one row per response, as API.md §12 requires ("the first row contains question text"). Survey metadata (title, status, created_at, exported_at, response count) is written as a **summary section after one blank line at the end** (`Survey summary` / `field,value` rows).
- **Reason:** Keeps row 1 as a real header so Excel/Google Sheets sort/filter work, while still exporting metadata (TODO Phase 11). Both apps open the file cleanly.
- **Alternatives:** Metadata rows at the top (breaks "first row is header"); separate summary file (two downloads).

### D12. Editor save strategy
- **Date:** 2026-11-02
- **Decision:** Save Draft = (1) insert or update the `surveys` row; (2) if the survey has **0 responses**, delete all its questions (choices cascade) and re-insert the editor's questions and choices with positions 1..n. Question ids are generated client-side with `crypto.randomUUID()` so choices can reference them in one bulk insert. If the survey has responses, only step (1) runs (D6).
- **Reason:** Simple and correct — no diffing, reordering cannot lose edits because the editor's in-memory state is the source of truth.
- **Known limitation:** The three requests are not one transaction. If the network fails between delete and insert, the survey temporarily has no questions; the editor keeps its state, shows an error, and "Save Draft" can be retried. Acceptable for drafts with no responses.
- **Alternatives:** A `save_survey` RPC taking the whole survey as JSON (atomic, more SQL); diff-based updates (complex).

### D13. Results percentages
- **Date:** 2026-11-02
- **Decision:** A choice's percentage = choice count ÷ number of answers to that question × 100, rounded to 1 decimal; 0 when the question has no answers. Question `response_count` = number of answers to that question. Because all questions are required (D5) this equals the survey's total response count.
- **Reason:** Matches the API.md §11 example (45 / 52 = 86.5%).

### D14. Activating closed surveys and dashboard actions
- **Date:** 2026-11-02
- **Decision:** Dashboard actions follow the prompt exactly: draft → Edit, Activate, Duplicate, Archive, Delete; active → Present, Results, Close, Duplicate; closed → Results, Edit, Duplicate, Archive, Delete; archived → Results, Duplicate, Delete. `activate_survey` accepts draft or closed surveys (rejects archived); re-opening a closed survey is possible from the editor/Present page.
- **Reason:** Instructors sometimes need to re-open a poll for late students. Active surveys cannot be archived or deleted without closing first, which avoids deleting a survey mid-class.

### D15. Error messages
- **Date:** 2026-11-02
- **Decision:** All errors pass through `src/lib/errors.ts`, which maps the RPC exception codes (`SURVEY_NOT_ACTIVE`, `DUPLICATE_RESPONSE`, `INVALID_QUESTION`, `INVALID_CHOICE`, `MISSING_REQUIRED_ANSWER`), auth errors and network errors to the friendly texts of UI.md §8 / API.md §13. Raw error text is only written to `console.error`, never rendered.

### D16. Automated tests: Vitest + React Testing Library instead of Playwright
- **Date:** 2026-11-02
- **Decision:** Use Vitest + RTL (jsdom) with a mocked `supabase` module for component tests; pure helpers are tested directly. Database behaviour is tested by `supabase/tests/rls_checks.sql` and `scripts/rls-probe.ts` against the real Supabase project.
- **Reason:** No browser download or live backend needed in CI; Prompt 12 allows either.

### D17. Dashboard response counts and the "Edit" action on closed surveys
- **Date:** 2026-11-02
- **Decision:** `listSurveys` uses PostgREST's embedded aggregate `select('*, responses(count)')` so each card shows "N responses" and the delete dialog can show the stronger warning with the count. "Edit" on a closed survey opens the editor **without** changing the status (it does not re-open as a draft) — see D6.
- **Reason:** One request for the whole list; no extra count query per card.
- **Alternatives:** A count query per survey (N+1 requests); a database view.

### D18. Editor details
- **Date:** 2026-11-02
- **Decision:**
  - New questions start as Multiple Choice with two blank choices. A choice's Delete button is disabled while the question has only two choices (minimum 2). Duplicate choice texts within one question are rejected ("This choice is the same as another choice.").
  - Deleting a **question** asks for confirmation (UI.md §5 "destructive actions require confirmation"); deleting a single choice does not (UI.md §14 warns against excessive dialogs, and a choice is quick to retype).
  - Switching Multiple Choice → True/False asks for confirmation only if any choice text was typed. True/False → Multiple Choice keeps "True"/"False" as editable starting choices.
  - Reorder uses ↑/↓ buttons with labels such as "Move question 2 up"; keyboard focus follows the moved item.
  - The editor's **Activate** button validates, checks for another active survey (confirm "This will close …"), saves, calls `activate_survey`, then opens the Present page.
  - Before rewriting questions the editor re-counts responses on the server; if responses arrived since the page was opened, it refuses and asks to reload (protects answers if the survey was re-activated in another tab).
  - Unsaved changes: `beforeunload` for reload/close tab, and React Router's `useBlocker` (requires the data router, so the app uses `createBrowserRouter`) for in-app navigation, with a "Leave without saving?" dialog.

### D19. Present page and public URL
- **Date:** 2026-11-02
- **Decision:**
  - Public URL = `(VITE_PUBLIC_SITE_URL || window.location.origin)/s/<slug>` (`src/lib/urls.ts`). `||` is used instead of `??` so an empty `VITE_PUBLIC_SITE_URL=` line (as in `.env.example`) also falls back to the current origin. Set `VITE_PUBLIC_SITE_URL` to the Cloudflare Pages URL in production so QR codes shown from any machine point at production.
  - QR code: `qrcode.toDataURL`, error correction M, 1024 px, black on white, 2-module quiet zone; displayed at `min(60vh, 90vw)`. The same PNG data URL is used for "Download QR" (`<slug>-qr.png`).
  - Response count: count-only query (`head: true`) polled every 5 s while the survey is active (Realtime is post-MVP). A failed poll keeps the last number and shows "Retrying...".
  - The page has no header/navigation; action buttons sit at the bottom (View Results, Close Survey, Download QR, Fullscreen, Back to Dashboard). A non-active survey shows its status and an "Activate Survey" button (draft/closed only).
- **Build-time env vars:** Vite inlines `VITE_*` variables at build time. Building without them produces a bundle that only throws "Missing Supabase configuration" (the bundler removes the unreachable app code). `vite.config.ts` prints a warning in that case; on Cloudflare Pages the variables must be set **before** the build runs.

### D20. Student page details
- **Date:** 2026-11-02
- **Decision:**
  - Route is `/s/:slug` (TODO.md's `/s/:surveyId` superseded, D1). The page loads the survey by `public_slug` with nested questions/choices; anon RLS returns nothing for non-active surveys, and `get_survey_status_by_slug` (D10, implemented) decides between "This survey is no longer accepting responses." and "Survey not found." If that status call itself fails, the page shows "Survey not found.".
  - Anonymous token: stored in `localStorage["classroom-survey.anonymous-token"]`. Generated with `crypto.randomUUID()`, falling back to `crypto.getRandomValues` because `randomUUID` only exists in secure contexts (a phone testing the dev server over `http://<LAN IP>` would otherwise crash). If storage throws, an in-memory token is used for the page's lifetime.
  - Submitted survey ids are kept in `localStorage["classroom-survey.submitted-surveys"]` (plus memory) so a returning student immediately sees "You have already submitted a response to this survey." The database unique index remains the real protection (a student can clear storage or use another browser — accepted for an anonymous classroom tool).
  - Errors: `DUPLICATE_RESPONSE` → already-submitted screen; `SURVEY_NOT_ACTIVE` → closed screen; everything else → friendly message above the Submit button, which stays usable for a retry. Double submission is prevented by a ref guard plus the disabled "Submitting..." button.

### D21. CSV export details
- **Date:** 2026-11-02
- **Decision:** `src/lib/csv.ts` builds the file in the browser (API.md §12). Cells are quoted per RFC 4180 when they contain `"`, `,`, CR/LF or leading/trailing spaces; embedded quotes are doubled; rows end with CRLF. Cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading `'` (OWASP CSV-injection guidance) — this also applies to legitimate values such as "-1", which then show as `'-1` in a spreadsheet; accepted for safety. The download is prefixed with a UTF-8 BOM so Excel shows accented characters correctly. Timestamps are ISO 8601 UTC (`toISOString()`). File name `<slugified-title>-results-<yyyy-mm-dd>.csv` (local date). Responses are fetched with nested answers in pages of 1000 rows (Supabase's default row limit) so big classes are not silently truncated.
- **Alternatives:** A server-side export endpoint (not needed for MVP); a CSV library such as PapaParse (one more dependency for ~30 lines of code).

### D22. RLS probe safety
- **Date:** 2026-11-02
- **Decision:** `scripts/rls-probe.ts` uses only the anon key. It first makes one call anon is allowed to make (`get_survey_status_by_slug`); if that fails (wrong URL/key, network, missing migrations) it stops with exit code 2. A "rejected" check only counts as PASS for Postgres `42501 permission denied` or zero returned rows — any other error is a FAIL. The double-submission check creates a real response, so it only runs with `--submit` (use a test survey).
- **Reason:** The first version reported PASS when the server was unreachable, because "request failed" looked the same as "permission denied" (see AI_HISTORY.md Session 13).

---

## Part 2 — Database policies and functions in plain English (Prompt 3)

See the end of this file (section "Policies and functions explained").

---

## Policies and functions explained (Prompt 3)

Files: `supabase/migrations/20261102000100_initial_schema.sql`, `supabase/migrations/20261102000200_rpc_functions.sql`, test script `supabase/tests/rls_checks.sql`.

### Roles
- **`anon`** — every request made with the public anon key and no login. This is what a student's phone uses.
- **`authenticated`** — a request made by a logged-in user. Because sign-ups are disabled (D4), this is always the instructor (or the grader account).
- **Table owner (`postgres`)** — the role that ran the migration. Only `SECURITY DEFINER` functions run as this role.

### Table privileges (before RLS is even considered)
- Supabase grants every privilege on new tables to `anon` by default. The migration **revokes all** of them and grants back only `SELECT` on `surveys`, `questions`, `choices`. So `anon` gets "permission denied" for any insert/update/delete, and for any access to `responses`/`answers`, even if a policy were later added by mistake.
- `authenticated` gets `SELECT, INSERT, UPDATE, DELETE` on all five tables.

### Row Level Security policies
| Table | Policy | Plain English |
|---|---|---|
| surveys | `students read active surveys` (anon, SELECT) | A student can see a survey row only while its status is `active`. Drafts, closed and archived surveys are invisible. |
| questions | `students read active survey questions` (anon, SELECT) | A student can see a question only if the survey it belongs to is active. |
| choices | `students read active survey choices` (anon, SELECT) | A student can see an answer choice only if its question's survey is active. |
| responses, answers | *(no anon policy)* | Students can never read or write responses/answers directly. The only way in is `submit_survey_response`. |
| all five | `authenticated users manage …` (authenticated, ALL, `using (true) with check (true)`) | The logged-in instructor can read and change everything. |

### Functions
| Function | Who may call | Runs as | Plain English |
|---|---|---|---|
| `activate_survey(p_survey_id)` | authenticated | caller (`SECURITY INVOKER`) | Takes a lock so two clicks can't race, refuses archived surveys and surveys without questions, closes whichever survey is currently active, gives the survey an 8-character random slug if it doesn't have one yet (retrying on the rare collision), marks it active, and returns `{id, status, public_slug}`. All in one transaction, so there is never a moment with two active surveys. |
| `close_survey(p_survey_id)` | authenticated | caller | Marks an active survey `closed`. Calling it on an already-closed survey does nothing (safe to double-click). After this, `submit_survey_response` rejects new submissions with `SURVEY_NOT_ACTIVE`. |
| `submit_survey_response(p_survey_id, p_anonymous_token, p_answers)` | anon, authenticated | table owner (`SECURITY DEFINER`, `search_path = public`) | The only way students write data. Checks, in order: the survey is active (`SURVEY_NOT_ACTIVE`); the browser token is present (`INVALID_TOKEN`); this token hasn't already answered this survey (`DUPLICATE_RESPONSE`); every answer's question belongs to this survey and appears once (`INVALID_QUESTION`); every chosen choice belongs to its question (`INVALID_CHOICE`); every question of the survey is answered (`MISSING_REQUIRED_ANSWER`). Then inserts one `responses` row and its `answers` rows atomically and returns `{"success": true, "response_id": …}`. The unique index on `(survey_id, anonymous_token)` is the final guard against two simultaneous duplicate submissions. Running as owner is what lets it insert even though anon has no table privileges; the fixed `search_path` prevents a malicious object in another schema from hijacking it. |
| `get_survey_results(p_survey_id)` | authenticated | caller | Returns the API.md §11 JSON: total responses, and for each question (in position order) the number of answers and, for each choice, its count and percentage (1 decimal; 0 when nobody answered). |
| `duplicate_survey(p_survey_id)` | authenticated | caller | Creates a new **draft** survey titled "Copy of …" with copies of all questions and choices (same order), no slug and no responses, and returns its id. |
| `get_survey_status_by_slug(p_slug)` | anon, authenticated | table owner (`SECURITY DEFINER`) | Returns only the status word (`draft`/`active`/`closed`/`archived`) for a slug, or null. Lets the student page say "This survey is no longer accepting responses." instead of "Survey not found." Reveals nothing else. |

Every function first `REVOKE`s `EXECUTE` from `public`, `anon` and `authenticated` (Supabase grants execute to anon/authenticated by default) and then `GRANT`s exactly the roles listed above.

### Extra constraints added beyond DATABASE.md
- `questions (survey_id, position)` and `choices (question_id, position)` are unique (D8).
- `submit_survey_response` raises `INVALID_TOKEN` (not in API.md's list) when the token is missing — the frontend always sends one, so the UI treats it as a generic error.
- `activate_survey` raises `SURVEY_NOT_FOUND`, `SURVEY_ARCHIVED`, `SURVEY_HAS_NO_QUESTIONS`; the dashboard maps them to friendly messages.

### How the SQL was verified
The migrations and `rls_checks.sql` were executed locally against PostgreSQL in PGlite (Postgres compiled to WebAssembly) with `anon`/`authenticated` roles and Supabase-style default privileges recreated: both migrations apply cleanly twice in a row (re-runnable), all 23 checks in `rls_checks.sql` return PASS, and additional checks confirmed the one-active-survey index, status CHECK, unique positions, `updated_at` trigger, idempotent close, slug reuse on re-activation, and `duplicate_survey`. This is not a substitute for running `rls_checks.sql` in the real Supabase project (PostgREST and Supabase's own grants are not emulated exactly).
