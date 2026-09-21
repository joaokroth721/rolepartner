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

### The mission, repeated on the conversation screen

The goal and the briefing's tasks now appear during the conversation too, German first
with the English blurred behind the same Show/Hide English toggle as the briefing. The
goal is the first thing that slips once the talking starts, and the only way to check it
was to leave the chat.

One component, `GoalPanel`, now renders it in both places: the briefing's own copy was
replaced by it rather than a second copy being written, so the two cannot drift.

Two deliberate differences on the conversation screen:

- It sits **after** the controls, so "Sprechen" stays reachable without scrolling.
- It is a `<details>`, open by default and foldable, and the goal drops from the
  briefing's 18px headline to body size. Reused verbatim, the panel was tall enough to
  push the tasks off a 390px screen, which is the opposite of a reminder.

The English toggle inside the `<summary>` calls `preventDefault` and `stopPropagation`,
or clicking it would also fold the panel away.

Checked in a browser at 390px, both screens: panel present during the conversation,
4 of 4 English lines blurred by default, none after the toggle with the panel still open,
folded away on a summary click, and no page errors. The briefing renders as before.

## 20.09.2026

### New challenge: "Weniger ist mehr"

From Lektion 11 (Konsum, Minimalismus): the learner is a guest on Sabrina Krause's podcast
"so einfach" and talks about decluttering. B1, category Konsum, playable.

This lesson carries **three** Kommunikation boxes rather than one, so the challenge has one
task per box, each worded as the move it asks for:

| Page | Box | Task |
| --- | --- | --- |
| 54 | Einschätzungen formulieren | Say how you would feel in an almost empty flat, and why |
| 55 | Verzicht ausdrücken | Name three things you could do without, and say why |
| 57 | Argumente einschränken | Qualify Sabrina's argument instead of simply agreeing |

