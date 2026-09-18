// Runnable check for the history endpoint's pure parts: the query clamps and the
// stats fold, which is the one place an average can quietly go wrong.
// node app/history.selftest.mjs
import assert from "node:assert";
import { parseListQuery, foldStats, HISTORY_PAGE, HISTORY_MAX } from "./history.js";

const q = (s) => parseListQuery(new URLSearchParams(s));

// --- query parsing ---
assert.deepEqual(q(""), { limit: HISTORY_PAGE, before: null, scenarioId: null }, "defaults");
assert.equal(q("limit=999").limit, HISTORY_MAX, "limit clamps down to the maximum");
assert.equal(q("limit=0").limit, 1, "limit clamps up to one row");
assert.equal(q("limit=-5").limit, 1, "a negative limit clamps up too");
assert.equal(q("limit=abc").limit, HISTORY_PAGE, "a non-numeric limit falls back to the default");
assert.equal(q("limit=7").limit, 7, "a sane limit survives");
assert.equal(q("before=2026-09-10T10:00:00.000Z").before, "2026-09-10T10:00:00.000Z", "cursor passes through");

// An unknown scenario is ignored rather than refused, exactly as /api/leaderboard does it.
assert.equal(q("scenarioId=fahrkarte").scenarioId, "fahrkarte", "a known scenario survives");
assert.equal(q("scenarioId=nope").scenarioId, null, "an unknown scenario becomes no filter");

// --- stats ---
assert.deepEqual(
  foldStats([]),
  { plays: 0, best: null, avg: null, perScenario: [] },
  "no sessions yet is empty, not NaN"
);
assert.deepEqual(foldStats(null), { plays: 0, best: null, avg: null, perScenario: [] }, "null rows survive");

// Deliberately asymmetric: 1 run at 100 and 3 runs averaging 60 is 70 overall, not 80.
const rows = [
  { scenario_id: "fahrkarte", title: "Fahrkarte kaufen", plays: 1, best: 100, total_score: 100, last_at: "2026-09-17T19:04:11.512Z" },
  { scenario_id: "arzt", title: "Beim Arzt", plays: 3, best: 70, total_score: 180, last_at: "2026-09-18T08:00:00.000Z" },
];
const stats = foldStats(rows);
assert.equal(stats.plays, 4, "plays are summed");
assert.equal(stats.best, 100, "best is the highest of the bests");
assert.equal(stats.avg, 70, "the overall average comes from the summed scores");
assert.equal(stats.perScenario[0].scenarioId, "arzt", "most recently played first");
assert.equal(stats.perScenario[0].avg, 60, "per-scenario average");

// A scenario that no longer exists in scenarios.js keeps the title stored with the session.
const gone = foldStats([
  { scenario_id: "abgeschafft", title: "Altes Szenario", plays: 2, best: 80, total_score: 140, last_at: "2026-01-01T00:00:00.000Z" },
]);
assert.equal(gone.perScenario[0].title, "Altes Szenario", "removed scenario falls back to the stored title");
assert.equal(
  foldStats([{ scenario_id: "fahrkarte", title: "Alter Name", plays: 1, best: 80, total_score: 80, last_at: "x" }])
    .perScenario[0].title,
  "Fahrkarte kaufen",
  "a renamed scenario shows its current name"
);

console.log("history self-check passed");
console.log("  overall:", { plays: stats.plays, best: stats.best, avg: stats.avg });
console.log("  per scenario:", stats.perScenario.map((s) => `${s.title}: ${s.plays}x, best ${s.best}, avg ${s.avg}`));
