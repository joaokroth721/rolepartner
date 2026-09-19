// The read side of /admin: every cross-user aggregate the dashboard draws.
//
// Kept out of the route for the same reason app/history.js is: the route should be the
// gate and the shape of the response, not three hundred lines of SQL. Everything here
// reads across all users and must only ever be called behind requireAdmin().
//
// Dates are compared with substr(col, 1, 10) rather than SQLite's date(): `created_at`
// holds two formats already -- an ISO string with a "T" when JavaScript wrote it, and
// "YYYY-MM-DD HH:MM:SS" when the column default did -- and the first ten characters are
// the day in both, with no parsing to get wrong.

import { scenarios } from "./scenarios";
import { WEIGHTS, TARGET_SAMPLE, MIN_MEANINGFUL_TURNS, SCORING_RULES, MATCHING_RULES } from "./scoring";
import { chatSystem, evalSystem, evalPrompt, EVAL_SCHEMA } from "./prompts";
import { MODEL, PRICING, costOf } from "./ai";
import { bootstrapAdmins } from "./admin";

const DAY = 86400000;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

// How far back the two daily series go. Two weeks is what fits on screen as bars without
// becoming a thing you have to squint at, and D1 reads at most one row per active user
// per day to build it.
export const SERIES_DAYS = 14;

const n = (x) => Number(x) || 0;

