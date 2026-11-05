# Testing

Three layers of testing:

1. **Automated unit/component tests** (Vitest + React Testing Library, mocked Supabase client) — `npm test -- --run`.
2. **Database permission tests** against the real Supabase project — `supabase/tests/rls_checks.sql` (SQL Editor) and `scripts/rls-probe.ts` (anon key over the real API).
3. **Manual end-to-end tests** in the deployed or local app — the table in section 3. Fill in **Result** (Pass / Fail) and **Notes** (date, browser/device, screenshot name) as you go.

---

## 1. Automated tests

Run: `npm test -- --run` · last run: 2026-11-02 · **112 passed, 0 failed** (13 files)

| File | Tests | What it covers |
|---|---|---|
| `src/test/auth.test.tsx` | 9 | Every protected route (`/dashboard`, `/surveys/new`, `/surveys/:id/edit`, `/present`, `/results`) redirects to `/login` when logged out; landing page is public; bad credentials show "Incorrect email or password."; login returns to the requested page; email shown + logout. |
| `src/test/dashboard.test.tsx` | 10 | Status-dependent actions, text badges, created date, search/status filters, empty states, delete warning with response count, Escape closes dialog and returns focus, activate-with-confirm, duplicate → editor, friendly errors. |
| `src/test/editor.test.tsx` | 10 | Validation next to fields, 2 MC + 1 T/F question survey with reordering (exact save payload), type-switch confirm, delete question confirm, choice delete minimum, active survey read-only, survey with responses locked, save → activate → present, unsaved-changes guard, save error. |
| `src/test/present.test.tsx` | 8 | Public URL helper, QR image + readable URL + `<slug>-qr.png` download, empty-count message, 5-second polling, close flow, activate flow, copy link. |
| `src/test/student.test.tsx` | 10 | **Student form validation** (unanswered question highlighted and focused), single submission with browser token (double-click guard), thank-you screen, `DUPLICATE_RESPONSE`, returning student, `SURVEY_NOT_ACTIVE`, raw DB error never shown + retry, closed vs not found, load error retry. |
| `src/test/results.test.tsx` | 5 | Counts and percentages as text, "No answers", archived/closed/active, Present QR only when active, refresh, CSV export (BOM bytes, file name, content), error + retry. |
| `src/test/a11y.test.tsx` | 3 | Dialog labelled + Tab/Shift+Tab trap + Escape while pending; skip link first; one h1; page title. |
| `src/lib/csv.test.ts` | 14 | **CSV helper**: RFC 4180 quoting, CRLF, formula-injection guard (`= + - @` tab), slug/file name, header/rows/summary layout. |
| `src/lib/editor.test.ts` | 9 | Reorder helper, True/False choices, type switching, validation rules, dirty-check snapshot. |
| `src/lib/results.test.ts` | 6 | Percentage rounding (45/52 = 86.5), formatting, pluralize, chart rows. |
| `src/lib/filters.test.ts` | 6 | Title search, status filter, inclusive date range, combined filters. |
| `src/lib/errors.test.ts` | 16 | Every RPC error code, PostgREST not-found / bad UUID, auth, permission, network and unknown errors map to the friendly UI.md texts (raw DB text is never returned). |
| `src/lib/token.test.ts` | 6 | Token reuse, storage blocked fallback, no `crypto.randomUUID` fallback, submitted-survey memory. |

Other automated checks run during development:
- `npm run lint` — 0 problems. `npm run build` — passes.
- Both migrations + `rls_checks.sql` executed on PostgreSQL 18 (PGlite) with Supabase-style roles: 23/23 PASS (see DECISIONS.md "How the SQL was verified"). **This does not replace running them in Supabase.**
- WCAG contrast script on the compiled CSS colours: 22/22 pairs pass AA (AI_HISTORY.md, Session 12).
- `scripts/rls-probe.ts` type-checks and exits with a clear message (exit code 2) when env vars are missing or the server is unreachable. It has **not** been run against a live database yet.

---

## 2. Database permission tests (run against Supabase)

| Test | Steps | Expected | Result | Notes |
|---|---|---|---|---|
| SQL RLS checks | Supabase → SQL Editor → paste `supabase/tests/rls_checks.sql` → Run | 23 rows, all `PASS`; no test surveys left afterwards; your active survey (if any) still active | Pass | 2026-11-05: run by the AI agent through the Supabase Management API (23/23 PASS, 0 surveys/responses/answers left), then re-run by me in the SQL Editor: 23/23 PASS (Screenshot 1) |
| Anon API probe | `npx tsx scripts/rls-probe.ts` (uses `.env.local`, anon key only) | All checks `PASS`, exit code 0 | Pass (agent) | 2026-11-05, run by the AI agent: 8 passed, 0 failed, 2 skipped (no active survey yet; the submit check needs `--submit`) |
| Anon probe with submission | Activate a **test** survey, then `npx tsx scripts/rls-probe.ts --submit` | First submit PASS, second fails with `DUPLICATE_RESPONSE` → PASS. Creates one test response (delete the test survey afterwards) | | |

---

## 3. Manual end-to-end test plan

Use a real Supabase project with the migrations applied, public sign-ups disabled and one instructor user.

