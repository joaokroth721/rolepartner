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
