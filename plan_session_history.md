# Implementation plan: session history

Makes the `sessions` table readable in the UI. Today `/api/feedback` writes one row per
finished conversation (transcript + evaluation + score) and nothing ever reads it back
except `currentStreak` and `readBoard`. This is `back.md` item 7.

**Headline: this feature needs no migration, no new dependency and no new table.** Every
column it displays already exists, and the index it needs (`sessions_user`) is already
there. It is one new API route, one new pure module, and roughly 150 lines of JSX in
`app/page.js`.

Written against the repo at commit `d71d947` on branch `claude/hopeful-hopper-c8gnva`.

---

## 1. Where it lives in the UI

### Decision: a sub-view of the existing "Review" tab, plus a detail screen

The nav has three items (Home, Texts, Review). Review is already the "your own stuff"
tab: the favorites collection, the streak counter, the struggle highlight. Past
conversations belong to the same mental category, and a fourth top-level tab in a
three-tab app makes the nav heavier for something a user opens occasionally, not daily.

So: `tab === "feedback"` gains a segmented switch at the top with two views,
`Sammlung` (the current favorites repo, default) and `Verlauf` (history). Opening a row
in `Verlauf` opens a full-screen detail, rendered the same way the reading screen is —
an early return in `Home` guarded by a single piece of state.

**What is traded away:** history is one tap deeper than it would be as its own tab, and
it is not discoverable from the home screen. Accepted, because the alternative costs a
permanent quarter of the nav bar.

**Rejected alternative:** reusing `stage === "feedback"` with `scenario` set from
`byId(row.scenario_id)` and `feedback` set to the stored evaluation. This is only about
ten lines and renders correctly, but it conflates "just finished" with "looking back":
`back()` would drop the user on the scenario catalog instead of the history list, the
chat stage would sit there with an empty `messages` array, and `stage` stops meaning
"where am I in a live conversation". Not worth the 50 lines saved.

### Existing CSS that this reuses

`app/globals.css` already contains a fully styled, entirely unused list of saved
conversations — leftovers from the old `localStorage` feedback list that `back.md` item 7
describes. Verified: zero references in `app/page.js`, present in the stylesheet.

| Class | Line | Purpose here |
| --- | --- | --- |
| `.fb-list` | 444 | the history list container |
| `.fb-item`, `.fb-item-btn` | 445-447 | one clickable past session |
| `.fb-head`, `.fb-title`, `.fb-date` | 448-450 | scenario title + timestamp row |
| `.fb-body` | 451 | the one-line summary, if shown |
| `.fb-eval`, `.score-badge` | 410-419 | score badge beside the title |
| `.tabs`, `.tab`, `.tab.active`, `.tab .count` | 185-200 | the Sammlung / Verlauf switch |

`.medal`, `.medal-gold|silver|bronze|none`, `.chat`, `.bubble`, `.panel.muted`,
`.btn-ghost`, `.learn-hero`, `.learn-stats`, `.lstat`, `.lstat-num` and `.mastered`
(a `<details>` style) are all in use elsewhere and carry over unchanged. Expect small
touch-ups only, since `.fb-*` was written for slightly different markup.

### Change to the screen list in `CLAUDE.md`

Item 6 is amended and a ninth screen is added. Replace:

```
6. **feedback** — nav label "Review": favorited corrections only, no history logs (`tab=feedback`, no scenario open)
```

with:

```
6. **feedback** — nav label "Review", two sub-views chosen by `reviewView`: `collection`
   (favorited corrections, the default) and `history` (past conversations)
   (`tab=feedback`, no scenario open)
```

and append:

```
9. **session** — one past conversation reopened from the history list: score, breakdown,
   corrections, transcript (`openSession` set)
```

`back.md` item 7 should also be reworded from "gravação morta / baixa prioridade" to
point at this plan, and the endpoint table in `How To/HowTo-backend.md` gains the new
route. `desc.md` step 6 can mention that Review holds both the collection and the
history.

---

## 2. What it shows

### Earns its place

**A. The list row.** Scenario title, medal dot, relative date, score badge. Four facts,
one line, and enough to spot "I scored 61 on Beim Arzt twice and 88 once". Costs one
query over five small columns.

