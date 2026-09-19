import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "./auth";

export const UID_COOKIE = "rp_uid";
const YEAR = 60 * 60 * 24 * 365;

// The D1 binding. Missing binding is a config error, not a user error, so it says so plainly.
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) throw new Error("D1-Binding 'DB' fehlt (siehe wrangler.jsonc).");
  return env.DB;
}

const readCookie = (req, name) =>
  (req.headers.get("cookie") || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1) || null;

// Google identity when the login is configured, nothing when it is not.
// Auth.js throws if AUTH_SECRET/GOOGLE_* are absent, which is the normal state until those
// secrets are set, so an anonymous visitor must not be turned into a 500 here.
async function sessionUser() {
  try {
    const session = await auth();
    return session?.user?.email ? session.user : null;
  } catch {
    return null;
  }
}

/**
 * Resolves who is calling, creating the row on first contact.
 *
 * Logged in: keyed by email, and an existing anonymous row for this browser is adopted
 * rather than orphaned, so favorites collected before the first login survive it.
 * Logged out: keyed by the rp_uid cookie, which the caller must send back (see `json`).
 */
export async function resolveUser(db, req) {
  const cookieId = readCookie(req, UID_COOKIE);
  const google = await sessionUser();
  const now = new Date().toISOString();

  if (google) {
    const found = await db.prepare("SELECT * FROM users WHERE email = ?").bind(google.email).first();
    if (found) {
      await db
        .prepare("UPDATE users SET last_seen_at = ?, name = ?, avatar_url = ? WHERE id = ?")
        .bind(now, google.name || found.name, google.image || found.avatar_url, found.id)
        .run();
      return { user: { ...found, last_seen_at: now }, clearCookie: Boolean(cookieId) };
    }
    // First login on a browser that already collected favorites anonymously: claim that row.
    const anon = cookieId
      ? await db.prepare("SELECT * FROM users WHERE id = ? AND email IS NULL").bind(cookieId).first()
      : null;
    const id = anon?.id || crypto.randomUUID();
    if (anon) {
      await db
        .prepare("UPDATE users SET email = ?, name = ?, avatar_url = ?, last_seen_at = ? WHERE id = ?")
        .bind(google.email, google.name || null, google.image || null, now, id)
        .run();
    } else {
      await db
        .prepare("INSERT INTO users (id, email, name, avatar_url, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, google.email, google.name || null, google.image || null, now, now)
        .run();
    }
    return { user: { id, email: google.email, name: google.name || null }, clearCookie: Boolean(cookieId) };
  }

  if (cookieId) {
    // `email IS NULL` is the security boundary: once a row belongs to a Google account, the
    // cookie alone must never reach it again. Without this, the cookie left behind by a
    // signed-out account would still unlock that account's data for the next person on the
    // machine, and NextAuth's signOut() does not clear this cookie.
    const found = await db
      .prepare("SELECT * FROM users WHERE id = ? AND email IS NULL")
      .bind(cookieId)
      .first();
    if (found) {
      await db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(now, found.id).run();
      return { user: found, setCookie: null };
    }
  }

  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO users (id, created_at, last_seen_at) VALUES (?, ?, ?)")
    .bind(id, now, now)
    .run();
  return { user: { id, email: null, name: null }, setCookie: id };
}

// JSON response that also hands back the anonymous id when one was just minted, or drops
// it once a Google session is the identity, so the two can never be confused.
export function json(data, { setCookie = null, clearCookie = false, status = 200 } = {}) {
  const res = Response.json(data, { status });
  if (setCookie) {
    res.headers.append(
      "set-cookie",
      `${UID_COOKIE}=${setCookie}; Path=/; Max-Age=${YEAR}; HttpOnly; SameSite=Lax; Secure`
    );
  } else if (clearCookie) {
    res.headers.append("set-cookie", clearedCookie());
  }
  return res;
}

export const clearedCookie = () => `${UID_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;

/**
 * Deliberate, safe-to-show errors only.
 *
 * `fail("...", 400)` messages are written here and meant for the user. Unexpected
 * exceptions go through `oops`, which keeps the detail in the Worker log instead of
 * handing an anonymous caller our schema, table names and binding configuration.
 */
export const fail = (message, status = 400) => Response.json({ error: message }, { status });

export function oops(where, e) {
  console.error(`[${where}]`, e?.stack || e);
  return Response.json({ error: "Serverfehler. Bitte später erneut versuchen." }, { status: 500 });
}

/**
 * A stable, pseudonymous id for analytics.
 *
 * Never the user id itself: that is the value of the rp_uid cookie, and handing it to page
 * JavaScript would undo the cookie's HttpOnly flag. The salt makes the hash unguessable from
 * a known user id, so it cannot be replayed as a cookie either. Null until a salt is set,
 * and only ever issued to a signed-in user.
 */
export async function analyticsId(user) {
  const salt = process.env.ANALYTICS_SALT;
  if (!user?.email || !salt) return null;
  const bytes = new TextEncoder().encode(`${user.id}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * Counts one page open for this user, on today's date (UTC).
 *
 * Called from /api/me, which the app fires once per page load, so this is a visit
 * counter and not a request counter. `users.last_seen_at` already says when someone was
 * last here; only this can say how many times, or how many people were here in a month
 * that has since passed.
 *
 * Never throws, for the same reason recordUsage does not: a counter must not be able to
 * break the bootstrap call that every screen waits on.
 */
export async function recordVisit(db, userId) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    await db
      .prepare(
        `INSERT INTO visits (user_id, day, hits) VALUES (?, ?, 1)
         ON CONFLICT (user_id, day) DO UPDATE SET hits = hits + 1`
      )
      .bind(userId, day)
      .run();
  } catch (e) {
    console.error("[recordVisit]", e?.stack || e);
  }
}

