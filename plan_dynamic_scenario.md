# Implementation plan: dynamic scenario unlocking

Covers `back.md` item 10 ("Cenários bloqueados"). Today `app/scenarios.js` carries a literal
`locked: true` on `restaurant` and `arzt`, and `app/page.js` refuses the click. Nothing in the
running app can ever flip that flag. This plan turns the flag into a **requirement** that the
user's own practice history satisfies.

Scope: progress-based unlocking only. No payment, no level test, no new AI call.

---

## 1. What unlocks a scenario

### 1.1 The rule

A scenario may declare **one prerequisite scenario** and two ways to clear it:

```js
// app/scenarios.js
requires: { scenario: "fahrkarte", score: 60, attempts: 3 }
```

It is unlocked when, on the prerequisite scenario, the user has either

- a **best score >= `score`**, or
- **>= `attempts` finished conversations**, whatever the scores were.

A scenario with no `requires` key is open to everyone, always.

### 1.2 The numbers, concretely

| Scenario | Level | `requires` | In words |
| --- | --- | --- | --- |
| `fahrkarte` | A2 | none | Always open. The only entry point. |
| `restaurant` | A2 | `{ scenario: "fahrkarte", score: 60, attempts: 3 }` | One decent ticket-counter conversation, or three tries. |
| `arzt` | B1 | `{ scenario: "restaurant", score: 75, attempts: 4 }` | A Bronze-medal restaurant run, or four tries. |

### 1.3 Why these numbers and not others

- **60** is not invented for this feature: `scoreClass()` in `app/page.js` already calls 60+
  "ok" (the amber band), and the score card colours it that way. The user has already seen
  60 mean "passable" before they hit the gate.
- **75** is the existing **Bronze** threshold in `MEDAL_TIERS` (`app/page.js`), which the
  leaderboard screen already advertises as "Noch N Punkte bis Bronze". Reusing it means the
  progress bar the user is already chasing *is* the unlock condition. Stepping up a CEFR
  level (A2 -> B1) should cost a medal; staying at the same level should not.
- **60 is reachable but not free.** From `app/scoring.js`: goal reached (30) + all three
  tasks (20) already gives 50, so a completed conversation with any grammar at all clears 60.
  A two-turn bail-out cannot: engagement alone caps at 10, and without `goalReached` the
  ceiling is 70 before grammar/vocab ratings, which a broken conversation will not reach.
- **The `attempts` escape hatch is the fairness rule.** Score depends on `gpt-5-nano`'s
  judgement, which we do not control and cannot tune per user. A learner who genuinely
  cannot hit 60 must not be stuck staring at two grey rows forever - in a language app,
  being walled out is the thing that makes people close the tab. Three honest attempts buy
  the next scenario. Effort is a legitimate currency; this makes the gate a pace-setter, not
  a filter.
- **A first-time user is never stuck**: `fahrkarte` is `featured: true`, has no `requires`,
  and is the hero card on home. Section 5.4 adds a selftest that fails the build-time check
  if every scenario ever ends up gated.

### 1.4 Rules deliberately rejected

- **Streak-based** ("3 Tage Serie schaltet frei"): rewards showing up, not speaking. Someone
  could unlock `arzt` across three days without ever finishing a conversation, and someone
  who practises hard on one Saturday gets nothing. It also punishes the user for a missed
  day, which is a harsher failure mode than a low score.
- **Favorites mastered** (`reviews >= MASTER_AT`): the `reviews` counter is incremented by
  the user tapping "Got it" (`markReviewed`). It measures clicks, not knowledge, and would be
  unlocked by tapping one card three times.
- **A CEFR ladder computed from an average score** ("reach B1 to open B1 scenarios"):
  opaque. The user cannot see what moves it, and "Noch 4 Punkte Durchschnitt" is not a thing
  anyone can act on. The prerequisite rule is legible: it names one scenario and one number.
- **Total finished conversations across all scenarios**: would let someone grind `fahrkarte`
  ten times and unlock `arzt` without ever touching `restaurant`, breaking the ladder the
  levels imply.

---

## 2. Where the unlock state lives

**Recommendation: derived on the fly from `sessions`, no new table, no migration.**

