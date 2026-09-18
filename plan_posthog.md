# Implementation plan: PostHog product analytics

Status: plan only, nothing implemented. Supersedes the rough sketch in `back.md` item 12,
and corrects it where it is out of date (see "What back.md got wrong" at the end).

Target repo state: branch `claude/hopeful-hopper-c8gnva`, Next.js 16.3.4 App Router, React 19,
deployed to Cloudflare Workers through `@opennextjs/cloudflare` (`npm run deploy`), backend on D1.

---

## 1. What the analytics must answer

Start from the questions. Everything below exists to answer one of these, and anything that
answers none of them does not get instrumented.

| # | Question | How it is answered |
|---|---|---|
| Q1 | Which scenarios do people open, and does the lock on `restaurant`/`arzt` frustrate them? | `scenario_opened` (property `scenario_id`, `locked`) |
| Q2 | Of the people who open a briefing, how many actually start talking? | `scenario_opened` -> `conversation_started` funnel |
| Q3 | Where do people abandon a conversation? | `conversation_ended` with `reason` and `user_turns`; distribution of `user_turns` is the drop-off curve |
| Q4 | How many reach a score at all, and what do scores look like? | `conversation_scored` (`score`, `score_band`, breakdown parts) |
| Q5 | Do people go past the leaderboard into the detailed evaluation? | `screen_viewed` with `screen=leaderboard` -> `screen=evaluation` |
| Q6 | Is the reader used at all, or is it dead weight? | `text_opened`, plus `word_looked_up` for depth |
| Q7 | Does anyone favorite anything, and what kind? | `favorite_toggled` (`fav_type`, `action`) |
| Q8 | Does the Review screen get used, or is it a screen people visit once? | `screen_viewed` with `screen=feedback`, plus `review_marked` |
| Q9 | Do people come back? | PostHog retention on any of the above; no extra event needed |
| Q10 | Which reader words are missing from the glossary (this is also the `/api/translate` cost driver, back.md item 4)? | `word_looked_up` with `in_glossary=false` |

### What autocapture gives for free, and what it does not

Autocapture (`$autocapture`, `$pageview`, `$pageleave`, `$rageclick`, `$web_vitals`) answers:

- session counts, new vs returning, device/browser/country, referrer - Q9 and the demographics
  around all the other questions, with zero code;
- "a button was clicked" as a raw DOM event, and rage clicks on dead UI.

Autocapture cannot answer Q1-Q8, for three reasons specific to this app:

1. It has no access to React state, so it cannot tell you *which* scenario a click belongs to.
2. Its only handle on a button is the element chain plus the visible text, and the visible text
   here is German UI copy (`Los geht's`, `Gespräch beenden`). Rewording the copy silently breaks
   every insight built on it.
3. This plan turns `mask_all_text` on (section 8), which removes that text handle on purpose,
   because the same mechanism would otherwise pull conversation transcripts into `$elements`.

So: autocapture stays on for the free session-level picture and for rage-click detection, and
every product question is answered by a named event. That is the deliberate trade - autocapture
is worth much less here than in a normal app, and the nine named events carry the weight.

---

## 2. The single-route problem

`app/page.js` is one `"use client"` component and there is exactly one route, `/`. The screen a
person is looking at is `tab` + `scenario` + `stage` + `openText` state, and the URL never changes.
Consequences:

- The default `capture_pageview: true` fires once per hard load. Every session is one pageview of
  `/`, so "top pages", pageview funnels and time-on-page are all meaningless.
- `capture_pageview: 'history_change'` (what `defaults: '2025-05-24'` and later switch on) listens
  to the History API. This app never pushes history, so it changes nothing today. Keep it set
  anyway, so that adding real routes later starts working without a config change.

### Chosen approach: a custom `screen_viewed` event plus a super property

Fire one custom event when the derived screen name changes, and register the screen name as a
super property so that every other event - including autocapture clicks and `$pageleave` - carries
the screen it happened on. That last part is what makes tab-close abandonment measurable.

```js
// inside Home(), app/page.js
const screen =
  openText ? "reading"
  : scenario ? (stage === "chat" ? "conversation"
              : stage === "leaderboard" ? "leaderboard"
              : stage === "feedback" ? "evaluation"
              : "intro")
  : tab === "texts" ? "texts"
  : tab === "feedback" ? "feedback"
  : "home";

useEffect(() => {
  posthog.register({ app_screen: screen });           // sticks to every later event
  posthog.capture("screen_viewed", {
    screen,
    scenario_id: scenario?.id ?? null,
    text_id: openText?.id ?? null,
  });
}, [screen, scenario?.id, openText?.id]);
```

