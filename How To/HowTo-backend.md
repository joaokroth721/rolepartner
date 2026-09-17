# Backend (Cloudflare D1)

The backend the 16.09.2026 flow diagram describes: identity, favorites, conversation
transcripts and the leaderboard. Everything lives in one D1 database bound as `DB`.

## One-time setup

```bash
npx wrangler d1 create rolepartner
```

Paste the `database_id` it prints into `wrangler.jsonc` (replacing `PASTE_D1_DATABASE_ID_HERE`),
then create the tables:

```bash
npx wrangler d1 migrations apply rolepartner --remote   # production
npx wrangler d1 migrations apply rolepartner --local    # local dev / npm run preview
```

Re-run these after pulling any change that adds a file to `migrations/`.

Deploy as usual with `npm run deploy`. Until the id is pasted in, the deploy fails: the
binding points at a database that does not exist.

## Tables

`migrations/0001_init.sql` creates:

- **users** — one row per person. `email` is NULL until Google login exists (see below).
- **favorites** — everything the star button saves, any screen, any type. The type-specific
  fields sit in `payload` as JSON, so a new favorite type needs no migration.
  Unique per `(user_id, fav_key)`; `fav_key` comes from `app/favkey.js`, shared with the client.
- **sessions** — one finished conversation: transcript + evaluation + score.
  The leaderboard reads this table; there is no separate `scores` table.
  Rows are written by `/api/feedback` only.
- **ai_usage** — per-user, per-day counter for the three AI routes (`migrations/0002`).

## Who is the user, before login

Google login is not configured yet, so the API identifies a browser by the `rp_uid` cookie
(HttpOnly, one year) and creates an anonymous `users` row on first contact. When the Google
secrets are set, `app/db.js` keys off `session.user.email` instead, and the first login
**adopts** the anonymous row for that browser, so favorites collected before signing in
survive it. Nothing else has to change.

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/me` | Identify the caller, mint the anonymous id, return the measured streak |
| DELETE | `/api/me` | Drop the identity cookie; called on sign-out |
| GET | `/api/favorites` | Everything this user starred |
| POST | `/api/favorites` | Star an item (idempotent per `fav_key`) |
| DELETE | `/api/favorites?key=…` | Unstar |
| POST | `/api/favorites/review` | "Got it" +1; at 3 the card counts as mastered |
| POST | `/api/feedback` | Evaluates the conversation, scores it, stores the session, returns the board |
| GET | `/api/leaderboard` | Top 10 by best score; `?scenarioId=` narrows it to one scenario |

There is deliberately no endpoint that accepts a score. `/api/feedback` is the only writer
of `sessions`, because it is the only place a score is produced.

## Scoring

`app/scoring.js` turns a conversation into 0-100. The model is never asked for the score;
it reports observations (goal reached, which tasks happened, grammar and vocabulary 0-5,
the mistakes it found) and the server adds up fixed weights:

| Part | Points | Where it comes from |
| --- | --- | --- |
| Goal reached | 30 | Model |
| Tasks of the briefing | 20 | Model, one flag per task |
| Grammar | 20 | Model's 0-5 rating |
| Vocabulary | 20 | 12 measured from the transcript (target words actually said) + 8 from the rating |
| Conversation held | 10 | Student turns, full marks at 6 |
| Mistakes | up to -10 | One point per correction past the first two |

Two conversations of the same quality therefore score the same, which is what makes the
leaderboard comparable. `node app/scoring.selftest.mjs` checks the rules.

## Safety

- **The score cannot be sent in.** It is computed in `/api/feedback` from the model's own
  output and written there. Nothing else writes `sessions`.
- **Unknown scenario ids are rejected** against `app/scenarios.js`, so the leaderboard only
  ever holds scenarios that exist.
- **Daily AI allowance** per user (`DAILY_AI_CALLS` in `app/guard.js`), counted before the
  model runs. This is the cap that protects the OpenAI bill.
- **Size limits** on transcripts and reader lookups (`LIMITS` in `app/guard.js`).
- **Same-origin required** for writes.
- **A cookie can never reach a Google account.** The logged-out lookup filters on
  `email IS NULL`, and sign-out drops the cookie via `DELETE /api/me`.
- **Errors are generic.** Unexpected failures log server-side and return one fixed message,
  so D1 error text never reaches a caller.

## Notes

- The **streak** is derived from distinct days in `sessions`, not stored. No table to keep in sync.
- Before login every row on the leaderboard reads "Anonym"; names arrive with Google auth.