This is exactly the `currentStreak` pattern in `app/db.js`: the facts are already in
`sessions` (one row per finished conversation, with `scenario_id` and `score`), so a second
copy of them can only drift.

One query serves the whole feature:

```sql
SELECT scenario_id, MAX(score) AS best, COUNT(*) AS plays
  FROM sessions
 WHERE user_id = ?
 GROUP BY scenario_id
```

It is covered by the existing `sessions_user` index (`user_id` is the leading column), and
the row count per user is tiny - one row per conversation ever held.

### What this trades away

- **No permanent unlock.** If a threshold is ever *raised*, or rows are deleted, a scenario
  the user had open can close again. Mitigation, written into `HowTo-challenge.md`: unlock
  thresholds are append-only - loosen freely, never tighten a published one; to retire a
  rule, delete the `requires` key (which only ever opens things).
- **No `unlocked_at` timestamp**, so "you unlocked this on the 14th" and unlock-rate
  analytics are not available without adding the table later.
- **No unlock without a session row.** A manual grant ("support unlocked this for you") has
  no place to live. Not needed today; would be the reason to add the table.

The alternative, `CREATE TABLE unlocks (user_id, scenario_id, unlocked_at)` written from
`/api/feedback`, buys permanence and an audit trail, and costs a migration, a write path, and
a permanent risk that the table and the rule disagree. Not worth it for three scenarios.

---

## 3. Server vs client trust

**Be honest: a locked scenario is not a security boundary, and should not be built as one.**

- `app/scenarios.js` is imported by `app/page.js`, a `"use client"` component. Every locked
  scenario's `system` prompt, vocab and phrases are **already in the JavaScript bundle** of
  every visitor. There is no secret behind the lock.
- `/api/chat` accepts any id that `knownScenario()` recognises, which includes locked ones.
  Anyone with devtools can hold the conversation today.
- Cost is already capped elsewhere: `DAILY_AI_CALLS = 120` in `app/guard.js`, counted before
  the model runs. Unlocking changes nobody's spend.

So the lock is a **pacing and motivation feature**. What still needs server enforcement is
the narrow part where one user's behaviour reaches another user:

| Place | Enforce? | Why |
| --- | --- | --- |
| The unlock computation itself | **Server** | It reads `sessions`; the client has no access and must be told the answer. |
| `/api/feedback` | **Yes, enforce** | It is the only writer of `sessions`, and `sessions` feeds the **global** leaderboard (`readBoard`). A row for a scenario the user has not unlocked is a score in a public ranking they did not earn the right to enter. One extra query on a route that already calls an LLM: free. Returns `fail("Dieses Szenario ist noch gesperrt.", 403)`. |
| `/api/chat` | **No** | Gating it would add a D1 read to **every conversation turn** (latency, and D1 row reads on the free tier) to protect content that is already in the client bundle. Pure cost, zero protection. |
| Client list rendering | Presentation only | Renders what `/api/me` says. Tampering with it only lets someone start a conversation they could already start by hand - and the `/api/feedback` gate still refuses the score at the end. |

**The remaining honest hole, stated plainly:** `/api/feedback` accepts any well-formed
transcript. Someone can POST a scripted, perfect `fahrkarte` conversation they never spoke and
unlock `restaurant` in one request. That hole exists today for the leaderboard and is not made
worse by this feature. Closing it needs server-side turn recording in `/api/chat` (comparing
the submitted transcript against what the server actually generated), which is a separate,
larger piece of work and out of scope here.

---

## 4. The API

**Recommendation: no new endpoint. Unlock state rides on `/api/me` and `/api/feedback`.**

`/api/me` is already the bootstrap call the home screen awaits before it paints, and the
home screen is exactly where the locks are shown. A separate `GET /api/progress` would add a
second round trip to the same screen for no gain.

### 4.1 `GET /api/me` (extended)

`app/api/me/route.js`, same `resolveUser` / `json({ setCookie, clearCookie })` shape:

```jsonc
{
  "email": null,
  "name": null,
  "anonymous": true,
  "streak": 2,
  "progress": {                       // per scenario, only scenarios ever played appear
    "fahrkarte": { "best": 64, "plays": 3 }
  },
  "unlocked": ["fahrkarte", "restaurant"]   // authoritative, computed server-side
}
```