The screen names are exactly the ones `CLAUDE.md` defines, so a chart label and a conversation
about the app use the same word. Mapping, for reference:

| `screen` | State |
|---|---|
| `home` | `tab=practice`, no scenario |
| `intro` | scenario open, `stage=intro` |
| `conversation` | scenario open, `stage=chat` |
| `leaderboard` | `stage=leaderboard` |
| `evaluation` | `stage=feedback` |
| `feedback` | `tab=feedback` (nav label "Review") |
| `texts` | `tab=texts`, no text open |
| `reading` | `openText` set |

### Options considered

- **Synthetic `$pageview` with a fabricated `$current_url`** (`.../screen/conversation`). Works, and
  it reuses PostHog's built-in path reports and web analytics. Rejected: it invents URLs that do
  not exist, which misleads anyone reading the web analytics tab later, and it mixes fabricated
  paths into the same `$pageview` series as the one real page load. Trading away: the built-in
  pageview funnels, which are easy enough to rebuild on `screen_viewed`.
- **Put the state in the URL** (`/?tab=texts&scenario=fahrkarte&stage=chat`) via
  `history.replaceState` or `router.replace`, then let `capture_pageview: 'history_change'` do the
  work for free. This is the better long-run answer: it also gives back/forward navigation and
  shareable links, which the app lacks. Rejected *for this plan* because it is a product change to
  a 1000-line component, not an analytics change, and it should not ride along inside an analytics
  PR. Worth filing separately; `screen_viewed` keeps working if it ever lands.

---

## 3. Event catalogue

Nine custom events. Property names are `snake_case`. Every event additionally carries the
`app_screen` super property and PostHog's own `$` properties.

| Event | Properties | Answers |
|---|---|---|
| `screen_viewed` | `screen` (enum above), `scenario_id`\|null, `text_id`\|null | Q5, Q8, all navigation |
| `scenario_opened` | `scenario_id`, `scenario_title`, `level`, `category`, `locked` (bool) | Q1, Q2 |
| `conversation_started` | `scenario_id`, `level` | Q2, Q3 |
| `conversation_ended` | `scenario_id`, `reason` (`finished`\|`abandoned`\|`failed`), `user_turns`, `assistant_turns`, `duration_ms` | Q3 |
| `conversation_scored` | `scenario_id`, `score`, `score_band` (`low`\|`ok`\|`good`), `grammar`, `vocabulary`, `goal_reached` (bool), `user_turns` | Q4 |
| `text_opened` | `text_id`, `text_title`, `level` | Q6 |
| `word_looked_up` | `text_id`, `kind` (`word`\|`sentence`), `in_glossary` (bool), `word` (word lookups only) | Q6, Q10 |
| `favorite_toggled` | `fav_type` (`correction`\|`vocab`\|`phrase`\|`keyword`\|`message`), `action` (`added`\|`removed`), `scenario_id`\|null | Q7 |
| `review_marked` | `fav_type`, `reviews` (new count), `mastered` (bool, `reviews >= MASTER_AT`) | Q8 |

Notes on specific properties:

- `score` comes from the server (`/api/feedback` returns `{ evaluation, score, board, streak }`,
  score computed in `app/scoring.js`). The client never invents it, so the number in PostHog and
  the number in the `sessions` table agree. `score_band` duplicates `scoreClass()` in `page.js`
  (80/60 thresholds) so that charts can group without a formula.
- `grammar`/`vocabulary`/`goal_reached` come out of `evaluation.breakdown`. Keep it to those three;
  do not ship the whole breakdown object as a property blob.
- `word` on `word_looked_up` is a word from a static text in `app/texts.js`, i.e. published content,
  not something the user wrote. It is safe and it is the whole point of Q10. Sentence lookups send
  **no** text - only `kind: "sentence"` and `text_id` - because a sentence is enough content to be
  worth not shipping, and knowing which sentence was tapped adds nothing.
- Deliberately **not** events: every chat turn, every keystroke, screen time, the transcript, the
  corrections. See section 8.

---

## 4. Where each capture goes

All of these are in `app/page.js` unless stated. Import once at the top of the file:
`import posthog from "posthog-js";`

