// Reading side of the `sessions` table: query parsing and the stats fold behind
// GET /api/sessions. Kept out of the route so it can be exercised by plain node
// (app/history.selftest.mjs) — which is also why the scenario lookup is `byId` and not
// guard.js's `knownScenario`: guard.js pulls in db.js, and that needs a Worker runtime.
import { byId } from "./scenarios.js";

// Page size, shared by the route and the client so "Mehr laden" and the server agree.
export const HISTORY_PAGE = 20;
export const HISTORY_MAX = 50;

// The scenario's current name, so renaming a scenario renames it everywhere in the
// history; the title stored with the session is the fallback for a scenario that has
// since been removed from scenarios.js.
export const scenarioTitle = (scenarioId, stored) =>
  byId(scenarioId)?.title || stored || scenarioId;

/**
 * Query string of the list endpoint. Nothing here 400s: an unknown scenario id is
 * ignored the way /api/leaderboard ignores it, and a nonsense limit falls back to the
 * default, because a bad URL in a link should still show the user their history.
 */
export function parseListQuery(searchParams) {
  const rawLimit = searchParams.get("limit");
  const n = Number(rawLimit);
  const limit =
    rawLimit && Number.isFinite(n)
      ? Math.min(HISTORY_MAX, Math.max(1, Math.trunc(n)))
      : HISTORY_PAGE;

  const asked = searchParams.get("scenarioId");
  return {
    limit,
    before: searchParams.get("before") || null,
    scenarioId: asked ? byId(asked)?.id || null : null,
  };
}

/**
 * Folds the per-scenario aggregate rows into the shape the history view draws.
 *
 * The overall average is computed from the summed scores, not by averaging the
 * per-scenario averages: one run at 100 and three at 60 is 70, not 80.
 */
export function foldStats(rows) {
  const list = rows || [];
  const perScenario = list.map((r) => ({
    scenarioId: r.scenario_id,
    title: scenarioTitle(r.scenario_id, r.title),
    plays: r.plays,
    best: r.best,
    avg: Math.round(r.total_score / r.plays),
    lastAt: r.last_at,
  }));
  perScenario.sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));

  const plays = list.reduce((n, r) => n + r.plays, 0);
  if (plays === 0) return { plays: 0, best: null, avg: null, perScenario };
  return {
    plays,
    best: list.reduce((m, r) => Math.max(m, r.best), 0),
    avg: Math.round(list.reduce((n, r) => n + r.total_score, 0) / plays),
    perScenario,
  };
}
