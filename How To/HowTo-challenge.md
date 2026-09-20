# HowTo: A Challenge (intro + conversation + evaluation)

How one practice scenario ("challenge") flows from briefing to live chat to scored
feedback, and what you fill in to add a new one. Everything is driven by a single
object in `app/scenarios.js`; add one there and it shows up in the menu and all three
screens automatically.

## The pieces

| File | Role |
|------|------|
| `app/scenarios.js` | Data. One object per challenge. `byId(id)` looks one up. Imported by the client (menu + all screens) and the API routes (system prompt + evaluation title). |
| `app/page.js` | `Home` component holds `scenario` and `stage` (`intro` / `chat` / `feedback`) and renders each screen. `Evaluation` and `ResultModal` are the feedback UI. |
| `app/api/chat/route.js` | Live conversation. Sends the transcript + the scenario's `system` prompt to the model, returns the character's next German line. |
| `app/api/feedback/route.js` | Evaluation. Sends the transcript, returns a structured score object (`evalSchema`). |

One object powers the whole flow:

```js
{
  id: "fahrkarte",              // unique slug, used by byId and stored on every result
  category: "Reisen",           // menu filter chip
  level: "A2",                  // CEFR pill (A/B/C drives the color)
  featured: true,               // optional: shows as the big hero card on Home
  locked: true,                 // optional: greys the row out, not startable
  photo: "https://…",           // header image (intro + menu row)

  title: "Fahrkarte kaufen",    // shown everywhere; also the leaderboard label
  desc: "Kauf am Bahnhofsschalter …",   // one-line menu subtitle + chat subtitle

  place: "Du stehst am Fahrkartenschalter …",   // intro subtitle (German)
  placeEn: "You are at the ticket counter …",   // English version (toggle)
  goal: "Kaufe eine Zugfahrkarte …",            // the mission (German)
  goalEn: "Buy a train ticket …",               // English version (blurred until "Show English")
  tasks:   ["Sag, wohin du willst", …],         // 2-4 sub-steps (German)
  tasksEn: ["Say where you want to go", …],     // English, SAME length/order as tasks

  vocab:   [{ de: "die Fahrkarte", en: "the ticket" }, …],   // starrable word list
  phrases: [{ de: "Ich möchte …",   en: "I would like …" }, …], // starrable phrase list

  system: `Du bist ein Schalterbeamter …`,      // the character's role prompt (German)
}
```

---

## 1) Intro (the briefing)

`stage === "intro"`. The user picked the scenario from Home; nothing has been sent yet.

**What the user sees**
- Header photo with the `category` and `level` pills.
- `title`, then `place` / `placeEn` as the subtitle.
- **Dein Ziel / Goal** panel: `goal` + `tasks`. English (`goalEn`, `tasksEn`) sits blurred beside each line; the "Show English" toggle unblurs it.
- **Wortschatz** panel: `vocab`, each with a star to save it to the "Review" repo.
- **Nützliche Sätze** panel: `phrases`, same star behavior.
- Button: **Los geht's** (starts the conversation).

**What drives it**
- Every field above is read straight off the scenario object. The three panels only render if their array is non-empty, so `vocab`/`phrases` are optional.
- Stars call `toggleFav`, tagging the item `type: "vocab"` or `type: "phrase"` so it lands in the right section of the Review screen.
- "Los geht's" just runs `setStage("chat")`. No API call happens in the intro.

**Preview buttons** (dev only, remove when the real flow is enough)

---

## 2) Conversation (the live chat)

`stage === "chat"`. Voice-driven role-play against the character defined by `system`.

**What the user sees**
- `desc` as the subtitle.
- **Sprechen** button (records one utterance), **Gespräch beenden** (ends and scores).
- The chat bubbles. Each character (assistant) line has a star to save it as a `message` favorite.

**The turn loop**
1. `listen()` uses the browser's `SpeechRecognition` (`de-DE`, Chrome only). One press captures one spoken utterance.
2. `onresult` hands the transcript to `send(userText)`.
3. `send` appends the user line to `messages` and `POST`s the whole array + `scenarioId` to `/api/chat`.
4. `/api/chat` looks up the scenario and builds the system prompt with `buildSystem(scenario)`, then calls the model with it and the full `messages` as history, returns the next German line.
5. The reply is appended to `messages` and read aloud with `speak()` (`SpeechSynthesis`, `de-DE`).

**What the `system` prompt controls**
The character is defined by `scenario.system` (role, place, tone). On top of that, `buildSystem` in `route.js` appends the scenario's structured fields so the model knows the mission and target language, not just its persona:

- `level` → "Niveau des Nutzers: …" so it calibrates difficulty.
- `goal` → "Ziel des Nutzers: …" the mission to steer toward.
- `tasks` → "Aufgaben: …" the sub-steps, joined by `;`.
- `vocab` → "Zielvokabular (bevorzugt einsetzen): …" the German words to work in.
- `phrases` → "Nützliche Sätze: …" the German phrases, joined by `|`.

