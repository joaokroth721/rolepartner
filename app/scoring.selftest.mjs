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

// --- a perfect run: goal fully reached, clean German, the briefing's words used, a real exchange ---
const perfectTurns = [
  { role: "user", content: "Guten Tag, ich möchte eine Fahrkarte nach Bonn." },
  { role: "user", content: "Hin und zurück, bitte." },
  { role: "user", content: "Wann fährt der nächste Zug?" },
  { role: "user", content: "Muss ich umsteigen?" },
  { role: "user", content: "Was kostet das?" },
  { role: "user", content: "Gut, ich nehme sie. Von welchem Bahnsteig?" },
];
const perfectJudgement = { goalCompletion: 3, taskResults: [2, 2, 2], grammar: 5, vocab: 5, interaction: 5, corrections: [] };
const best = computeScore({ scenario, messages: perfectTurns, judgement: perfectJudgement });
assert.equal(best.score, 100, `a flawless run that uses the briefing is 100, got ${best.score}`);

// Same conversation quality, but ignoring every target word the briefing offered: still
// strong, deliberately not perfect. This is the rule that makes the briefing worth reading.
const ignoredBriefing = computeScore({ scenario, messages: turns(6), judgement: perfectJudgement });
assert.ok(
  ignoredBriefing.score < best.score,
  `ignoring the briefing must cost something (${ignoredBriefing.score} vs ${best.score})`
);

// --- goal is graded, not all-or-nothing: a near-miss beats a no-show ---
const nearGoal = computeScore({ scenario, messages: perfectTurns, judgement: { ...perfectJudgement, goalCompletion: 2 } });
const noGoal = computeScore({ scenario, messages: perfectTurns, judgement: { ...perfectJudgement, goalCompletion: 0 } });
assert.ok(noGoal.score < nearGoal.score, "not attempting the goal scores below a near-miss");
assert.ok(nearGoal.score < best.score, "a near-miss scores below full goal completion");
assert.equal(noGoal.score, 100 - WEIGHTS.goal, "missing the goal entirely costs exactly its weight");

// --- partial tasks earn partial credit ---
const halfTasks = computeScore({ scenario, messages: perfectTurns, judgement: { ...perfectJudgement, taskResults: [2, 1, 0] } });
assert.ok(halfTasks.score < best.score && halfTasks.score > noGoal.score, "partial tasks land between full and no goal");

// --- one word, nothing achieved ---
const empty = computeScore({
  scenario,
  messages: [{ role: "user", content: "Hallo" }],
  judgement: { goalCompletion: 0, taskResults: [0, 0, 0], grammar: 0, vocab: 0, interaction: 0, corrections: [] },
});
assert.ok(empty.score <= 2, `a one-word attempt scores near zero, got ${empty.score}`);

// --- interaction is gated by turns: the model can't grant full interaction on one line ---
const oneLineGenerous = computeScore({
  scenario,
  messages: [{ role: "user", content: "Ich möchte eine Fahrkarte nach Bonn, hin und zurück." }],
  judgement: { ...perfectJudgement, interaction: 5 },
});
assert.ok(oneLineGenerous.breakdown.interaction < WEIGHTS.interaction, "a one-turn transcript cannot claim full interaction");

// --- determinism: same input, same score ---
const again = computeScore({ scenario, messages: perfectTurns, judgement: perfectJudgement });
assert.equal(again.score, best.score, "same conversation always scores the same");

// --- using the briefing's words beats ignoring them ---
const withTargets = computeScore({
  scenario,
  messages: [
    { role: "user", content: "Ich möchte eine Fahrkarte nach Bonn." },
    { role: "user", content: "Hin und zurück. Was kostet das? Muss ich umsteigen?" },
    { role: "user", content: "Wann fährt der nächste Zug vom Bahnsteig?" },
  ],
  judgement: { goalCompletion: 3, taskResults: [2, 2, 0], grammar: 4, vocab: 4, interaction: 4, corrections: [] },
});
const withoutTargets = computeScore({
  scenario,
  messages: [
    { role: "user", content: "Ich will da hin." },
    { role: "user", content: "Ja gut, und der Preis?" },
    { role: "user", content: "Alles klar, danke." },
  ],
  judgement: { goalCompletion: 3, taskResults: [2, 2, 0], grammar: 4, vocab: 4, interaction: 4, corrections: [] },
});
assert.ok(
  withTargets.score > withoutTargets.score,
  `using target vocabulary must score higher (${withTargets.score} vs ${withoutTargets.score})`
);

