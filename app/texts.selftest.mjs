// Runnable check for the reader's non-trivial bit: tokenize + sentence split + glossary match.
// node app/texts.selftest.mjs
import assert from "node:assert";
import { splitSentences, tokenize, isWord, glossKey } from "./tokenize.mjs";

const para = "Die Insel Ponza ist schön. Sie liegt im Meer!";
const sents = splitSentences(para);
assert.equal(sents.length, 2, "two sentences");

const toks = tokenize(sents[0]);
assert.equal(toks.join(""), sents[0], "tokens round-trip the sentence");
assert.ok(toks.includes("Insel"), "word token preserved");
assert.ok(isWord("Insel") && !isWord(" ") && !isWord("."), "word vs non-word");

// A tapped word finds its glossary entry via the lowercased surface key.
const gloss = { insel: { en: "island" } };
const hit = toks.find((t) => isWord(t) && gloss[glossKey(t)]);
assert.equal(hit, "Insel", "glossary lookup by surface form");

console.log("texts tokenizer self-check passed");
