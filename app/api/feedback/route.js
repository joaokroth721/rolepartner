import { generateObject, jsonSchema } from "ai";
import { openai } from "@ai-sdk/openai";
import { computeScore } from "../../scoring";
import { getDb, resolveUser, json, fail, oops, readBoard, currentStreak } from "../../db";
import { wrongOrigin, knownScenario, badTranscript, overQuota } from "../../guard";
import { EVAL_SCHEMA, evalSystem, evalPrompt } from "../../prompts";
import { MODEL, recordUsage } from "../../ai";

// What the model is asked for: observations, not a score. The score is computed from
// these in app/scoring.js, on the server, so it cannot be sent in by a client. The schema
// and the prompt live in app/prompts.js, where the admin page reads them too.
const evalSchema = jsonSchema(EVAL_SCHEMA);

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

    const { object, usage } = await generateObject({
      model: openai(MODEL),
      schema: evalSchema,
      temperature: 0,
      system: evalSystem(scenario),
      prompt: evalPrompt(messages),
    });
    await recordUsage(db, { userId: user.id, route: "feedback", usage });

    // Show the mistakes that impede meaning first.
    object.corrections = (object.corrections || []).sort(
      (a, b) => (a.severity === "major" ? 0 : 1) - (b.severity === "major" ? 0 : 1)
    );

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
