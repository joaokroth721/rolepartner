// Dependency-free tokenizer shared by the Texts reader and its self-check.
// Sentences drive the read-aloud highlight; word tokens make glossary words clickable.

// Split a paragraph into sentences, keeping the terminal punctuation.
export const splitSentences = (para) => para.split(/(?<=[.!?…])\s+/).filter(Boolean);

// Contiguous runs of word-chars vs everything else, so tokens.join("") === input.
const TOKEN_RE = /[0-9A-Za-zÄÖÜäöüß]+|[^0-9A-Za-zÄÖÜäöüß]+/g;
export const tokenize = (sentence) => sentence.match(TOKEN_RE) || [];

export const isWord = (tok) => /[0-9A-Za-zÄÖÜäöüß]/.test(tok);

// Glossary lookup key: lowercased surface form as it appears in the text.
export const glossKey = (w) => w.toLowerCase();