Worth noting: the S.57 set is *not* the same wording as Lektion 10's box of the same name
("Ich denke zwar auch, dass … Das heißt jedoch nicht, dass …" against "Einerseits …
andererseits …"), so both sets exist in the app separately rather than one standing in for
the other.

Measured, not assumed: each of the six phrases matches from a sentence a learner would
really say rather than the template recited, and with identical examiner ratings the spoken
run scores 91 against 83 for bland agreement, before the task grading adds its own gap.
`app/scoring.selftest.mjs` asserts every box individually, so a reworded phrase that stops
matching fails the test instead of silently scoring nothing.

Sabrina is prompted to contradict the learner at least once ("Aber Dinge erzählen doch
Geschichten.") precisely so the third box has something to qualify.

### The Kommunikation rule is now written down

`How To/HowTo-challenge.md` gained a "Where the content comes from" section: challenges are
built from Kursbuch lessons, and the KOMMUNIKATION boxes are the point of the challenge,
not decoration. Every box goes into `phrases` (which the measured half of the vocabulary
score matches against the transcript) and gets its own entry in `tasks` (which the examiner
grades 0-2), and both must be checked to fire before shipping. This was implicit in the two
challenges built so far and is now the documented recipe.

## 20.09.2026

### New challenge: "Weniger ist mehr" (Lektion 11, Minimalismus)

A podcast recording with Sabrina Krause, the minimalism blogger from the chapter. B1,
category Konsum, playable; no partner illustration yet, so it exercises the fallback the
Tier 0 work added.

This lesson carries **three** Kommunikation boxes rather than one, and the challenge is
built so each is a required move:

| Box | Page | Task |
| --- | --- | --- |
| Einschätzungen formulieren | 54 | Say how an almost empty flat would feel, and why |
| Verzicht ausdrücken | 55 | Name three things you could do without |
| Argumente einschränken | 57 | Qualify Sabrina's argument instead of agreeing |

Note the "Argumente einschränken" set here is worded differently from Lektion 10's
("Ich denke zwar auch, dass … Das heißt jedoch nicht, dass …"), so both sets exist in the
app, each attached to its own challenge.

Measured, not assumed: all six phrases register from sentences a learner would really say
rather than the template recited, and with identical examiner ratings a conversation that
uses the boxes scores 91 against 83 for bland agreement. `app/scoring.selftest.mjs` now
asserts each box matches individually, which is stricter than the coaching test: it checks
the match came from `phrases` and not merely from a vocabulary word in the same sentence.
That distinction mattered - a first run looked like a pass because "der Krempel" matched in
a sentence whose actual phrase had not been checked.

### Where challenge content comes from, written down

`How To/HowTo-challenge.md` gained a section saying the KOMMUNIKATION boxes are the point
of a challenge: every box goes into `phrases` (which the measured half of the vocabulary
score matches against the transcript) and gets its own entry in `tasks` (which the examiner
grades 0-2), and both must be checked before shipping. That was the owner's instruction,
and it belongs where the next session will read it rather than only in a chat log.

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

## Admin review: verified end to end, and the way in

The dashboard from `0557e23` had never been reviewed or opened by anyone. This pass was a
review of it, a real end-to-end run against the local Worker, and the runbook the owner
needs to actually get in.

### What the review found

Three things were changed; everything else stood.

1. **A `POST /api/admin/admins` with a body that is not JSON returned 500.** `await
   req.json()` threw into the `catch`, which is `oops()` - the convention for *unexpected*
   failures. A body the caller sent is the caller's mistake: it now parses with a
   `.catch(() => null)` and falls into the existing 400. `JSON.parse("null")` used to
   throw on the destructuring too, and no longer does.

2. **Adding an `ADMIN_EMAILS` address through the UI wrote a row nobody could see or
   delete.** `INSERT OR IGNORE` ran for any valid address; `adminList()` then filtered that
   row out of the response because the address is pinned, and `DELETE` refused it for the
   same reason. Harmless while the address stays in the secret - and a silent revocation
   failure the moment it is taken out, because the invisible row keeps granting access.
   POST now skips the insert for a pinned address and returns the unchanged list, so the
   trap cannot be created. Verified: `SELECT COUNT(*) FROM admins` stays 0 after adding a
   pinned address.

3. **`DELETE` checked "that is you" before "that is pinned".** For the owner - who is both
   - the answer was "Du kannst dich nicht selbst entfernen", when the actionable answer is
   "this comes from ADMIN_EMAILS and must be removed there". Order swapped. Same 400
   either way, so nothing about access changed.

Also added: `Cache-Control: no-store` on every 200 from the two admin routes, via
`adminJson()` in `app/admin.js`. Every byte these routes return is other people's data, and
without a directive a browser may keep a 200 in its disk cache - on a shared machine that
outlives the session the gate checked. The gate is per request, so the answer must be too.

What was looked at and left alone:

- **No path reaches admin data without `requireAdmin`.** `app/adminreport.js` is not
  imported anywhere else; both routes call the gate before anything else, and the client
  page holds no cross-user data of its own - every table it draws comes from a gated fetch,
  so a stranger who forces `/admin` open gets the shell and a 403.
- **Every statement is parameterised.** `before`, `id` and `limit` are bound;
  `scenarioId` is validated against `scenarios.js` first and dropped if unknown; `view` is
  compared, never interpolated. The `WHERE` clause in `conversationList` is assembled from
  fixed strings with `?` placeholders, in step with the bind array.
- **Nothing in `/api/admin` mints or returns an identity cookie.** The gate deliberately
  does not call `resolveUser`, and the routes never call `json()`. Confirmed on the wire:
  no `Set-Cookie` on 401, 403 or 200, and `users` stayed at 5 rows across every
  unauthenticated probe.
- **Errors do not leak internals.** `oops()` returns one fixed German sentence and logs the
  stack; `fail()` carries only messages written for a person.

### Measured, not assumed

Local D1 rebuilt from scratch (`rm -rf .wrangler`, then all three migrations: 0003 applied
cleanly on top of an empty database, creating `admins`, `visits`, `ai_tokens`) and seeded
with 5 users (3 with an email, 2 anonymous), 8 `visits` rows over three days, 6 `ai_tokens`
rows over three days, 4 `sessions` across three scenarios and 2 favorites. Then
`opennextjs-cloudflare build` + `npx wrangler dev` on :8787, driven with curl and with
Playwright.

**The session was real, not stubbed.** Auth.js's own `encode()` from `next-auth/jwt` minted
an `authjs.session-token` with the same `AUTH_SECRET` the Worker had in `.dev.vars`, and
the Worker's own `auth()` decrypted it - confirmed by `/api/auth/session` returning the
account. Nothing in `app/` was patched for the test and no shim is left behind; the only
untestable part is Google's own redirect, which cannot be completed from this sandbox. The
`GOOGLE_*` values were dummies, which the session-read path never touches.

Observed:

- No session: 401 `{"error":"Nicht angemeldet."}` on all four endpoints, no `Set-Cookie`,
  no new row in `users`.
- `anna@example.com`, signed in, not on the list: 403 `{"error":"Kein Zugriff."}` on all
  four, and the page renders "No access" rather than an error.
- `joao.kroth7@gmail.com` via `ADMIN_EMAILS`: 200 everywhere. Overview returned
  `you: joao.kroth7@gmail.com`, 32 page opens (13 today), 5 users (3 with an email), 4
  conversations averaging 61, 52 AI calls, 50,700 tokens, $0.006035 estimated - each figure
  re-derived from the seed by hand and matching. 14-day series filled every day including
  the empty ones.
- Allow list: add lowercases and trims (`"  Anna@Example.com "` -> `anna@example.com`) and
  the added address goes from 403 to 200 immediately; a duplicate add keeps the original
  `added_by`; removing takes it back to 403. 400 for an invalid address, for a malformed
  body, for removing yourself, and for removing a pinned address - tested with a second
  pinned address (`Owner2@Example.com`, mixed case in the env, normalised on read) so the
  pinned branch was reached without the self check short-circuiting it. 403 for a
  cross-site `Origin`, 200 for the page's own.
- Conversations: list, `scenarioId` filter, one conversation by id, 404 for a missing id,
  404 for `id=abc`, 400 for an unknown `view`, and `scenarioId=1' OR 1=1--` ignored
  (4 rows, i.e. unfiltered) rather than reaching SQL.
- `/api/me` with the owner's session returns `"admin":true`, which is what puts the Admin
  link in the learner top bar; `anna` gets `false`, anonymous gets `false`.
- In a real browser (Playwright, Chromium): all five tabs rendered with the seeded data and
  **zero page errors**; signed out shows "Not signed in" with the Google button, non-admin
  shows "No access", and a conversation opens with its transcript and the examiner JSON.
- `npx next build` clean; `scoring`, `history` and `texts` self-tests pass.

### The owner's way in

`joao.kroth7@gmail.com` is now the documented value of `ADMIN_EMAILS` in `.env.example` and
`.dev.vars.example`, and nowhere else. Not in application code and not in a migration: who
may read every user's data is environment configuration, it has to change without a code
deploy, and a migration would bake it into a database that outlives any decision about it.
The example files are templates the app never reads, so this is documentation, not a
default that takes effect anywhere.

`How To/HowTo-admin.md` is the runbook, in order, with what to expect after each command:
migration 0003 `--remote`, the Google OAuth client (consent screen in *Testing* needs the
owner as a test user, redirect URI
`https://app.rolepartner.workers.dev/api/auth/callback/google`), one deploy **before** the
secrets so the Worker exists under its new name `app`, then `wrangler secret put` for
`AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ADMIN_EMAILS`, then sign in
and open `/admin`. The deploy-first order matters: secrets belong to a Worker by name, and
`app` (commit `f90e03d`) has never been deployed, so anything set before that first deploy
could land on a Worker that never serves the app.

### Still open

- Nothing here can be verified in production from this session: `api.cloudflare.com` and
  `workers.dev` are blocked by the egress proxy. Everything above is the local Worker.
  The remaining steps are account setup, not code, and are the runbook.
- `AUTH_URL` is still not set anywhere. `auth.js` has `trustHost: true`, so the callback
  origin is taken from the request and the deploy works without it; it is only needed if
  the app is ever served from a second hostname.
- The user list still runs three correlated subqueries per row (unchanged from `0557e23`).
- `How To/HowTo-backend.md` still prints the pre-`93c36b1` scoring weights (goal 30,
  conversation held 10, mistakes -10). Left alone here because scoring is being edited in
  parallel, but it is wrong today.

## Talking illustration during the conversation (plan only)

`plan_video.md` written, no code touched. The idea: while the partner speaks, show a person
that represents the scenario with a mouth that moves.

The deciding fact is that the conversation speaks with the browser's `speechSynthesis`
(`app/page.js:835`), which plays straight to the OS and exposes no audio stream and no
reliable viseme/word events. That splits every option in two: keep `speechSynthesis` and
*fake* the mouth (free, unsynced), or replace it with fetched TTS audio played through an
`<audio>` element to get a *real* amplitude/viseme mouth (costs money per reply, adds a
round-trip).

Four tiers, laziest first: Tier 0 a 2D **illustrated** persona (explicitly not realistic,
one drawn character carrying both who the partner is and where the scene is) with a mouth
faked off the existing "speaking" state - zero code cost, art is the only cost, recommended
start; Tier 1 OpenAI TTS (key already wired) + wawa-lipsync for real browser lip-sync, which
also replaces the robotic voice flagged at `page.js:607`; Tier 2 photoreal streaming avatars
(HeyGen/Tavus/D-ID), rejected as overkill for a practice tool; Tier 3 pre-rendered video per
reply, rejected as too slow for live chat. Open gate before building: leave the free browser
voice for paid TTS or not - that is the Tier 0 to Tier 1 line.

---

## Talking illustration: Tier 0 shipped for "Fahrkarte kaufen"

`c1f57ef` - the wiring for the art drawn in `30b23ca`. Only Tier 0 of `plan_video.md`,
and only the one scenario.

**What it is.** A new optional scenario field carries the art and the mouth anchor:

    partner: { art: "/partners/fahrkarte.svg", mouth: { x: 50, y: 59, w: 7 } }

`PartnerStage` in `app/page.js` renders the image and, over it, a `<span>` mouth placed from
those percentages. The numbers live with the scenario rather than in the component, so the
next illustration is a mouthless drawing plus three numbers, with no code change. The field
is optional and the component returns `null` without it: on a phone the coaching screen is
pixel-for-pixel what it was, no placeholder and no reserved space. That fallback matters
more than the feature right now, since two scenarios are locked and coaching has no art.

**Why the mouth is CSS and not state.** The obvious version flips React state on an interval
to redraw the mouth. It would run a render loop on a phone for the whole reply. Instead the
speaking state changes exactly twice per utterance (`onstart` / `onend`), toggles one class,
and a `@keyframes` on a transform does the rest on the compositor. The movement therefore
costs nothing while it runs, and `@media (prefers-reduced-motion: reduce)` drops both
animations while keeping the illustration.

**Why it follows the utterance and not a guess.** `speak()` sets `onstart`, `onend` and
`onerror` on the utterance it creates, so the mouth starts when the OS voice really starts.
Browsers disagree on what `speechSynthesis.cancel()` fires (Chrome fires `end`, the spec
says `error`), and a cancel can hit a voice that never started, in which case neither fires
and the mouth would keep flapping after the user left. So every exit now goes through a
`stopSpeaking()` that cancels *and* clears the state: `back()`, `navTo()` and
`endConversation()`. Verified with a stub whose `cancel()` fires nothing at all, the worst
case: the mouth still stopped.

**Decorative, not labelled.** `aria-hidden` on the figure, empty `alt` on the image, matching
every other `<img>` in the app. It repeats what the transcript already says; announcing a
drawing on every turn would be noise, and the speaking state is audible by definition.

**Measured, not assumed.** Playwright against `next dev`, with a speech stub driving
`onstart`/`onend`, at 390x844 and 1280x900:

- the mouth lands at exactly 50% / 59% of the art box, 22x4 px closed at phone size,
  and the `mouthTalk` keyframe is live only while speaking (sampled 21x9 mid-animation)
- the speaking class is 1 while the voice runs, 0 after `onend`, 0 after `Zurück`
- `Sprechen` / `Gespräch beenden` sit at y=554 in an 844 px viewport, so the art does not
  push the controls below the fold; the transcript and the star buttons are untouched
- the coaching scenario renders zero `.partner` nodes with both controls and both bubbles
- with `prefers-reduced-motion: reduce`: art visible, both animations `none`, mouth closed

The art is 320 px wide on a phone and 400 px (its drawn size) from 700 px up; capping the
height as well (`min(400px, 46vh)`) is what keeps a short laptop window from hiding the
buttons.

**Not done here.** No TTS change, so the mouth is still unsynced to the words - that is the
Tier 0 bargain and the gate to Tier 1 is still the paid-voice decision. Coaching has no art
and the two locked scenarios have none either.

---

## 20.09.2026

## Two challenges from the Kursbuch: Lektion 8 and Lektion 9

Two new scenarios in `app/scenarios.js`, built the way `How To/HowTo-challenge.md`
prescribes: the KOMMUNIKATION boxes of the lesson are the challenge, everything else
is staging for them.

**`innereuhr` - "So tickt unsere innere Uhr" (Wissenschaft, B1).** Lektion 9, Tagesrhythmus.
The partner is Jule Bergmann, host of the radio show "Neues aus der Forschung"; the learner
is the studio guest, like Sören Rasmussen on S. 43. The show's running order in the `system`
prompt is what forces the four boxes in sequence: the guest's own Tageskurve (ein Schaubild
beschreiben, S. 42), the study on light (Überraschung ausdrücken / Wissen wiedergeben, S. 43),
the three Meldungen of which one is invented (Vermutungen äußern und begründen, S. 45), and
shift work plus an invention against it (ein Problem darstellen / ein Produkt vorstellen, S. 45).
Five tasks, one per move, because the examiner grades each task 0-2 and a skipped box has to cost.

The lesson's grammar (adversative Zusammenhänge) is carried as **vocab**, not prose: `im Gegensatz
zu` and `jedoch` are target words, so contrasting yourself with another sleep type is measured
against the transcript instead of merely encouraged. The `system` prompt also demands the
comparison out loud, so the partner asks for it rather than hoping for it.

**`esstyp` - "Alles unter Kontrolle?" (Essen, B1).** Lektion 8, Essverhalten. The partner is
Barbara from the Kolumne on S. 39, hosting dinner and weighing every ingredient. Two halves,
matching the two KOMMUNIKATION boxes: reacting to her control (Verständnis, Unverständnis,
Gleichgültigkeit, S. 40) and then arguing about controlling what you eat (Argumente und
Gegenargumente nennen, Argumente einschränken, zustimmen, widersprechen, S. 41). The Zustandspassiv
of S. 40-41 is not a task; Barbara simply narrates the table in it ("Die Eier sind von
glücklichen Hühnern gelegt.", "Das Brot ist mit viel Liebe gebacken."), so the learner meets
Passiv mit *von* und *durch* as input, where a task would have turned it into a grammar drill.
The idioms of the Wörter box (S. 40) sit in `vocab` as the fixed pairs they are - `durch und durch`,
`hin und wieder`, `kurz und gut`, `fix und fertig` - which is also the form that matches in a transcript.

**Measured, not assumed** (`node app/scoring.selftest.mjs`, extended with both challenges):

- every one of the 13 + 12 Kommunikation phrases registers from a sentence a learner would
  really say, not from the template recited verbatim (the phrase matcher wants 60 percent of
  the content words, so a filled-in gap still matches)
- a run using the boxes outscores a bland one on the same judgement, and the bland run hits
  zero targets - so the briefing is worth reading, in numbers
- `im Gegensatz zu` and `jedoch` both register from one natural contrast sentence
- `tasksEn` mirrors `tasks` in length for both
- `npx next build` passes

**Phrase wording is chosen for the matcher, not copied from the page.** Two rejections worth
recording. Book templates with a slash (`Jede/r hat das Recht …`, `Ab … sinkt / fällt …`)
tokenise with the slash attached, so they can never match; they are written out instead. And
short templates whose words are all common produce false positives at the 60 percent threshold:
`Das größte Hoch habe ich am …` would have matched a bare "Ich habe am Morgen Zeit" (3 of 5
words), so it became `Mein größtes Hoch habe ich am …` (4 of 6 needed), which that sentence
misses. Same reason `Soviel ich weiß, …` was extended to `Soviel ich weiß, hängt das mit … zusammen.`: on its own, a plain "ich weiß nicht" would have scored it.

Open: neither challenge has `partner` art, so the conversation screen shows no illustration
for them. Both use a `picsum` seed as the header photo, like `coaching` and `minimalismus`;
a curated image would be better but nothing depends on it.

## Security audit: are the Google OAuth credentials retrievable?

Asked to check whether the Google OAuth credentials can be recovered by any route. Audited,
and the answer is no - with one gap in the fence, which this commit closes.

**Nothing is leaking today.** What was checked, and what it showed:

- **Git history, every blob.** Walked all objects on all refs (`git rev-list --objects --all`,
  `git cat-file` each blob) against patterns for a Google client secret (`GOCSPX-…`), a client
  id (`…apps.googleusercontent.com`), OAuth access and refresh tokens (`ya29.…`, `1//…`), an
  OpenAI key (`sk-…`), a Google API key (`AIza…`) and PEM private keys. One hit in total:
  `phc_xxxxxxxxxxxx` in `plan_posthog.md`, a placeholder. `-S` searches for `GOCSPX`,
  `apps.googleusercontent.com` and `AUTH_SECRET=` found only documentation and empty
  assignments. No secret has ever been committed, so there is nothing to rotate and no
  history to rewrite.
- **The client bundle.** `GOOGLE_CLIENT_SECRET` is read in exactly one place, `app/auth.js`,
  which is imported only by `app/db.js`, `app/admin.js` and the `[...nextauth]` route - all
  server. The three `"use client"` files import `next-auth/react` and never `./auth`.
  Grepping `.next/static` for the values found nothing; the one chunk that contains the
  string `ADMIN_EMAILS` contains it as a table label on the admin page, not as a value. No
  source maps are emitted, so the server code is not reconstructable from the assets either.
  Next only inlines `NEXT_PUBLIC_*`, and the only two are the PostHog key and host, which are
  publishable by design.
- **The runtime.** No `callbacks` in `app/auth.js`, so the session is Auth.js's default JWT:
  name, email, image. The Google `access_token` / `refresh_token` / `id_token` are never put
  in the token, never returned by `/api/auth/session`, and no table has a column for them
  (the `ai_tokens` "tokens" are billing counters). Unexpected exceptions go through `oops()`,
  which logs the stack to the Worker and returns a fixed German sentence, so a stranger
  cannot provoke a stack trace that names the configuration.
- **What is served publicly.** `public/` is four SVGs. `.open-next/assets` does not exist in
  this tree. `.dev.vars` and `.env.local` are absent from disk and untracked.

**The gap: `.gitignore` named files, not shapes.** The old list was `.env`, `.env*.local`,
`.env.local`, `.dev.vars`. That covers the files that happen to exist right now and misses
their neighbours: `.env.production`, `.dev.vars.production` and `.dev.vars.local` were all
committable, as were `client_secret_*.json` and `service-account.json`, the names the Google
console and gcloud hand you on download. The repo is **public**
(`github.com/joaokroth721/rolepartner`), so any one of those is the whole OAuth client the
moment it is created - and `.env.example` actively points at `.env.production` as a place to
put the build-time PostHog key, which is exactly the file a server secret gets added to by
mistake later.

Fixed by inverting the default: `.env*` and `.dev.vars*` are ignored, with `!.env.example`
and `!.dev.vars.example` re-admitting the two that are meant to be tracked, plus `*.pem`,
`*.key`, `*.p12` and the `*client_secret*.json` / `*service-account*.json` /
`*credentials*.json` shapes. Verified with `git check-ignore` over thirteen filenames: all
seven env spellings and all four credential names ignored, both examples still tracked, and
`app/page.js` unaffected. The two example files remain in `git ls-files`.

Deliberately not blanket-committing `.env.production`: it is now ignored like the rest, and
if the PostHog key ever needs to ship in the build it goes in with `git add -f` after being
read. The friction is the point on a public repo - a file that holds one publishable key is
the file someone later pastes a client secret into.

Two things noted and not changed, because neither is a leak:

- `trustHost: true` in `app/auth.js` means Auth.js builds the callback URL from the `Host`
  header. This is required on Workers and is not exploitable for credential theft here:
  Google validates `redirect_uri` against the registered list, so a forged host produces a
  URI Google refuses. Left as is.
- `ADMIN_EMAILS=joao.kroth7@gmail.com` is committed in both example files and therefore
  public. It is not a credential - the gate in `app/admin.js` needs a Google-verified session
  for that address, so knowing it grants nothing - but it does tell an attacker which single
  account to phish for the admin dashboard. Worth knowing; not worth a placeholder, since the
  value being concrete is what makes "How To/HowTo-admin.md" followable.

Open: nothing in code. If the deployed Worker's secrets were ever set from a file that later
left the machine, that is an account-side question this audit cannot see - `wrangler secret
list` shows names only, by design.

## Lektion pill on the four Kursbuch challenges

`app/scenarios.js` gains an optional `lektion` field, set on the four scenarios that come
from a Kursbuch chapter: `esstyp` / "Alles unter Kontrolle?" -> Lektion 8, `innereuhr` /
"So tickt unsere innere Uhr" -> Lektion 9, `coaching` / "Erfolgreich scheitern" -> Lektion 10,
`minimalismus` / "Weniger ist mehr" -> Lektion 11. The other three scenarios (`fahrkarte`,
`restaurant`, `arzt`) are not from the book and carry no `lektion`.

It renders in the three places a scenario already shows its metadata: the intro header pills,
the catalog row meta, and the featured hero eyebrow. Every site guards on the field, so a
scenario without it looks exactly as it did before.

Stored as the full display string ("Lektion 8") rather than a number. A number would have
needed a formatter at each of the three render sites to earn nothing: there is no sorting,
filtering or arithmetic on it, and the string is what the pill shows. Rejected making it a
filter chip alongside `category` for the same reason - four of seven scenarios have one, so
a "Lektion" chip row would be mostly empty, and the user asked for a tag, not a facet.

New `.lektion` CSS in `app/globals.css` copies the CEFR pill's geometry (same size, radius,
padding) in neutral slate, so the two pills sit as a pair and the level keeps sole ownership
of the A/B/C color coding. There is no dark-mode block in this stylesheet, so none was added.

