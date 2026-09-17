import { generateObject, jsonSchema } from "ai";
import { openai } from "@ai-sdk/openai";
import { TAGS } from "../../tags";
import { computeScore } from "../../scoring";
import { getDb, resolveUser, json, fail, oops, readBoard, currentStreak } from "../../db";
import { wrongOrigin, knownScenario, badTranscript, overQuota } from "../../guard";

// What the model is asked for: observations, not a score. The score is computed from
// these in app/scoring.js, on the server, so it cannot be sent in by a client.
const evalSchema = jsonSchema({
  type: "object",
  additionalProperties: false,
  required: ["goalReached", "taskResults", "grammar", "vocab", "summary", "strengths", "corrections", "tip"],
  properties: {
    goalReached: { type: "boolean", description: "Did the student achieve the scenario's goal?" },
    taskResults: {
      type: "array",
      items: { type: "boolean" },
      description: "One true/false per task of the briefing, in the same order as given",
    },
    grammar: { type: "integer", minimum: 0, maximum: 5, description: "Grammar rating 0-5" },
    vocab: { type: "integer", minimum: 0, maximum: 5, description: "Vocabulary rating 0-5" },
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
        required: ["wrong", "right", "note", "tag"],
        properties: {
          wrong: { type: "string", description: "What the student said (in German)" },
          right: { type: "string", description: "The correct German form" },
          note: { type: "string", description: "Short explanation, in English" },
          tag: { type: "string", enum: TAGS, description: "Error category (closest match)" },
        },
      },
      description: "Main grammar or vocabulary mistakes",
    },
    tip: { type: "string", description: "One practical tip for next time, in English" },
  },
});

export async function POST(req) {
  const bad = wrongOrigin(req);
  if (bad) return bad;

  try {
    const { messages, scenarioId } = await req.json();
    const scenario = knownScenario(scenarioId);
    if (!scenario) return fail("Unbekanntes Szenario.", 400);
    const badShape = badTranscript(messages);
    if (badShape) return badShape;
    if (messages.length === 0) return fail("Noch kein Gespräch.", 400);

    const db = await getDb();
    const { user, setCookie, clearCookie } = await resolveUser(db, req);
    const limited = await overQuota(db, user.id);
    if (limited) return limited;

    const transcript = messages
      .map((m) => `${m.role === "user" ? "Aluno" : "Personagem"}: ${m.content}`)
      .join("\n");

    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: evalSchema,
      system: `You are a German teacher evaluating a student after a role-play (scenario: "${scenario.title}").
Write ALL feedback in English, be specific and encouraging. For each mistake, give the corrected German form and classify it with the closest "tag" error category.
The student's goal was: "${scenario.goal}".
Their tasks were, in this order: ${(scenario.tasks || []).map((t, i) => `${i + 1}. ${t}`).join(" ")}
Report "goalReached" and one "taskResults" entry per task, in that order. Judge only what the transcript shows.
Rate grammar (0-5) and vocabulary (0-5). Do not rate an overall score: that is computed separately.`,
      prompt: `Conversa:\n${transcript}`,
    });

    // The score is derived here, from the model's observations plus what the transcript
    // itself proves (target words used, turns taken).
    const { score, breakdown, targetsUsed } = computeScore({ scenario, messages, judgement: object });
    const evaluation = { ...object, score, breakdown, targetsUsed };

    // Written in the same breath as it is produced, so the only way into the leaderboard
    // is a conversation the model actually evaluated.
    const createdAt = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO sessions (user_id, scenario_id, title, score, transcript, evaluation, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(user.id, scenario.id, scenario.title, score, JSON.stringify(messages), JSON.stringify(evaluation), createdAt)
      .run();

    const board = await readBoard(db, { scenarioId: scenario.id, userId: user.id });
    const streak = await currentStreak(db, user.id);
    return json({ evaluation, score, board, streak }, { setCookie, clearCookie });
  } catch (e) {
    return oops("feedback", e);
  }
}