| Event | Function | Note |
|---|---|---|
| `screen_viewed` | new `useEffect` in `Home`, keyed on the derived `screen` | Single place; do not scatter screen captures into handlers |
| `scenario_opened` | `open(s)` | `locked: Boolean(s.locked)`; note `open()` is only reached for unlocked scenarios today, so `locked` is always false until the click-through on a locked card is allowed |
| `conversation_started` | extract the inline `onClick={() => setStage("chat")}` on the "Los geht's" button into a named `startConversation()` and capture there | Also set `chatStartedAt.current = Date.now()` here, for `duration_ms` |
| `conversation_ended` (`reason: "finished"`) | `endConversation()`, before the `await` | Captured before the request so a failed scoring call still records that the person finished |
| `conversation_scored` | `endConversation()`, in the `try` after `postJSON("/api/feedback", ...)` resolves | Reads `res.evaluation.score` / `res.evaluation.breakdown` |
| `conversation_ended` (`reason: "failed"`) | `endConversation()` `catch` block | Distinguishes "the server broke" from "they walked away" |
| `conversation_ended` (`reason: "abandoned"`) | `back()`, guarded by `if (stage === "chat" && messages.length > 0)` | `navTo()` also calls `back()`, so nav-away abandonment is covered by the same line |
| `text_opened` | there are two `setOpenText(t)` call sites (the hero button and the list rows). Extract `openReading(t)` and call it from both | |
| `word_looked_up` | `pickWord()` and `pickSentence()` inside `TextReader` | `in_glossary` = whether the word resolved from `texts.js` without hitting `/api/translate` |
| `favorite_toggled` | `toggleFav(item)`, after the `await` succeeds | Capturing after the write means a failed save (which rolls the UI back) is not counted as a favorite |
| `review_marked` | `markReviewed(item)`, after the `await` succeeds | |
| `posthog.reset()` | `AuthButton`'s sign-out handler, next to the existing `fetch("/api/me", { method: "DELETE" })` | Not an event, but belongs here: without it the next person on a shared machine inherits the previous person's `distinct_id`, exactly the problem the `rp_uid` delete already solves |

Tab-close abandonment needs no capture call: `$pageleave` is on by default and carries the
`app_screen` super property, so `$pageleave where app_screen = conversation` is the "closed the tab
mid-conversation" number.

---

## 5. Init and provider setup

### Recommendation: `instrumentation-client.js`, not `app/providers.js`

PostHog's current Next.js guide initializes in the framework's
[`instrumentation-client.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client)
file, not in a provider. Next 16 supports it (introduced in 15.3; the local copy of the docs is at
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md`).
Three reasons it is the right choice here specifically:

1. It runs after document load and **before React hydration**, so the very first interactions are
   captured. A `useEffect` in a provider runs after hydration.
2. It is browser-only. `app/providers.js` is a client component but is still executed on the server
   during SSR/prerender, so importing `posthog-js` there pulls the library into the Worker bundle
   as well. The Cloudflare free tier caps the Worker bundle (~3 MB gzip) and this repo already ships
   Next plus the AI SDK plus Auth.js into it. `instrumentation-client.js` keeps posthog-js in the
   browser bundle only, where it is served from the `ASSETS` binding and costs nothing.
3. It leaves `app/providers.js` alone, which is a two-line file wrapping `SessionProvider`.

Trade-off: no `PostHogProvider`, so `usePostHog()` is not available. That is fine - the docs'
instrumentation-client page says to `import posthog from "posthog-js"` and call methods directly
anywhere, and states that the `@posthog/react` feature-flag hooks work against the initialized
singleton without a provider. If feature flags or surveys with provider-scoped hooks are wanted
later, add `@posthog/react` and wrap the children in `app/providers.js` then; the init call does
not move.

### `npm i posthog-js`

Current version at time of writing: `posthog-js` 1.434.1. Do **not** install `posthog-js/react`;
the React bindings moved to the separate `@posthog/react` package (1.11.1), and this plan needs
neither.

### `instrumentation-client.js` (repo root, next to `next.config.mjs`)

```js
// Client-side analytics. This file runs in the browser only, before React hydrates,
// so posthog-js never enters the Cloudflare Worker bundle.
import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    ui_host: "https://eu.posthog.com",

    // Opt in to the dated defaults rather than the legacy ones. Check the config docs for
    // the newest date before implementing; this was the latest listed.
    defaults: "2026-08-30",

    // The app has one route, so this only ever fires on a hard load. Kept as history_change
    // so that real routes, if they ever exist, start reporting without a config change.
    // Screens are tracked by the screen_viewed event instead (see the plan, section 2).
    capture_pageview: "history_change",
    capture_pageleave: true,

    // Anonymous users get no person profile: cheaper, and nothing to delete later.
    // This is also the SDK default; set explicitly because it is a decision, not an accident.
    person_profiles: "identified_only",

    // This app renders speech transcripts and AI replies inside clickable containers.
    // Autocapture walks the element tree, so element text must never leave the browser.
    mask_all_text: true,
    mask_all_element_attributes: true,
    autocapture: { element_allowlist: ["a", "button"] },

    // Session replay would record the conversation. Off, deliberately and explicitly.
    disable_session_recording: true,
    disable_surveys: true,
  });
} else if (process.env.NODE_ENV === "development") {
  console.warn("[analytics] NEXT_PUBLIC_POSTHOG_KEY is not set; PostHog is disabled.");
}
```

