@AGENTS.md

## Conventions

- Do not use emojis anywhere (UI, code, comments, copy).

## Screen names

The whole app is one page (`app/page.js`) rendering state-driven screens. We refer to them by these names:

1. **home** / **main** — scenario catalog: featured hero + filterable list (`tab=practice`, no scenario open)
2. **intro** — scenario briefing: goal, tasks, vocab, phrases (`scenario` open, `stage=intro`)
3. **conversation** — live voice chat with the AI partner (`scenario` open, `stage=chat`)
4. **evaluation** — score, corrections, tips after a conversation (`stage=feedback`)
5. **feedback** — nav label "Review": favorited corrections only, no history logs (`tab=feedback`, no scenario open)
6. **texts** — reading catalog: featured hero + list of reading texts (`tab=texts`, no text open)
7. **reading** — a single reading text open in the reader (`openText` set)

## Process to create new challenges / texts

Two step-by-step guides live at the repo root. Read the matching one before adding or editing content.

- **`HowTo-challenge.md`**: for a **challenge**, a practice scenario with the intro + conversation + evaluation flow (voice chat with the AI partner, then a scored feedback screen). Data lives in `app/scenarios.js`. Use when the user wants a new role-play / conversation scenario.
- **`HowTo-text.md`**: for a **text**, a clickable reading in the Texts reader, where each word and sentence is tap-to-translate. Data lives in `app/texts.js`. Use when the user wants a new reading text.