`progress` lets the client render "how far to go" without another request; `unlocked` is the
server's own verdict so a client/server rule skew shows up immediately instead of silently.
The user's id is still never returned (that rule in the route's comment stands).

### 4.2 `POST /api/feedback` (extended)

`app/api/feedback/route.js` gains, in order:

1. After `resolveUser`, before `overQuota`: read progress, and if `scenario.id` is not in the
   unlocked set, `return fail("Dieses Szenario ist noch gesperrt.", 403)`. Placed before the
   quota counter so a refused request does not burn an AI call from the allowance.
2. After the `INSERT INTO sessions`: recompute the unlocked set from the **same** progress
   object merged in memory with the row just written (`best = max(best, score)`,
   `plays + 1`) - exactly equivalent to re-querying, one D1 read cheaper.
3. Response gains three fields next to `evaluation`, `score`, `board`, `streak`:

```jsonc
{
  "progress": { "fahrkarte": { "best": 72, "plays": 4 } },
  "unlocked": ["fahrkarte", "restaurant"],
  "newlyUnlocked": ["restaurant"]     // difference across this one conversation
}
```

### 4.3 New code

**`app/db.js`** - one function, alongside `currentStreak`:

```js
// Best score and attempt count per scenario, for the unlock rules. Derived, like the
// streak: sessions is the only record of what the user has practised.
export async function readProgress(db, userId) { /* the GROUP BY query from section 2 */ }
```

**`app/unlock.js`** - new pure module, no imports outside `./scenarios.js`, so plain `node`
can run its selftest (the pattern `app/scoring.js` and `app/favkey.js` already follow):

```js
export function isUnlocked(scenario, progress)      // -> boolean
export function unlockedIds(progress)               // -> string[] over all scenarios
export function requirementLabel(scenario, progress) // -> German string, section 7
export function checkRequirements(list)             // -> string[] of rule defects, for the selftest
```

It is imported by `app/page.js` (labels), `app/api/me/route.js` and
`app/api/feedback/route.js` (the gate) - the same shared-module arrangement as `app/tags.js`
and `app/favkey.js`.

---

## 5. Client changes

### 5.1 `app/scenarios.js`

Delete `locked: true` from `restaurant` and `arzt`; add `requires` per the table in 1.2. The
key changes meaning from "a fact about the scenario" to "a condition on the user", so the old
name goes rather than being reinterpreted.

```js
// restaurant
requires: { scenario: "fahrkarte", score: 60, attempts: 3 },
```

Update the field table in `How To/HowTo-challenge.md` (lines 25 and 140 mention `locked`) and
the endpoints/notes tables in `How To/HowTo-backend.md`.

### 5.2 `app/page.js` - the list

Around line 773, `!s.locked` becomes a lookup against server state:

```js
const unlocked = new Set(me?.unlocked || []);
const open_ = !s.requires || unlocked.has(s.id);
```

- `onClick={() => open_ && open(s)}`, `aria-disabled={!open_}` - the existing CSS
  (`.row[aria-disabled="true"] { opacity: 0.6 }`, line 155 of `globals.css`) already handles
  the grey.
- `.row-meta`: `{open_ ? s.category : "Gesperrt"}` stays as the short label.
- `.row-sub`: when locked, replace `s.desc` with `requirementLabel(s, me.progress)` - the
  concrete, counting-down line from section 7. This is the whole point: the row stops saying
  "no" and starts saying "one more conversation".
- **While `me` is still null** (first paint, or `/api/me` failed): render gated rows disabled
  with an empty requirement line and no "Gesperrt" text - a neutral, non-shouting state. Do
  not optimistically open them: a click would carry the user through the intro and into a
  conversation that `/api/feedback` refuses to score at the end, which is a far worse
  experience than a half-second of quiet rows.
- **The hero**: `scenarios.find((s) => s.featured)` (line 699) is not lock-aware. It happens
  to be `fahrkarte` today, but guard it - prefer the first featured scenario that is
  unlocked, else the first unlocked scenario overall. The hero must never be a dead button.
