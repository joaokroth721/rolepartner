# Getting into /admin

The dashboard at `/admin` reads across **all** users: page opens, token spend, the user
table and other people's conversations. The only thing holding that boundary is the gate
in `app/admin.js`, and it keys on one thing: the email of a **Google-verified session**.
The `rp_uid` cookie proves nothing and can never clear it.

So two things must be true before anyone, including the owner, can open the page:

1. **Google login works** on the deployed Worker (`AUTH_SECRET` + the two `GOOGLE_*`
   secrets). Until then `signedInEmail()` returns null for everybody and every request to
   `/api/admin` is a 401.
2. **That email is on the allow list.** The `admins` table starts empty and the UI that
   fills it is itself behind the gate, so the first admin can only come from the
   environment: `ADMIN_EMAILS`.

The owner is `joao.kroth7@gmail.com`. That address is not written into any code file or
migration on purpose - who may read everyone's data is environment configuration, and it
has to be changeable without a deploy of new code.

Run the steps in order. Each one says what you should see.

---

## 0. Before you start

```bash
cd <repo root>
npx wrangler whoami
```

Expect your Cloudflare account and the account id. If it prints "not authenticated", run
`npx wrangler login` first.

One thing to know about the Worker name: `wrangler.jsonc` says `"name": "app"` (commit
`f90e03d`, so the URL is `app.rolepartner.workers.dev` rather than
`rolepartner.rolepartner.workers.dev`), but **nothing has been deployed under that name
yet**. Secrets belong to a Worker by name, so anything set on the old `rolepartner` Worker
would be invisible to `app`. Nothing was ever set there, so there is nothing to migrate -
but this is why step 3 deploys before step 4 sets the secrets: the secrets must land on the
Worker that will actually serve the app.

## 1. Apply migration 0003 to the remote database

```bash
npx wrangler d1 migrations list rolepartner --remote
```

Expect `0003_admin.sql` listed as not yet applied. Then:

```bash
npx wrangler d1 migrations apply rolepartner --remote
```

Expect a table of migrations ending in `0003_admin.sql` marked as applied. This creates
`admins`, `visits` and `ai_tokens`. Until it is applied, `/api/me` logs one `recordVisit` failure per
request (the counters are wrapped so they cannot break the bootstrap call) and `/admin`
would 500 on every view.

Check it landed:

```bash
npx wrangler d1 execute rolepartner --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expect `admins`, `ai_tokens`, `ai_usage`, `favorites`, `sessions`, `users`, `visits`.

## 2. Create the Google OAuth client

Browser work, at https://console.cloud.google.com/apis/credentials, signed in as
**joao.kroth7@gmail.com**.

1. Create (or pick) a project.
2. **OAuth consent screen**: User type *External*. App name, support email and developer
   email are yours. While the app is in *Testing*, only listed test users can sign in, so
   **add joao.kroth7@gmail.com as a test user** - otherwise the sign-in ends in
   `access_denied` and the gate never even sees an email.
3. **Credentials -> Create credentials -> OAuth client ID -> Web application**.
4. Authorized JavaScript origins:
   - `https://app.rolepartner.workers.dev`
   - `http://localhost:3000` (only if you want login in `next dev`)
5. Authorized redirect URIs - this is the one that has to be exact:
   - `https://app.rolepartner.workers.dev/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (local dev)

Copy the client id and client secret. Expect the id to look like
`123456789-xxxx.apps.googleusercontent.com`.

## 3. Deploy once, so the Worker exists under its new name

```bash
npm run deploy
```

Expect the build to finish and wrangler to print a URL. It must be
`https://app.rolepartner.workers.dev`. Open it: the app loads and works anonymously. The
"Anmelden" button does **not** work yet - there are no secrets - and that is expected.

If the URL printed is anything else, stop: the secrets in the next step would go to the
wrong Worker.

## 4. Set the four secrets on that Worker

Each command prompts for the value and redeploys the Worker with it. `-> app` in the output
is the Worker they land on.

```bash
openssl rand -base64 33            # generate the session signing key, copy the output
npx wrangler secret put AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put ADMIN_EMAILS      # value: joao.kroth7@gmail.com
```