`app/providers.js` and `app/layout.js` are unchanged.

The `if (key)` guard matters for this pipeline: a build without the variable produces an app that
works normally and sends nothing, rather than one that throws on load. See section 10 for how to
notice that you shipped such a build.

### Do not add a reverse proxy

PostHog recommends proxying its ingestion endpoint through your own domain so ad blockers do not
drop events. Do not do it here. Under OpenNext on Workers, a Next rewrite for `/ingest/*` is served
by the Worker, so every single analytics request would consume one of the 100k daily Worker requests
and its CPU slice - the opposite of the "browser-to-PostHog is free" property in section 9. Trading
away: some percentage of events lost to blockers, probably meaningful for a technical audience. If
that ever matters, PostHog's managed reverse proxy (a paid add-on) sidesteps the Worker entirely and
is the option to evaluate, not a Next rewrite.

---

## 6. Key and host configuration for this build pipeline

### The constraint, stated exactly

`NEXT_PUBLIC_*` variables are inlined by `next build` into the JavaScript sent to the browser. From
the Next docs: "Next.js can inline a value, at build time, into the js bundle ... After being built,
your app will no longer respond to changes to these environment variables."

`npm run deploy` is `opennextjs-cloudflare build && opennextjs-cloudflare deploy`, and the `build`
step runs `next build`. Therefore:

- `npx wrangler secret put NEXT_PUBLIC_POSTHOG_KEY` **does not work**. Worker secrets are runtime
  values injected into `workerd`; the client bundle was frozen minutes earlier.
- A `vars` entry in `wrangler.jsonc` **does not work** either, for the same reason.
- `.dev.vars` **does not work** - it is read by wrangler at runtime, not by `next build`.
- The value must be present in the environment of the process that runs `next build`.

### Where it must live

`next build` (NODE_ENV=production) resolves variables in this order: `process.env`,
`.env.production.local`, `.env.local`, `.env.production`, `.env`.

This repo's `.gitignore` contains `.env` and `.env*.local`. It does **not** ignore `.env.production`.

**Recommended: commit `.env.production` with the project token in it.**