- Optional, cheap, and good for motivation: a stat in the "Learn more" panel next to the
  streak - `{unlocked.size} von {scenarios.length}` "Szenarien frei".

### 5.3 `app/page.js` - the unlock moment

`endConversation()` already receives the `/api/feedback` response. Add:

```js
setMe((m) => (m ? { ...m, progress: res.progress, unlocked: res.unlocked } : m));
```

so home is correct without a refetch, and keep `res.newlyUnlocked` in a new
`const [unlockedNow, setUnlockedNow] = useState([])`, cleared in `open()` alongside
`setFeedback(null)` / `setBoard(null)`.

Render it in two places, both **after** the score is shown, so it reads as a reward:

1. **Leaderboard screen** (`stage === "leaderboard"`), a banner under `.result-hero`:
   "Neu freigeschaltet: Im Restaurant bestellen". Announcement only, no navigation - the
   user is on their way to the evaluation and must not be yanked out of the flow.
2. **Evaluation screen** (`stage === "feedback"`), at the bottom next to the existing
   buttons: the same line plus a button "Jetzt starten" calling `open(byId(id))`, which
   drops the user straight into the new scenario's intro.

New CSS in `globals.css` (reuse the existing vocabulary): a `.unlock-note` styled like
`.lb-rank-badge` / `.lb-row.new` (accent border, the existing `badgePop` keyframe) so it
looks native rather than bolted on.

### 5.4 Invariant the selftest enforces

`checkRequirements(scenarios)` must report, and `app/unlock.selftest.mjs` must assert empty:

- at least one scenario with no `requires` (otherwise a new user has nothing to do);
- every `requires.scenario` resolves via `byId`;
- no cycles and no self-reference in the prerequisite graph;
- `score` within 0-100 and `attempts >= 1`.

---

## 6. The anonymous problem

State it plainly, because it decides how deep the ladder may get.

Identity today is the `rp_uid` HttpOnly cookie mapped to a `users` row with `email IS NULL`
(`resolveUser` in `app/db.js`). Google login is coded but its secrets are unset, so **every
visitor is anonymous**. That means:

- Progress is **per browser**. A second device, a private window, or a cleared cookie is a
  new user with an empty `sessions` table, and every gated scenario closes again.
- Sign-out already drops the cookie (`DELETE /api/me`), by design, so a signed-out user is
  back to zero until they sign in again.

**The important asymmetry: clearing cookies loses progress, it does not grant it.** The
anonymous weakness is not an exploit against the gate - a fresh identity is strictly *more*
locked. So the feature is safe to ship before login exists; the failure mode is a user losing
work, not a user cheating.

**Recommendation: ship now, but keep the ladder shallow until login is live.** With the
numbers in 1.2, re-earning everything after a cookie loss is one or two conversations, maybe
five minutes. That is an acceptable cost for a feature that is otherwise nothing but upside.
Concretely, until `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `AUTH_SECRET` are set:

- keep exactly one prerequisite hop per scenario (no chains longer than the 1.2 table);
- never make a rule depend on `streak` or on anything accumulated over days - those are the
  requirements that hurt when a cookie disappears;
- do not add a visible "Fortschritt" percentage that can silently reset to zero.

When login lands, nothing has to be rewritten: `resolveUser` already **adopts** the anonymous
row on first Google login, so the sessions collected before signing in carry over, and the
derived unlock state comes with them for free. A deeper ladder is a data change in
`scenarios.js` at that point, not a code change.

---

## 7. German UI copy

All new strings. No emojis anywhere (hard rule in `CLAUDE.md`).

| Situation | String |
| --- | --- |
| Short meta label, locked (unchanged) | `Gesperrt` |
| Prerequisite never played | `Zuerst „Fahrkarte kaufen“ abschließen` |
| Score is the shorter path (n = points missing) | `Noch 12 Punkte in „Fahrkarte kaufen“` |
| Attempts is the shorter path, 1 left | `Noch 1 Gespräch in „Fahrkarte kaufen“` |
| Attempts is the shorter path, n left | `Noch 2 Gespräche in „Fahrkarte kaufen“` |
| Both paths comparably far | `Noch 12 Punkte oder 2 Gespräche in „Fahrkarte kaufen“` |
| Loading / state unknown | (empty line, no text) |
| Banner, one scenario unlocked | `Neu freigeschaltet: Im Restaurant bestellen` |
| Banner, more than one | `Neu freigeschaltet: 2 Szenarien` |
| Button in the banner (evaluation screen) | `Jetzt starten` |
| Badge on an unlocked, never-played row | `Neu` |
| Intro screen reached while still locked (defensive) | `Noch gesperrt` in place of `Los geht's` |
| Server refusal from `/api/feedback` (403) | `Dieses Szenario ist noch gesperrt.` |
| Optional stat in "Learn more" | `{n} von {m}` + `Szenarien frei` |