`ADMIN_EMAILS` is a comma-separated list; a single address is a list of one. Case and
surrounding spaces do not matter, they are normalised on read.

Confirm all four are there:

```bash
npx wrangler secret list
```

Expect `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS` (plus
`OPENAI_API_KEY`, and `ANALYTICS_SALT` if it was set). Values are never shown, only names.

Secrets take effect on the running Worker immediately; no further deploy is needed for
them. Deploy again only when code changed:

```bash
npm run deploy
```

## 5. Sign in and open the dashboard

1. Open `https://app.rolepartner.workers.dev` and click **Anmelden**. Google should ask
   which account, then return you to the app with your name in the top bar.
2. Check the server agrees you are an admin:

   ```bash
   curl -s https://app.rolepartner.workers.dev/api/me
   ```

   From the terminal (no session) expect `"admin":false` and `"anonymous":true` - that is
   the correct answer for a request with no Google session. The flag that matters is the
   one the signed-in browser gets: with the session cookie the same call returns
   `"email":"joao.kroth7@gmail.com","admin":true`, and that is what puts the **Admin** link
   in the top bar.
3. Click **Admin**, or go straight to `https://app.rolepartner.workers.dev/admin`.

Expect five tabs - Overview, Tokens, Users, Challenges, Conversations - and real numbers on
the first one. The `visits` and `ai_tokens` counters start at zero the moment migration
0003 is applied: nothing before that was recorded, so an empty chart on day one is correct,
not a bug.

## 6. Adding and removing other admins

On the **Users** tab, "Who can open this page":

- Type an address, press **Grant access**. They see the dashboard from their next sign-in.
  They do not need to have opened the app before - the two lists are matched by email at
  the moment of the request.
- **Remove** takes an address back off the list.
- Addresses that came from `ADMIN_EMAILS` show as `pinned` and have no Remove button. They
  live in the environment, so the way to revoke one is to change the secret:

  ```bash
  npx wrangler secret put ADMIN_EMAILS      # the new, shorter list
  ```

  Pinned addresses are also the way back in if the table is ever emptied by accident, which
  is why the UI cannot touch them, and why adding a pinned address through the UI writes no
  row: a row nobody can see and nobody can delete would keep granting access after the
  address was taken out of the secret.
- Nobody can remove their own address, pinned or not. That is the other way a one-admin app
  locks itself out.

## When it does not work

| What you see | What it means | What to do |
| --- | --- | --- |
| `/admin` shows "Not signed in" | No Google session reached the server: the secrets are missing, or you are signed out | `npx wrangler secret list`; sign in on the app first |
| Sign-in ends in `redirect_uri_mismatch` | The redirect URI in Google does not match the deployed URL, character for character | Fix it in the Google console (step 2.5); it must end in `/api/auth/callback/google` |
| Sign-in ends in `access_denied` | The consent screen is in *Testing* and this account is not a test user | Add the address under OAuth consent screen -> Test users |
| `/admin` shows "No access" | The gate saw your email and it is not on the list | Check the value of `ADMIN_EMAILS` (step 4); a typo here is the usual cause |
| Every tab shows "Serverfehler" | Migration 0003 is not applied remotely | Step 1 |
| Charts are empty but people are using the app | `visits` and `ai_tokens` only count from the moment 0003 was applied | Nothing to fix; wait a day |

The detail behind any 500 is in the Worker log, never in the response - by design, so a
stranger probing `/api/admin` learns nothing about the schema:

```bash
npx wrangler tail
```

## Local development

`.dev.vars` (for `npm run preview` / `npx wrangler dev`) and `.env.local` (for `next dev`)
take the same variables; copy `.dev.vars.example` or `.env.example` and fill them in. Both
files are gitignored. Apply the migrations to the local database once:

```bash
npx wrangler d1 migrations apply rolepartner --local
```

Local Google login needs the `http://localhost:3000` entries from step 2 and only works in
`next dev` (port 3000); the wrangler port is 8787 and would need its own redirect URI.
