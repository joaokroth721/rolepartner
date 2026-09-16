// Single source of truth for the error categories.
// The LLM emits one of these in app/api/feedback/route.js (enum in the schema) and the UI
// shows them as chips, so both sides must read the same list.
export const TAGS = [
  "Genus/Artikel",
  "Verbzeit",
  "Wortstellung",
  "Falscher Freund",
  "Wortwahl",
  "Präposition",
  "Sonstiges",
];

export const FALLBACK_TAG = "Sonstiges";

// Anything the model (or an old localStorage row) sends that is not in the list collapses to "Sonstiges".
export const normalizeTag = (tag) => (TAGS.includes(tag) ? tag : FALLBACK_TAG);