/** Counts of people: how many exist, how many signed in, how many came back. */
async function userStats(db) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) AS with_email,
              SUM(CASE WHEN substr(created_at, 1, 10) =  ? THEN 1 ELSE 0 END) AS new_today,
              SUM(CASE WHEN substr(created_at, 1, 10) >= ? THEN 1 ELSE 0 END) AS new_7d,
              SUM(CASE WHEN substr(last_seen_at, 1, 10) =  ? THEN 1 ELSE 0 END) AS active_today,
              SUM(CASE WHEN substr(last_seen_at, 1, 10) >= ? THEN 1 ELSE 0 END) AS active_7d,
              SUM(CASE WHEN substr(last_seen_at, 1, 10) >= ? THEN 1 ELSE 0 END) AS active_30d
         FROM users`
    )
    .bind(today(), daysAgo(6), today(), daysAgo(6), daysAgo(29))
    .first();
  return {
    total: n(row?.total),
    withEmail: n(row?.with_email),
    anonymous: n(row?.total) - n(row?.with_email),
    newToday: n(row?.new_today),
    new7d: n(row?.new_7d),
    activeToday: n(row?.active_today),
    active7d: n(row?.active_7d),
    active30d: n(row?.active_30d),
  };
}

/**
 * Page opens, from the `visits` table.
 *
 * "Users" here means distinct users, and one row in `visits` is already one user on one
 * day, so a plain COUNT(*) over a single day is the distinct count.
 */
async function visitStats(db) {
  const totals = await db
    .prepare(
      `SELECT COALESCE(SUM(hits), 0) AS hits,
              COUNT(DISTINCT user_id) AS users,
              COALESCE(SUM(CASE WHEN day =  ? THEN hits END), 0) AS hits_today,
              COALESCE(SUM(CASE WHEN day >= ? THEN hits END), 0) AS hits_7d,
              COUNT(DISTINCT CASE WHEN day =  ? THEN user_id END) AS users_today,
              COUNT(DISTINCT CASE WHEN day >= ? THEN user_id END) AS users_7d
         FROM visits`
    )
    .bind(today(), daysAgo(6), today(), daysAgo(6))
    .first();

  const { results } = await db
    .prepare(
      `SELECT day, SUM(hits) AS hits, COUNT(*) AS users
         FROM visits WHERE day >= ? GROUP BY day ORDER BY day`
    )
    .bind(daysAgo(SERIES_DAYS - 1))
    .all();

  return {
    hits: n(totals?.hits),
    users: n(totals?.users),
    hitsToday: n(totals?.hits_today),
    hits7d: n(totals?.hits_7d),
    usersToday: n(totals?.users_today),
    users7d: n(totals?.users_7d),
    daily: fillDays(results || [], (r) => ({ hits: n(r.hits), users: n(r.users) }), { hits: 0, users: 0 }),
  };
}

// A day with no traffic produces no row, and a bar chart that silently skips those days
// lies about the shape of the week. Every day in the window gets an entry.
function fillDays(rows, map, empty) {
  const byDay = new Map(rows.map((r) => [r.day, map(r)]));
  return Array.from({ length: SERIES_DAYS }, (_, i) => {
    const day = daysAgo(SERIES_DAYS - 1 - i);
    return { day, ...(byDay.get(day) || empty) };
  });
}

const tokenRow = (r) => {
  const input = n(r.input_tokens);
  const output = n(r.output_tokens);
  return {
    calls: n(r.calls),
    input,
    output,
    reasoning: n(r.reasoning_tokens),
    total: input + output,
    cost: costOf({ model: r.model || MODEL, inputTokens: input, outputTokens: output }),
  };
};

// Adds up rows that may span models, and gives up on the cost the moment one of them has
// no price: a total missing an unpriced model reads as cheaper than it was.
const foldCost = (rows) =>
  rows.reduce((sum, r) => (sum === null || r.cost === null ? null : sum + r.cost), 0);

/** Token spend, sliced the four ways the page shows it: total, per route, per day, per user. */
async function tokenStats(db) {
  const byModelRows = await db
    .prepare(
      `SELECT model, SUM(calls) AS calls, SUM(input_tokens) AS input_tokens,
              SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
         FROM ai_tokens GROUP BY model`
    )
    .all();
  const byModel = (byModelRows.results || []).map((r) => ({ model: r.model, ...tokenRow(r) }));

  const byRouteRows = await db
    .prepare(
      `SELECT route, model, SUM(calls) AS calls, SUM(input_tokens) AS input_tokens,
              SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
         FROM ai_tokens GROUP BY route, model
        ORDER BY SUM(input_tokens) + SUM(output_tokens) DESC`
    )
    .all();
  const byRoute = (byRouteRows.results || []).map((r) => ({ route: r.route, model: r.model, ...tokenRow(r) }));

  const dailyRows = await db
    .prepare(
      `SELECT day, model, SUM(calls) AS calls, SUM(input_tokens) AS input_tokens,
              SUM(output_tokens) AS output_tokens, SUM(reasoning_tokens) AS reasoning_tokens
         FROM ai_tokens WHERE day >= ? GROUP BY day, model ORDER BY day`
    )
    .bind(daysAgo(SERIES_DAYS - 1))
    .all();
  // One entry per day even when two models ran on it.
  const perDay = new Map();
  for (const r of dailyRows.results || []) {
    const cell = tokenRow(r);
    const prev = perDay.get(r.day);
    perDay.set(
      r.day,
      prev
        ? {
            calls: prev.calls + cell.calls,
            input: prev.input + cell.input,
            output: prev.output + cell.output,
            total: prev.total + cell.total,
            cost: prev.cost === null || cell.cost === null ? null : prev.cost + cell.cost,
          }
        : { calls: cell.calls, input: cell.input, output: cell.output, total: cell.total, cost: cell.cost }
    );
  }
  const daily = fillDays(
    Array.from(perDay, ([day, v]) => ({ day, ...v })),
    (r) => ({ calls: r.calls, input: r.input, output: r.output, total: r.total, cost: r.cost }),
    { calls: 0, input: 0, output: 0, total: 0, cost: 0 }
  );

  const topRows = await db
    .prepare(
      `SELECT t.user_id, u.email, u.name, t.model,
              SUM(t.calls) AS calls, SUM(t.input_tokens) AS input_tokens,
              SUM(t.output_tokens) AS output_tokens, SUM(t.reasoning_tokens) AS reasoning_tokens
         FROM ai_tokens t JOIN users u ON u.id = t.user_id
        GROUP BY t.user_id, t.model
        ORDER BY SUM(t.input_tokens) + SUM(t.output_tokens) DESC
        LIMIT 10`
    )
    .all();
  const topUsers = (topRows.results || []).map((r) => ({
    who: r.email || r.name || "Anonym",
    model: r.model,
    ...tokenRow(r),
  }));

  const totals = byModel.reduce(
    (a, m) => ({
      calls: a.calls + m.calls,
      input: a.input + m.input,
      output: a.output + m.output,
      reasoning: a.reasoning + m.reasoning,
      total: a.total + m.total,
    }),
    { calls: 0, input: 0, output: 0, reasoning: 0, total: 0 }
  );

  return { ...totals, cost: foldCost(byModel), byModel, byRoute, daily, topUsers, pricing: PRICING };
}

/** Conversations: how many were scored, how well, and on which scenario. */
export async function conversationStats(db) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total, AVG(score) AS avg,
              SUM(CASE WHEN substr(created_at, 1, 10) =  ? THEN 1 ELSE 0 END) AS today,
              SUM(CASE WHEN substr(created_at, 1, 10) >= ? THEN 1 ELSE 0 END) AS last_7d
         FROM sessions`
    )
    .bind(today(), daysAgo(6))
    .first();

  const { results } = await db
    .prepare(
      `SELECT scenario_id, COUNT(*) AS plays, COUNT(DISTINCT user_id) AS users,
              AVG(score) AS avg, MAX(score) AS best, MAX(created_at) AS last_at
         FROM sessions GROUP BY scenario_id ORDER BY plays DESC`
    )
    .all();

  return {
    total: n(row?.total),
    today: n(row?.today),
    last7d: n(row?.last_7d),
    avg: row?.avg == null ? null : Math.round(row.avg),
    byScenario: (results || []).map((r) => ({
      scenarioId: r.scenario_id,
      plays: n(r.plays),
      users: n(r.users),
      avg: Math.round(n(r.avg)),
      best: n(r.best),
      lastAt: r.last_at,
    })),
  };
}