```shell
# .env.production - committed on purpose.
# The PostHog project token is a publishable client key (see below); it is compiled into the
# browser bundle by `next build`, so it cannot be a Worker secret. Keeping it here means any
# checkout can run `npm run deploy` and produce a build that actually reports.
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

Why: builds are reproducible from a clean clone, and nobody can ship an analytics-blind production
build by forgetting to export a shell variable. What it trades away: the token is visible in the
repo, so anyone with repo access - or anyone who opens DevTools on the live site, which is the same
thing - can send events to the project. That is section 6's last paragraph.

**Alternative, if committing it is unacceptable:** export it in the environment that runs the
deploy - `NEXT_PUBLIC_POSTHOG_KEY=phc_... npm run deploy`, or as a build-time environment variable
in Cloudflare Workers Builds / a CI job. Mitigate the silent-failure mode with a check in the deploy
script, e.g. `node -e "process.env.NEXT_PUBLIC_POSTHOG_KEY || (console.error('missing PostHog key'), process.exit(1))"`.

### Local development

`.env.local` (already gitignored) gets the same two variables, pointing at the same project or at a
separate "RolePartner dev" project. A separate dev project is worth the two minutes: it keeps test
runs out of the numbers you make decisions from. If you use one project for both, add
`posthog.register({ env: process.env.NODE_ENV })` and filter.

### Files to update

- **`.env.example`** - add both variables with a comment saying they are baked in at build time and
  are safe to publish:
  ```shell
  # PostHog (analytics de produto). Chave publicável: entra no bundle do navegador.
  # Lida por `next build`, NÃO por wrangler em runtime. Ver plan_posthog.md seção 6.
  NEXT_PUBLIC_POSTHOG_KEY=
  NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
  ```
- **`.dev.vars.example`** - add a comment, not the variables, so the next person does not put them
  there and wonder why nothing arrives:
  ```shell
  # As variáveis NEXT_PUBLIC_POSTHOG_* NÃO entram aqui: são compiladas no bundle do cliente
  # por `next build` (.env.local / .env.production), não lidas pelo worker em runtime.
  ```
- **`wrangler.jsonc`** - no change.

### The project token is publishable

PostHog's own docs: the project token (starts with `phc_`) is fine to be public - it is what
initializes the SDK, captures events and evaluates flags. The personal API key (`phx_`) is the one
that must never ship; nothing in this plan uses one.

What "publishable" permits: anyone can write events into the project. Someone could forge or spam
events and make the numbers wrong. There is no rate limit you control on the free tier, so a
determined spammer could also burn through the 1M monthly allowance. What it does **not** permit:
reading any data out of the project, listing users, or changing project settings.

---

## 7. Identity

### Today (everyone anonymous)

Do not call `identify` at all. With `person_profiles: "identified_only"`, every event is an
anonymous event: no person profile is created, nothing to honour a deletion request over, and the
events sit in PostHog's cheapest tier (identified events cost up to 4x more).

The unit of analysis is PostHog's own `distinct_id`, stored in `localStorage` + a cookie on the
app's own domain. What that costs analytically: one person on a phone and a laptop counts as two,
and clearing site data resets them to new. Both acceptable for a pre-launch app whose questions are
about screens and funnels rather than about individuals.

### When Google login is switched on

`useSession()` from `next-auth/react` is already available in `app/page.js` (used by `AuthButton`).
The constraint is that the D1 user id must not reach the client - `/api/me` deliberately omits it
because it is the value of the HttpOnly `rp_uid` cookie, and returning it would undo that flag.
This plan does not touch that.

Three candidate identifiers:

1. **`session.user.email`.** Zero backend work. Rejected: it plants a real email address in PostHog
   as a `distinct_id`, permanently, on a free-tier analytics project, for a product that has no
   need to know who anyone is. It also makes every deletion request a PostHog problem as well as a
   D1 problem.
2. **A client-side hash of the email.** No backend work, no PII shipped. Rejected: the client would
   have to do the hashing, so the mapping is guessable by anyone who knows the algorithm and a
   candidate email - which is the same privacy exposure with extra steps.
3. **A server-derived pseudonymous id (recommended).** Add one field to `/api/me`:
   ```js
   // app/api/me/route.js - alongside email/name/anonymous/streak
   analyticsId: user.email ? await hmacId(user.id) : null,
   ```
   where `hmacId` is `SHA-256(user.id + ANALYTICS_SALT)` hex-truncated to 32 chars, with
   `ANALYTICS_SALT` a Worker secret (`npx wrangler secret put ANALYTICS_SALT` - this one *is*
   runtime, so a secret is correct). Then in `app/page.js`, once `me` has loaded:
   ```js
   useEffect(() => {
     if (me?.analyticsId) posthog.identify(me.analyticsId);
   }, [me?.analyticsId]);
   ```
   This is not the cookie value and cannot be replayed as one - the server only ever accepts the
   real `rp_uid` - so the HttpOnly guarantee is untouched. It is stable across devices, because
   `resolveUser()` in `app/db.js` looks the user up by email on login and claims any existing
   anonymous row, so one Google account maps to one D1 row maps to one hash.

   `identify()` also merges the person's prior anonymous events into the identified person, so the
   pre-login sessions on that device are not lost.

   What it costs analytically: you cannot search PostHog for a person by email, and you cannot join
   a support conversation to a person profile without re-running the hash server-side. Send no
   person properties beyond non-identifying ones (e.g. `$set: { level: ... }` if that ever exists).
   Deliberately no email, no name, no avatar URL.

Also required at that point: `posthog.reset()` on sign-out, in `AuthButton` (section 4).

Cost note: identifying every logged-in user moves their events into the identified tier. With a
handful of users that is irrelevant; it is worth remembering if the app ever gets traction.

---

## 8. Privacy

This app captures speech (Web Speech API transcripts of the user talking), AI-generated German
conversation, LLM-written corrections quoting what the person said wrong, and on-demand
translations. A German practice transcript is a person talking about their own life in a second
language; treat it as personal data, because under the GDPR's definition it plausibly is.

### Must never reach PostHog

- The contents of `messages[]` - neither role. Not as an event property, not as an element text.
- Anything from `evaluation`: `corrections[].wrong` / `.right` / `.note`, `summary`, `strengths`,
  `tip`. Only the numbers (`score`, `grammar`, `vocabulary`) leave.
- Favorite payloads: `de`/`en`/`text`/`wrong`/`right`. Only `fav_type` leaves.
- The sentence text in `pickSentence()`.
- `session.user.email`, `name`, `image` (section 7).

### The concrete settings that enforce it

| Setting | Value | Why, for this app specifically |
|---|---|---|
| `mask_all_text` | `true` | Autocapture builds an `$elements` chain from root to click target and records element text. `StarButton` is a `<button>` **inside** a `.bubble` that renders a chat message, so a single star tap would otherwise ship the surrounding message text. This is the single most important line in the config. |
| `mask_all_element_attributes` | `true` | Same risk via `title`/`aria-label`; `AuthButton` puts the person's Google name in a `title` attribute. |
| `autocapture.element_allowlist` | `["a", "button"]` | Narrows autocapture to real controls, keeping it away from the chat and the reader panel. |
| `disable_session_recording` | `true` | Replay would capture the entire conversation as video. Do not turn this on later without re-reading this section; if it is ever wanted, it needs `maskAllInputs` plus `ph-no-capture` on `.bubble` and the reader panel. |
| `person_profiles` | `"identified_only"` | No person profiles for anonymous visitors: nothing to store, nothing to delete. |
| `disable_surveys` | `true` | Not used; one less script and one less endpoint. |
| Event properties | hand-written only | No property is ever spread from `item`, `evaluation` or `m.content`. Write property objects literally, field by field. A code-review rule, not a config flag. |

Belt and braces, optional: `property_denylist`, or a `before_send` hook that drops any event whose
property values exceed a length threshold. Worth it only if the team grows.

### Region: EU

Use `https://eu.i.posthog.com` (and `ui_host: https://eu.posthog.com`). The app is a German learning
tool; its likely users are in Europe, and the behavioural data around German practice sessions is
arguably personal data. Keeping it in the EU region removes a transfer question before anyone asks
it, at no cost or feature difference. Trading away: the region is chosen when the PostHog
organization/project is created and cannot be flipped afterwards without starting a new project and
losing history - so decide before signing up, not after.