**B. Re-opening a past evaluation.** The stored `evaluation` JSON is exactly what the
`Evaluation` component already renders: `score`, `summary`, `breakdown`, `strengths`,
`corrections` (with `tag`), `tip`, `targetsUsed`. Passing it to `<Evaluation ev={...}>`
reproduces the post-conversation screen with no new markup. This is the single biggest
payoff of the feature: **the star buttons work**, because `favKey()` keys a correction by
its content, not by which screen it came from. A correction the user did not star at the
time becomes recoverable forever. Today it is lost the moment they hit "Zur Übersicht".

**C. The transcript, collapsed.** A `<details>` under the evaluation using the existing
`.chat` / `.bubble` markup. It is the only record of what the user actually said out loud,
it costs nothing extra (the row is already fetched for the evaluation), and collapsed it
costs no screen space. Optionally keep the `StarButton` on assistant bubbles so partner
phrases can still be starred from history, exactly as in the live chat.

**D. A stats strip above the list.** Conversations held, best score, average score, and a
per-scenario line. One aggregate query, reusing `.learn-hero` / `.learn-stats` / `.lstat`
from the collection view directly above it. This is the "am I improving" answer at almost
no cost, and it makes the history view useful before the user has scrolled anything.

### Does not earn its place

**A score trend chart.** Three scenarios exist and a user will have single-digit runs per
scenario for a long time. A line with four points communicates nothing a column of four
score badges does not, and it needs either a charting dependency (against the spirit of a
zero-dependency client) or hand-rolled SVG. **Defer.** If it is wanted later, it can be an
inline `<svg>` sparkline built from rows the list endpoint already returns — no new
endpoint, no new query.

**Search or full-text filter over transcripts.** No volume justifies it. A scenario filter
chip (`?scenarioId=`) is supported by the API from day one and can be wired to the UI in
ten minutes if the list ever gets long.

**Per-session delete.** Tempting and dangerous: `sessions` is the leaderboard's only
source (`readBoard` reads `MAX(score)` from it) and the streak's only source
(`currentStreak` reads `DISTINCT date(created_at)`). Deleting one row silently rewrites a
public ranking and can break a streak. **Recommend not offering it.** See open decision 3.

**Replaying or continuing a past conversation.** Out of scope; it is a different feature
(`/api/chat` with a preloaded transcript) with its own cost profile.

---

## 3. The API

### One route: `app/api/sessions/route.js`, `GET` only

The list and the detail share one route file and branch on the presence of an `id` query
parameter. Two reasons: it matches the existing convention (`DELETE /api/favorites?key=…`
rather than `/api/favorites/[key]`), and it avoids a dynamic segment, whose `params`
signature changed in recent Next versions — per `AGENTS.md` that would have to be checked
against `node_modules/next/dist/docs/` first. **Trade-off:** one handler with two response
shapes; keep it honest with an early `if (id) return one(db, user, id)`.

`GET` only, so no `wrongOrigin` guard (that guard is applied to writes) and no `overQuota`
(no AI call, no cost). `resolveUser` mints an anonymous row on this GET exactly as
`GET /api/favorites` already does, so the cookie behaviour is unchanged.

#### `GET /api/sessions` — the list

Query parameters, all optional:

| Param | Type | Default | Clamp / validation |
| --- | --- | --- | --- |
| `limit` | integer | 20 | `1..50`; non-numeric falls back to 20 |
| `before` | ISO timestamp | none | keyset cursor, passed straight back from `nextCursor` |
| `scenarioId` | string | none | run through `knownScenario(...)?.id \|\| null`, mirroring `/api/leaderboard`: an unknown id is ignored, not a 400 |

Response `200`:

```json
{
  "sessions": [
    { "id": 41, "scenarioId": "fahrkarte", "title": "Fahrkarte kaufen", "score": 88,
      "createdAt": "2026-09-17T19:04:11.512Z" }
  ],
  "nextCursor": "2026-09-14T08:22:03.004Z",
  "stats": {
    "plays": 12, "best": 91, "avg": 74,
    "perScenario": [
      { "scenarioId": "fahrkarte", "title": "Fahrkarte kaufen", "plays": 7, "best": 91, "avg": 78,
        "lastAt": "2026-09-17T19:04:11.512Z" }
    ]
  }
}
```

