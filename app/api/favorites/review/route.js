import { getDb, resolveUser, json, fail } from "../../../db";
import { MASTER_AT } from "../../../favkey";

// The "Got it" button. At MASTER_AT the card moves to the mastered pile, which is a
// client-side reading of this counter, so the server just increments it.
export async function POST(req) {
  try {
    const { key } = await req.json();
    if (!key) return fail("Kein Schlüssel angegeben.", 400);
    const db = await getDb();
    const { user, setCookie } = await resolveUser(db, req);
    await db
      .prepare("UPDATE favorites SET reviews = reviews + 1 WHERE user_id = ? AND fav_key = ?")
      .bind(user.id, key)
      .run();
    const row = await db
      .prepare("SELECT reviews FROM favorites WHERE user_id = ? AND fav_key = ?")
      .bind(user.id, key)
      .first();
    if (!row) return fail("Favorit nicht gefunden.", 404);
    return json({ reviews: row.reviews, mastered: row.reviews >= MASTER_AT }, { setCookie });
  } catch (e) {
    return fail(e.message);
  }
}
