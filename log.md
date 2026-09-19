# Work log

## 16.09.2026 - 18.09.2026

From a local Next.js app with no backend to a deployed one on Cloudflare, with a
database, a real scoring system and product analytics.

---

## 1. Deploy to Cloudflare free tier

`c08560a` - build config and env plumbing, no app code.

The path is OpenNext (`@opennextjs/cloudflare`), because Cloudflare has no verified
Next.js adapter yet. Before committing anything, the whole pipeline was tried in a
sandbox to replace guesses with facts:

- The adapter supports Next 16.3.4 (`next: ">=15.5.24 <16 || >=16.3.3"`).
- The build refuses to run without a `next.config` file; the repo had none.
- The Worker bundle is 1275.80 KiB gzip, against the 3 MiB free-tier cap.
- Google OAuth works on workerd: the full redirect with PKCE was exercised locally,
  so no change to `app/auth.js` was needed.

Files: `next.config.mjs`, `open-next.config.ts`, `wrangler.jsonc`, deploy scripts,
`.env.example` corrected to `OPENAI_API_KEY` (which is what the routes actually read).

**Correction made during the day:** the prerendered page is served by the Worker, not
from static assets. Page loads therefore count against the 100k/day request budget;
only `/_next/*` and the SVGs are unmetered.

Live at `https://app.rolepartner.workers.dev`.

---

## 2. D1 backend

`331b801`, `d66053c` - the data flows from the 16.09 diagram.

Everything that lived in `localStorage` moved to Cloudflare D1.

| Table | Holds |
| --- | --- |
| `users` | One row per person; `email` NULL until Google login exists |
| `favorites` | Every starred item, any type, with type-specific fields as JSON |
| `sessions` | One finished conversation: transcript, evaluation, score |

Deviation from `back.md`: no separate `scores` table. The leaderboard reads
`sessions.score` directly, so there is nothing to keep in sync.

New in the UI: the **leaderboard screen** between the conversation and the evaluation,
showing the score and the global Top 10. The streak in the topbar became a real
measurement from distinct practice days instead of a hardcoded 7.

Identity before login: an `rp_uid` cookie maps a browser to an anonymous row, and the
first Google login adopts that row, so favorites collected beforehand survive.

A race was found and fixed during testing: loading `/api/me` and `/api/favorites` in
parallel minted two users on a first visit. The bootstrap is sequential now.

---

## 3. Removing the fake

`698ac4d` - the demo evaluation.

The "Vorschau (Demo)" button injected a canned conversation and a fixed 82/100 with the
same two corrections every time, rendered in the same medal and leaderboard UI as a real
result. Removed, along with `DEMO_SEED` and the old result modal.

An audit of the rest of the app found no other fake user data. It did find a real bug:
`setError` was only rendered on two screens, so a failed load or a failed save was
silent everywhere else. Fixed.

Still flagged, not changed: the reader's `picsum.photos` placeholder images, the
unreachable `showEn` branch, and `locked: true` scenarios that can never unlock.

---

## 4. Security review and server-side scoring

`d71d947` - three findings, all fixed, plus the scoring rebuild the first one forced.

1. **Anyone could write any score.** `POST /api/sessions` took `evaluation.score` from
   the request body. A loop without a cookie minted a fresh user per request, so the
   Top 10 could be flushed permanently. The route is gone; `/api/feedback` is now the
   only writer of `sessions`.
2. **The `rp_uid` cookie could reach a Google account.** After login the cookie held the
   account's id and the logged-out lookup did not filter on `email IS NULL`, so the
   cookie alone resolved to the full account - and sign-out never cleared it. On a
   shared machine the next person inherited the previous user's data.
3. **Raw exception text reached anonymous callers**, D1 error messages included.

No SQL injection (all `.bind()`), no XSS sink, no hardcoded secrets.

### Scoring

There was no real scoring system: the model was asked to "rate 0-100" and returned a
number. Unreproducible between runs and sent through the client.

Now the model reports only what it can judge, and `app/scoring.js` computes the score:

| Part | Points | Source |
| --- | --- | --- |
| Goal reached | 30 | Model |
| Briefing tasks | 20 | Model, one flag per task |
| Grammar | 20 | Model 0-5 |
| Vocabulary | 20 | 12 measured from the transcript, 8 rated |
| Conversation held | 10 | Student turns, full at 6 |
| Mistakes | -10 max | Past the first two |