// --- weak grammar lowers the score; errors are not charged a second time ---
const sloppy = computeScore({
  scenario,
  messages: perfectTurns,
  judgement: {
    goalCompletion: 3, taskResults: [2, 2, 2], grammar: 2, vocab: 3, interaction: 4,
    corrections: [1, 2, 3, 4, 5].map((i) => ({ wrong: `w${i}`, right: `r${i}`, severity: "minor" })),
  },
});
assert.ok(sloppy.score < best.score, "weak grammar and vocab lower the score");
assert.ok(sloppy.score > 0, "a completed but sloppy run still scores");

// --- the breakdown always adds up to the score ---
for (const r of [best, ignoredBriefing, nearGoal, noGoal, halfTasks, empty, withTargets, sloppy]) {
  const b = r.breakdown;
  const sum = b.goal + b.tasks + b.grammar + b.vocabulary + b.interaction;
  assert.equal(Math.max(0, Math.min(100, sum)), r.score, "breakdown explains the score");
  assert.ok(r.score >= 0 && r.score <= 100, "score stays in 0-100");
}

// --- the coaching challenge: its phrases are the challenge ---
// "Erfolgreich scheitern" exists to make the student qualify an argument rather than
// call something simply good or bad. That only means anything if saying it moves the
// number, so this asserts the forcing function rather than trusting the briefing.
const coaching = byId("coaching");
const coachingJudgement = {
  goalCompletion: 3, taskResults: [2, 2, 2, 2], grammar: 4, vocab: 4, interaction: 4, corrections: [],
};
const hedged = [
  { role: "user", content: "Ich bin mit meiner Firma gescheitert. Das war eine echte Niederlage." },
  { role: "user", content: "Einerseits ist es positiv, dass ich genau plane, andererseits ist es problematisch, wenn ich zu langsam werde." },
  { role: "user", content: "Das stimmt schon, aber so einfach ist das leider nicht." },
  { role: "user", content: "Man kann zwar sagen, dass Ehrgeiz hilft, allerdings muss man auch bedenken, dass er schadet." },
  { role: "user", content: "Kritisch wird es aber, wenn niemand Hilfe leistet." },
  { role: "user", content: "Ich habe einen Entschluss gefasst: Das Scheitern wird mein Sprungbrett." },
];
const flat = [
  { role: "user", content: "Meine Firma ist kaputt gegangen. Das war schlecht." },
  { role: "user", content: "Ich plane sehr genau. Das ist gut." },
  { role: "user", content: "Nein, das finde ich nicht." },
  { role: "user", content: "Ehrgeiz ist gut. Ich bin ehrgeizig." },
  { role: "user", content: "Ja, manchmal ist es schwer." },
  { role: "user", content: "Ich will eine neue Firma machen." },
];
const hedgedRun = computeScore({ scenario: coaching, messages: hedged, judgement: coachingJudgement });
const flatRun = computeScore({ scenario: coaching, messages: flat, judgement: coachingJudgement });
assert.ok(
  hedgedRun.score > flatRun.score,
  `qualifying an argument must beat a flat one (${hedgedRun.score} vs ${flatRun.score})`
);
assert.ok(
  hedgedRun.targetsUsed.some((t) => t.startsWith("Einerseits")),
  "the einerseits/andererseits phrase must register from a natural sentence, not only verbatim"
);
assert.equal(flatRun.targetsUsed.length, 0, "a flat conversation hits none of the target phrases");