`nextCursor` is `null` when fewer than `limit` rows came back. `stats` is returned **only
on the first page** (when no `before` was sent) and is `null` on subsequent pages, so
paging does not re-run the aggregate.

Note what the list deliberately does **not** select: `transcript` and `evaluation`. D1
bills row reads, not bytes, so skipping the blobs saves no quota — it saves response size
and, more importantly, the CPU of parsing up to 20 JSON documents inside a 10 ms budget.
The consequence is no per-row summary sentence in the list; scenario, date and score carry
the row fine.

#### `GET /api/sessions?id=41` — one session

Response `200`:

```json
{
  "session": {
    "id": 41, "scenarioId": "fahrkarte", "title": "Fahrkarte kaufen", "score": 88,
    "createdAt": "2026-09-17T19:04:11.512Z",
    "evaluation": { "score": 88, "breakdown": {...}, "summary": "...", "strengths": [],
                    "corrections": [], "tip": "...", "targetsUsed": [] },
    "transcript": [ { "role": "user", "content": "..." } ]
  }
}
```

Not found, or found but belonging to someone else: identical `fail("Gespräch nicht
gefunden.", 404)`. The ownership check is in the `WHERE` clause, not a post-fetch
comparison, and the two cases are indistinguishable from outside so existence is not
leaked.

`evaluation` and `transcript` are parsed server-side rather than handed over as strings.
That is one parse plus one re-serialize per request instead of one parse in the browser;
it buys a clean API shape and a route that can validate what it stores. At ~26 KB worst
case (`LIMITS.transcriptChars` is 24,000) this is far under the CPU budget.

### Conventions to follow exactly

```js
import { getDb, resolveUser, json, fail, oops } from "../../db";
import { knownScenario } from "../../guard";

export async function GET(req) {
  try {
    const db = await getDb();
    const { user, setCookie, clearCookie } = await resolveUser(db, req);
    // ... queries ...
    return json(payload, { setCookie, clearCookie });
  } catch (e) {
    return oops("sessions.get", e);
  }
}
```

`fail` for the deliberate 404 only. Everything unexpected goes to `oops("sessions.get", e)`
so D1 error text never reaches the caller. `setCookie` / `clearCookie` must be threaded
through every response, including the 404 — otherwise a first-time visitor whose very
first call is a bad `?id=` never receives their `rp_uid` and the next call mints a second
user row.

### Why not extend `/api/me`

`/api/me` is the bootstrap call on every page load and must stay at two cheap queries.
History is needed only when the user opens the Review tab's history view.

---

## 4. The queries

### List (index `sessions_user (user_id, created_at DESC)`)

First page:

```sql
SELECT id, scenario_id, title, score, created_at
  FROM sessions
 WHERE user_id = ?
 ORDER BY created_at DESC
 LIMIT ?;
```

With a cursor, and with the optional scenario filter:

```sql
SELECT id, scenario_id, title, score, created_at
  FROM sessions
 WHERE user_id = ? AND created_at < ?
   -- AND scenario_id = ?   (only when scenarioId was given and known)
 ORDER BY created_at DESC
 LIMIT ?;
```

Keyset pagination on `created_at` alone, not `OFFSET`. `OFFSET` re-reads and discards
every skipped row, which is the one thing that would make this expensive against the D1
rows-read quota; a keyset cursor reads exactly `limit` rows per page whatever the offset.

**No `id` tiebreak.** `/api/feedback` binds `new Date().toISOString()`, which is
millisecond precision, so a tie requires one user finishing two conversations in the same
millisecond. The accepted consequence of a tie would be one row skipped across a page
boundary. Adding `ORDER BY created_at DESC, id DESC` would cost a sorter step, because the
index cannot satisfy the second key. Not worth it. (Note the `DEFAULT (datetime('now'))`
in the migration is only second-precision, but no code path uses the default.)

`scenario_id` is not in the index, so the filtered variant scans the user's rows and
filters. At tens of rows per user this is free; it is called out so nobody is surprised.

### Detail (primary key)