| # | Test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| 1 | Instructor login (valid) | Open `/login`, enter instructor email + password, Log In | Button shows "Logging in..."; lands on `/dashboard`; header shows "Signed in as <email>" | | |
| 2 | Instructor login (invalid) | Wrong password | "Incorrect email or password."; no raw error | | |
| 3 | Protected routes | Logged out, open `/dashboard` and `/surveys/<id>/results` directly | Redirect to `/login`; after login you return to the page you asked for | | |
| 4 | Logout | Click Logout, then press browser Back | Back on login; dashboard not accessible | | |
| 5 | Sign-ups disabled | Supabase → Authentication → Providers/Sign In: "Allow new users to sign up" is off | Off | Pass (agent) | 2026-11-05, set by the AI agent through the Management API (`disable_signup: true`); a sign-up attempt with the anon key returned 422 `signup_disabled` |
| 6 | Survey creation stores it (DB) | New Survey → title "Test 1" → Save Draft. Supabase → Table Editor → `surveys` | A row with title "Test 1", status `draft` | | Screenshot 2 |
| 7 | Adding questions creates records (DB) | Add 2 Multiple Choice (3 choices each) + 1 True/False question → Save Draft. Check `questions` and `choices` | 3 `questions` rows (positions 1–3, correct types); 8 `choices` rows; T/F has "True"(1) and "False"(2) | | Screenshot 2 |
| 8 | Editor validation | Empty title / empty question / blank choice → Save Draft | Errors next to each field, first invalid field focused, nothing saved | | |
| 9 | Survey editing + reorder | Edit "Test 1": change a question, move question 3 to the top, reorder choices → Save Draft → refresh | Order and edits are kept after refresh; DB positions match | | |
| 10 | Data survives refresh | After saving, reload the editor and the dashboard (F5) | Same title, questions, choices, status | | |
| 11 | Unsaved changes warning | Type in the editor, click Back to Dashboard; also try closing the tab | "Leave without saving?" dialog; browser prompt on tab close | | |
| 12 | Activation | Dashboard → Activate "Test 1" | Present page opens with QR + URL `/s/<8-char slug>`; dashboard badge "Active" | | |
| 13 | Only one active survey | Create "Test 2", Activate it | Dialog "This will close "Test 1""; after confirming, Test 1 is Closed, Test 2 Active; `surveys` has exactly one `active` row | | |
| 14 | Active survey is read-only | Open `/surveys/<active id>/edit` | "This survey is active. Close this survey to edit it."; fields disabled | | |
| 15 | QR-code links | Scan the projected QR with a phone (production URL) | Phone opens `/s/<slug>` on the production site with the survey | | |
| 16 | QR download | Present → Download QR | File `<slug>-qr.png` downloads and scans | | |
| 17 | Student submission persists (DB) | On the phone answer all questions → Submit | "Submitting..." then "Thank you! Your response has been recorded."; one new `responses` row and one `answers` row per question | | Screenshot 3 |
| 18 | Student validation | Submit with one question unanswered | Question outlined in red, "Please choose an answer.", page scrolls to it | | |
| 19 | Duplicate-submission prevention | (a) Same phone: open the link again. (b) DevTools → Application → Local Storage: delete only `classroom-survey.submitted-surveys` (keep the token), reload, answer, Submit | (a) "You have already submitted a response to this survey." (b) Server rejects it (`DUPLICATE_RESPONSE`) and the same message appears; still only one `responses` row for that token | | |
| 20 | Present page count | Submit from 2–3 devices while the Present page is open | Count updates within ~5 s | | |
| 21 | Closing surveys | Present → Close Survey → confirm; then submit from a phone that still has the form open | Status Closed; phone gets "This survey is no longer accepting responses." | | |
| 22 | Closed / unknown links | Open `/s/<closed slug>` and `/s/doesnotexist` | "This survey is no longer accepting responses." / "Survey not found." | | |
| 23 | Results calculations | Results page for a survey with known answers (e.g. 3 responses: A, A, B) | "3 responses"; A = 2 (66.7%), B = 1 (33.3%); counts and percentages visible as text | | |
| 24 | Results come from the DB | Compare the results page with `select choice_id, count(*) from answers group by choice_id` in the SQL Editor; submit one more response and click Refresh | Numbers match the SQL; Refresh shows the new response | | |
| 25 | Historical results | Archive a closed survey; open its Results; filter dashboard by status Archived and by created date | Results still shown; filters find it | | |
| 26 | Edit closed survey with responses | Open Edit on a closed survey that has responses | Questions locked with explanation; title/description can be saved | | |
| 27 | Duplicate | Duplicate a survey with responses | Editor opens "Copy of …" as Draft with the same questions/choices and 0 responses | | |
| 28 | Delete with responses | Delete a survey that has responses | Strong warning showing the response count; after confirming, the survey and its responses are gone | | |
| 29 | CSV export | Results → Export CSV; open in Excel **and** Google Sheets | File `<title>-results-<date>.csv`; header row with question texts; one row per response; accents correct; summary section at the bottom; a choice like `=1+1` shows as text | | |
| 30 | Mobile layout | Phone (or devtools at 375 px, 768 px, 1440 px): student page, dashboard, editor, results | Single column on phone, tap targets ≥44 px, no horizontal scrolling, buttons wrap | | |
| 31 | Two browsers | Repeat tests 1, 12, 17, 23 in two browsers (e.g. Chrome + Firefox/Safari) | Same behaviour | | |
| 32 | Keyboard only | Tab through every page; use dialogs with keyboard; skip link | All controls reachable, visible focus ring, Escape closes dialogs, focus returns | | |
| 33 | Unauthorized access attempts | Logged out: open `/dashboard`, `/surveys/<id>/results`; run `scripts/rls-probe.ts` | Redirect to login; probe all PASS (anon cannot read responses/answers, insert/update/delete surveys, read drafts, call results/activate RPCs) | | |
| 34 | Database Row Level Security | Run `supabase/tests/rls_checks.sql` | All PASS | Pass | 2026-11-05, 23/23 PASS on the live project, run by the agent and re-run by me in the SQL Editor (see section 2, Screenshot 1) |
| 35 | Production smoke test (Prompt 14) | On the Cloudflare Pages URL: login, activate, scan QR, submit, results | Everything works on the production URL; QR points to production | | Do after deployment |