### Consent

Not covered by any of the above: in the EU, non-essential analytics that write a cookie generally
need consent. Options, in order of effort:
- do nothing and accept the risk (a hobby project with no users - defensible today, not after launch);
- `opt_out_capturing_by_default: true` plus a small banner calling `posthog.opt_in_capturing()`;
- `persistence: "memory"` so nothing is stored client-side, at the cost of no returning-user
  analysis at all.
Also add a privacy line to the app saying anonymous usage analytics are collected and that
conversation content is not sent. This is an open decision for the user (section 11), and it is
worth a lawyer's five minutes before a public launch, not mine.

---

## 9. Cost

### PostHog free tier (checked September 2026, via search results; the pricing page itself was not reachable from this environment)

- **1,000,000 events per month free**, every month, no credit card, then usage-based pricing from
  roughly $0.00005 per anonymous event in the 1-2M band, stepping down at volume.
- Identified events are billed at a higher rate on top of the base (roughly 4x; about $0.000248 vs
  $0.00005 in the first paid band), which is why section 7 keeps anonymous users anonymous.
- Also on the free tier: 5,000 session replays/month (unused here - replay is off), 1M feature flag
  requests/month, unlimited team members.

### Estimate for this app

A rough engaged session: 1 `$pageview`, 1 `$pageleave`, 6-10 `screen_viewed`, 1 `scenario_opened`,
1 `conversation_started`, 1 `conversation_ended`, 1 `conversation_scored`, 2-5 `favorite_toggled` /
`review_marked`, plus autocapture clicks (roughly 20-40) and a handful of `$web_vitals`. Call it
60 events for a practice session.

A reader session is the volatile one: `word_looked_up` fires on every tap in the text, and a curious
reader can tap 50 words in one sitting. Call it 100 events.

So on the order of 60-100 events per active session. 1M/month divided by 80 is roughly
**12,000 sessions per month** inside the free tier. The app currently has 3 scenarios (2 locked),
4 reading texts, and no users. Staying free is not in doubt; the first thing that would threaten it
is `word_looked_up` under real reader traffic, and the mitigation is to sample it or drop it to
`in_glossary=false` only (which is the part that answers Q10 anyway).

### Cloudflare cost: zero

Confirmed for this setup: the browser posts events directly to `eu.i.posthog.com`. Those requests
never touch the Worker, so they consume none of the 100k requests/day and none of the 10ms CPU per
invocation. This is only true because section 5 rejects the reverse proxy; a Next rewrite proxy
would convert every event into a Worker request.

The one real cost is bundle size: posthog-js adds tens of KB gzipped to the client bundle. It is
served from the `ASSETS` binding, which `wrangler.jsonc` already documents as free and unmetered,
and it stays out of the Worker bundle because it is imported only from `instrumentation-client.js`.
Check the actual figure in the `next build` output after installing.