```sql
SELECT id, scenario_id, title, score, transcript, evaluation, created_at
  FROM sessions
 WHERE id = ? AND user_id = ?;
```

One row read. `id` must be coerced with `Number(...)` and rejected if `NaN` before it is
bound, so a string id cannot reach the driver.

### Stats — one query, folded in JS

```sql
SELECT scenario_id,
       COUNT(*)        AS plays,
       MAX(score)      AS best,
       SUM(score)      AS total_score,
       MAX(created_at) AS last_at
  FROM sessions
 WHERE user_id = ?
 GROUP BY scenario_id;
```

One row per scenario (three today). The overall figures are folded from these in JS:
`plays = Σ plays`, `best = max(best)`, `avg = round(Σ total_score / Σ plays)`. Computing
the average from the sums rather than averaging the per-scenario averages is the one place
this can quietly go wrong, so it gets a self-test (section 8). `title` comes from
`byId(scenario_id)?.title` on the server, not from the stored `title` column, so a renamed
scenario displays its current name.

This scans all of that user's rows through `sessions_user` with a row lookup per row
(`scenario_id` and `score` are not in the index). Bounded by the user's own session count.

### Indexes and migrations

**None needed.** `sessions_user (user_id, created_at DESC)` from `0001_init.sql` serves
the list; the detail uses the primary key; the aggregate is bounded per user.

If a single user ever accumulated thousands of sessions and the stats query became the
slow part, the fix would be `migrations/0003_sessions_stats.sql`:

```sql
CREATE INDEX IF NOT EXISTS sessions_user_scenario ON sessions (user_id, scenario_id, score DESC);
```

**Do not add it now.** It would be paid for on every `/api/feedback` insert to speed up a
query that reads a few dozen rows.

---

## 5. Client changes in `app/page.js`

### New pure module: `app/history.js`

Keeps the route thin and gives the self-test something to bite on. Exports:

- `parseListQuery(searchParams)` → `{ limit, before, scenarioId }`, with the clamping
  from section 3. Uses `knownScenario` for `scenarioId`.
- `foldStats(rows)` → `{ plays, best, avg, perScenario }` from the aggregate rows,
  null-safe on an empty array (`{ plays: 0, best: null, avg: null, perScenario: [] }`).
- `HISTORY_PAGE = 20`, `HISTORY_MAX = 50` as named constants, imported by both the route
  and the client so "Mehr laden" and the server agree on a page size.

### New state in `Home`

```js
const [reviewView, setReviewView] = useState("collection"); // collection | history
const [history, setHistory] = useState(null);   // { sessions, stats, nextCursor } or null = not loaded
const [historyBusy, setHistoryBusy] = useState(false);
const [openSession, setOpenSession] = useState(null); // a past session being read
```

### How data loads

**Not in the bootstrap effect.** That effect is deliberately sequential (its comment
explains that the first call mints the cookie, so parallel calls would create two users)
and it runs on every page load. History is lazy:

```js
useEffect(() => {
  if (tab !== "feedback" || reviewView !== "history" || history || historyBusy) return;
  let alive = true;
  setHistoryBusy(true);
  getJSON("/api/sessions")
    .then((d) => { if (alive) setHistory(d); })
    .catch((e) => { if (alive) setError("Verlauf konnte nicht geladen werden: " + e.message); })
    .finally(() => { if (alive) setHistoryBusy(false); });
  return () => { alive = false; };
}, [tab, reviewView, history, historyBusy]);
```

First paint stays at the current two requests.

**Paging:** a `Mehr laden` button, shown only while `history.nextCursor` is set, calls
`getJSON("/api/sessions?before=" + encodeURIComponent(history.nextCursor))` and appends:
`setHistory((h) => ({ ...h, sessions: [...h.sessions, ...d.sessions], nextCursor: d.nextCursor }))`
— `stats` is kept from the first page.

**Opening a row:** set `openSession` to the row immediately (so the header, score and date
paint at once) and merge the detail when it lands:

```js
async function openPast(row) {
  setOpenSession({ ...row, pending: true });
  try {
    const { session } = await getJSON(`/api/sessions?id=${row.id}`);
    setOpenSession(session);
  } catch (e) {
    setError("Gespräch konnte nicht geladen werden: " + e.message);
    setOpenSession(null);
  }
}
```

