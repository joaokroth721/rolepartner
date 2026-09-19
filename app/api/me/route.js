import { getDb, resolveUser, json, oops, currentStreak, clearedCookie, analyticsId, recordVisit } from "../../db";
import { isAdminEmail } from "../../admin";

// Bootstrap call: identifies the browser (minting the anonymous id on first visit),
// and returns what the topbar needs. The streak is measured, not hardcoded.
// The user's id is deliberately NOT returned: it is the value of the identity cookie,
// so handing it to page JavaScript would undo the cookie's HttpOnly flag.
export async function GET(req) {
  try {
    const db = await getDb();
    const { user, setCookie, clearCookie } = await resolveUser(db, req);
    // This route is the app's bootstrap call, one per page load, which makes it the only
    // honest place to count a visit.
    await recordVisit(db, user.id);
    const streak = await currentStreak(db, user.id);
    return json(
      {
        email: user.email || null,
        name: user.name || null,
        anonymous: !user.email,
        streak,
        // Pseudonymous and only for signed-in users; null today, since login is not configured.
        analyticsId: await analyticsId(user),
        // Only decides whether the topbar offers the Admin link. /api/admin re-checks it
        // server-side on every call, so a forged `true` here buys nothing.
        admin: await isAdminEmail(db, user.email),
      },
      { setCookie, clearCookie }
    );
  } catch (e) {
    return oops("me", e);
  }
}

// Called on sign-out. NextAuth clears its own session cookie but knows nothing about
// rp_uid, and a stale rp_uid on a shared machine is exactly how one person ends up
// looking at another's collection.
export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", clearedCookie());
  return res;
}
