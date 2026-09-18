import { getDb, resolveUser, json, oops } from "../../db";
import { parseListQuery, foldStats, scenarioTitle } from "../../history";

// Past conversations of the caller. The list and one full session share this route and
// branch on `?id=`, the way /api/favorites branches on `?key=` instead of taking a
// dynamic segment. Read-only, so no origin check and no AI quota.

// fail() cannot carry the identity cookie, and this 404 may be a visitor's very first
// call: without the cookie, the next request would mint a second user row and the
// history would start out empty. Same message whether the session does not exist or
// belongs to somebody else, so existence is not leaked.
const notFound = (cookies) => json({ error: "Gespräch nicht gefunden." }, { ...cookies, status: 404 });

const toRow = (r) => ({
  id: r.id,
  scenarioId: r.scenario_id,
  title: scenarioTitle(r.scenario_id, r.title),
  score: r.score,
  createdAt: r.created_at,
});

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const db = await getDb();
    const { user, setCookie, clearCookie } = await resolveUser(db, req);
    const cookies = { setCookie, clearCookie };

    const asked = url.searchParams.get("id");
    if (asked !== null) return one(db, user, asked, cookies);

    const { limit, before, scenarioId } = parseListQuery(url.searchParams);
    // Keyset pagination on created_at, never OFFSET: a cursor reads exactly `limit` rows
    // whatever the page, where OFFSET re-reads and discards everything before it.
    const binds = [user.id];
    let where = "user_id = ?";
    if (before) {
      where += " AND created_at < ?";
      binds.push(before);
    }
    if (scenarioId) {
      where += " AND scenario_id = ?";
      binds.push(scenarioId);
    }
    // transcript and evaluation are deliberately not selected here: 20 of them would be
    // parsed and re-serialized for a list that shows neither.
    const { results } = await db
      .prepare(
        `SELECT id, scenario_id, title, score, created_at
           FROM sessions
          WHERE ${where}
          ORDER BY created_at DESC
          LIMIT ?`
      )
      .bind(...binds, limit)
      .all();

    const rows = results || [];
    return json(
      {
        sessions: rows.map(toRow),
        nextCursor: rows.length === limit ? rows[rows.length - 1].created_at : null,
        // Only on the first page, so paging does not re-run the aggregate.
        stats: before ? null : foldStats(await statsRows(db, user.id)),
      },
      cookies
    );
  } catch (e) {
    return oops("sessions.get", e);
  }
}

async function statsRows(db, userId) {
  const { results } = await db
    .prepare(
      `SELECT scenario_id,
              COUNT(*)        AS plays,
              MAX(score)      AS best,
              SUM(score)      AS total_score,
              MAX(title)      AS title,
              MAX(created_at) AS last_at
         FROM sessions
        WHERE user_id = ?
        GROUP BY scenario_id`
    )
    .bind(userId)
    .all();
  return results || [];
}

// One session with its transcript and evaluation. Ownership is part of the WHERE clause,
// not a comparison after the fetch, so no code path can read another user's conversation.
async function one(db, user, asked, cookies) {
  const id = Number(asked);
  if (!Number.isInteger(id)) return notFound(cookies);

  const row = await db
    .prepare(
      `SELECT id, scenario_id, title, score, transcript, evaluation, created_at
         FROM sessions
        WHERE id = ? AND user_id = ?`
    )
    .bind(id, user.id)
    .first();
  if (!row) return notFound(cookies);

  return json(
    {
      session: {
        ...toRow(row),
        evaluation: JSON.parse(row.evaluation),
        transcript: JSON.parse(row.transcript),
      },
    },
    cookies
  );
}
