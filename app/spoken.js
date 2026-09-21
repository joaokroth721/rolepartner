// What a spoken transcript cannot prove.
//
// The conversation is voice: app/page.js records one utterance with the browser's
// SpeechRecognition and sends whatever text the recognizer returns. Capitalization,
// punctuation and the choice between two spellings that sound alike are therefore the
// recognizer's guesses, never the learner's. Marking them wrong fails somebody for a
// decision they never made -- there is no capital letter in speech, and no comma.
//
// German makes this sharper than most languages: every noun is capitalized in writing,
// so a recognizer that writes "die fahrkarte" hands the examiner a mistake the speaker
// could not have made. That was the single most common false correction.
//
// Two layers, because one is not enough:
//   1. The note below tells the examiner not to look at orthography at all.
//   2. dropSpokenArtifacts() removes what it reported anyway. A prompt is a request; a
//      filter is a guarantee, and gpt-5-nano needs the second one.

/**
 * The audible form of a string: what is left once everything inaudible is gone.
 *
 * Umlauts expand before the accent strip, so "ü" becomes "ue" (how it is also written
 * when the key is missing) rather than a bare "u", which is a different sound.
 */
const spokenForm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** True when two strings would be indistinguishable read aloud. */
export const soundsSame = (a, b) => {
  const left = spokenForm(a);
  return left.length > 0 && left === spokenForm(b);
};

/**
 * Drops the corrections that only exist on paper.
 *
 * A correction survives when `wrong` and `right` still differ after everything a speaker
 * cannot pronounce is removed: case, punctuation, hyphens, spacing. What is left is word
 * order, case endings, verb forms, articles and word choice -- the things that are still
 * wrong when the sentence is read out loud.
 *
 * A correction with an empty side is kept: there is nothing to compare, so the examiner's
 * judgement stands rather than being silently thrown away.
 */
export const dropSpokenArtifacts = (corrections = []) =>
  corrections.filter((c) => !soundsSame(c?.wrong, c?.right));

/** Appended to the examiner prompt. Tells it not to produce what the filter would remove. */
export const SPOKEN_TRANSCRIPT_NOTE = `The transcript is machine-written: the student SPOKE, and a speech recognizer typed what it heard.
Capitalization, punctuation and the spelling of words that sound alike are the recognizer's guesses, not the student's choices.
Never report them as mistakes and never let them lower the grammar rating: a lower-case noun, a missing comma and a missing question mark are not errors a speaker can make.
Judge only what would still be wrong if you heard the sentence read aloud: word order, case endings, verb forms, the article a noun takes, and word choice.`;
