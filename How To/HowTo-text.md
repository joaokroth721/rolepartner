# HowTo: Clickable Texts (word + sentence translation)

How the Texts reader turns every word and sentence into a tap-to-translate item,
and how to add a new text so it works with zero API calls.

## What the user sees

- **Single click on a word** shows its translation (lemma, part of speech, English gloss) in the bottom bar.
- **Double click anywhere in a sentence** shows the English meaning of the whole sentence.
- Featured vocab keeps a dotted underline; every other word is still clickable, just not underlined.
- The speaker button reads the selection aloud; words can be starred to save them.

## The pieces

| File | Role |
|------|------|
| `app/texts.js` | Data. Each text carries `glossary` (featured vocab, underlined), `words` (full static lookup for every word), and `sentences` (every sentence -> English). |
| `app/tokenize.mjs` | `splitSentences`, `tokenize`, `isWord`, `glossKey` (lowercased surface form = lookup key). |
| `app/page.js` | `TextReader` component: renders words/sentences, handles click vs double-click, shows the bottom bar. |
| `app/api/translate/route.js` | Fallback only. Translates a word or sentence via the LLM for any text that has no static data yet. |

## How lookup works (in `TextReader`)

- Key for a word = `glossKey(token)` = the token lowercased.
- `pickWord`: check `text.glossary[key]`, then `text.words[key]`. If found, show instantly. Otherwise fall back to `POST /api/translate`.
- `pickSentence`: check `text.sentences[exactSentenceString]`. If found, show instantly. Otherwise fall back to the API.
- The sentence key must be the **exact** string produced by `splitSentences`, including punctuation and the German quote marks (`„` `"`). A mismatched key silently falls through to the API.

## Click vs double-click

A single click is debounced 250ms so a double-click can cancel it:

- `clickWord` schedules `pickWord` after 250ms.
- `doubleSentence` (on the sentence's `onDoubleClick`) clears that timer and runs `pickSentence`.
- The word span calls `clickWord`; the sentence span (the parent) catches the double-click, which bubbles up from the word.
- `.sentence { user-select: none }` in `globals.css` stops double-click from highlighting text.
- A `reqRef` counter drops a slow API response if a newer tap has already happened.

## Adding a new text (the full recipe)

1. **Add the text object** to `app/texts.js` with `id`, `category`, `level`, `photo`, `title`, `desc`, `paragraphs`, and a curated `glossary` (the featured vocab you want underlined).

2. **Extract every unique word and every sentence** so nothing is missed. Run from the project root:

   ```bash
   node --input-type=module -e '
   import { texts } from "./app/texts.js";
   import { splitSentences, tokenize, isWord, glossKey } from "./app/tokenize.mjs";
   const t = texts.find(x => x.id === "YOUR_ID");
   const words = new Set(), sents = [];
   for (const p of t.paragraphs) for (const s of splitSentences(p)) {
     sents.push(s);
     for (const tok of tokenize(s)) if (isWord(tok)) words.add(glossKey(tok));
   }
   console.log("WORDS (" + words.size + ")\n" + [...words].sort().join("\n"));
   console.log("SENTENCES (" + sents.length + ")");
   sents.forEach((s, i) => console.log(i + "\t" + JSON.stringify(s)));
   '
   ```

3. **Fill `words`**: one entry per surface form, keyed by the lowercased form.
   Shape: `key: { lemma, pos, en }`. Nouns get their article in the lemma (`die Daten`),
   verbs get the infinitive, inflected forms point back to the dictionary form.
   Numbers count as words too (`"2030": { lemma: "2030", pos: "numeral", en: "2030 (year)" }`).
   Keys that are pure digits must be quoted (`"250":`).

4. **Fill `sentences`**: key = the exact sentence string from step 2 (copy it verbatim,
   including `„ "` quotes), value = the natural English translation.

5. **Verify coverage** (this is the gate, do not skip it):

   ```bash
   node --input-type=module -e '
   import { texts } from "./app/texts.js";
   import { splitSentences, tokenize, isWord, glossKey } from "./app/tokenize.mjs";
   for (const t of texts) {
     const w = t.words || {}, g = t.glossary || {}, s = t.sentences || {};
     let mw = [], ms = 0;
     for (const p of t.paragraphs) for (const sent of splitSentences(p)) {
       if (!(sent in s)) ms++;
       for (const tok of tokenize(sent)) if (isWord(tok)) { const k = glossKey(tok); if (!(k in g) && !(k in w)) mw.push(tok); }
     }
     console.log(t.id + ": missing words=" + mw.length + ", missing sentences=" + ms);
   }
   '
   ```

   Both counts must be `0`. Missing words are usually a typo in a key or a form
   you skipped; a missing sentence is almost always a quote-mark or punctuation
   mismatch in the key.

## Notes

- A word appearing with different inflections (e.g. `drohne` / `drohnen`) needs one
  entry per surface form; both can point to the same lemma.
- Capitalized sentence-start words still lowercase via `glossKey`, so no separate entry is needed.
- The `„...\"` German quotes are the reason `splitSentences` sometimes keeps two
  sentences joined (the period is followed by `"` not whitespace). That is fine:
  just key the sentence exactly as the extractor prints it.
- No emojis and no em dash (`—`) in copy, per project conventions.