**Invalidation:** on a successful `endConversation`, add `setHistory(null)` so the next
visit to the history view refetches and includes the run that just finished.

### New components (top level in `page.js`, beside `FavItem`)

- `SessionRow({ s, onOpen })` — `<li className="fb-item fb-item-btn">` as a `<button>`,
  `.fb-head` with `.fb-title` (scenario title + `<span className={`medal medal-${medalFor(s.score)?.key || "none"}`} />`),
  `.fb-date` with `new Date(s.createdAt).toLocaleString("pt-BR")` (matching `favDate`), and a
  `<span className={`score-badge score-${scoreClass(s.score)}`}>{s.score}</span>`.
- `HistoryList({ data, busy, onOpen, onMore, anonymous })` — the `.learn-hero` stats strip,
  then `<ul className="fb-list">`, then the `Mehr laden` button. Empty state:
  `<p className="panel muted">Noch keine Gespräche. Beende eine Übung, um sie hier zu sehen.</p>`.
  Loading: `<p className="panel muted">Verlauf lädt…</p>`, matching the leaderboard's
  "Bestenliste lädt…". When `anonymous` is true, one muted line under the stats:
  "Ohne Anmeldung wird dein Verlauf nur in diesem Browser gespeichert."
- `SessionDetail({ session, favorites, onToggleFav, onBack })` — `.btn-ghost` back button,
  a heading with the scenario title and the date, `<Evaluation ev={session.evaluation}
  favorites={favorites} onToggleFav={...} />`, then
  `<details className="mastered"><summary>Gesprächsverlauf</summary>` containing the
  `.chat` / `.bubble` markup mapped from `session.transcript`. While `session.pending` is
  true, show the muted loading line in place of the evaluation.

### Render placement

Immediately after the existing `if (openText) { ... }` early return, mirroring it:

```js
if (openSession) {
  return (
    <div className="app">
      {topbar}
      {error && <p className="error container">{error}</p>}
      <SessionDetail
        session={openSession}
        favorites={favorites}
        onToggleFav={(item) => toggleFav(item, openSession.title)}
        onBack={() => setOpenSession(null)}
      />
    </div>
  );
}
```

### Three small existing-code changes that are easy to miss

1. **`toggleFav` loses the scenario label from history.** It builds the entry with
   `scenario: scenario?.title`, and in the history detail `scenario` state is `null`, so a
   correction starred from a past session would be saved without its scenario. Change the
   signature to `toggleFav(item, scenarioTitle = scenario?.title)` and use `scenarioTitle`
   in both the optimistic entry and the POST body. No call site outside history changes.
2. **`navTo` must clear `openSession`** alongside `setOpenText(null)`, or tapping Home
   from a past session leaves the detail on screen.
3. **The Review tab's empty branch must be restructured.** Today it is
   `favorites.length === 0 ? <empty panel> : <collection>`, which would make history
   unreachable for a user with no favorites. The switch has to render first, and the
   empty check moves inside the `collection` view only. The Review nav item's `active`
   condition also needs `&& !openSession`.

### The sub-view switch

Reuses the unused `.tabs` block verbatim:

```jsx
<div className="tabs">
  <button className={`tab ${reviewView === "collection" ? "active" : ""}`} onClick={() => setReviewView("collection")}>
    Sammlung {favorites.length ? <span className="count">({favorites.length})</span> : null}
  </button>
  <button className={`tab ${reviewView === "history" ? "active" : ""}`} onClick={() => setReviewView("history")}>
    Verlauf {history?.stats?.plays ? <span className="count">({history.stats.plays})</span> : null}
  </button>
</div>
```

### Errors

Nothing new. The main screen already renders `{error && <p className="error">{error}</p>}`
at the top of `<main>`, which covers the Review tab; the detail screen gets its own copy
with `className="error container"`, copied from the reading screen. All three new failure
paths funnel into the same `setError`, in German, prefixed like the existing ones.

---

## 6. Cost and limits

### Cloudflare Workers, free tier

