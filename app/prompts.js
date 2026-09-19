// Every instruction the app sends to the model, in one file.
//
// These used to live inside the route that sent them. They moved here so the admin page
// can show the prompt a challenge actually runs on: a page that reassembles the prompt
// from the same scenario fields would look right and still drift the day a route changes
// a line. Now there is one string builder, and both the caller and the report use it.
import { TAGS } from "./tags";

/** The in-character system prompt for /api/chat: the scenario's own voice, plus the briefing. */
export function chatSystem(s) {
  const lines = [s.system, ""];
  if (s.level) lines.push(`Niveau des Nutzers: ${s.level}. Passe deine Sprache daran an.`);
  if (s.goal) lines.push(`Ziel des Nutzers: ${s.goal}`);
  if (s.tasks?.length) lines.push(`Aufgaben: ${s.tasks.join("; ")}`);
  if (s.vocab?.length) lines.push(`Zielvokabular (bevorzugt einsetzen): ${s.vocab.map((v) => v.de).join(", ")}`);
  if (s.phrases?.length) lines.push(`Nützliche Sätze: ${s.phrases.map((p) => p.de).join(" | ")}`);
  return lines.join("\n");
}

/** The examiner prompt for /api/feedback. Asks for observations only; see app/scoring.js. */
export function evalSystem(scenario) {
  // The rated dimensions are anchored to a CEFR level, and scenarios are not all at the
  // same one: grading a B1 briefing against A2 descriptors would flatter it. The level
  // the scenario declares is the level it gets judged at.
  const level = scenario.level || "A2";
  return `You are a CEFR examiner evaluating a German ${level} student after a role-play (scenario: "${scenario.title}").
Write ALL feedback in English, be specific and encouraging. For each mistake, give the corrected German form, classify it with the closest "tag" error category, and mark its "severity".
The student's goal was: "${scenario.goal}".
Their tasks were, in this order: ${(scenario.tasks || []).map((t, i) => `${i + 1}. ${t}`).join(" ")}
Report "goalCompletion" (0 not attempted, 1 attempted, 2 mostly done, 3 fully achieved) and one "taskResults" entry per task, in that order (0 skipped, 1 partial, 2 done). Judge only what the transcript shows.
Rate grammar (0-5), vocabulary (0-5), and interaction (0-5) against the ${level} level. Do not rate an overall score: that is computed separately.`;
}

/** How the transcript is laid out under the examiner prompt. */
export const transcriptFor = (messages) =>
  messages.map((m) => `${m.role === "user" ? "Aluno" : "Personagem"}: ${m.content}`).join("\n");

export const evalPrompt = (messages) => `Conversa:\n${transcriptFor(messages)}`;

/**
 * What the examiner must return. A plain object, not a `jsonSchema()` handle, so the
 * admin page can read the field descriptions without importing the AI SDK: those
 * descriptions ARE the grading rubric the model sees, so the methodology report quotes
 * them rather than paraphrasing them.
 */
export const EVAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["goalCompletion", "taskResults", "grammar", "vocab", "interaction", "summary", "strengths", "corrections", "tip"],
  properties: {
    goalCompletion: {
      type: "integer", minimum: 0, maximum: 3,
      description: "How far the student got toward the goal: 0 not attempted, 1 attempted, 2 mostly done, 3 fully achieved",
    },
    taskResults: {
      type: "array",
      items: { type: "integer", minimum: 0, maximum: 2 },
      description: "One rating per task of the briefing, in the same order as given: 0 skipped, 1 partial, 2 done",
    },
    grammar: { type: "integer", minimum: 0, maximum: 5, description: "Grammar rating 0-5 at the level named above: range and accuracy of its structures (verb position, cases, articles)" },
    vocab: { type: "integer", minimum: 0, maximum: 5, description: "Vocabulary rating 0-5 at the level named above: range and aptness of words for the situation" },
    interaction: {
      type: "integer", minimum: 0, maximum: 5,
      description: "Interaction rating 0-5 at the level named above: did the student initiate, respond on-topic, and repair misunderstandings, or only give one-word replies",
    },
    summary: { type: "string", description: "One sentence summarizing performance, in English" },
    strengths: {
      type: "array", minItems: 1, maxItems: 3,
      items: { type: "string" },
      description: "What the student did well, in English",
    },
    corrections: {
      type: "array", maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["wrong", "right", "note", "tag", "severity"],
        properties: {
          wrong: { type: "string", description: "What the student said (in German)" },
          right: { type: "string", description: "The correct German form" },
          note: { type: "string", description: "Short explanation, in English" },
          tag: { type: "string", enum: TAGS, description: "Error category (closest match)" },
          severity: { type: "string", enum: ["major", "minor"], description: "major if it impedes meaning, minor otherwise" },
        },
      },
      description: "Main grammar or vocabulary mistakes",
    },
    tip: { type: "string", description: "One practical tip for next time, in English" },
  },
};

// The two /api/translate prompts. No scenario goes into either: the reader is not a challenge.
export const TRANSLATE_SENTENCE_SYSTEM =
  "Translate the German sentence to natural English. Reply with only the translation, no quotes, no extra text.";

export const TRANSLATE_WORD_SYSTEM =
  "You are a German-English dictionary. Given a German word (with its sentence for context), reply with exactly one line: LEMMA | POS | ENGLISH. " +
  "LEMMA is the dictionary form (nouns with article, e.g. 'die Daten'). POS is one of: noun, verb, adjective, adverb, preposition, pronoun, conjunction, other. " +
  "ENGLISH is a short gloss. No quotes, no extra text.";
