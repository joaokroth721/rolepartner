// How a conversation becomes a number between 0 and 100.
//
// The model does NOT hand us a score. It reports observations it is actually good at
// (did the goal get reached, which tasks happened, how clean was the grammar), and the
// score is computed here, on the server, from those observations plus facts measured
// directly from the transcript. Two reasons:
//   1. A score the client sends can be forged; a score derived here cannot.
//   2. A single "rate this 0-100" call drifts between runs. Fixed weights do not, so two
//      equivalent conversations get equivalent scores and the leaderboard means something.

// What each part of the conversation is worth. They add up to 100.
export const WEIGHTS = {
  goal: 30, // did the student achieve what the scenario asked
  tasks: 20, // the individual steps of the briefing
  grammar: 20, // how correct the German was
  vocabulary: 20, // 12 for target words actually used, 8 for the model's rating
  engagement: 10, // did they actually hold a conversation
};

// Enough target words to count as full marks: hitting 5 of a scenario's 13 vocab and
// phrase entries is already good use of the briefing, and scenarios differ in size.
const TARGET_SAMPLE = 5;
// A conversation of this many student turns is a complete attempt.
const FULL_TURNS = 6;
// Corrections above this many start costing points, one point each.
const FREE_ERRORS = 2;
const MAX_PENALTY = 10;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Strip articles, punctuation and case so "Die Fahrkarte," matches "eine fahrkarte".
const ARTICLES = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer"]);
const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[.,!?;:„“"'()…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const contentWords = (s) => normalize(s).split(" ").filter((w) => w && !ARTICLES.has(w));

/**
 * Which of the scenario's target vocab and phrases the student actually said.
 *
 * Vocab counts when its head word appears (so "die Fahrkarte" matches "eine Fahrkarte
 * nach Bonn"). A phrase counts when most of its content words appear, because the
 * briefing's phrases are templates like "Ich möchte eine Fahrkarte nach …" that nobody
 * repeats verbatim.
 */
export function targetsUsed(scenario, studentText) {
  const said = normalize(studentText);
  const saidWords = new Set(said.split(" "));
  const hits = [];

  for (const v of scenario.vocab || []) {
    const words = contentWords(v.de);
    if (words.length === 0) continue;
    const matched = words.length === 1 ? saidWords.has(words[0]) : words.every((w) => saidWords.has(w));
    if (matched) hits.push(v.de);
  }

  for (const p of scenario.phrases || []) {
    const words = contentWords(p.de).filter((w) => w !== "…");
    if (words.length === 0) continue;
    const present = words.filter((w) => saidWords.has(w)).length;
    if (present / words.length >= 0.6) hits.push(p.de);
  }

  return hits;
}

/**
 * The score and the breakdown behind it.
 *
 * `judgement` is what the model returned: { goalReached, taskResults[], grammar, vocab,
 * corrections[] }. `messages` is the transcript, where role "user" is the student.
 */
export function computeScore({ scenario, messages = [], judgement = {} }) {
  const studentTurns = messages.filter((m) => m.role === "user");
  const studentText = studentTurns.map((m) => m.content).join(" ");

  // Goal: the scenario either got done or it did not.
  const goal = judgement.goalReached ? WEIGHTS.goal : 0;

  // Tasks: the share of the briefing's steps that happened. A scenario without tasks
  // cannot lose points it never offered, so it scores full.
  const taskList = scenario.tasks || [];
  const done = (judgement.taskResults || []).filter(Boolean).length;
  const tasks = taskList.length === 0 ? WEIGHTS.tasks : Math.round((WEIGHTS.tasks * clamp(done, 0, taskList.length)) / taskList.length);

  // Grammar: the model's 0-5 rating, scaled.
  const grammar = Math.round((WEIGHTS.grammar * clamp(Number(judgement.grammar) || 0, 0, 5)) / 5);

  // Vocabulary: mostly measured, partly judged. The measured part is what stops a fluent
  // improviser who ignores the briefing from scoring the same as someone who used it.
  const hits = targetsUsed(scenario, studentText);
  const targetPool = Math.min(TARGET_SAMPLE, (scenario.vocab?.length || 0) + (scenario.phrases?.length || 0)) || 1;
  const measured = Math.round((12 * Math.min(hits.length, targetPool)) / targetPool);
  const judged = Math.round((8 * clamp(Number(judgement.vocab) || 0, 0, 5)) / 5);
  const vocabulary = measured + judged;

  // Engagement: a two-word conversation is not an A2 role-play, whatever else is true.
  const engagement = Math.round((WEIGHTS.engagement * Math.min(studentTurns.length, FULL_TURNS)) / FULL_TURNS);

  // Errors past a small allowance cost a point each. Corrections are capped at 5 by the
  // schema, so this can never dominate the score.
  const errors = (judgement.corrections || []).length;
  const penalty = clamp(Math.max(0, errors - FREE_ERRORS), 0, MAX_PENALTY);

  const score = clamp(goal + tasks + grammar + vocabulary + engagement - penalty, 0, 100);

  return {
    score,
    breakdown: { goal, tasks, grammar, vocabulary, engagement, penalty },
    targetsUsed: hits,
    turns: studentTurns.length,
  };
}