- **100,000 requests/day.** This feature adds: 1 request to open the history view (list +
  stats in one response), 1 per session opened, 1 per 20 rows paged. A heavy session of
  use adds maybe 5 requests on top of the 2 the app already makes on load. Irrelevant
  against the cap.
- **10 ms CPU per invocation.** This is CPU, not wall clock — time awaiting D1 does not
  count. The list route does no JSON parsing at all. The detail route parses at most
  ~26 KB (24,000-char transcript cap from `LIMITS.transcriptChars`, plus a small
  evaluation) and re-serializes it; comfortably inside the budget, but it is the only
  place in this feature worth measuring if a CPU-limit error ever shows up in the logs.
- **Static assets unmetered.** History adds no new asset: it is JSX inside the existing
  `page.js` bundle and CSS that is already being shipped.

### Cloudflare D1, free tier

**Unverified — `developers.cloudflare.com` is blocked from this environment, so these
figures are from memory and must be checked at
`https://developers.cloudflare.com/d1/platform/limits/` before anyone relies on them.**
The free plan is, as I recall it: **5 GB total storage**, **5,000,000 rows read/day**,
**100,000 rows written/day**.

- **Writes: zero.** History is read-only; nothing in this plan inserts or updates.
- **Reads per history open:** `limit` rows for the list (20) plus every row that user owns
  for the aggregate. A user with 200 sessions costs 220 row reads per open. Against
  5,000,000/day the app would need roughly 20,000 history opens per day to feel it.
- **Reads per session opened:** exactly 1.
- **The thing that would break this** is `OFFSET`-based paging, which re-reads every
  skipped row; section 4 uses a keyset cursor specifically to avoid it. If the stats query
  ever does become the hot path, cache it per user or fold it into `/api/me`, do not
  index around it.
- **Storage:** a row is a transcript of up to 24 KB plus ~2 KB of evaluation. 1,000
  conversations is about 26 MB; 5 GB holds on the order of 190,000. No pruning strategy is
  needed, and pruning would in any case corrupt the leaderboard and the streak.

---

## 7. The anonymous problem

### Today

Identity is the `rp_uid` cookie (HttpOnly, one year, `Secure`, `SameSite=Lax`), mapping to
a `users` row with `email IS NULL`. History is therefore **per browser profile**. Clearing
site data, using a second device, or a private window all silently produce an empty
history. This is already true of favorites and the streak; history makes it more visible,
because an empty list reads like data loss where a missing star does not. Hence the muted
notice in the history empty state (section 5).

### When Google login is switched on

**The good case works already.** `resolveUser` adopts the anonymous row on first login
*from the same browser*: it reuses `anon.id` and fills in `email` rather than creating a
new row, so every `sessions` row keeps pointing at the same `users.id`. History, favorites
and streak all survive the first login on that browser, with no change to this feature.

**The bad case has no fix in the current code.** If the user first logs in on browser A,
then later opens browser B where they had been practising anonymously, `resolveUser` finds
an existing row by email and returns it — B's anonymous row is neither adopted nor deleted.
It becomes an orphan: unreachable while signed in, and still reachable (with its own
separate history) if they sign out of B, because the logged-out lookup filters on
`email IS NULL` and that row still qualifies. One person, two histories, no merge path.

Options, if the user cares:

1. **Accept it** and say so in the UI. Recommended for now: it only bites people who
   practised anonymously on two browsers before ever logging in.
2. **One-time claim on login.** When a Google session resolves and a `rp_uid` cookie is
   present pointing at an anonymous row that is *not* the user's row, offer "Übungen aus
   diesem Browser übernehmen". On yes: `UPDATE sessions SET user_id = ? WHERE user_id = ?`,
   the same for `favorites` (watch the `favorites_user_key` unique index — use
   `INSERT OR IGNORE` into the target then delete, or handle the conflict), then delete the
   orphan row. This is a separate small feature, not part of this plan, and it must be
   explicit rather than automatic: silently absorbing whatever cookie is in the browser is
   how one person inherits another's data on a shared machine.

**Sign-out.** `DELETE /api/me` drops `rp_uid`, so the next request mints a fresh anonymous
identity with an empty history. That is deliberate and correct (the comment in
`app/api/me/route.js` explains why), but from the history view it looks like everything was
deleted. The `me.anonymous` notice is what makes it legible.