export async function overview(db) {
  return {
    users: await userStats(db),
    visits: await visitStats(db),
    tokens: await tokenStats(db),
    conversations: await conversationStats(db),
    seriesDays: SERIES_DAYS,
  };
}

/**
 * The people list.
 *
 * Three correlated subqueries per row, which is the wrong shape at a hundred thousand
 * users and the right one at the size this app is: the alternative is three more round
 * trips to D1 and a join in JavaScript.
 */
export async function userList(db, limit = 100) {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.created_at, u.last_seen_at,
              (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS plays,
              (SELECT COALESCE(SUM(hits), 0) FROM visits v WHERE v.user_id = u.id) AS visits,
              (SELECT COALESCE(SUM(input_tokens + output_tokens), 0) FROM ai_tokens t WHERE t.user_id = u.id) AS tokens
         FROM users u
        ORDER BY u.last_seen_at DESC
        LIMIT ?`
    )
    .bind(limit)
    .all();
  return (results || []).map((r) => ({
    email: r.email,
    name: r.name,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    plays: n(r.plays),
    visits: n(r.visits),
    tokens: n(r.tokens),
  }));
}

/** The admin allow list: the table, plus the entries the environment pins. */
export async function adminList(db) {
  const { results } = await db
    .prepare("SELECT email, added_by, created_at FROM admins ORDER BY created_at")
    .all();
  const pinned = bootstrapAdmins();
  const fromTable = (results || [])
    .filter((r) => !pinned.includes(r.email))
    .map((r) => ({ email: r.email, addedBy: r.added_by, createdAt: r.created_at, source: "database" }));
  return [...pinned.map((email) => ({ email, addedBy: null, createdAt: null, source: "env" })), ...fromTable];
}

/**
 * Every challenge, with the prompts it actually runs on and the scoring it is graded by.
 *
 * `chatPrompt` and `evalPrompt` are produced by the same functions the routes call, not
 * rebuilt here, so this page cannot show a prompt the app does not send.
 */
export function challenges(stats = []) {
  const plays = new Map(stats.map((s) => [s.scenarioId, s]));
  return scenarios.map((s) => {
    const targetPool = Math.min(TARGET_SAMPLE, (s.vocab?.length || 0) + (s.phrases?.length || 0)) || 1;
    return {
      id: s.id,
      title: s.title,
      level: s.level,
      category: s.category,
      locked: Boolean(s.locked),
      model: MODEL,
      goal: s.goal,
      tasks: s.tasks || [],
      chatPrompt: chatSystem(s),
      evalPrompt: evalSystem(s),
      evalUserPrompt: evalPrompt([
        { role: "user", content: "<student turn>" },
        { role: "assistant", content: "<partner turn>" },
      ]),
      // What this scenario's own numbers do to the shared formula.
      scoring: {
        taskCount: (s.tasks || []).length,
        taskStep: (s.tasks || []).length
          ? Math.round((WEIGHTS.tasks / (2 * (s.tasks || []).length)) * 10) / 10
          : null,
        targetPool,
        targetCandidates: [...(s.vocab || []).map((v) => v.de), ...(s.phrases || []).map((p) => p.de)],
        pointsPerTarget: Math.round((8 / targetPool) * 10) / 10,
      },
      stats: plays.get(s.id) || null,
    };
  });
}

/** The parts of the grading method that are the same for every challenge. */
export const methodology = () => ({
  model: MODEL,
  weights: WEIGHTS,
  rules: SCORING_RULES,
  matching: MATCHING_RULES,
  targetSample: TARGET_SAMPLE,
  minMeaningfulTurns: MIN_MEANINGFUL_TURNS,
  // The field descriptions are the rubric the examiner model is handed, verbatim.
  schema: Object.entries(EVAL_SCHEMA.properties).map(([field, def]) => ({
    field,
    type: def.type,
    range: def.minimum != null ? `${def.minimum}-${def.maximum}` : def.maxItems ? `max ${def.maxItems}` : "",
    description: def.description || "",
  })),
});

export async function conversationList(db, { limit = 25, before = null, scenarioId = null } = {}) {
  const binds = [];
  const where = [];
  if (before) {
    where.push("s.created_at < ?");
    binds.push(before);
  }
  if (scenarioId) {
    where.push("s.scenario_id = ?");
    binds.push(scenarioId);
  }
  const { results } = await db
    .prepare(
      `SELECT s.id, s.scenario_id, s.title, s.score, s.created_at, u.email, u.name
         FROM sessions s JOIN users u ON u.id = s.user_id
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY s.created_at DESC
        LIMIT ?`
    )
    .bind(...binds, limit)
    .all();
  const rows = results || [];
  return {
    conversations: rows.map((r) => ({
      id: r.id,
      scenarioId: r.scenario_id,
      title: r.title,
      score: r.score,
      createdAt: r.created_at,
      who: r.email || r.name || "Anonym",
    })),
    nextCursor: rows.length === limit ? rows[rows.length - 1].created_at : null,
  };
}

/** One conversation in full. No user_id filter: reading anyone's is the point of the page. */
export async function conversation(db, id) {
  if (!Number.isInteger(id)) return null;
  const r = await db
    .prepare(
      `SELECT s.id, s.scenario_id, s.title, s.score, s.transcript, s.evaluation, s.created_at,
              u.email, u.name
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`
    )
    .bind(id)
    .first();
  if (!r) return null;
  return {
    id: r.id,
    scenarioId: r.scenario_id,
    title: r.title,
    score: r.score,
    createdAt: r.created_at,
    who: r.email || r.name || "Anonym",
    transcript: JSON.parse(r.transcript),
    evaluation: JSON.parse(r.evaluation),
  };
}
