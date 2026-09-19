"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { scenarios } from "../scenarios";
import { scenarioTitle } from "../history";

// The owner's dashboard: who is using the app, what the AI calls cost, who may see this
// page, and the prompts and scoring behind every challenge.
//
// Its own route, not a screen of app/page.js. The learner app is one page of state-driven
// screens on purpose; this shares none of that state, and keeping it apart means none of
// these tables, and no cross-user data, ships in the bundle a learner downloads.
//
// The copy here is English while the learner app is German: this is an internal tool, and
// the methodology it reports (the examiner prompt, the schema, the rules) is English
// already, so translating the labels around it would only add a second vocabulary.
//
// Nothing here is trusted: /api/admin re-checks the allow list on every request. A visitor
// who forces this page open sees the shell and a 403.

const VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "tokens", label: "Tokens" },
  { key: "users", label: "Users" },
  { key: "challenges", label: "Challenges" },
  { key: "conversations", label: "Conversations" },
];

// The two data views share one endpoint, so the tab is not always the query.
const SOURCE = { overview: "overview", tokens: "overview", users: "users", challenges: "challenges" };

async function api(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Server ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const int = (n) => (n == null ? "-" : Number(n).toLocaleString("en-US"));
const money = (n) => (n == null ? "n/a" : `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`);
// Day and minute. Seconds are never the reason anyone reads one of these tables, and
// they are what pushes the column wide enough to collide with the next one.
const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "-";
const plural = (n, one, many = `${one}s`) => `${int(n)} ${Number(n) === 1 ? one : many}`;
const dayLabel = (day) => day.slice(8) + "." + day.slice(5, 7);
const scoreClass = (n) => (n >= 80 ? "good" : n >= 60 ? "ok" : "low");

// Challenge names come from scenarios.js, the same source the learner app reads, so a
// renamed challenge is renamed here too; a scenario since deleted falls back to its id.
const SCENARIO_IDS = scenarios.map((s) => s.id);
const titleOf = (id, stored) => scenarioTitle(id, stored);

// A compact token count: 1.2M reads faster than 1,203,455 in a tile, and the exact
// figure is one hover away in the daily chart and in the per-route table.
const short = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${Math.round(v / 1e3)}k`;
  return v.toLocaleString("en-US");
};

function Stat({ label, value, sub }) {
  return (
    <div className="a-stat">
      <div className="a-stat-num">{value}</div>
      <div className="a-stat-label">{label}</div>
      {sub && <div className="a-stat-sub">{sub}</div>}
    </div>
  );
}

/**
 * One series of daily bars.
 *
 * One measure, one hue, one axis. The exact value of every day is on hover and the
 * highest is named in the header, rather than a number printed over every bar; a day with
 * no traffic draws no bar, which is what the baseline is for.
 */
function Bars({ title, data, pick, format = int, unit = "" }) {
  const values = data.map(pick);
  const max = Math.max(...values, 1);
  const peakAt = values.indexOf(Math.max(...values));
  const peak = values[peakAt];

  return (
    <div className="a-chart">
      <div className="a-chart-head">
        <span className="brief-label">{title}</span>
        <span className="a-chart-peak">
          {peak > 0 ? `peak ${format(peak)}${unit} on ${dayLabel(data[peakAt].day)}` : "no activity yet"}
        </span>
      </div>
      <div className="a-chart-plot">
        {data.map((d, i) => (
          <div className="a-chart-col" key={d.day}>
            <div className="a-chart-bar" style={{ height: `${(values[i] / max) * 100}%` }} />
            <span className="a-chart-tip">
              {dayLabel(d.day)}: {format(values[i])}
              {unit}
            </span>
          </div>
        ))}
      </div>
      <div className="a-chart-axis">
        <span>{dayLabel(data[0].day)}</span>
        <span>{dayLabel(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}

function Table({ head, rows, empty = "Nothing recorded yet." }) {
  if (!rows.length) return <p className="a-empty">{empty}</p>;
  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h.key} className={h.num ? "num" : ""}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {head.map((h) => (
                <td key={h.key} className={h.num ? "num" : ""}>
                  {h.render ? h.render(r) : r[h.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Overview({ data }) {
  const { users, visits, conversations, tokens, seriesDays } = data;
  return (
    <>
      <div className="a-stats">
        <Stat label="Page opens" value={int(visits.hits)} sub={`${int(visits.hitsToday)} today`} />
        <Stat label="People who opened it" value={int(visits.users)} sub={`${int(visits.usersToday)} today`} />
        <Stat label="User records" value={int(users.total)} sub={`${int(users.withEmail)} signed in, ${int(users.anonymous)} anonymous`} />
        <Stat label="Active last 7 days" value={int(users.active7d)} sub={`${int(users.new7d)} new`} />
        <Stat label="Conversations scored" value={int(conversations.total)} sub={conversations.avg == null ? "no scores yet" : `avg score ${conversations.avg}`} />
        <Stat
          label="Estimated AI cost"
          value={money(tokens.cost)}
          sub={tokens.cost == null ? "a model used has no price on file" : plural(tokens.calls, "call")}
        />
      </div>

      <div className="a-charts">
        <Bars title={`Page opens, last ${seriesDays} days`} data={visits.daily} pick={(d) => d.hits} />
        <Bars title={`Distinct people, last ${seriesDays} days`} data={visits.daily} pick={(d) => d.users} />
      </div>

      <div className="panel">
        <div className="brief-label">Conversations by challenge</div>
        <Table
          head={[
            { key: "scenarioId", label: "Challenge", render: (r) => titleOf(r.scenarioId) },
            { key: "plays", label: "Plays", num: true, render: (r) => int(r.plays) },
            { key: "users", label: "People", num: true, render: (r) => int(r.users) },
            { key: "avg", label: "Avg score", num: true },
            { key: "best", label: "Best", num: true },
            { key: "lastAt", label: "Last", render: (r) => when(r.lastAt) },
          ]}
          rows={conversations.byScenario}
          empty="No conversation has been scored yet."
        />
      </div>

      <p className="a-note">
        A page open is one call to /api/me, which the app makes once per load. &quot;User records&quot; counts
        rows in the users table: a browser gets one before anyone signs in, so it is an upper bound on
        people, not a headcount.
      </p>
    </>
  );
}

function Tokens({ data }) {
  const { tokens, seriesDays } = data;
  const rate = Object.entries(tokens.pricing || {});
  return (
    <>
      <div className="a-stats">
        <Stat label="Total tokens" value={short(tokens.total)} sub={`${int(tokens.total)} exactly`} />
        <Stat label="Input" value={short(tokens.input)} />
        <Stat label="Output" value={short(tokens.output)} sub={`${short(tokens.reasoning)} of it reasoning`} />
        <Stat label="AI calls" value={int(tokens.calls)} />
        <Stat
          label="Estimated cost"
          value={money(tokens.cost)}
          sub={tokens.cost == null ? "a model used has no price on file" : "at the rates below"}
        />
      </div>

      <div className="a-charts">
        <Bars title={`Tokens per day, last ${seriesDays} days`} data={tokens.daily} pick={(d) => d.total} format={short} />
        <Bars title={`AI calls per day, last ${seriesDays} days`} data={tokens.daily} pick={(d) => d.calls} />
      </div>

      <div className="panel">
        <div className="brief-label">By route</div>
        <Table
          head={[
            { key: "route", label: "Route", render: (r) => `/api/${r.route}` },
            { key: "model", label: "Model" },
            { key: "calls", label: "Calls", num: true, render: (r) => int(r.calls) },
            { key: "input", label: "Input", num: true, render: (r) => int(r.input) },
            { key: "output", label: "Output", num: true, render: (r) => int(r.output) },
            { key: "total", label: "Total", num: true, render: (r) => int(r.total) },
            { key: "cost", label: "Est. cost", num: true, render: (r) => money(r.cost) },
          ]}
          rows={tokens.byRoute}
          empty="No AI call has been recorded yet."
        />
      </div>

      <div className="panel">
        <div className="brief-label">Heaviest users</div>
        <Table
          head={[
            { key: "who", label: "User" },
            { key: "model", label: "Model" },
            { key: "calls", label: "Calls", num: true, render: (r) => int(r.calls) },
            { key: "total", label: "Tokens", num: true, render: (r) => int(r.total) },
            { key: "cost", label: "Est. cost", num: true, render: (r) => money(r.cost) },
          ]}
          rows={tokens.topUsers}
        />
      </div>

      <div className="panel">
        <div className="brief-label">Rate card</div>
        <Table
          head={[
            { key: "model", label: "Model" },
            { key: "input", label: "Input, $ per 1M", num: true },
            { key: "output", label: "Output, $ per 1M", num: true },
          ]}
          rows={rate.map(([model, r]) => ({ model, input: r.input, output: r.output }))}
        />
        <p className="a-note">
          Every cost on this page is an estimate from this table, not a bill. The provider does not
          report prices over the API, so the rates are written down in app/ai.js and go stale the day
          the provider changes them. Reasoning tokens are part of output and are not charged twice.
        </p>
      </div>
    </>
  );
}

function Users({ data, onAdd, onRemove, busy, notice }) {
  const [email, setEmail] = useState("");

  return (
    <>
      <div className="panel">
        <div className="brief-label">Who can open this page</div>
        <form
          className="a-add"
          onSubmit={(e) => {
            e.preventDefault();
            const value = email.trim();
            if (!value) return;
            onAdd(value).then((ok) => ok && setEmail(""));
          }}
        >
          <input
            className="a-input"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !email.trim()}>
            Grant access
          </button>
        </form>
        {notice && <p className="a-note">{notice}</p>}
        <Table
          head={[
            { key: "email", label: "Email" },
            { key: "source", label: "Source", render: (r) => (r.source === "env" ? "ADMIN_EMAILS" : "added here") },
            { key: "addedBy", label: "Added by", render: (r) => r.addedBy || "-" },
            { key: "createdAt", label: "Added", render: (r) => when(r.createdAt) },
            {
              key: "remove",
              label: "",
              render: (r) =>
                r.source === "env" ? (
                  <span className="a-muted">pinned</span>
                ) : (
                  <button className="btn btn-ghost" onClick={() => onRemove(r.email)} disabled={busy}>
                    Remove
                  </button>
                ),
            },
          ]}
          rows={data.admins}
          empty="Only the addresses in ADMIN_EMAILS have access."
        />
        <p className="a-note">
          Access is matched on the Google account email at the moment of the request, so an address can
          be added before that person has ever opened the app. Addresses from ADMIN_EMAILS cannot be
          removed here: they live in the environment and are the way back in if this list is emptied.
        </p>
      </div>

      <div className="panel">
        <div className="brief-label">Users, most recently seen first</div>
        <Table
          head={[
            { key: "email", label: "Email", render: (r) => r.email || <span className="a-muted">anonymous</span> },
            { key: "name", label: "Name", render: (r) => r.name || "-" },
            { key: "visits", label: "Opens", num: true, render: (r) => int(r.visits) },
            { key: "plays", label: "Conversations", num: true, render: (r) => int(r.plays) },
            { key: "tokens", label: "Tokens", num: true, render: (r) => int(r.tokens) },
            { key: "createdAt", label: "First seen", render: (r) => when(r.createdAt) },
            { key: "lastSeenAt", label: "Last seen", render: (r) => when(r.lastSeenAt) },
          ]}
          rows={data.users}
        />
        <p className="a-note">Showing at most {data.limit} rows.</p>
      </div>
    </>
  );
}

function Challenges({ data }) {
  const [open, setOpen] = useState(data.challenges[0]?.id || null);
  const m = data.methodology;

  return (
    <>
      <div className="panel">
        <div className="brief-label">How every challenge is scored</div>
        <p className="a-lead">
          The model is never asked for a score. It reports observations, and the 0-100 comes out of
          fixed weights on the server (app/scoring.js), so a client cannot send one in and two
          equivalent conversations get equivalent numbers.
        </p>
        <Table
          head={[
            { key: "label", label: "Part" },
            { key: "weight", label: "Points", num: true, render: (r) => m.weights[r.key] },
            { key: "source", label: "Comes from" },
            { key: "formula", label: "Formula", render: (r) => <code className="a-code">{r.formula}</code> },
            { key: "why", label: "Why" },
          ]}
          rows={m.rules}
        />
        <div className="a-sub">
          <div className="brief-label">Matching target words</div>
          <ul className="brief-tasks">
            {m.matching.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="a-sub">
          <div className="brief-label">What the examiner must return</div>
          <Table
            head={[
              { key: "field", label: "Field", render: (r) => <code className="a-code">{r.field}</code> },
              { key: "type", label: "Type" },
              { key: "range", label: "Range" },
              { key: "description", label: "Description shown to the model" },
            ]}
            rows={m.schema}
          />
        </div>
        <p className="a-note">
          Model: {m.model}. Interaction is capped in proportion to student turns below{" "}
          {m.minMeaningfulTurns}, and at most {m.targetSample} target words can earn the measured part
          of the vocabulary score.
        </p>
      </div>

      {data.challenges.map((c) => (
        <div className="panel a-challenge" key={c.id}>
          <button className="a-challenge-head" onClick={() => setOpen(open === c.id ? null : c.id)}>
            <span className="a-challenge-title">{c.title}</span>
            <span className={`level level-${(c.level || "A")[0]}`}>{c.level}</span>
            {c.locked && <span className="a-muted">locked</span>}
            <span className="a-challenge-meta">
              {c.stats ? `${plural(c.stats.plays, "play")}, avg ${c.stats.avg}` : "never played"}
            </span>
            <span className="a-chevron">{open === c.id ? "Hide" : "Show"}</span>
          </button>

          {open === c.id && (
            <div className="a-challenge-body">
              <div className="a-sub">
                <div className="brief-label">Conversation system prompt (/api/chat)</div>
                <pre className="a-pre">{c.chatPrompt}</pre>
              </div>
              <div className="a-sub">
                <div className="brief-label">Examiner system prompt (/api/feedback)</div>
                <pre className="a-pre">{c.evalPrompt}</pre>
              </div>
              <div className="a-sub">
                <div className="brief-label">Examiner user prompt, with the transcript filled in</div>
                <pre className="a-pre">{c.evalUserPrompt}</pre>
              </div>
              <div className="a-sub">
                <div className="brief-label">What the weights mean for this challenge</div>
                <ul className="brief-tasks">
                  <li>
                    {c.scoring.taskCount
                      ? `${c.scoring.taskCount} tasks, so each 0-2 step of a task is worth ${c.scoring.taskStep} points.`
                      : "No tasks, so the 20 task points are awarded in full."}
                  </li>
                  <li>
                    {c.scoring.targetPool} target words count toward the measured part of vocabulary,{" "}
                    {c.scoring.pointsPerTarget} points each, out of {c.scoring.targetCandidates.length} the
                    briefing offers.
                  </li>
                  <li>Model: {c.model}.</li>
                </ul>
                <div className="a-chips">
                  {c.scoring.targetCandidates.map((t, i) => (
                    <span className="a-chip" key={`${i}-${t}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function Conversations({ state, onFilter, onMore, onOpen, onClose, busy }) {
  const open = state.open;

  if (open) {
    return (
      <div className="panel">
        <button className="btn btn-ghost" onClick={onClose}>
          Back to the list
        </button>
        <div className="a-conv-head">
          <div>
            <div className="a-challenge-title">{titleOf(open.scenarioId, open.title)}</div>
            <div className="a-muted">
              {open.who} - {when(open.createdAt)}
            </div>
          </div>
          <div className={`score-badge score-${scoreClass(open.score)}`}>{open.score}</div>
        </div>

        <div className="a-sub">
          <div className="brief-label">Transcript</div>
          <div className="chat">
            {open.transcript.map((msg, i) => (
              <div className={`bubble ${msg.role}`} key={i}>
                {msg.content}
              </div>
            ))}
          </div>
        </div>

        <div className="a-sub">
          <div className="brief-label">What the examiner returned</div>
          <pre className="a-pre">{JSON.stringify(open.evaluation, null, 2)}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="a-filter">
        <span className="brief-label">Conversations</span>
        <select className="a-input" value={state.scenarioId || ""} onChange={(e) => onFilter(e.target.value || null)}>
          <option value="">Every challenge</option>
          {SCENARIO_IDS.map((id) => (
            <option key={id} value={id}>
              {titleOf(id)}
            </option>
          ))}
        </select>
      </div>
      <Table
        head={[
          { key: "createdAt", label: "When", render: (r) => when(r.createdAt) },
          { key: "who", label: "User" },
          { key: "title", label: "Challenge", render: (r) => titleOf(r.scenarioId, r.title) },
          { key: "score", label: "Score", num: true },
          {
            key: "open",
            label: "",
            render: (r) => (
              <button className="btn btn-ghost" onClick={() => onOpen(r.id)}>
                Read
              </button>
            ),
          },
        ]}
        rows={state.conversations}
        empty="No conversation has been scored yet."
      />
      {state.nextCursor && (
        <div className="btn-row">
          <button className="btn" onClick={onMore} disabled={busy}>
            Load more
          </button>
        </div>
      )}
      <p className="a-note">
        These are other people&apos;s practice conversations, stored so they can review their own
        history. Read them to debug a prompt or a score, not out of curiosity.
      </p>
    </div>
  );
}

export default function Admin() {
  const { status } = useSession();
  const [view, setView] = useState("overview");
  const [cache, setCache] = useState({}); // one entry per source: overview | users | challenges
  const [convo, setConvo] = useState({ conversations: [], nextCursor: null, scenarioId: null, open: null, loaded: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(null); // 401 | 403, the two that are not bugs
  const [notice, setNotice] = useState("");

  const source = SOURCE[view];

  // Each tab fetches once and is then served from `cache`, so paging back and forth does
  // not re-run the aggregates. A write to the allow list refreshes only its own entry.
  useEffect(() => {
    if (!source || cache[source]) return;
    let alive = true;
    setBusy(true);
    api(`/api/admin?view=${source}`)
      .then((d) => alive && setCache((c) => ({ ...c, [source]: d })))
      .catch((e) => {
        if (!alive) return;
        if (e.status === 401 || e.status === 403) setDenied(e.status);
        else setError(e.message);
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [source, cache]);

  // The conversation list is not in `cache`: it pages and filters, so it owns its state.
  useEffect(() => {
    if (view !== "conversations" || convo.loaded) return;
    let alive = true;
    setBusy(true);
    api(`/api/admin?view=conversations${convo.scenarioId ? `&scenarioId=${convo.scenarioId}` : ""}`)
      .then((d) => alive && setConvo((s) => ({ ...s, conversations: d.conversations, nextCursor: d.nextCursor, loaded: true })))
      .catch((e) => {
        if (!alive) return;
        if (e.status === 401 || e.status === 403) setDenied(e.status);
        else setError(e.message);
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [view, convo.scenarioId, convo.loaded]);

  async function addAdmin(email) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const d = await api("/api/admin/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setCache((c) => ({ ...c, users: { ...c.users, admins: d.admins } }));
      setNotice(`${d.added} can open this page from their next sign-in.`);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeAdmin(email) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const d = await api(`/api/admin/admins?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      setCache((c) => ({ ...c, users: { ...c.users, admins: d.admins } }));
      setNotice(`${d.removed} no longer has access.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function moreConversations() {
    if (!convo.nextCursor || busy) return;
    setBusy(true);
    try {
      const d = await api(
        `/api/admin?view=conversations&before=${encodeURIComponent(convo.nextCursor)}` +
          (convo.scenarioId ? `&scenarioId=${convo.scenarioId}` : "")
      );
      setConvo((s) => ({ ...s, conversations: [...s.conversations, ...d.conversations], nextCursor: d.nextCursor }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function openConversation(id) {
    setBusy(true);
    setError("");
    try {
      const d = await api(`/api/admin?view=conversations&id=${id}`);
      setConvo((s) => ({ ...s, open: d.conversation }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const topbar = (
    <header className="topbar">
      <div className="a-topbar">
        <div className="brand">
          RolePartner <span className="brand-tag">Admin</span>
        </div>
        <nav className="nav">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              className={`nav-item ${view === v.key ? "active" : ""}`}
              onClick={() => {
                setView(v.key);
                setError("");
                setNotice("");
              }}
            >
              {v.label}
            </button>
          ))}
        </nav>
        <Link className="nav-item a-back" href="/">
          Back to the app
        </Link>
      </div>
    </header>
  );

  if (denied) {
    return (
      <div className="app">
        {topbar}
        <main className="container a-main narrow">
          <div className="panel">
            {denied === 401 ? (
              <>
                <div className="brief-label">Not signed in</div>
                <p>This page needs a Google account, because an email is the only identity the app can verify.</p>
                <div className="btn-row">
                  <button className="btn btn-primary" onClick={() => signIn("google")} disabled={status === "loading"}>
                    Sign in
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="brief-label">No access</div>
                <p>
                  This account is not on the admin list. Someone already on it can add the address, or it
                  can be set in ADMIN_EMAILS.
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  const data = cache[source];

  return (
    <div className="app">
      {topbar}
      <main className="container a-main">
        {error && <p className="error">{error}</p>}
        {!data && view !== "conversations" && <p className="a-empty">Loading.</p>}

        {view === "overview" && data && <Overview data={data} />}
        {view === "tokens" && data && <Tokens data={data} />}
        {view === "users" && data && (
          <Users data={data} onAdd={addAdmin} onRemove={removeAdmin} busy={busy} notice={notice} />
        )}
        {view === "challenges" && data && <Challenges data={data} />}
        {view === "conversations" && (
          <Conversations
            state={convo}
            busy={busy}
            onFilter={(scenarioId) => setConvo({ conversations: [], nextCursor: null, scenarioId, open: null, loaded: false })}
            onMore={moreConversations}
            onOpen={openConversation}
            onClose={() => setConvo((s) => ({ ...s, open: null }))}
          />
        )}
      </main>
    </div>
  );
}