`requirementLabel()` picks between these. Rule for which path to name: show the one requiring
fewer remaining conversations-worth of effort; show both only when the points gap is under 15
and more than one attempt remains. The existing "Noch N Punkte bis Gold" line on the
leaderboard is the model for the tone - always a countable number, never "keep practising".

---

## 8. Verification

### 8.1 Pure logic - `node`, no server

New `app/unlock.selftest.mjs`, following `app/scoring.selftest.mjs` (which imports
`./scoring.js` and `./scenarios.js` with extensions so plain `node` resolves them - keep
`app/unlock.js` free of any Next-only import for the same reason):

```bash
node app/unlock.selftest.mjs
```

Assertions:

- empty progress unlocks `fahrkarte` and nothing else;
- `checkRequirements(scenarios)` returns `[]` (the section 5.4 invariants);
- boundary: `{ fahrkarte: { best: 59, plays: 1 } }` keeps `restaurant` locked,
  `best: 60` opens it;
- attempts path: `{ fahrkarte: { best: 12, plays: 3 } }` opens `restaurant` despite the score;
- monotonicity: for a spread of progress objects, raising `best` or `plays` never moves a
  scenario from unlocked back to locked;
- `arzt` stays shut while only `fahrkarte` has been played, whatever the `fahrkarte` score;
- label text: each row of the section 7 table is produced by the progress state it describes,
  including `Gespräch` vs `Gespräche`.

### 8.2 Against a local D1

```bash
npx wrangler d1 migrations apply rolepartner --local   # no new migration, but keeps the db current
npm run preview                                        # opennextjs-cloudflare build + wrangler dev
```

(`npm run preview` is the repo's documented path in `How To/HowTo-backend.md`; it is
`wrangler dev` underneath, against `.open-next/worker.js`.)

Drive the progression without holding real conversations:

```bash
# who am I (after one page load, which mints the row)
npx wrangler d1 execute rolepartner --local --command \
  "SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 3"

# fabricate a passing fahrkarte session
npx wrangler d1 execute rolepartner --local --command \
  "INSERT INTO sessions (user_id, scenario_id, title, score, transcript, evaluation)
   VALUES ('<id>', 'fahrkarte', 'Fahrkarte kaufen', 64, '[]', '{}')"

# re-lock everything for the next pass
npx wrangler d1 execute rolepartner --local --command \
  "DELETE FROM sessions WHERE user_id = '<id>'"
```

### 8.3 Driving the UI

1. Fresh browser profile -> home shows `fahrkarte` open, `restaurant` and `arzt` grey with
   `Zuerst „Fahrkarte kaufen“ abschließen`. Confirm the hero is `fahrkarte` and clickable.
2. `/api/me` in devtools -> `progress: {}`, `unlocked: ["fahrkarte"]`.
3. Hold one short `fahrkarte` conversation to the end. If it scores under 60, the row should
   read `Noch N Punkte in „Fahrkarte kaufen“` or `Noch 2 Gespräche …`, counting down from the
   first attempt - this is the copy check that matters most.
4. Insert the row from 8.2 to cross 60 and reload -> `restaurant` opens.
5. The unlock moment end to end: with `plays = 2` seeded, finish a real third `fahrkarte`
   conversation -> the leaderboard screen shows `Neu freigeschaltet: Im Restaurant bestellen`,
   the evaluation screen shows it with `Jetzt starten`, and going back home shows the row
   already open without a reload (the `setMe` merge in 5.3).