---

## 10. Verification

1. **Local, dev server.** Put the key in `.env.local`, `npm run dev`, open `http://localhost:3000`.
   In the browser console run `posthog.debug()`; every capture then logs. Walk one full path:
   home -> open a scenario -> Los geht's -> speak one turn -> Gespräch beenden -> leaderboard ->
   Zur Auswertung -> star a correction -> Review -> Got it -> Texts -> open a text -> tap a word.
2. **Network check.** DevTools Network, filter `i.posthog.com`. Each capture is a POST that should
   return 200. A CORS error or a 401 means a wrong key or the wrong `api_host` region.
3. **PostHog live view.** Activity -> Live events in the PostHog project. Confirm each of the nine
   event names arrives, and that `conversation_scored` carries a plausible `score`.
4. **Privacy check, do this one deliberately.** In the live view, open the raw JSON of an
   `$autocapture` event produced by tapping a star inside a chat bubble. Confirm the `$elements`
   entries have no `text` values. Then scan every custom event's properties for anything that is not
   in the section 3 table. This is the check that catches a spread operator someone added.
5. **Worker runtime.** `npm run preview` (`opennextjs-cloudflare build && ... preview`) and repeat
   step 2 against workerd. This confirms nothing about the OpenNext build breaks
   `instrumentation-client.js` - the one piece of this plan that was not verified against OpenNext
   in writing it.
6. **Build-time inlining check, the one that catches the pipeline mistake.** After a build:
   ```sh
   grep -rl "phc_" .open-next/assets/_next/static | head
   ```
   A hit means the token was inlined into the client bundle. No hit means the environment variable
   was missing at `next build` time, and the deploy would be analytics-blind while looking healthy.