// Consecutive days with a finished conversation, counting back from today (yesterday still
// counts, so the streak does not break until a full day is missed).
export async function currentStreak(db, userId) {
  const { results } = await db
    .prepare("SELECT DISTINCT date(created_at) AS d FROM sessions WHERE user_id = ? ORDER BY d DESC LIMIT 366")
    .bind(userId)
    .all();
  const days = (results || []).map((r) => r.d);
  if (days.length === 0) return 0;

  const dayMs = 86400000;
  const todayUtc = new Date().toISOString().slice(0, 10);
  const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / dayMs);

  if (diffDays(todayUtc, days[0]) > 1) return 0; // last practice is older than yesterday
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (diffDays(days[i - 1], days[i]) !== 1) break;
    streak++;
  }
  return streak;
}

/**
 * Top 10 by each player's best score, plus where the caller stands.
 *
 * This is the one query that reads across all users, so it is the only place a person sees
 * anything of anyone else: a display name (or "Anonym" before login) and a score.
 * `scenarioId` narrows it to one scenario; omitted, it ranks across the whole app.
 */
export async function readBoard(db, { scenarioId = null, userId = null } = {}) {
  const where = scenarioId ? "WHERE s.scenario_id = ?" : "";
  const top = await db
    .prepare(
      `SELECT s.user_id AS id, u.name AS name, MAX(s.score) AS score,
              COUNT(*) AS plays, MIN(s.created_at) AS first_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         ${where}
        GROUP BY s.user_id
        ORDER BY score DESC, first_at ASC
        LIMIT 10`
    )
    .bind(...(scenarioId ? [scenarioId] : []))
    .all();

  const rows = (top.results || []).map((r, i) => ({
    rank: i + 1,
    name: r.name || "Anonym",
    score: r.score,
    plays: r.plays,
    me: userId != null && r.id === userId,
  }));

  let me = null;
  if (userId) {
    const mine = await db
      .prepare(
        `SELECT MAX(score) AS best FROM sessions WHERE user_id = ?${scenarioId ? " AND scenario_id = ?" : ""}`
      )
      .bind(...(scenarioId ? [userId, scenarioId] : [userId]))
      .first();
    if (mine?.best != null) {
      const ahead = await db
        .prepare(
          `SELECT COUNT(*) AS n FROM (
             SELECT user_id, MAX(score) AS best FROM sessions ${scenarioId ? "WHERE scenario_id = ?" : ""}
             GROUP BY user_id
           ) WHERE best > ?`
        )
        .bind(...(scenarioId ? [scenarioId, mine.best] : [mine.best]))
        .first();
      me = { best: mine.best, rank: (ahead?.n || 0) + 1 };
    }
  }
  return { top: rows, me };
}