`npx next build` passes. `How To/HowTo-challenge.md` documents the field in the object
template, the intro description, and the authoring checklist.
## Login gate: the app now requires Google sign-in

The backend for this already existed and was untouched: `resolveUser` in `app/db.js`
keys a user by Google email, adopts an anonymous cookie row on first login, and the
JWT session cookie keeps you signed in. Favorites and progress were already stored in
D1 per user. The only thing missing was the front-end gate, so that is all that changed.

Three edits in `app/page.js` plus login styles in `globals.css`:

- `Home()` now reads `useSession().status`. When it is not `authenticated`, the whole
  app is replaced by a full-screen `LoginScreen` with a single "Mit Google anmelden"
  button. `loading` shows a disabled placeholder so the button does not flash.
- the bootstrap effect (`/api/me` + `/api/favorites`) now returns early unless
  authenticated, and depends on `authStatus`. Before, it fired on every page load and
  minted an anonymous user; with a hard gate there is no reason to create anonymous
  rows, so it waits for the session and runs when one appears.
- the existing `AuthButton` in the topbar is unchanged; it still handles sign-out.

Consequence worth noting: the anonymous-use path (cookie identity, then adoption on
login) is now unreachable from the UI. The code in `db.js` that supports it is left in
place, not deleted: it is harmless, and removing it is a separate decision.

