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
| GET | `/api/favorites` | Everything this user starred |
| POST | `/api/favorites` | Star an item (idempotent per `fav_key`) |
| DELETE | `/api/favorites?key=…` | Unstar |
| POST | `/api/favorites/review` | "Got it" +1; at 3 the card counts as mastered |
| POST | `/api/sessions` | Save a finished conversation, returns the leaderboard for the next screen |
| GET | `/api/leaderboard` | Top 10 by best score; `?scenarioId=` narrows it to one scenario |

## Notes

- The **streak** is derived from distinct days in `sessions`, not stored. No table to keep in sync.
- Before login every row on the leaderboard reads "Anonym"; names arrive with Google auth.
