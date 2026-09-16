# Language Role Partner

A voice-based app for practicing a foreign language through spoken role-play. You pick a
real-life situation, talk to an AI character out loud, and get written feedback on your
performance afterward. Currently set up for **German**.

## How it works

1. **Pick a scenario** on the main screen (e.g. 🚆 *Fahrkarte kaufen*). Each is a card with
   an illustration.
2. **Read the briefing** — an intro explaining your goal for that situation (in German, with a
   one-tap English translation).
3. **Talk** — hit 🎤 *Sprechen*, speak in German, and the AI character replies by voice and
   text, staying in role.
4. **End the conversation** — hit ✅ *Gespräch beenden* to get short written feedback (in
   Portuguese): what you did well, key corrections, and one tip.
5. **Review** — every feedback is saved under the **Feedback** tab on the main screen.

There's also a 👀 *Vorschau (Demo)* button that shows the feedback flow with sample data,
useful when the AI key has no credits.

## Scenarios

- 🚆 **Fahrkarte kaufen** — buy a train ticket at the station counter.
- 🍽️ **Im Restaurant bestellen** — order food and drinks, then ask for the bill.
- 🩺 **Beim Arzt** — describe symptoms at a doctor's appointment.

## Tech

- **Next.js 16** (App Router) + **React 19**.
- **AI SDK** (`ai` + `@ai-sdk/openai`) for the role-play and feedback, model `gpt-5-nano`.
- **Web Speech API** (browser-native) for speech-to-text and text-to-speech — reliable in
  **Chrome**, no extra dependencies.
- Feedback is stored in the browser's **localStorage** (per-device, no account).

## Structure

- `app/page.js` — the whole UI: scenario menu, briefing, chat, feedback, and Feedback tab.
- `app/scenarios.js` — single source of truth for scenarios (title, image, intro, system prompt).
  Add one object here to add a scenario everywhere.
- `app/api/chat/route.js` — role-play replies.
- `app/api/feedback/route.js` — end-of-conversation feedback.
- `public/*.svg` — scenario illustrations.

## Running

```bash
npm run dev        # starts on the default port; pass -- -p 5300 for a specific one
```

Set an AI key in `.env.local` (`OPENAI_API_KEY=...`) for the chat and feedback to return real
responses. Without credits, everything but the AI replies still works, and the demo button
shows the intended feedback experience.