The measured vocabulary part is deliberate: a fluent improviser who ignores the briefing
scores 88, not 100. Two equivalent conversations now score equally, which is what makes
a shared leaderboard mean anything. The evaluation screen shows the breakdown.

### Before the API key

Daily AI allowance per user, counted before the model runs, plus transcript size caps
and a same-origin requirement on writes.

---

## 5. Plans for the remaining back.md items

`080b7b4`, `623520e`, `db7ff4b` - three plans, one per item, written by separate agents.

- `plan_session_history.md` (item 7)
- `plan_dynamic_scenario.md` (item 10)
- `plan_posthog.md` (item 12)

---

## 6. PostHog analytics

`55a71c3` - nine events.

The whole app is one route, so a pageview measures nothing. A derived screen name drives
a `screen_viewed` event and is registered as a super property, which is what makes
"closed the tab mid-conversation" measurable.

Initialised in `instrumentation-client.js` rather than a provider: it runs before
hydration and keeps posthog-js out of the Worker bundle, verified by grep.

Privacy: the star buttons sit inside chat bubbles holding speech transcripts, and
autocapture walks the element tree, so text masking is on. Sentence lookups send no
text; word lookups send the word, which is published content.

**Open item.** PostHog's own "Self-driving" agent later pushed `db95e78`, which enabled
Session Replay and removed the client-side opt-out. `mask_all_text` does not mask
replay - it only feeds autocapture - so recordings could capture conversation
transcripts, which two Replay Vision scanners (LLMs) would then read. Fix is one line:
`disable_session_recording: true`, or `session_recording: { maskTextSelector: "*" }` to
keep replay with text blanked. Decision pending.

---

## 7. Session history

`a8d8844` - `plan_session_history.md`, implemented.

Conversations were already stored and never shown. The Review tab now has two
sub-views, **Sammlung** and **Verlauf**, plus a session detail screen. The payoff is not
old scores: reopening a past evaluation makes its star buttons work, so a correction not
saved at the time becomes recoverable.

No migration, no new table, no new dependency. The CSS for the list was already in
`globals.css`, unused, from the old localStorage version.

Three existing bugs fixed along the way: `toggleFav` hardcoding the scenario title,
`navTo` not clearing the detail screen, and the Review empty state hiding history from
users with no favorites.

---

## 8. Worker renamed

`wrangler.jsonc` `name` changed from `rolepartner` to `app`, so the URL is
`app.rolepartner.workers.dev` instead of `rolepartner.rolepartner.workers.dev`. The
account subdomain is already `rolepartner`, and Cloudflare always serves
`<worker>.<subdomain>.workers.dev`, so a two-label `rolepartner.workers.dev` is not
available at all.

Done now because it is nearly free at this point: no secrets had been set on the old
worker yet and Google OAuth was not configured, so there was no redirect URI to update
and nothing to re-add. The D1 binding carries over untouched, since it references the
database by id.

A rename creates a new Worker rather than moving the old one, so `rolepartner` has to be
deleted separately or it keeps serving the old URL.

---

## 9. Evaluation model reworked (Version A)

Kept the architecture that was already right: the model reports observations, server code
in `app/scoring.js` computes the score. Fixed five weaknesses of the old rubric, none of
which needed a new LLM call or per-scenario machinery. Weights still sum to 100, now:
goal 25, tasks 20, grammar 20, vocabulary 20, interaction 15.

- **Goal is graded 0-3, not a boolean.** A near-miss now beats a no-show
  (`goalCompletion: 2` scores 92 vs 75 for full miss on the perfect transcript). Old
  all-or-nothing goal made "almost closed the deal" score identically to "never tried".
- **Tasks graded 0-2 each** instead of done/not-done, so partial task credit is smooth.
- **Removed the per-error penalty.** It double-counted: grammar errors already lower the
  grammar rating, and the penalty was a function of how many corrections the model chose
  to *report* (capped at 5), not how many were made. Grammar accuracy is the grammar
  rating's job alone now.
- **Vocabulary split inverted to 12 judged + 8 measured** (was 12 measured + 8 judged).
  Correct paraphrase that never says the exact briefing lemma is no longer punished, but
  the measured floor still stops a fluent improviser from maxing vocab by ignoring the
  briefing. The `targetsUsed()` string matcher is unchanged, just weighted less.
