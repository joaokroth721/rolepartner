import { getDb, resolveUser, json, fail, readBoard, currentStreak } from "../../db";

// A finished conversation: transcript plus the evaluation the LLM produced.
// Saving returns the leaderboard for the screen that comes next (Conversation -> Leaderboard
// -> Evaluation in the 16.09.2026 flow), so that screen needs no second round trip.
export async function POST(req) {
  try {
    const { scenarioId, title, transcript, evaluation } = await req.json();
    if (!scenarioId) return fail("Kein Szenario angegeben.", 400);
    const score = Number(evaluation?.score);
    if (!Number.isFinite(score)) return fail("Bewertung ohne Punktzahl.", 400);

    const db = await getDb();
    const { user, setCookie } = await resolveUser(db, req);
    const createdAt = new Date().toISOString();
    const inserted = await db
      .prepare(
        `INSERT INTO sessions (user_id, scenario_id, title, score, transcript, evaluation, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
      )
      .bind(
        user.id,
        scenarioId,
        title || null,
        Math.round(score),
        JSON.stringify(transcript || []),
        JSON.stringify(evaluation || {}),
        createdAt
      )
      .first();

    const board = await readBoard(db, { scenarioId, userId: user.id });
    const streak = await currentStreak(db, user.id);
    return json({ id: inserted?.id, score: Math.round(score), createdAt, board, streak }, { setCookie });
  } catch (e) {
    return fail(e.message);
  }
}
