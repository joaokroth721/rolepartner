import { getDb, resolveUser, json, fail, currentStreak } from "../../db";

// Bootstrap call: identifies the browser (minting the anonymous id on first visit),
// and returns what the topbar needs. The streak is measured, not hardcoded.
export async function GET(req) {
  try {
    const db = await getDb();
    const { user, setCookie } = await resolveUser(db, req);
    const streak = await currentStreak(db, user.id);
    return json(
      {
        id: user.id,
        email: user.email || null,
        name: user.name || null,
        anonymous: !user.email,
        streak,
      },
      { setCookie }
    );
  } catch (e) {
    return fail(e.message);
  }
}