- **Engagement (raw turn count) replaced by interaction:** the model's 0-5 interaction
  rating gated by a turn-count floor, so quality is judged but a one-line transcript still
  can't claim full marks (`min(5, ceil(5*turns/4))`). Raw turn count rewarded padding;
  monosyllabic "ja/nein" turns can't game the new one.

All ratings are now anchored to explicit CEFR-A2 descriptors in the prompt, and the
`generateObject` call runs at `temperature: 0`, so the same transcript yields the same
observations and therefore the same score. Corrections gained a `severity` field
(major/minor); the route sorts major first, and it drives display only, never the score.

Touched: `app/scoring.js` (formula), `app/api/feedback/route.js` (schema + prompt +
sort), `app/page.js` (breakdown label engagement to interaction, dropped the penalty
line, PostHog `goal_reached` now `goalCompletion >= 2`), `app/scoring.selftest.mjs`
(rewritten for the new judgement shape). Self-test passes. Not committed yet.

Old `sessions` rows carry the old breakdown shape (`engagement`, `penalty`,
`goalReached`); the history/session screens just omit the bar they no longer recognize,
which is harmless. `sessions` is empty anyway until `OPENAI_API_KEY` is set.

The three candidate methodologies (A, B, C) are written up in `evaluation.md`; this
implements A.

---

## 19.09.2026

### New challenge: "Erfolgreich scheitern"

A second playable scenario alongside "Fahrkarte kaufen", from the Kursbuch chapter of the
same name (Modul 4, Lektion 10): Milo Hansen's Institut fuer erfolgreiches Scheitern,
career setbacks, and the strengths-and-weaknesses discussion round.

The point of it is the chapter's Kommunikation box, "Argumente einschraenken": qualifying
an argument instead of calling something simply good or bad. Making that unavoidable
needed no new machinery, only the existing two levers used deliberately:

- The five hedging patterns are the scenario's `phrases`, and `phrases` are what the
  measured half of the vocabulary score matches against the transcript.
