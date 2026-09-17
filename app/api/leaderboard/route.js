import { getDb, resolveUser, json, oops, readBoard } from "../../db";
import { knownScenario } from "../../guard";

// Top 10. `scenarioId` narrows it to one scenario; without it the ranking spans the app.
export async function GET(req) {
  try {
    const asked = new URL(req.url).searchParams.get("scenarioId");
    const scenarioId = asked ? knownScenario(asked)?.id || null : null;
    const db = await getDb();
    const { user, setCookie, clearCookie } = await resolveUser(db, req);
    const board = await readBoard(db, { scenarioId, userId: user.id });
    return json(board, { setCookie, clearCookie });
  } catch (e) {
    return oops("leaderboard", e);
  }
}