// Skipping the two tasks that ask for the hedging costs points of its own, on top.
const flatSkipped = computeScore({
  scenario: coaching,
  messages: flat,
  judgement: { ...coachingJudgement, taskResults: [2, 0, 0, 2] },
});
assert.ok(flatSkipped.score < flatRun.score, "tasks the student skipped must cost points");

// --- the minimalism challenge carries three Kommunikation boxes, not one ---
// Lektion 11 has three: Einschätzungen formulieren, Verzicht ausdrücken, Argumente
// einschränken. Each must register from a sentence a learner would actually say, or the
// briefing is decoration.
const minimal = byId("minimalismus");
const boxLines = [
  "Ich persönlich würde mich in so einer Wohnung wohlfühlen, weil ich dann Platz zum Denken habe.",
  "Was mir auf jeden Fall fehlen würde, wäre meine Bücherwand.",
  "Also, ich könnte auf meinen zweiten Drucker verzichten. Den brauche ich sowieso nicht.",
  "Die Anzahl meiner T-Shirts könnte ich reduzieren und den Rest spenden.",
  "Ich denke zwar auch, dass Dinge Geschichten erzählen, das heißt jedoch nicht, dass ich jeden Krempel behalten muss.",
  "Es stimmt zwar, dass ein Auto praktisch ist, aber entscheidend ist für mich, dass ich es fast nie benutze.",
];
for (const line of boxLines) {
  const hits = targetsUsed(minimal, line);
  assert.ok(
    hits.some((h) => minimal.phrases.some((p) => p.de === h)),
    `a Kommunikation phrase must match from a natural sentence: ${line.slice(0, 50)}`
  );
}
const minimalJudgement = {
  goalCompletion: 3, taskResults: [2, 2, 2, 2], grammar: 4, vocab: 4, interaction: 4, corrections: [],
};
const spoken = computeScore({
  scenario: minimal,
  messages: boxLines.map((content) => ({ role: "user", content })),
  judgement: minimalJudgement,
});
const bland = computeScore({
  scenario: minimal,
  judgement: minimalJudgement,
  messages: ["Ja, das wäre schön.", "Ich habe zu viele Sachen.", "Das Auto kann weg.", "Ja, da stimme ich zu.", "Okay, gut.", "Die dritte Methode nehme ich."].map(
    (content) => ({ role: "user", content })
  ),
});
assert.ok(spoken.score > bland.score, `using the boxes must beat bland agreement (${spoken.score} vs ${bland.score})`);
assert.equal(bland.targetsUsed.length, 0, "bland agreement hits none of the targets");

