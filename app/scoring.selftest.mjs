// Runnable check for the scoring rules: the score must be reproducible and must move
// in the right direction when the conversation gets better or worse.
// node app/scoring.selftest.mjs
import assert from "node:assert";
import { computeScore, targetsUsed, WEIGHTS } from "./scoring.js";
import { byId, scenarios } from "./scenarios.js";

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
const perfectJudgement = { goalCompletion: 3, taskResults: [2, 2, 2, 2, 2], grammar: 5, vocab: 5, interaction: 5, corrections: [] };
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
const halfTasks = computeScore({ scenario, messages: perfectTurns, judgement: { ...perfectJudgement, taskResults: [2, 1, 1, 0, 0] } });
assert.ok(halfTasks.score < best.score && halfTasks.score > noGoal.score, "partial tasks land between full and no goal");

// --- one word, nothing achieved ---
const empty = computeScore({
  scenario,
  messages: [{ role: "user", content: "Hallo" }],
  judgement: { goalCompletion: 0, taskResults: [0, 0, 0, 0, 0], grammar: 0, vocab: 0, interaction: 0, corrections: [] },
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
  judgement: { goalCompletion: 3, taskResults: [2, 2, 2, 0, 0], grammar: 4, vocab: 4, interaction: 4, corrections: [] },
});
const withoutTargets = computeScore({
  scenario,
  messages: [
    { role: "user", content: "Ich will da hin." },
    { role: "user", content: "Ja gut, und der Preis?" },
    { role: "user", content: "Alles klar, danke." },
  ],
  judgement: { goalCompletion: 3, taskResults: [2, 2, 2, 0, 0], grammar: 4, vocab: 4, interaction: 4, corrections: [] },
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
    goalCompletion: 3, taskResults: [2, 2, 2, 2, 2], grammar: 2, vocab: 3, interaction: 4,
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

// --- Fahrkarte: the five questions are the challenge ---
// This one is an information gap: the clerk holds the timetable and the learner only
// gets it by asking. That is only real if asking moves the number, so every question is
// asserted from a sentence somebody would actually say, not from the template recited.
const asked = [
  "Wann fährt der nächste Zug nach Bonn?",
  "Und was kostet das dann?",
  "Muss ich in Mannheim umsteigen?",
  "Von welchem Gleis fährt er ab?",
  "Wie lange dauert die Fahrt ungefähr?",
];
for (const line of asked) {
  const hits = targetsUsed(scenario, line);
  assert.ok(
    hits.some((h) => scenario.phrases.some((f) => f.de === h)),
    `an askable question must match from a natural sentence: ${line}`
  );
}

// A learner who asks nothing and lets the clerk volunteer everything must score below one
// who asks. Same goal reached, same grammar: the difference is only the asking.
const curiousJudgement = {
  goalCompletion: 3, taskResults: [2, 2, 2, 2, 2], grammar: 4, vocab: 4, interaction: 4, corrections: [],
};
const silentJudgement = {
  goalCompletion: 3, taskResults: [2, 0, 0, 0, 2], grammar: 4, vocab: 4, interaction: 4, corrections: [],
};
const curious = computeScore({
  scenario,
  messages: asked.map((content) => ({ role: "user", content })),
  judgement: curiousJudgement,
});
const silent = computeScore({
  scenario,
  messages: ["Ich will nach Bonn.", "Ja.", "Okay.", "Gut.", "Ich nehme die."].map((content) => ({ role: "user", content })),
  judgement: silentJudgement,
});
assert.ok(curious.score > silent.score, `asking must beat being told (${curious.score} vs ${silent.score})`);
assert.equal(silent.targetsUsed.length, 0, "a learner who asks nothing hits none of the question phrases");

// --- the coaching challenge: its phrases are the challenge ---
// "Erfolgreich scheitern" exists to make the student qualify an argument rather than
// call something simply good or bad. That only means anything if saying it moves the
// number, so this asserts the forcing function rather than trusting the briefing.
const coaching = byId("coaching");
const coachingJudgement = {
  goalCompletion: 3, taskResults: [2, 2, 2, 2, 2], grammar: 4, vocab: 4, interaction: 4, corrections: [],
};
// Rewritten for the B2.1 phrases: 41260d8 replaced the einerseits/andererseits register
// with subjunctive-II hedging and left these sentences (and the assertion below) behind,
// which is why this file failed for a day. Every line is a filled-in template.
const hedged = [
  { role: "user", content: "Rückblickend würde ich sagen, dass mein Scheitern weniger an der Idee lag als vielmehr an meiner Planung." },
  { role: "user", content: "Was auf den ersten Blick wie eine Stärke wirkt, kann sich unter Druck als Schwäche erweisen." },
  { role: "user", content: "Man müsste hier differenzieren: In dem einen Kontext ist Ehrgeiz hilfreich, in dem anderen eher hinderlich." },
  { role: "user", content: "Das mag im Prinzip zutreffen, greift meiner Ansicht nach aber zu kurz." },
  { role: "user", content: "Gerade weil ich ehrgeizig bin, laufe ich Gefahr, mich zu übernehmen." },
  { role: "user", content: "Unterm Strich habe ich mich entschieden, das Projekt noch einmal anzugehen." },
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
for (const phrase of coaching.phrases) {
  assert.ok(
    hedged.some((m) => targetsUsed(coaching, m.content).includes(phrase.de)),
    `coaching: no sentence triggers the B2.1 phrase "${phrase.de.slice(0, 50)}"`
  );
}
assert.equal(flatRun.targetsUsed.length, 0, "a flat conversation hits none of the target phrases");

// Skipping the two tasks that ask for the hedging costs points of its own, on top.
const flatSkipped = computeScore({
  scenario: coaching,
  messages: flat,
  judgement: { ...coachingJudgement, taskResults: [2, 0, 0, 0, 2] },
});
assert.ok(flatSkipped.score < flatRun.score, "tasks the student skipped must cost points");

// --- the minimalism challenge carries three Kommunikation boxes, not one ---
// Lektion 11 has three: Einschätzungen formulieren, Verzicht ausdrücken, Argumente
// einschränken. Each must register from a sentence a learner would actually say, or the
// briefing is decoration.
const minimal = byId("minimalismus");
// Also rewritten for the B2.1 phrases, for the same reason as the coaching block above.
const boxLines = [
  "Ich könnte mir gut vorstellen, mich dort anfangs fremd zu fühlen, langfristig aber zur Ruhe zu kommen.",
  "Verzichten fällt mir dort leicht, wo ein Gerät austauschbar ist; schwieriger wird es, sobald ein persönlicher Wert im Spiel ist.",
  "Dass Minimalismus befreit, will ich nicht bestreiten, allerdings sollte man den sozialen Druck dahinter nicht unterschätzen.",
  "Letztlich kommt es weniger auf die Menge an als darauf, welche Bedeutung wir den Dingen beimessen.",
  "Für die Korb-Methode spricht, dass sie langsam ist; dagegen ließe sich allerdings einwenden, dass sie vier Wochen dauert.",
  "Ich neige zu der Karton-Methode, weil sie meinem Alltag am ehesten gerecht wird.",
];
for (const line of boxLines) {
  const hits = targetsUsed(minimal, line);
  assert.ok(
    hits.some((h) => minimal.phrases.some((p) => p.de === h)),
    `a Kommunikation phrase must match from a natural sentence: ${line.slice(0, 50)}`
  );
}
const minimalJudgement = {
  goalCompletion: 3, taskResults: [2, 2, 2, 2, 2], grammar: 4, vocab: 4, interaction: 4, corrections: [],
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
      "Dem Schaubild zufolge erreicht meine Leistungskurve gegen elf Uhr ihren Höhepunkt, bevor sie am Nachmittag deutlich abfällt.",
      "Was mich dabei am meisten erstaunt hat, ist der Umstand, dass Licht die innere Uhr verschieben kann.",
      "Soweit ich informiert bin, geht die Forschung davon aus, dass die Gene nur die Hälfte bestimmen.",
      "Im Gegensatz zu vielen anderen zähle ich eher zu den Langschläfern, was sich daran zeigt, dass ich abends fit bin.",
      "Es liegt nahe, dass die Pille erfunden ist, denn andernfalls müsste man annehmen, dass niemand mehr Schlafmittel braucht.",
      "Ein grundlegendes Problem der Schichtarbeit besteht darin, dass der Rhythmus ständig kippt; hier könnte eine Speziallampe Abhilfe schaffen.",
      "Bei meiner Erfindung handelt es sich um eine Lampe für den Nachtdienst, deren besonderer Vorteil darin liegt, dass sie blaues Licht herausfiltert.",
    ],
    ["Ja, morgens geht es mir gut.", "Das wusste ich nicht.", "Vielleicht die zweite.", "Nachts arbeiten ist hart.", "Eine Lampe wäre gut.", "Ja, genau."],
  ],
  [
    "esstyp",
    [
      "Ich kann durchaus nachvollziehen, dass dir deine Nährstoffe wichtig sind, gleichwohl frage ich mich, ob das nicht anstrengend wird.",
      "Ehrlich gesagt lässt es mich eher kalt, ob mein Brot von Hand gebacken ist.",
      "Für ein so kontrolliertes Essverhalten spricht zwar die Gesundheit, dem steht jedoch entgegen, dass es vierzig Minuten am Tag kostet.",
      "So berechtigt dein Einwand ist, so wenig überzeugt er mich, denn Genuss gehört für mich dazu.",
      "Man kann es mit der Selbstoptimierung auch übertreiben, findest du nicht?",
      "Unterm Strich neige ich zu der Auffassung, dass ein bisschen Kontrolle völlig reicht.",
    ],
    ["Das Essen schmeckt gut.", "Du machst das schon richtig.", "Ich esse einfach, was da ist.", "Okay, verstehe.", "Ja, kann sein.", "Mal sehen."],
  ],
];

const boxJudgement = {
  goalCompletion: 3, taskResults: [2, 2, 2, 2, 2, 2], grammar: 4, vocab: 4, interaction: 4, corrections: [],
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

// --- every challenge is now an information gap ---
// The partner holds something the learner only gets by asking. Two shapes, on purpose:
//
//   Transactional (fahrkarte, restaurant, arzt): the questions ARE the challenge, so they
//   also sit in `phrases` and the measured half of the vocabulary score rewards asking.
//
//   Kursbuch (coaching, minimalismus, innereuhr, esstyp): the Kommunikation boxes are the
//   challenge. The questions are a task only, and deliberately NOT phrases -- adding them
//   would let a learner hit the 5-target pool by asking five questions and never saying a
//   single box, which is the forcing function those challenges exist for.
const TRANSACTIONAL = ["fahrkarte", "restaurant", "arzt"];

for (const sc of scenarios) {
  assert.ok(sc.facts?.length, `${sc.id}: has a fact sheet`);
  assert.equal(sc.askables?.length, 5, `${sc.id}: carries exactly five askable questions`);
  for (const a of sc.askables) {
    for (const key of ["de", "en", "answer"]) {
      assert.ok(typeof a[key] === "string" && a[key].trim(), `${sc.id}: askable "${a.de}" needs a ${key}`);
    }
  }

  const inPhrases = sc.askables.filter((a) => sc.phrases.some((f) => f.de === a.de)).length;
  if (TRANSACTIONAL.includes(sc.id)) {
    assert.equal(inPhrases, 5, `${sc.id} is transactional: every question must also be a scoring phrase`);
  } else {
    assert.equal(inPhrases, 0, `${sc.id} is a Kursbuch challenge: questions must not dilute the Kommunikation pool`);
  }
}

// And on the three transactional ones, asking has to actually pay. Same goal, same grammar
// and vocab ratings: the only difference is whether the learner asked or was simply told.
const asking = { goalCompletion: 3, grammar: 4, vocab: 4, interaction: 4, corrections: [] };
const askedVsTold = [];
for (const id of TRANSACTIONAL) {
  const sc = byId(id);
  const full = sc.tasks.map(() => 2);
  // Being told: the learner opens and closes the transaction but asks nothing in between.
  const told = sc.tasks.map((_, i) => (i === 0 || i === sc.tasks.length - 1 ? 2 : 0));
  const curious = computeScore({
    scenario: sc,
    messages: sc.askables.map((a) => ({ role: "user", content: a.de })),
    judgement: { ...asking, taskResults: full },
  });
  const passive = computeScore({
    scenario: sc,
    messages: ["Guten Tag.", "Ja.", "Okay.", "Gut, danke.", "Auf Wiedersehen."].map((content) => ({ role: "user", content })),
    judgement: { ...asking, taskResults: told },
  });
  assert.ok(curious.score > passive.score, `${id}: asking must beat being told (${curious.score} vs ${passive.score})`);
  assert.equal(passive.targetsUsed.length, 0, `${id}: a passive transcript hits none of the questions`);
  askedVsTold.push(`${id} ${curious.score}/${passive.score}`);
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
console.log("  asked vs told:", askedVsTold.join(" | "));