6. Server gate, with a fresh user's cookie:

```bash
curl -i -X POST http://localhost:8787/api/feedback \
  -H 'content-type: application/json' -H 'origin: http://localhost:8787' \
  -H 'cookie: rp_uid=<fresh id>' \
  -d '{"scenarioId":"arzt","messages":[{"role":"user","content":"Guten Tag"}]}'
# expect 403 {"error":"Dieses Szenario ist noch gesperrt."}
```

7. Confirm the refusal did **not** increment `ai_usage` for that user (the gate sits before
   `overQuota`):

```bash
npx wrangler d1 execute rolepartner --local --command \
  "SELECT * FROM ai_usage WHERE user_id = '<fresh id>'"
```

8. `/api/chat` with `scenarioId: "arzt"` on the same fresh user still answers 200 - that is
   intended (section 3), and the test exists to document it, not to fail.

---

## 9. Risks and open decisions

### Decisions for the user

1. **Two of three scenarios start locked.** With only three scenarios in the catalog, a new
   visitor sees two grey rows, which can read as a paywall tease rather than a ladder.
   Alternatives: (a) ship as specced and add scenarios soon; (b) soften `restaurant` to
   `{ scenario: "fahrkarte", attempts: 1 }` - one finished conversation, any score - so the
   first gate falls within minutes and only `arzt` is a real goal. **Recommendation: (b) if
   the catalog stays at three scenarios; (a) once there are six or more.**
2. **Wait for Google login?** Recommendation: no, ship now with the shallow ladder
   (section 6). Deepening it later is a data edit in `scenarios.js`.
3. **Is `arzt` at Bronze the right ask,** given B1 content judged by a model prompted for A2
   habits? If early testing shows scores clustering low, drop `arzt` to `score: 70`. Only
   loosen, never tighten (section 2).

### Risks

- **Score distribution is unknown.** I could not query the deployed D1 or run the app against
  a live model, so 60 and 75 are reasoned from `app/scoring.js`'s weights, not from observed
  scores. The `attempts` fallback is what keeps a mis-set threshold from becoming a wall;
  check real scores after a week and adjust down if needed.
- **Re-locking.** Derived state means a rule change or deleted rows can close a scenario the
  user had open. Handled by the append-only convention, but it is a real property of the
  choice, not an oversight.
- **Mid-conversation rule change.** If a threshold is tightened while someone is talking,
  their `/api/feedback` call 403s and the conversation is lost unscored. Another reason the
  append-only rule is a rule and not a preference.
- **Transcript forgery** (section 3) makes the gate bypassable by anyone willing to use
  devtools. Accepted: it is a pacing feature, and the same hole already exists for the
  leaderboard.
- **Anonymous progress loss** (section 6). Accepted while the ladder is shallow.

### Effort

| Piece | Estimate |
| --- | --- |
| `app/unlock.js` + `app/unlock.selftest.mjs` | 1.5 h |
| `readProgress` in `app/db.js`, `/api/me` and `/api/feedback` changes | 1 h |
| `app/page.js`: list rendering, hero guard, unlock moment, `globals.css` | 2 h |
| `scenarios.js` data + docs (`HowTo-challenge.md`, `HowTo-backend.md`) | 0.5 h |
| Local D1 verification pass (section 8.2, 8.3) | 1 h |
| **Total** | **~6 h, one focused day** |

No migration, no new dependency, no new AI call, no new endpoint.

---

## What I could not verify

- **Real score distribution.** No access to the deployed D1 and no live model run; the
  thresholds are derived from the weights in `app/scoring.js`, not measured.
- **The logged-in path.** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `AUTH_SECRET` are
  unset in this checkout, so the claim that `resolveUser`'s anonymous-row adoption carries
  progress across a first login is read from the code in `app/db.js`, not observed.
- **The app was not run** during this planning pass (no `npm run preview`, no build), so the
  line numbers cited in `app/page.js` are from the current checkout and will drift with edits;
  anchor on the identifiers (`open(s)`, `aria-disabled`, `row-meta`, `endConversation`)
  instead.