// --- the two Lektion-8/9 challenges: every Kommunikation box has to register ---
// "So tickt unsere innere Uhr" carries four boxes (Schaubild beschreiben, Überraschung
// ausdrücken / Wissen wiedergeben, Vermutungen äußern, Problem und Produkt) and "Alles
// unter Kontrolle?" carries the understanding and argument sets. A box only exists for
// the learner if a sentence they would really say moves the number, so each line below
// is a filled-in template, never the template recited verbatim.
const boxChallenges = [
  [
    "innereuhr",
    [
      "Wie das Schaubild zeigt, bin ich am Morgen kaum leistungsfähig.",
      "Mein größtes Hoch habe ich am späten Vormittag.",
      "Ab 13 Uhr sinkt die Kurve, und das größte Tief kommt am frühen Nachmittag.",
      "Überraschend war für mich vor allem, dass Licht die innere Uhr verschieben kann.",
      "Mich hat überrascht, dass Schichtarbeit den Tagesrhythmus so stark stört.",
      "Soviel ich weiß, hängt das mit unseren Genen zusammen.",
      "Unbestritten ist auf jeden Fall, dass Tageslicht uns wach macht.",
      "Ich könnte mir vorstellen, dass die dritte Meldung falsch ist, weil es keine solche Pille gibt.",
      "Das kommt mir unglaubwürdig vor. Ich würde vermuten, dass die Brille erfunden ist.",
      "Für viele ist es problematisch, wenn sie nachts arbeiten müssen.",
      "Die Schichtarbeit macht vielen Menschen große Schwierigkeiten.",
      "Bei meiner Erfindung handelt es sich um eine Lampe für den Nachtdienst.",
      "Ein besonderes Merkmal ist, dass sie das blaue Licht herausfiltert.",
    ],
    ["Ja, morgens geht es mir gut.", "Das wusste ich nicht.", "Vielleicht die zweite.", "Nachts arbeiten ist hart.", "Eine Lampe wäre gut.", "Ja, genau."],
  ],
  [
    "esstyp",
    [
      "Bis zu einem gewissen Grad kann ich verstehen, dass du auf deine Nährstoffe achtest.",
      "Ich habe Verständnis dafür, dass dir gutes Essen wichtig ist.",
      "Aber das geht mir einfach zu weit.",
      "Man kann es auch übertreiben, finde ich.",
      "Wenn ich ehrlich bin, ist mir das ziemlich egal.",
      "Wenn sie es glücklich macht, soll sie weiter wiegen!",
      "Ein wichtiges Argument dafür ist, dass man seinen Körper besser kennt.",
      "Ein weiteres Argument dagegen ist, dass zu viel Kontrolle stresst.",
      "Zwar hat sie recht, wenn sie sagt, dass Ernährung wichtig ist.",
      "Das ist allerdings nicht ganz richtig, denn Genuss gehört auch dazu.",
      "Da stimme ich voll und ganz zu.",
      "Ich bin komplett dagegen.",
    ],
    ["Das Essen schmeckt gut.", "Du machst das schon richtig.", "Ich esse einfach, was da ist.", "Okay, verstehe.", "Ja, kann sein.", "Mal sehen."],
  ],
];

const boxJudgement = {
  goalCompletion: 3, taskResults: [2, 2, 2, 2, 2], grammar: 4, vocab: 4, interaction: 4, corrections: [],
};
for (const [id, spokenLines, blandLines] of boxChallenges) {
  const sc = byId(id);
  assert.ok(sc, `${id} exists`);
  assert.equal(sc.tasks.length, sc.tasksEn.length, `${id}: tasksEn mirrors tasks`);
  for (const phrase of sc.phrases) {
    assert.ok(
      spokenLines.some((line) => targetsUsed(sc, line).includes(phrase.de)),
      `${id}: no sentence triggers the Kommunikation phrase "${phrase.de}"`
    );
  }
  const usedBox = computeScore({ scenario: sc, messages: spokenLines.map((content) => ({ role: "user", content })), judgement: boxJudgement });
  const skippedBox = computeScore({ scenario: sc, messages: blandLines.map((content) => ({ role: "user", content })), judgement: boxJudgement });
  assert.ok(usedBox.score > skippedBox.score, `${id}: using the boxes must beat bland talk (${usedBox.score} vs ${skippedBox.score})`);
  assert.equal(skippedBox.targetsUsed.length, 0, `${id}: bland talk hits none of the targets`);
}

// The adversative connectors are Lektion 9's grammar, carried as target vocab so that
// contrasting yourself with another sleep type is measured, not merely encouraged.
const uhr = byId("innereuhr");
const contrasted = targetsUsed(uhr, "Im Gegensatz zu meiner Kollegin bin ich ein Langschläfer, abends bin ich jedoch fit.");
assert.ok(contrasted.includes("im Gegensatz zu"), "the adversative expression registers from a real sentence");
assert.ok(contrasted.includes("jedoch"), "the adversative connector registers from a real sentence");

console.log("scoring self-check passed");
console.log("  perfect:", best.score, best.breakdown);
console.log("  same run ignoring the briefing:", ignoredBriefing.score);
console.log("  near goal:", nearGoal.score, "| no goal:", noGoal.score);
console.log("  half tasks:", halfTasks.score);
console.log("  with target vocab:", withTargets.score, "| without:", withoutTargets.score);
console.log("  sloppy:", sloppy.score, sloppy.breakdown);
console.log("  one word:", empty.score);