**Isolation.** Every query in section 4 is scoped by `user_id`, and the detail scopes in
the `WHERE` clause rather than checking after the fetch, so no code path can return
another user's transcript. The one cross-user read in the app remains `readBoard`, which
exposes only a display name and a score.

**Minor exposure:** `sessions.id` is a global `AUTOINCREMENT`, so handing it to the client
reveals roughly how many conversations the whole app has ever stored. Enumeration is
blocked by the `AND user_id = ?` scope. Acceptable for a personal practice app; if it ever
matters, key the detail on `created_at` instead.

---

## 8. Verification

### Pure logic: `node app/history.selftest.mjs`

Following the pattern of `app/scoring.selftest.mjs` and `app/texts.selftest.mjs` — plain
`node`, `node:assert`, a `console.log` on success. Assertions:

1. `parseListQuery` defaults: no params gives `{ limit: 20, before: null, scenarioId: null }`.
2. `limit=999` clamps to 50; `limit=0` clamps to 1; `limit=abc` falls back to 20.
3. `scenarioId=fahrkarte` survives; `scenarioId=nope` becomes `null` (not an error),
   matching `/api/leaderboard`.
4. `foldStats([])` returns `{ plays: 0, best: null, avg: null, perScenario: [] }` without
   throwing or producing `NaN`.
5. `foldStats` on two scenarios with different play counts computes the overall average
   from the summed scores, not from averaging the per-scenario averages. Use deliberately
   asymmetric fixtures, e.g. one scenario with 1 play at 100 and one with 3 plays at 60:
   the answer is 70, not 80.
6. `perScenario` rows carry a `title` resolved through `byId`, and a scenario id no longer
   in `scenarios.js` still renders (falls back to the stored title) rather than crashing.

Also re-run `node app/scoring.selftest.mjs` as a regression guard, since the plan touches
nothing in scoring but the evaluation shape is shared.

### Integration: local D1 + `wrangler`

```bash
npx wrangler d1 migrations apply rolepartner --local
npm run preview                       # opennextjs-cloudflare build && preview
```

Seed without spending AI credits (note the port wrangler prints):

```bash
npx wrangler d1 execute rolepartner --local \
  --command "INSERT INTO users (id) VALUES ('test-user')"
npx wrangler d1 execute rolepartner --local \
  --command "INSERT INTO sessions (user_id, scenario_id, title, score, transcript, evaluation, created_at) VALUES ('test-user','fahrkarte','Fahrkarte kaufen',82,'[{\"role\":\"user\",\"content\":\"Ich möchte eine Fahrkarte nach Bonn.\"}]','{\"score\":82,\"summary\":\"Gut gemacht.\",\"breakdown\":{\"goal\":30,\"tasks\":20,\"grammar\":16,\"vocabulary\":16,\"engagement\":10,\"penalty\":0},\"strengths\":[\"Clear request\"],\"corrections\":[{\"wrong\":\"Ich will Fahrkarte\",\"right\":\"Ich möchte eine Fahrkarte\",\"note\":\"Use the article.\",\"tag\":\"Genus/Artikel\"}],\"tip\":\"Practice articles.\"}','2026-09-10T10:00:00.000Z')"
```

`rp_uid` is HttpOnly, so drive the API with an explicit cookie rather than the browser:

```bash
curl -s 'http://localhost:8788/api/sessions' -H 'cookie: rp_uid=test-user'
curl -s 'http://localhost:8788/api/sessions?id=1' -H 'cookie: rp_uid=test-user'
```

Checks:

1. No cookie at all: returns an empty list and a zeroed `stats`, and the response carries
   `set-cookie: rp_uid=…`. (This is the case that catches a 404 path that forgot to thread
   `setCookie`.)
2. Seeded cookie: rows newest first.
3. `?limit=999` returns at most 50 rows; `?limit=abc` behaves as 20.
4. Two-page walk with `before=<nextCursor>`: no duplicate ids, no gaps, and `nextCursor`
   is `null` on the final page.
5. `?id=` of a session owned by a different `user_id`: `404` with
   `{"error":"Gespräch nicht gefunden."}`, and no row content in the body.
