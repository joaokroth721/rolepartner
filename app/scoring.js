// How a conversation becomes a number between 0 and 100.
//
// The model does NOT hand us a score. It reports observations it is actually good at
// (how far the goal got, which tasks happened, how clean the grammar was), and the
// score is computed here, on the server, from those observations plus facts measured
// directly from the transcript. Two reasons:
//   1. A score the client sends can be forged; a score derived here cannot.
//   2. A single "rate this 0-100" call drifts between runs. Fixed weights do not, so two
//      equivalent conversations get equivalent scores and the leaderboard means something.
//
// Every rated observation is graded on a fixed CEFR-A2 scale in the prompt, and every
// term below is a clean fraction of its weight, so partial credit is smooth: a near-miss
// beats a no-show instead of falling off a cliff.

// What each part of the conversation is worth. They add up to 100.
export const WEIGHTS = {
  goal: 25, // how far the student got toward what the scenario asked (graded 0-3)
  tasks: 20, // the individual steps of the briefing (each graded 0-2)
  grammar: 20, // how correct the German was
  vocabulary: 20, // 12 for the model's judged use, 8 for target words actually said
  interaction: 15, // was it a real exchange: initiating, responding on-topic, repairing
};

// Enough target words to count as full marks: hitting 5 of a scenario's vocab and
// phrase entries is already good use of the briefing, and scenarios differ in size.
export const TARGET_SAMPLE = 5;
// Fewer student turns than this cannot prove real interaction, so the interaction score
// is capped in proportion: a one-line "conversation" can never claim full marks for it.
export const MIN_MEANINGFUL_TURNS = 4;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (x) => Number(x) || 0;

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
 * `judgement` is what the model returned: { goalCompletion (0-3), taskResults[] (each
 * 0-2), grammar (0-5), vocab (0-5), interaction (0-5), corrections[] }. `messages` is
 * the transcript, where role "user" is the student.
 */
export function computeScore({ scenario, messages = [], judgement = {} }) {
  const studentTurns = messages.filter((m) => m.role === "user");
  const studentText = studentTurns.map((m) => m.content).join(" ");

  // Goal: graded, not all-or-nothing. 0 not attempted, 3 fully achieved. A near-miss
  // keeps most of the weight it earned.
  const goal = Math.round((WEIGHTS.goal * clamp(num(judgement.goalCompletion), 0, 3)) / 3);

  // Tasks: the share of the briefing's steps that happened, each step graded 0-2. A
  // scenario without tasks cannot lose points it never offered, so it scores full.
  const taskList = scenario.tasks || [];
  const taskResults = (judgement.taskResults || []).map((t) => clamp(num(t), 0, 2));
  const earned = taskResults.reduce((a, b) => a + b, 0);
  const tasks = taskList.length === 0 ? WEIGHTS.tasks : Math.round((WEIGHTS.tasks * clamp(earned, 0, 2 * taskList.length)) / (2 * taskList.length));

  // Grammar: the model's 0-5 rating, scaled. Errors are already reflected here, so they
  // are never charged a second time as a separate penalty.
  const grammar = Math.round((WEIGHTS.grammar * clamp(num(judgement.grammar), 0, 5)) / 5);

  // Vocabulary: mostly judged, partly measured. The measured floor is what stops a fluent
  // improviser who ignores the briefing from maxing out vocab; the larger judged part
  // rewards correct paraphrase that never says the exact briefing lemma.
  const hits = targetsUsed(scenario, studentText);
  const pool = Math.min(TARGET_SAMPLE, (scenario.vocab?.length || 0) + (scenario.phrases?.length || 0)) || 1;
  const judged = Math.round((12 * clamp(num(judgement.vocab), 0, 5)) / 5);
  const measured = Math.round((8 * Math.min(hits.length, pool)) / pool);
  const vocabulary = judged + measured;

  // Interaction: quality (the model's rating) gated by sufficiency (turns taken). A short
  // transcript cannot claim full interaction however generous the model was.
  const floor = Math.min(5, Math.ceil((5 * studentTurns.length) / MIN_MEANINGFUL_TURNS));
  const interaction = Math.round((WEIGHTS.interaction * Math.min(clamp(num(judgement.interaction), 0, 5), floor)) / 5);

  const score = clamp(goal + tasks + grammar + vocabulary + interaction, 0, 100);

  return {
    score,
    breakdown: { goal, tasks, grammar, vocabulary, interaction },
    targetsUsed: hits,
    turns: studentTurns.length,
  };
}

/**
 * The same five terms in prose, for the methodology report on /admin.
 *
 * Written here rather than in the admin page so a change to a formula and a change to
 * its explanation are one edit in one file. `formula` is the arithmetic as it is coded
 * below; if the two ever disagree, the code is what runs and this is the bug.
 */
export const SCORING_RULES = [
  {
    key: "goal",
    label: "Goal",
    source: "model observation (goalCompletion 0-3)",
    formula: "round(25 * goalCompletion / 3)",
    why: "Graded, not pass/fail: a near miss keeps most of the weight it earned instead of scoring the same as never trying.",
  },
  {
    key: "tasks",
    label: "Tasks",
    source: "model observation (taskResults, one 0-2 per briefing task)",
    formula: "round(20 * sum(taskResults) / (2 * taskCount)), or the full 20 when the scenario has no tasks",
    why: "The share of the briefing that actually happened. A scenario that asks for nothing cannot dock points it never offered.",
  },
  {
    key: "grammar",
    label: "Grammar",
    source: "model observation (grammar 0-5, rated against A2)",
    formula: "round(20 * grammar / 5)",
    why: "The corrections list is already a symptom of this rating, so mistakes are never charged twice.",
  },
  {
    key: "vocabulary",
    label: "Vocabulary",
    source: "12 from the model (vocab 0-5), 8 measured from the transcript",
    formula: `round(12 * vocab / 5) + round(8 * min(hits, pool) / pool), pool = min(${TARGET_SAMPLE}, vocab + phrases)`,
    why: "The measured half stops a fluent improviser who ignores the briefing from maxing out; the judged half still rewards correct paraphrase that never says the exact lemma.",
  },
  {
    key: "interaction",
    label: "Interaction",
    source: "model observation (interaction 0-5), capped by student turns",
    formula: `round(15 * min(interaction, ceil(5 * turns / ${MIN_MEANINGFUL_TURNS})) / 5)`,
    why: "Quality gated by sufficiency: a three-line exchange cannot claim full marks for interaction however generous the model was.",
  },
];

/** How the raw transcript is turned into the "hits" that the vocabulary term measures. */
export const MATCHING_RULES = [
  "Case, punctuation and articles (der/die/das/ein/eine/...) are stripped before comparing.",
  "A vocab entry counts when every content word of it appears among the student's words.",
  "A phrase counts when at least 60% of its content words appear, because briefing phrases are templates nobody repeats verbatim.",
  `Only the first ${TARGET_SAMPLE} hits can be worth anything: the pool is capped so a large scenario is not easier than a small one.`,
];