- Tasks 2 and 3 name the move itself ("Waege eine Eigenschaft ab", "Widersprich Milo
  hoeflich und schraenke sein Argument ein"), and the examiner grades every task 0-2.

Measured, not assumed: same transcript quality and identical examiner ratings, the hedged
run scores 91 and the flat one 83, purely from phrase matching. If the examiner also marks
those two tasks skipped, the flat run drops to 73. So the communication is worth about 18
points, and `app/scoring.selftest.mjs` now asserts that gap so it cannot regress quietly.

The `einerseits ... andererseits` phrase matches from a natural sentence rather than
verbatim repetition, which the self-test also pins: phrase matching needs 60 percent of
the content words, not the whole template.

Level B1, the first non-A2 scenario that is actually playable. That exposed a real
mismatch: `evalSystem` in `app/prompts.js` hardcoded "a German A2 student" and "against
the A2 level", so a B1 briefing would have been graded against A2 descriptors and
flattered. The examiner prompt now takes the level from the scenario, and the schema
descriptions were reworded to point at that level instead of naming A2 themselves.

The photo is a picsum seed, like the reader's images, because a guessed Unsplash id can
404 on the hero. Worth swapping for a curated photo.

## State at the end of the day

Deployed and working: Cloudflare Workers, D1, favorites, leaderboard, streak,
server-side scoring, session history, the security fixes.

Waiting on account setup, not on code:

- `OPENAI_API_KEY` - until it is set, the conversation, the evaluation and non-glossary
  word lookups all return an error. Nothing has ever been scored, so `sessions` is empty.
- Google login - three secrets and a redirect URI. Until then every leaderboard row
  reads "Anonym".
- The session replay decision above.
- `main` still has none of this work; production runs from
  `claude/hopeful-hopper-c8gnva`.

Not started: dynamic scenario unlocking (item 10, planned), better voice (item 11),
and the one item nobody can do from a sandbox - rotating the OpenAI key that was
sitting in a synced folder.

---

## 19.09.2026

No app code changed. The branch that carried everything was merged into `main`, and two
claims the log made above are now wrong.

---

## Merged to main

Two fast-forwards, no merge commits:

- `331b801..f90e03d` - the 12 commits from 16-18.09 (Cloudflare, D1, removing the fake,
  the security review and server-side scoring, the three plans, PostHog, session history,
  the Worker rename).
- `f90e03d..93c36b1` - the evaluation rework, committed after the first merge and merged
  separately.

`main` had no commits of its own since `331b801`, so both merges were `--ff-only` and the
history stays linear. A merge commit would have recorded nothing a linear history does not
already say, and no pull request was opened because there was no second opinion to collect
on work already reviewed in place. `origin/main` and `claude/hopeful-hopper-c8gnva` now
point at the same commit.

**This does not deploy anything.** There is no CI in the repo - no `.github/workflows` -
and `wrangler.jsonc` binds a Worker name, not a branch. Production is whatever was last
pushed by hand with `wrangler deploy`, so `main` being current is a statement about the
repository and nothing else.

Verified rather than assumed: `node app/scoring.selftest.mjs` passes on the merged tree.
The graded goal behaves as intended - a near miss scores 92 against 75 for never trying,
where the old boolean scored both the same.

---

## Corrections to what is written above

- Item 9 ends "Self-test passes. Not committed yet." It was committed, as `93c36b1`, in
  the same commit that added that sentence.
- The end-of-day state says "`main` still has none of this work; production runs from
  `claude/hopeful-hopper-c8gnva`." The first half is no longer true. The second half was
  never about branches in the way it reads: nothing serves from a branch, it serves from
  the last manual deploy.

---

## Still open

Unchanged and still waiting on account setup, not code: `OPENAI_API_KEY`, Google login,
the session replay decision. Still not started: dynamic scenario unlocking, better voice,
and rotating the OpenAI key that was sitting in a synced folder.

One thing carried forward as unverified rather than done. Item 9 claims old `sessions`
rows, which carry the previous breakdown shape (`engagement`, `penalty`, `goalReached`),
degrade cleanly because the history and session screens "just omit the bar they no longer
recognize". Nobody has watched that happen - `sessions` is empty until `OPENAI_API_KEY` is
set, so it cannot have been exercised. It is a reading of the code, not an observation. If
it is wrong, the failure only appears once real rows exist and a user opens an old one.

---

## Admin page

A dashboard for the owner at `/admin`, plus the recording the app was not doing that it
needs. Five tabs: Overview, Tokens, Users, Challenges, Conversations.

### Its own route, not a sixth screen of `page.js`

The learner app is one page of state-driven screens on purpose and CLAUDE.md names them.
The admin page is a separate route anyway, for two reasons: it shares none of that state,
and every table on it reads across all users, so keeping it apart means none of that code
or data ships in the bundle a learner downloads. Its copy is English while the app is
German - it is an internal tool, and the methodology it reports (the examiner prompt, the
schema, the scoring rules) is English already, so translating the labels around it would
only have added a second vocabulary to keep in sync.

### Access

Email only, and only a Google-verified one (`app/admin.js`). The `rp_uid` cookie
identifies a browser and proves nothing, so an anonymous visitor can never clear the gate
whatever they send. `ADMIN_EMAILS` (comma separated) bootstraps the list, because the
`admins` table starts empty and the UI that fills it is itself behind the gate - without a
way in from outside the database the first admin could never exist. Those addresses cannot
be removed through the UI, which makes them the recovery path if the table is emptied, and
you cannot remove yourself, which is the other way a one-admin app locks itself out.

`requireAdmin` deliberately does not call `resolveUser`: that mints a row in `users` and an
identity cookie on first contact, so a stranger probing `/api/admin` would otherwise leave
a user record behind. Verified against the local worker: three unauthenticated probes
returned 401 with no `set-cookie` and created no rows.

### What it can now measure, and from when

Three things were not being recorded at all, so three tables were added (`0003_admin.sql`):

- `visits` - one row per user per day, incremented by `/api/me`, which the app calls once
  per page load. `users.last_seen_at` could already say *who* was here last; only this can
  say *how many times*, or how many people were here in a month that has since passed.
- `ai_tokens` - `(user, day, route, model)` with calls and input/output/reasoning tokens.
  `ai_usage` counts calls, and a one-word `/api/translate` call and a whole-transcript
  `/api/feedback` call are both "1" there while differing by two orders of magnitude in
  cost, so it could never answer "what am I spending".
- `admins` - the allow list.

All three aggregate rather than storing one row per event, so they stay small.

**These start at zero.** Nothing before this commit was counted, so the first weeks of
history simply do not exist. `users.created_at` is the only number here that reaches back.

Cost is an **estimate**, never a bill: the provider does not report prices over the API, so
the rate card is hardcoded in `app/ai.js` ($0.05 / $0.40 per 1M in/out for gpt-5-nano,
checked 19.09.2026) and goes stale the day prices change. A model with no entry makes the
total `n/a` rather than a number that silently omits it - the seeded test data included an
unpriced model specifically to watch that happen, and it did.

### Prompts and methodology are the real ones

`chatSystem` and `evalSystem` moved out of their routes into `app/prompts.js`, and the
eval JSON schema with them. The admin page calls the same functions the routes call, so it
cannot show a prompt the app does not send. A page that rebuilt the prompt from the same
scenario fields would have looked identical and drifted the first time a route changed a
line. Same reasoning for `SCORING_RULES` and `MATCHING_RULES`, which live in
`app/scoring.js` beside the arithmetic they describe, and for the schema field
descriptions, which are the rubric the examiner model is handed, quoted rather than
paraphrased.

The model id also moved to `app/ai.js`. It was typed out in three routes, and
`ai_tokens.model` records which model spent the tokens - a recorded model that can drift
from the one called is worse than no record.

### Conversations are other people's

The Conversations tab shows any user's transcript and the examiner's raw output. This is
the one feature here that is a real privacy step: those conversations are stored so the
learner can review their own history, and an admin reading them is a new thing. The tab
says so on the page. If that is not wanted, deleting the `conversations` branch of
`app/api/admin/route.js` and the tab removes it and leaves the rest working.

### Measured, not assumed

- All 13 SQL statements in `app/adminreport.js` were extracted from the source and run
  against a seeded local D1 - not retyped, so a query that only exists in a test cannot
  pass while the real one is broken. All 13 returned correct values.
- The three write statements (`visits` upsert, `ai_tokens` upsert, admin insert/delete)
  were exercised the same way: two `recordVisit` calls took hits 5 -> 7, two `recordUsage`
  calls accumulated 12 -> 14 calls and 9000 -> 9222 input tokens, and `INSERT OR IGNORE`
  kept the original `added_by` on a duplicate add.
- Against the local worker, with the Google session stubbed out for the test and the stub
  removed afterwards: 401 on all four endpoints when signed out, 403 on all four for a
  signed-in address that is not on the list (and the page shows "No access" rather than an
  error), 200 for an address in the `admins` table but *not* in `ADMIN_EMAILS`, so both
  halves of the allow list were exercised. Also: 400 for a malformed email, 400 for
  removing yourself, 400 for removing an `ADMIN_EMAILS` address, 403 for a cross-site
  POST, 404 for a missing conversation, and an unknown `scenarioId` filter ignored rather
  than passed to SQL. An address is lowercased on the way in, and a duplicate add is a
  no-op rather than an error.
- Every tab was screenshotted. Three things that only a screenshot catches were fixed: the
  learner topbar pins `.brand` absolutely and it overlapped five nav pills, a right-aligned
  number column had no gap before the next text column ("TOKENSFIRST SEEN"), and the 900px
  learner column was too narrow for a seven-column table.
- `scoring`, `history` and `texts` self-tests still pass.

### Charts

Single measure, single hue, one axis, values on hover with the peak named in the header
rather than a number over every bar, and a day with no traffic drawing no bar above the
baseline. Fourteen days, which is what fits without squinting and costs at most one row
per active user per day to read.

### Still open

- `ADMIN_EMAILS` is not set anywhere yet. Until it is, and until Google login is
  configured, nobody can open `/admin` - the gate works, there is simply no one on the
  list. Both are account setup, not code.
- `0003_admin.sql` has been applied locally only. Production needs
  `npx wrangler d1 migrations apply rolepartner --remote`. Until it is, `/api/me` logs a
  `recordVisit` failure per request and keeps working: the counters are wrapped so a
  missing table cannot break the bootstrap call every screen waits on.
- The user list runs three correlated subqueries per row. Right at this size, wrong at a
  hundred thousand users.
