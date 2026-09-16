import { getDb, resolveUser, json, fail, readBoard } from "../../db";

// Top 10. `scenarioId` narrows it to one scenario; without it the ranking spans the app.
export async function GET(req) {
  try {
    const scenarioId = new URL(req.url).searchParams.get("scenarioId");
    const db = await getDb();
    const { user, setCookie } = await resolveUser(db, req);
    const board = await readBoard(db, { scenarioId, userId: user.id });
    return json(board, { setCookie });
  } catch (e) {
    return fail(e.message);
  }
}
