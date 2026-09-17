import { byId } from "./scenarios";
import { fail } from "./db";

// Every AI call costs money and the routes are open to anyone, so each caller gets a
// daily allowance. Generous for a person practising, ruinous for a script.
export const DAILY_AI_CALLS = 120;

// Nothing the app legitimately sends comes close to these.
export const LIMITS = {
  messages: 60, // turns in one conversation
  messageChars: 2000, // one turn
  transcriptChars: 24000, // whole conversation
  translateChars: 600, // a word or a sentence from the reader
};

/**
 * Same-origin check for writes.
 *
 * The cookie is SameSite=Lax, so a cross-site POST arrives without an identity anyway;
 * this stops the sloppier case of a page elsewhere driving these endpoints on behalf of
 * a visitor who happens to have the app open. Requests with no Origin at all (curl,
 * server-to-server) are allowed through: they carry no ambient authority to abuse.
 */
export function wrongOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const here = new URL(req.url).origin;
  return origin === here ? null : fail("Ungültige Herkunft.", 403);
}

// A scenario id the app does not define must never reach the database: it would create a
// leaderboard for a scenario nobody can play.
export function knownScenario(scenarioId) {
  return typeof scenarioId === "string" ? byId(scenarioId) : null;
}

/** Shape and size check for a conversation coming from the client. */
export function badTranscript(messages) {
  if (!Array.isArray(messages)) return fail("Kein Gesprächsverlauf.", 400);
  if (messages.length > LIMITS.messages) return fail("Gespräch zu lang.", 413);
  let total = 0;
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return fail("Ungültige Nachricht.", 400);
    if (typeof m.content !== "string") return fail("Ungültige Nachricht.", 400);
    if (m.content.length > LIMITS.messageChars) return fail("Nachricht zu lang.", 413);
    total += m.content.length;
  }
  if (total > LIMITS.transcriptChars) return fail("Gespräch zu lang.", 413);
  return null;
}

/**
 * Counts one AI call against today's allowance, or refuses.
 * Counted before the model runs, so a burst of parallel calls cannot slip past the cap.
 */
export async function overQuota(db, userId) {
  const day = new Date().toISOString().slice(0, 10);
  await db
    .prepare(
      `INSERT INTO ai_usage (user_id, day, calls) VALUES (?, ?, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET calls = calls + 1`
    )
    .bind(userId, day)
    .run();
  const row = await db
    .prepare("SELECT calls FROM ai_usage WHERE user_id = ? AND day = ?")
    .bind(userId, day)
    .first();
  if ((row?.calls || 0) > DAILY_AI_CALLS) {
    return fail("Tageslimit erreicht. Morgen geht es weiter.", 429);
  }
  return null;
}