7. **Post-deploy.** Load the live site, confirm events with the country and referrer fields
   populated (they come from PostHog's edge, not the Worker), and check that the events are tagged
   with the right `app_screen`.
8. **After a week.** Build the two insights that justify the work: a funnel
   `scenario_opened -> conversation_started -> conversation_scored`, and a bar chart of
   `conversation_ended` broken down by `user_turns`. If neither is legible, the event set is wrong,
   not the tool.

---

## 11. Risks and open decisions

### Decisions needed from the user

1. **EU or US region.** Recommended EU. Must be decided at signup; changing it later means a new
   project and losing history.
2. **Commit `.env.production` with the token, or keep it in a shell/CI environment variable?**
   Recommended: commit. The token is publishable, and committing removes the "forgot to export it"
   failure mode.
3. **Consent banner now, or accept the risk until launch?** Recommended: accept it now, revisit
   before any public launch, and add the privacy sentence to the UI in the same PR regardless.
4. **`mask_all_text: true` (recommended) or keep autocapture's button text and defend it with
   `ph-no-capture` classes?** The second gives more from autocapture, and leaks the moment someone
   adds a component and forgets the class.
5. **Keep `word_looked_up` at full volume, or only for `in_glossary=false`?** Full volume answers
   more about reader engagement; restricted volume is the safer bill.

### Risks

- **The nine events are guesses about what matters.** After two weeks of real data, expect to
  delete two and add one. Events are cheap to add and awkward to remove from dashboards, so err
  toward fewer.
- **Ad blockers** drop an unknown share of events, likely a high share for this audience. Numbers
  are directional, not exact. Do not use them for anything that needs to be right.
- **Anonymous-user identity is per-device and per-browser-profile**, so "users" is an overcount.
- **`instrumentation-client.js` under OpenNext is unverified** (step 5 above). Fallback if it does
  not fire: move the same `posthog.init(...)` into a `useEffect` in `app/providers.js` and accept
  the bundle cost and the post-hydration start.
- **Event-name drift.** Nothing in the build checks that a `posthog.capture` call matches this
  table. If it becomes a problem, put the names in an `app/analytics.js` module with one exported
  function per event, and let the module be the schema. Worth doing now if the event list grows
  past a dozen.

### Effort

- Section 5 install and init: 30 minutes.
- Sections 2 and 4, the `screen_viewed` effect and the nine capture call sites: 2 to 3 hours,
  including extracting `startConversation()` and `openReading()`.
- Section 6 configuration and the two `.example` files: 30 minutes.
- Section 10 verification, done properly including the privacy check: 1 hour.
- Section 7 identity: deferred until Google login has real users; about 1 hour then, mostly the
  `/api/me` change and the salt secret.

**Roughly half a day** for everything except identity.

---

## What `back.md` item 12 got wrong

The sketch was directionally right - client-only, lazy, four manual events - and wrong on five
specifics:

1. **"Inicializar dentro do `app/providers.js`"** - superseded. PostHog's current Next.js guide uses
   `instrumentation-client.js`, which also keeps posthog-js out of the Worker bundle (section 5).
2. **`<PostHogProvider client={posthog}>`** - the React bindings moved from `posthog-js/react` to the
   separate `@posthog/react` package, and with instrumentation-client init no provider is needed.
3. **"Autocapture já pega cliques/pageviews sem instrumentar nada"** - true in general, nearly
   useless here. One route means one pageview per session, and `mask_all_text` (which the transcript
   risk forces) removes the click labels (sections 1 and 2).
4. **Four events are not enough.** `scenario_start`, `feedback_shown`, `favorite_added`, `text_open`
   cannot answer where people abandon a conversation, which is the question the item itself names
   first. Section 3 has nine, including `screen_viewed` and `conversation_ended`.
5. **`posthog.identify(session.user.id)`** - there is no such id on the client. Auth.js gives email,
   name and image, and the D1 id is deliberately withheld. Section 7 uses a server-derived hash.

Also missing from the sketch and added here: the build-time inlining constraint for
`NEXT_PUBLIC_*` under OpenNext (section 6), `posthog.reset()` on sign-out, the EU/US region choice,
`person_profiles: "identified_only"`, and the explicit decision not to proxy through the Worker.

---

## Sources

Fetched from the PostHog documentation repository (`raw.githubusercontent.com/PostHog/posthog.com`),
September 2026 - `posthog.com` itself is blocked by this environment's egress proxy, so the docs
were read from the source repo that publishes them:

- `contents/docs/libraries/next-js/index.mdx` and
  `contents/docs/integrate/_snippets/nextjs/install-nextjs.mdx` - the `instrumentation-client.js`
  setup and the `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` / `NEXT_PUBLIC_POSTHOG_HOST` variables.
- `contents/docs/libraries/next-js/_snippets/instrumentation-client-access.mdx` - direct
  `import posthog from "posthog-js"` usage and hooks without a provider.
- `contents/docs/libraries/js/config.mdx` - every init option quoted in section 5, including
  `defaults` (latest listed: `2026-08-30`), `capture_pageview: 'history_change'`, `person_profiles`
  default `identified_only`, `mask_all_text`, `mask_all_element_attributes`, `property_denylist`,
  `persistence`, `opt_out_capturing_by_default`.
- `contents/tutorials/single-page-app-pageviews.md` - the SPA pageview problem and the
  provider-based alternative; also confirms `@posthog/react` as the React package.
- `contents/docs/product-analytics/autocapture.mdx` and
  `contents/docs/privacy/_snippets/autocapture-config-web.mdx` - what autocapture collects, form
  values excluded, `ph-no-capture`.
- `contents/docs/data/anonymous-vs-identified-events.mdx` and
  `contents/docs/product-analytics/_snippets/identified-vs-anonymous-intro.mdx` - "anonymous events
  can be up to 4x cheaper than identified ones".
- `contents/docs/privacy/index.mdx` and `contents/docs/_snippets/exposed-api-keys.mdx` - the `phc_`
  project token is safe to be public; `phx_` personal keys are not.
- `contents/docs/product-analytics/identify.mdx` - `identify`, anonymous-to-identified merging,
  reset on logout.
- npm registry: `posthog-js@1.434.1`, `@posthog/react@1.11.1`.

Next.js, from this repo's own copy of the docs (per `AGENTS.md`):

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md`
  - introduced in 15.3, runs before hydration, root of the app.
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` - `NEXT_PUBLIC_*` inlining
  at build time and the `.env` load order.

### Not verified

- **PostHog pricing figures** (1M events/month free, per-event rates). The pricing page is on
  `posthog.com`, which this environment cannot reach; the numbers come from search-result summaries
  of third-party 2026 pricing write-ups and are consistent with each other, but confirm on
  https://posthog.com/pricing before relying on them. The conclusion - this app stays free by three
  orders of magnitude - is robust to the numbers being somewhat off.
- **The newest `defaults` date.** `2026-08-30` was the latest listed in the config doc as fetched.
  Check for a newer one at install time.
- **`instrumentation-client.js` under `@opennextjs/cloudflare`.** Nothing in the OpenNext package
  references it; it should be transparent, since Next bundles it into the client entry and OpenNext
  only serves the resulting static assets, but it is unproven. Verification step 5 exists for this.
- **PostHog cookieless tracking.** Referenced as an option under consent; the doc path I tried
  returned 404, so confirm what PostHog currently offers before choosing that route.
