# plan_video.md — a talking illustration during the conversation

Goal: while the AI partner speaks, show a 2D illustration of a person that represents the
scenario, with a mouth that "kinda moves". Save the options, pick a rung later.

## The one constraint that decides everything

The conversation speaks with the browser's `speechSynthesis` (`app/page.js:835`). That API
plays audio straight to the OS. It gives you:

- no audio stream or buffer you can analyse
- no phoneme/viseme events, and `onboundary` (word timing) is unreliable across browsers

So there are two families of solution, split by whether we keep `speechSynthesis`:

- **Keep it** -> the mouth can only be *faked* (open/close while `speaking` is true). No real sync, but it is free and tiny.
- **Replace it** with a fetched audio clip (OpenAI TTS etc.) played through an `<audio>` element -> now you have a real audio stream, so you can drive a real amplitude/viseme mouth. Costs money per reply and adds a round-trip.

Everything below is ranked laziest-first.

---

## Tier 0 — illustrated persona + faked mouth (recommended start)

What the user literally asked for: an illustrated person that represents the challenge, mouth kinda moving. Deliberately a 2D illustration (flat/cartoon style), not a realistic photo. A drawn character sets the right expectation (a friendly practice partner, not an uncanny human) and lets the same art carry both the persona and the setting.

- Add an `illustration` field per scenario: a drawn character that shows both *who* the partner is and *where* the scene is (e.g. the Schalterbeamter behind a ticket counter, Coach Milo in the office). One consistent illustration style across scenarios. Falls back to a generic illustrated face if absent.
- Render it on the conversation screen. While `speechSynthesis.speaking` is true, toggle a mouth overlay on an interval (or swap 2-3 mouth-shape drawings), and add a subtle scale/glow pulse. On `utterance.onend`, close the mouth.
- We already flip a "speaking" state; hook the mouth to the same signal.

Cost: zero in code/APIs (no new dependency). The only cost is producing the illustrations (commission, or generate them once and store in `public/`). Effort: a few hours of code, one component + a CSS keyframe + a scenario field; the art is the real work.
Honest limit: the mouth is not synced to the words. On a drawn character at conversational distance this reads fine as "it's talking", which is the stated bar. This is the ponytail answer: ship it, and only climb if the fake mouth feels cheap.

Even lazier variant: skip the moving mouth entirely, just show the illustrated persona and pulse/breathe it while speaking. "Represents the challenge" is mostly carried by a good character drawing, not by the lips.

---

## Tier 1 — real lip-sync from streamed TTS audio

Only worth it if Tier 0's fake mouth looks wrong.

1. Replace `speak()` with a call to a TTS endpoint that returns an audio clip. OpenAI TTS (`gpt-4o-mini-tts` / `tts-1`) is the least new surface: the OpenAI key and `@ai-sdk/openai` are already here, and German voices are fine. Play the returned blob in an `<audio>` element.
2. Feed that element into the Web Audio API and drive mouth shapes from it:
   - **wawa-lipsync** — browser-native, real-time, reads any audio source and outputs viseme data, no server. Built for exactly this (2D talking avatars / AI assistants). MIT.
   - **lipsync-engine** — renderer-agnostic streaming viseme detection via AudioWorklet + Web Audio, if wawa-lipsync is too coupled to its own renderer.
3. The avatar is still a 2D SVG/sprite face; you map ~5-8 viseme classes to mouth shapes.

Cost: TTS is roughly $0.015 per ~1k characters (mini-tts) — pennies per conversation, but no longer free, and it adds a fetch of latency before the partner starts speaking (mitigate by streaming the audio). You also lose the zero-setup browser voice.
Effort: a day-ish. The real work is the TTS swap and the viseme->mouth mapping, not the lib.
Bonus: better, non-robotic voices than the OS voice (the existing `ponytail:` note at `app/page.js:607` already flags the browser voice as the weak point).

Precise-sync alternative to wawa: **Azure Neural TTS viseme events** give exact viseme timings alongside the audio, so mouth shapes match phonemes rather than amplitude. Costs a new provider (Azure Speech) and only via the Speech SDK (REST TTS has no visemes). Better sync, more setup. Skip unless amplitude-driven looks off.

---

## Tier 2 — photoreal streaming avatar (a real talking human video)

The "wow" option: an actual video person over WebRTC, real lip-sync, expressions.

- **HeyGen LiveAvatar**, **Tavus** (Phoenix-4 advertises sub-600ms over WebRTC), **D-ID** (~2-5s latency), **Simli**, **Sync Labs** (~3-8s). Pixazo / Crazyrouter keep current comparisons.
- You hand them text (or audio); they own TTS + video. That means ripping out our TTS path and probably our text-display path, plus a WebRTC client.

Cost: per-minute streaming pricing (dollars per conversation, not pennies) + external dependency + added latency + a much bigger integration. For a language-practice app where the point is the words, this is likely overkill. Park it as "if we ever want a marketing-grade demo".

---

## Tier 3 — pre-generated video per reply

Generate a talking-head video server-side for each reply. Rejected for live chat: generation takes seconds-to-minutes, which kills conversational flow. Only viable for a *fixed* intro clip on the briefing screen, not for turns. Not recommended.

---

## Recommendation

Start at **Tier 0** (persona image + faked mouth, zero cost). If the unsynced mouth bothers
anyone, climb to **Tier 1** (OpenAI TTS + wawa-lipsync), which also upgrades the robotic
voice we already flagged. Ignore Tier 2/3 unless the goal shifts from "practice tool" to
"demo showpiece".

Open decisions before building:
- Art: one generic illustrated face reused everywhere, or a portrait per scenario? (Tier 0 works either way; per-scenario is just more asset work.)
- Are we willing to leave the free browser voice for paid TTS? That is the real gate between Tier 0 and Tier 1.

## Sources
- [Best Lipsync APIs in 2026](https://www.pixazo.ai/blog/best-lipsync-api)
- [AI Lip Sync Tools Comparison 2026 (Crazyrouter)](https://crazyrouter.com/en/blog/ai-lip-sync-tools-comparison-may-2026-apis-avatars-dubbing)
- [HeyGen LiveAvatar](https://help.heygen.com/en/articles/12758516-introducing-liveavatar)
- [Wawa-Lipsync (real-time browser lip-sync)](https://wawasensei.dev/tuto/real-time-lipsync-web)
- [lipsync-engine (AudioWorklet viseme detection)](https://github.com/Amoner/lipsync-engine)
- [Azure Neural TTS viseme events](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/azure-neural-text-to-speech-extended-to-support-lip-sync-with-viseme/2356748)
