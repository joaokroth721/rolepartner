// Runnable check that a voice transcript is never marked down for what a speaker cannot say.
// node app/spoken.selftest.mjs
import assert from "node:assert";
import { dropSpokenArtifacts, soundsSame } from "./spoken.js";

// --- the case this exists for: German capitalizes every noun, speech does not ---
assert.ok(soundsSame("die fahrkarte", "die Fahrkarte"), "a lower-case noun is the recognizer's doing");
assert.ok(soundsSame("ich moechte nach bonn", "Ich möchte nach Bonn"), "umlaut spelling is inaudible");
assert.ok(soundsSame("Wann faehrt der Zug", "Wann fährt der Zug?"), "a missing question mark is inaudible");
assert.ok(soundsSame("ich heisse Jan", "Ich heiße Jan"), "ss and ß sound identical");
assert.ok(soundsSame("Fahr Karte", "Fahrkarte"), "where the recognizer split a compound is inaudible");

// --- what must still be heard as wrong ---
assert.ok(!soundsSame("ein Fahrkarte", "eine Fahrkarte"), "a wrong article ending is audible");
assert.ok(!soundsSame("Ich nach Bonn fahre", "Ich fahre nach Bonn"), "word order is audible");
assert.ok(!soundsSame("Ich habe gegeht", "Ich bin gegangen"), "a wrong verb form is audible");
assert.ok(!soundsSame("der Fahrkarte", "die Fahrkarte"), "a wrong gender is audible in the article");
assert.ok(!soundsSame("", "die Fahrkarte"), "an empty side is not a match");

// --- the filter keeps real mistakes and drops the paper ones ---
const corrections = [
  { wrong: "ich möchte eine fahrkarte", right: "Ich möchte eine Fahrkarte.", tag: "Sonstiges", severity: "minor" },
  { wrong: "ein Fahrkarte nach Bonn", right: "eine Fahrkarte nach Bonn", tag: "Genus/Artikel", severity: "major" },
  { wrong: "wann faehrt der naechste zug", right: "Wann fährt der nächste Zug?", tag: "Sonstiges", severity: "minor" },
  { wrong: "Ich nach Bonn fahre", right: "Ich fahre nach Bonn", tag: "Wortstellung", severity: "major" },
];
const kept = dropSpokenArtifacts(corrections);
assert.equal(kept.length, 2, `only the audible mistakes survive, got ${kept.length}`);
assert.deepEqual(kept.map((c) => c.tag), ["Genus/Artikel", "Wortstellung"], "the two real ones, in order");

// --- degenerate input must not throw: this runs on whatever the model returned ---
assert.deepEqual(dropSpokenArtifacts(), [], "no corrections at all is an empty list");
assert.deepEqual(dropSpokenArtifacts([]), [], "an empty list stays empty");
assert.equal(dropSpokenArtifacts([{ wrong: null, right: undefined }]).length, 1, "a malformed entry is left for the examiner");

console.log("spoken.selftest: ok");