6. `?scenarioId=does-not-exist`: same result as no filter, not a 400.
7. `?id=abc`: a clean 404, not a 500 in the Worker log.

### UI pass (the habit the repo already follows)

With `OPENAI_API_KEY` set in `.dev.vars`, drive the real flow in the browser:

1. Finish a conversation. Note the score on the leaderboard screen.
2. Review → Verlauf: the run appears at the top with that same score and scenario, and
   the stats strip counts it.
3. Open it: the corrections, breakdown and tip match what the evaluation screen showed a
   minute earlier.
4. Star a correction from the past evaluation; switch to Sammlung: it is there, with the
   right scenario label (this is the check for the `toggleFav` fix).
5. Expand Gesprächsverlauf: the bubbles match what was actually said, in order.
6. Tap Home, then Review: the detail is gone and the tab is on Sammlung (or wherever it
   was), not on a stale detail screen.
7. Finish a second conversation and reopen Verlauf: the new run is there, proving the
   `setHistory(null)` invalidation works.
8. With a fresh browser profile (no `rp_uid`): Verlauf shows the empty state and the
   anonymous notice, not an error.

---

## 9. Risks and open decisions

### Risks

| Risk | Mitigation |
| --- | --- |
| The Review tab restructure makes history unreachable for a user with zero favorites (the current `favorites.length === 0` early branch swallows the whole tab) | UI check 8, and the restructure is spelled out in section 5 |
| Corrections starred from a past session land with no scenario label | The `toggleFav(item, scenarioTitle)` change; UI check 4 |
| History goes stale after finishing a conversation | `setHistory(null)` in `endConversation`; UI check 7 |
| `.fb-*` CSS was written for different markup and may need touch-ups | Cosmetic only; budgeted below |
| D1 free-tier numbers here are from memory (docs are blocked in this environment) | Verify the limits page before relying on the headroom claims in section 6 |
| A third call added to the bootstrap effect would re-open the double-user race its comment warns about | History loads lazily, in its own effect |
| If the implementer prefers `/api/sessions/[id]`, the `params` signature is version-dependent | Per `AGENTS.md`, read `node_modules/next/dist/docs/` first — or just keep `?id=` as recommended |

### Decisions the user must make

1. **Sub-view of Review (recommended) or a fourth nav tab "Verlauf"?** Everything in
   sections 1 and 5 is written for the sub-view; a tab is a ~20-line change either way, but
   it changes the `CLAUDE.md` screen list differently.
2. **Include the transcript?** Recommended, collapsed. It is free to fetch and it is the
   only record of what the user said. Say no and `SessionDetail` loses ten lines.
3. **Any way to delete history?** Recommended: no. `sessions` is the sole source of both
   the leaderboard and the streak, so deleting a row silently rewrites a public ranking.
   If the user does want "meine Daten löschen", it should be all-or-nothing at the account
   level, and it is a separate feature (note that `DELETE /api/me` today only clears the
   cookie — it deletes nothing).
4. **Trend chart now or later?** Recommended: later, and only as an inline SVG sparkline
   over data the list already returns.
5. **Copy language.** Everything user-facing is German today. The proposed strings are
   "Sammlung", "Verlauf", "Gesprächsverlauf", "Mehr laden", "Noch keine Gespräche. Beende
   eine Übung, um sie hier zu sehen.", "Verlauf lädt…", "Gespräch nicht gefunden.".
   Confirm or replace.
6. **Anonymous merge (section 7, option 2)?** Build the one-time claim prompt, or accept
   the split-history case and ship the notice only.

### Effort

| Piece | Estimate |
| --- | --- |
| `app/history.js` + `app/history.selftest.mjs` | 1.5 h |
| `app/api/sessions/route.js` | 1 h |
| `page.js`: three components, state, lazy load, the three small fixes | 3 h |
| CSS touch-ups on the reused `.fb-*` rules | 0.5 h |
| Local D1 verification + a real UI pass | 1 h |
| Docs: `CLAUDE.md` screen list, `How To/HowTo-backend.md` endpoint table, `desc.md`, `back.md` item 7 | 0.5 h |
| **Total** | **~7 h, one sitting** |

Zero migrations, zero new dependencies, zero new tables.
