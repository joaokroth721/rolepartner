@AGENTS.md

## Conventions

- Do not use emojis anywhere (UI, code, comments, copy).

## Work log

`log.md` at the repo root is the running history of the project: what changed, and why
each decision went the way it did. It is the part a diff cannot recover later.

**Update it whenever you finish a piece of work.** Add to the current dated section, or
open a new one when the date changes. Record:

- what changed, and the commit it landed in
- **why**, especially where an obvious-looking option was rejected
- anything measured rather than assumed (sizes, limits, scores, timings)
- corrections to something the log previously claimed, stated as corrections
- what is left open, and whether it is blocked on code or on account setup

Skip it for changes that leave no trace worth remembering, such as a typo fix. If a
change alters how the app behaves, it belongs in the log.

## Screen names

The whole app is one page (`app/page.js`) rendering state-driven screens. We refer to them by these names:

1. **home** / **main** — scenario catalog: featured hero + filterable list (`tab=practice`, no scenario open)
2. **intro** — scenario briefing: goal, tasks, vocab, phrases (`scenario` open, `stage=intro`)
3. **conversation** — live voice chat with the AI partner (`scenario` open, `stage=chat`)
4. **leaderboard** — score of the conversation that just ended + global Top 10 (`stage=leaderboard`)
5. **evaluation** — score, corrections, tips after a conversation (`stage=feedback`)
6. **feedback** — nav label "Review", two sub-views chosen by `reviewView`: `collection`
   (favorited corrections, the default) and `history` (past conversations)
   (`tab=feedback`, no scenario open)
7. **texts** — reading catalog: featured hero + list of reading texts (`tab=texts`, no text open)
8. **reading** — a single reading text open in the reader (`openText` set)
9. **session** — one past conversation reopened from the history list: score, breakdown,
   corrections, transcript (`openSession` set)

## Process to create new challenges / texts

Two step-by-step guides live at the repo root. Read the matching one before adding or editing content.

- **`HowTo-challenge.md`**: for a **challenge**, a practice scenario with the intro + conversation + evaluation flow (voice chat with the AI partner, then a scored feedback screen). Data lives in `app/scenarios.js`. Use when the user wants a new role-play / conversation scenario.
- **`HowTo-text.md`**: for a **text**, a clickable reading in the Texts reader, where each word and sentence is tap-to-translate. Data lives in `app/texts.js`. Use when the user wants a new reading text.