Each line is guarded, so a scenario missing a field just skips it. English translations (`vocab.en`, `phrases.en`) are intentionally not sent: the model speaks German only. So `scenario.system` still handles role/place/tone (stay in character, German only, short sentences, help when stuck), and the structured fields handle the mission and vocab. Copy an existing `system` and swap the role/place/ending; the rest flows from the fields you already fill in.

**Notes**
- Model is `gpt-5-nano` via the AI SDK; key comes from `OPENAI_API_KEY` in `.env.local`.
- No message limit; "Gespräch beenden" is enabled once there is at least one message.
- Speech is browser-native, so it is reliable mainly in Chrome.

---

## 3) Evaluation (the score)

Triggered by **Gespräch beenden** → `endConversation()`. This does three things: score, save, and open the result modal.

**Scoring (`/api/feedback`)**
- `endConversation` `POST`s `messages` + `scenarioId`.
- The route flattens the transcript (`Aluno:` / `Personagem:`) and asks the model, as a German teacher, to return an object matching `evalSchema`:

| Field | Meaning |
|-------|---------|
| `score` | 0-100 overall (fluency + grammar + vocab + whether the `goal` was met). This is the number shown. |
| `summary` | One-sentence recap (English). |
| `strengths` | 1-3 things done well (English). |
| `corrections` | Up to 5 mistakes: `wrong` → `right`, a `note`, and a `tag` from a fixed category list. |
| `tip` | One practical tip (English). |
| `grammar`, `vocab` | 0-5 sub-ratings. Still returned and stored, but no longer shown in the UI. |

**Saving (`saveFeedback`)**
`saveSession()` POSTs the transcript and the evaluation to `/api/sessions`, which stores a row in D1 and returns the Top 10 for the leaderboard screen that follows the conversation.

**The feedback screen (`Evaluation` component)**
- `score-card`: the big `score/100`, colored by band (`good` ≥80, `ok` ≥60, else `low`), plus the `summary`.
- **Medal goals** (`MedalGoals` + shared `MEDAL_TIERS`): Bronze 75, Silber 85, Gold 95; a tier lights up when `score` clears its threshold.
- **Das lief gut** (`strengths`), **Korrekturen** (`corrections`, each starrable), **Tipp** (`tip`). Panels only render when their data exists.

**The result modal (`ResultModal`, opens on top right after finishing)**
1. Big medal + tier for this `score` (`medalFor`), or "Keine Medaille" below 75, with a "X points to next tier" line (`nextTier`).
2. **Personal leaderboard** for this scenario: `buildBoard(scenarioId)` filters `feedbacks` to this challenge and lists the top 10 by score, each row = one of your past attempts (date + score).
3. **Transition**: if this attempt cracks the top 10, its row slides in with a glow (`lbEnter`) and a "Neu auf Platz N" badge pops. If not, a "not in the top 10, best stays X" line.
4. **Weiter** closes the modal, leaving the detailed `Evaluation` screen underneath.

The leaderboard is **per-scenario and personal** (your own attempts, ranked). A cross-user leaderboard would need a backend.

---

## Where the content comes from

Challenges are built from the Kursbuch, one lesson at a time, and the owner sends photos of
the pages. **The KOMMUNIKATION boxes are the point of the challenge.** They are the phrase
sets the lesson is teaching (for example "Argumente einschränken", "Verzicht ausdrücken"),
and a challenge exists to make the learner say them out loud.

So, when building from a lesson:

- Put every Kommunikation box into `phrases`. That is not decoration: the measured half of
  the vocabulary score matches `phrases` against the transcript, so saying them earns points.
- Give each box its own entry in `tasks`, worded as the move it asks for. The examiner
  grades every task 0-2, so skipping a box costs points too.
- Check both actually fire before shipping, with a sentence a learner would really say
  rather than the template recited verbatim. `app/scoring.selftest.mjs` has examples for the
  "coaching" and "minimalismus" challenges; phrase matching needs 60 percent of the content
  words, so a template with a gap in the middle still matches a filled-in sentence.

Vocabulary and grammar from the lesson belong in `vocab` and in the partner's `system`
prompt; the lesson's reading text belongs in a text (see `HowTo-text.md`), not here.

## Recipe: add a new challenge

1. Open `app/scenarios.js`, copy an existing object, give it a unique `id`.
2. Fill the menu/header fields: `category`, `level`, `photo`, `title`, `desc`. Optionally `featured` / `locked`.
3. Write the briefing: `place`/`placeEn`, `goal`/`goalEn`, `tasks`/`tasksEn` (keep each `…En` array the same length and order as its German twin).
4. Add `vocab` and `phrases` (each `{ de, en }`). Both optional; empty just hides the panel. Note these also feed the chat model as target language (the `de` side), not just the intro panels.
5. Write the `system` prompt: role, place, "stay in character, German only, short sentences, help when stuck." Keep it about persona and tone; the mission and vocab (`level`, `goal`, `tasks`, `vocab`, `phrases`) are appended automatically by `buildSystem`, so you no longer need to restate them in prose.
6. That's it. No API, component, or CSS changes: chat reads `system` + the structured fields, feedback reads `title`, and the leaderboard keys off `scenario_id`. Test with a real run.
