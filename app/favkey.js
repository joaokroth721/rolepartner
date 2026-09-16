// Type-aware identity of a favorite. Shared by the client (dedupe, star state) and the API
// (the unique key per user in D1), so the two can never disagree about what "the same item" is.
// (no type = legacy correction favorite saved before this existed.)
export const favKey = (f) =>
  f.type === "correction" || !f.type
    ? `c|${f.wrong}→${f.right}`
    : f.type === "vocab"
    ? `v|${f.de}`
    : f.type === "phrase"
    ? `p|${f.de}`
    : f.type === "keyword"
    ? `k|${f.de}`
    : `m|${f.text}`;

export const FAV_TYPES = ["correction", "vocab", "phrase", "keyword", "message"];

// "Got it" clicks before a card counts as mastered and moves to the collapsed pile.
export const MASTER_AT = 3;