**Blocked on account setup, not code.** Sign-in will error until Google OAuth
credentials exist. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are empty in
`.env.local` (`AUTH_SECRET` and `OPENAI_API_KEY` are set). Create an OAuth client at
https://console.cloud.google.com/apis/credentials with redirect URIs
`http://localhost:3000/api/auth/callback/google` (dev) and the production callback, then
fill those two vars. In production they are Worker secrets
(`npx wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`), plus `AUTH_URL`.

`npx next build` passes.

## Four Kursbuch challenges lifted from B1 to B2.1

`coaching`, `minimalismus`, `innereuhr`, `esstyp` were all tagged B1. They now read
B2.1. This was not a label swap: relabelling without touching the content would have
lied about the difficulty. What actually changed per scenario:

- **phrases** (the target language the score measures against the transcript): rewritten
  in B2.1 register. Subjunctive II hypothesising, abstract adversative/concessive
  connectors (gleichwohl, dem steht entgegen, weniger … als vielmehr, ließe sich
  einwenden), and pro/contra weighing replace the flatter B1 chunk phrases. Each list is
  now 6-7 phrases instead of the old 5-13.
- **tasks**: sharpened toward analysis and nuance (analyse the real cause, differentiate
  by context, weigh two methods against each other) rather than name/describe.
- **system**: each partner got one line demanding B2-level answers ("Verlange
  differenzierte, gut begründete Antworten und gib dich nie mit einem Satz zufrieden.").

The old phrase-list comments tied each set to specific B1 Kursbuch Kommunikation boxes
and page numbers (Lektion 8/9, S. 40-57). Those mappings no longer hold after the
rewrite, so the comments were replaced with a note on the B2.1 register instead.

No UI or CSS change needed: the level badge keys off `level[0]`, so "B2.1" reuses the
existing `level-B` styling, and the home-screen level filter is built from
`new Set(scenarios.map(s => s.level))`, so "B2.1" shows up as a filter option on its own.

Left open: the four scenarios' `vocab` lists were left as-is. They are already
appropriate, and swapping words would not raise the level the way the phrases do. Revisit
if the scenarios feel too easy in practice.
