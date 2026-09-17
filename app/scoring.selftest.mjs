// Runnable check for the scoring rules: the score must be reproducible and must move
// in the right direction when the conversation gets better or worse.
// node app/scoring.selftest.mjs
import assert from "node:assert";
import { computeScore, targetsUsed, WEIGHTS } from "./scoring.js";
import { byId } from "./scenarios.js";

const scenario = byId("fahrkarte");
const turns = (n) => Array.from({ length: n }, (_, i) => ({ role: "user", content: `Satz ${i}` }));

// --- target matching ---
const used = targetsUsed(scenario, "Ich möchte eine Fahrkarte nach Bonn. Hin und zurück, bitte.");
assert.ok(used.includes("die Fahrkarte"), "vocab matches despite a different article");
assert.ok(used.includes("hin und zurück"), "multi-word vocab matches");
assert.ok(
  used.includes("Ich möchte eine Fahrkarte nach …"),
  "phrase matches on its content words, not verbatim"
);
assert.equal(targetsUsed(scenario, "Hallo, danke schön.").length, 0, "unrelated text hits nothing");

// --- a perfect run: goal reached, clean German, and the briefing's words actually used ---
const perfectTurns = [
  { role: "user", content: "Guten Tag, ich möchte eine Fahrkarte nach Bonn." },
  { role: "user", content: "Hin und zurück, bitte." },
  { role: "user", content: "Wann fährt der nächste Zug?" },
  { role: "user", content: "Muss ich umsteigen?" },
  { role: "user", content: "Was kostet das?" },
  { role: "user", content: "Gut, ich nehme sie. Von welchem Bahnsteig?" },
];
const best = computeScore({
  scenario,
  messages: perfectTurns,
  judgement: { goalReached: true, taskResults: [true, true, true], grammar: 5, vocab: 5, corrections: [] },
});
assert.equal(best.score, 100, `a flawless run that uses the briefing is 100, got ${best.score}`);

// Same conversation quality, but ignoring every target word the briefing offered: still
// strong, deliberately not perfect. This is the rule that makes the briefing worth reading.
const ignoredBriefing = computeScore({
  scenario,
  messages: turns(6),
  judgement: { goalReached: true, taskResults: [true, true, true], grammar: 5, vocab: 5, corrections: [] },
});
assert.ok(
  ignoredBriefing.score < best.score,
  `ignoring the briefing must cost something (${ignoredBriefing.score} vs ${best.score})`
);

// --- the same run, but the goal was never reached ---
const noGoal = computeScore({
  scenario,
  messages: perfectTurns,
  judgement: { goalReached: false, taskResults: [true, true, true], grammar: 5, vocab: 5, corrections: [] },
});
assert.equal(noGoal.score, 100 - WEIGHTS.goal, "missing the goal costs exactly its weight");

// --- one word, nothing achieved ---
const empty = computeScore({
  scenario,
  messages: [{ role: "user", content: "Hallo" }],
  judgement: { goalReached: false, taskResults: [false, false, false], grammar: 0, vocab: 0, corrections: [] },
});
assert.ok(empty.score <= 2, `a one-word attempt scores near zero, got ${empty.score}`);

// --- determinism: same input, same score ---
const again = computeScore({
  scenario,
  messages: perfectTurns,
  judgement: { goalReached: true, taskResults: [true, true, true], grammar: 5, vocab: 5, corrections: [] },
});
assert.equal(again.score, best.score, "same conversation always scores the same");

// --- using the briefing's words beats ignoring them ---
const withTargets = computeScore({
  scenario,
  messages: [
    { role: "user", content: "Ich möchte eine Fahrkarte nach Bonn." },
    { role: "user", content: "Hin und zurück. Was kostet das? Muss ich umsteigen?" },
    { role: "user", content: "Wann fährt der nächste Zug vom Bahnsteig?" },
  ],
  judgement: { goalReached: true, taskResults: [true, true, false], grammar: 4, vocab: 4, corrections: [] },
});
const withoutTargets = computeScore({
  scenario,
  messages: [
    { role: "user", content: "Ich will da hin." },
    { role: "user", content: "Ja gut, und der Preis?" },
    { role: "user", content: "Alles klar, danke." },
  ],
  judgement: { goalReached: true, taskResults: [true, true, false], grammar: 4, vocab: 4, corrections: [] },
});
assert.ok(
  withTargets.score > withoutTargets.score,
  `using target vocabulary must score higher (${withTargets.score} vs ${withoutTargets.score})`
);

// --- mistakes cost points, but never the whole score ---
const sloppy = computeScore({
  scenario,
  messages: perfectTurns,
  judgement: {
    goalReached: true,
    taskResults: [true, true, true],
    grammar: 2,
    vocab: 3,
    corrections: [1, 2, 3, 4, 5].map((i) => ({ wrong: `w${i}`, right: `r${i}` })),
  },
});
assert.ok(sloppy.score < best.score, "errors and weak grammar lower the score");
assert.ok(sloppy.score > 0, "a completed but sloppy run still scores");

// --- the breakdown always adds up to the score ---
for (const r of [best, ignoredBriefing, noGoal, empty, withTargets, sloppy]) {
  const b = r.breakdown;
  const sum = b.goal + b.tasks + b.grammar + b.vocabulary + b.engagement - b.penalty;
  assert.equal(Math.max(0, Math.min(100, sum)), r.score, "breakdown explains the score");
  assert.ok(r.score >= 0 && r.score <= 100, "score stays in 0-100");
}

console.log("scoring self-check passed");
console.log("  perfect:", best.score, best.breakdown);
console.log("  same run ignoring the briefing:", ignoredBriefing.score);
console.log("  no goal:", noGoal.score);
console.log("  with target vocab:", withTargets.score, "| without:", withoutTargets.score);
console.log("  sloppy:", sloppy.score, sloppy.breakdown);
console.log("  one word:", empty.score);
