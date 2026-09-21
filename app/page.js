"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import posthog from "posthog-js";
import { scenarios } from "./scenarios";
import { texts } from "./texts";
import { splitSentences, tokenize, isWord, glossKey } from "./tokenize.mjs";
import { favKey, MASTER_AT } from "./favkey";
import { WEIGHTS } from "./scoring";

// Favorites, transcripts and scores live in D1 (see app/api/favorites, /sessions, /leaderboard).
// favKey is imported rather than defined here so the client and the server always agree on
// what counts as the same item.

// Botão de login/logout Google. Anônimo por padrão; ao logar mostra avatar + sair.
function AuthButton() {
  const { data: session, status } = useSession();
  if (status === "loading") return <div className="avatar" aria-hidden />;
  if (!session)
    return (
      <button className="nav-item" onClick={() => signIn("google")}>
        Anmelden
      </button>
    );
  const src = session.user?.image;
  return (
    <button
      className="avatar-btn"
      title={`${session.user?.name || "Konto"} — abmelden`}
      onClick={async () => {
        // NextAuth clears its own cookie; rp_uid is ours to drop, or the next person on
        // this machine inherits the session's identity.
        await fetch("/api/me", { method: "DELETE" }).catch(() => {});
        // Without this the next person on a shared machine inherits the previous
        // distinct_id, the same problem the rp_uid delete above solves.
        posthog.reset();
        signOut();
      }}
    >
      {src ? <img className="avatar" src={src} alt="" /> : <div className="avatar" aria-hidden />}
    </button>
  );
}

// Full-screen gate shown until a Google session exists. Everything else (identity by email,
// favorites/progress in D1, staying logged in via the JWT cookie) is already handled server-side.
function LoginScreen({ loading }) {
  return (
    <div className="login">
      <div className="login-card">
        <div className="brand login-brand">
          RolePartner <span className="brand-tag">DE</span>
        </div>
        <p className="login-sub">
          Melde dich an, um zu üben. Dein Fortschritt und deine Favoriten bleiben mit deinem Konto verknüpft.
        </p>
        <button className="btn btn-primary login-btn" disabled={loading} onClick={() => signIn("google")}>
          {loading ? "..." : "Mit Google anmelden"}
        </button>
      </div>
    </div>
  );
}

const TYPE_LABEL = { vocab: "Vokabeln", phrase: "Sätze", message: "Nachrichten", keyword: "Texte" };
const favChip = (f) => (f.type && f.type !== "correction" ? TYPE_LABEL[f.type] : f.tag || "Sonstiges");
const favDate = (f) => (f.createdAt ? new Date(f.createdAt).toLocaleString("pt-BR") : "");

// "Learn more" groups favorites into sections by type (legacy no-type = correction).
const GROUP_ORDER = ["correction", "vocab", "phrase", "keyword", "message"];
const GROUP_LABEL = { correction: "Korrekturen", ...TYPE_LABEL };
const groupOf = (f) => (f.type && f.type !== "correction" ? f.type : "correction");

// Posta JSON e devolve o corpo parseado, ou lança uma mensagem limpa (mesmo se a resposta não for JSON).
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server ${res.status}`);
  return data;
}

async function getJSON(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server ${res.status}`);
  return data;
}

async function delJSON(url) {
  const res = await fetch(url, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server ${res.status}`);
  return data;
}

const scoreClass = (n) => (n >= 80 ? "good" : n >= 60 ? "ok" : "low");

// Shared medal thresholds: reused by the feedback goals and the result modal. Ordered high -> low.
const MEDAL_TIERS = [
  { key: "gold", label: "Gold", min: 95 },
  { key: "silver", label: "Silber", min: 85 },
  { key: "bronze", label: "Bronze", min: 75 },
];
const medalFor = (score) => MEDAL_TIERS.find((t) => score >= t.min) || null;
const nextTier = (score) => [...MEDAL_TIERS].reverse().find((t) => score < t.min) || null;

function MedalGoals({ score }) {
  const tiers = [...MEDAL_TIERS].reverse(); // display bronze -> gold
  return (
    <div className="goals">
      {tiers.map((t) => (
        <div key={t.key} className={`goal ${score >= t.min ? "earned" : ""}`}>
          <span className={`medal medal-${t.key}`} />
          <span className="goal-label">{t.label}</span>
          <span className="goal-min">{t.min}+</span>
        </div>
      ))}
    </div>
  );
}

// The mission: the goal and the briefing's tasks, German first with the English blurred
// until asked for. Rendered in the briefing and again during the conversation, because
// the goal is the first thing that slips once the talking starts and scrolling back to
// the intro would mean leaving the chat.
function GoalPanel({ scenario, showEn, onToggleEn, collapsible = false }) {
  const toggle = (
    <button
      className="brief-toggle"
      onClick={(e) => {
        // Inside a <summary> this click would also fold the panel away.
        e.preventDefault();
        e.stopPropagation();
        onToggleEn();
      }}
    >
      {showEn ? "Hide English" : "Show English"}
    </button>
  );

  const body = (
    <>
      <ul className="vocab-list">
        <li className="goal-row">
          <span className="vocab-de">{scenario.goal}</span>
          <span className={`vocab-en ${showEn ? "" : "brief-blur"}`}>{scenario.goalEn}</span>
        </li>
      </ul>
      <div className="brief-label" style={{ marginTop: 16 }}>Üben / Practice</div>
      <ul className="vocab-list">
        {scenario.tasks.map((t, i) => (
          <li key={i}>
            <span className="vocab-de">{t}</span>
            <span className={`vocab-en ${showEn ? "" : "brief-blur"}`}>{scenario.tasksEn[i]}</span>
          </li>
        ))}
      </ul>
    </>
  );

  // During the conversation the transcript is what the screen is for, so the panel can be
  // folded away; in the briefing there is nothing to get out of the way of.
  if (collapsible) {
    return (
      <details className="panel brief-section goal-recall" open>
        <summary className="brief-head">
          <span className="brief-label">Dein Ziel / Goal</span>
          {toggle}
        </summary>
        {body}
      </details>
    );
  }

  return (
    <div className="panel brief-section">
      <div className="brief-head">
        <div className="brief-label">Dein Ziel / Goal</div>
        {toggle}
      </div>
      {body}
    </div>
  );
}

function StarButton({ active, onClick }) {
  return (
    <button className={`star ${active ? "on" : ""}`} onClick={onClick} aria-pressed={active} title="Merken">
      <svg viewBox="0 0 24 24" width="20" height="20" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// The talking partner on the conversation screen (plan_video.md, Tier 0). The art is a flat
// SVG drawn without a mouth; the mouth is this overlay, placed from the scenario's percent
// anchor, so one component serves every illustration. Scenarios without `partner` render
// nothing here — two of them are locked and one has no art yet.
// Decorative on purpose: it carries no information the transcript does not already say, so
// it is hidden from assistive tech rather than announcing a drawing on every turn.
function PartnerStage({ partner, speaking }) {
  if (!partner?.art) return null;
  const { x = 50, y = 50, w = 7 } = partner.mouth || {};
  return (
    <div className={`partner ${speaking ? "speaking" : ""}`} aria-hidden="true">
      <img className="partner-art" src={partner.art} alt="" />
      <span className="partner-mouth" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%` }} />
    </div>
  );
}

function Evaluation({ ev, favorites = [], onToggleFav }) {
  const favKeys = new Set(favorites.map(favKey));
  return (
    <div className="eval">
      <div className={`score-card score-${scoreClass(ev.score)}`}>
        <div className="score-num">{ev.score}<span>/100</span></div>
        <p className="score-summary">{ev.summary}</p>
      </div>

      <MedalGoals score={ev.score} />

      <ScoreBreakdown breakdown={ev.breakdown} />

      {ev.strengths?.length > 0 && (
        <div className="panel eval-sec">
          <div className="brief-label">Das lief gut</div>
          <ul className="brief-tasks">
            {ev.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {ev.corrections?.length > 0 && (
        <div className="panel eval-sec">
          <div className="brief-label">Korrekturen</div>
          <ul className="corr-list">
            {ev.corrections.map((c, i) => {
              const item = { type: "correction", ...c };
              return (
                <li key={i}>
                  <div className="corr-row">
                    <div className="corr-main">
                      <div className="corr-line">
                        <span className="corr-wrong">{c.wrong}</span>
                        <span className="corr-arrow">→</span>
                        <span className="corr-right">{c.right}</span>
                        {c.tag && <span className="corr-tag">{c.tag}</span>}
                      </div>
                      {c.note && <div className="corr-note">{c.note}</div>}
                    </div>
                    {onToggleFav && <StarButton active={favKeys.has(favKey(item))} onClick={() => onToggleFav(item)} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {ev.tip && (
        <div className="panel eval-sec">
          <div className="brief-label">Tipp</div>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{ev.tip}</p>
        </div>
      )}
    </div>
  );
}

// Leaderboard screen: the score of the conversation that just ended, then the global Top 10
// from D1. Sits between the conversation and the evaluation (16.09.2026 flow).
// Before login everyone is "Anonym", so the ranking only gets names once Google auth is on.
// Where the score came from. The server returns the same parts it added up, so this is a
// report of the real calculation, not a second opinion about it.
const BREAKDOWN_LABEL = {
  goal: "Ziel erreicht",
  tasks: "Aufgaben",
  grammar: "Grammatik",
  vocabulary: "Wortschatz",
  interaction: "Interaktion",
};

function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;
  return (
    <div className="panel eval-sec">
      <div className="brief-label">So kommt die Punktzahl zustande</div>
      <div className="metrics">
        {Object.keys(BREAKDOWN_LABEL).map((key) => {
          const got = breakdown[key] || 0;
          const max = WEIGHTS[key];
          return (
            <div className="metric" key={key}>
              <div className="metric-head">
                <span>{BREAKDOWN_LABEL[key]}</span>
                <span className="metric-val">{got}/{max}</span>
              </div>
              <div className="metric-bar">
                <span className="on" style={{ flexGrow: got || 0.001 }} />
                <span style={{ flexGrow: Math.max(max - got, 0.001) }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Leaderboard({ score, board, scenario, loading, onContinue }) {
  const medal = medalFor(score);
  const next = nextTier(score);
  const top = board?.top || [];
  const me = board?.me;
  const inTop = top.some((r) => r.me);

  return (
    <div className="eval">
      <div className={`result-hero score-${scoreClass(score)}`}>
        <span className={`medal medal-${medal ? medal.key : "none"} medal-lg`} />
        <div className="result-tier">{medal ? medal.label : "Keine Medaille"}</div>
        <div className="result-score">{score}<span>/100</span></div>
        {next && (
          <div className="result-next">Noch {next.min - score} Punkte bis {next.label}</div>
        )}
      </div>

      <div className="lb-head">
        <span>Bestenliste{scenario ? ` · ${scenario}` : ""}</span>
        {me?.rank && <span className="lb-rank-badge">Platz {me.rank}</span>}
      </div>

      {loading ? (
        <p className="panel muted">Bestenliste lädt…</p>
      ) : top.length === 0 ? (
        <p className="panel muted">Noch keine Ergebnisse für dieses Szenario.</p>
      ) : (
        <ol className="lb-list">
          {top.map((r) => (
            <li key={r.rank} className={`lb-row ${r.me ? "new" : ""}`}>
              <span className="lb-rank">{r.rank}</span>
              <span className="lb-name">{r.me ? "Du" : r.name}</span>
              <span className="lb-date">{r.plays} {r.plays === 1 ? "Versuch" : "Versuche"}</span>
              <span className={`lb-score score-badge score-${scoreClass(r.score)}`}>{r.score}</span>
            </li>
          ))}
        </ol>
      )}

      {!loading && !inTop && me?.rank && (
        <p className="lb-miss">Diesmal nicht in den Top 10. Dein Bestwert ist {me.best} (Platz {me.rank}).</p>
      )}

      <div className="btn-row">
        <button className="btn btn-primary" onClick={onContinue}>Zur Auswertung</button>
      </div>
    </div>
  );
}

// One saved favorite in the "Learn more" repo. onReview is omitted for the mastered pile.
function FavItem({ f, onReview, onToggle }) {
  const reviews = f.reviews || 0;
  const mastered = reviews >= MASTER_AT;
  const isCorrection = f.type === "correction" || !f.type;
  return (
    <li>
      <div className="corr-row">
        <div className="corr-main">
          {isCorrection ? (
            <>
              <div className="corr-line">
                <span className="corr-wrong">{f.wrong}</span>
                <span className="corr-arrow">→</span>
                <span className="corr-right">{f.right}</span>
                <span className="corr-tag">{f.tag || "Sonstiges"}</span>
              </div>
              {f.note && <div className="corr-note">{f.note}</div>}
            </>
          ) : f.type === "message" ? (
            <div className="fav-text">{f.text}</div>
          ) : (
            <div className="corr-line">
              <span className="fav-de">{f.de}</span>
              <span className="corr-note" style={{ marginTop: 0 }}>{f.en}</span>
            </div>
          )}
          {(f.scenario || f.createdAt) && (
            <div className="fb-date">{[favChip(f), f.scenario, favDate(f)].filter(Boolean).join(" · ")}</div>
          )}
        </div>
        <div className="fav-actions">
          {onReview && !mastered && (
            <button className="btn-review" onClick={() => onReview(f)}>
              Got it ({reviews}/{MASTER_AT})
            </button>
          )}
          <StarButton active onClick={() => onToggle(f)} />
        </div>
      </div>
    </li>
  );
}

// One past conversation in the Verlauf list. The medal dot and the score badge say at a
// glance how the run went; the evaluation behind it is one tap away.
function SessionRow({ s, onOpen }) {
  const medal = medalFor(s.score);
  return (
    <li>
      <button className="fb-item fb-item-btn" onClick={() => onOpen(s)}>
        <div className="fb-head">
          <span className="fb-title">
            <span className={`medal medal-${medal ? medal.key : "none"}`} />
            {s.title}
          </span>
          <span className={`score-badge score-${scoreClass(s.score)}`}>{s.score}</span>
        </div>
        <div className="fb-date">{new Date(s.createdAt).toLocaleString("pt-BR")}</div>
      </button>
    </li>
  );
}

// Verlauf: finished conversations, newest first, with the aggregate on top.
// `data` stays null until the first page lands, and also when that load failed — the
// error banner above already says so, and an empty state there would be a lie.
function HistoryList({ data, busy, anonymous, onOpen, onMore }) {
  if (!data) return busy ? <p className="panel muted">Verlauf lädt…</p> : null;
  const stats = data.stats;
  return (
    <>
      <div className="learn-hero">
        <div className="hero-eyebrow">Deine Gespräche</div>
        <div className="learn-stats">
          <div className="lstat"><span className="lstat-num">{stats?.plays ?? 0}</span> Gespräche</div>
          <div className="lstat"><span className="lstat-num">{stats?.best ?? "-"}</span> Bestwert</div>
          <div className="lstat"><span className="lstat-num">{stats?.avg ?? "-"}</span> Durchschnitt</div>
        </div>
        {stats?.perScenario?.length > 0 && (
          <p className="learn-struggle">
            {stats.perScenario.map((s) => `${s.title}: ${s.plays}x, Bestwert ${s.best}`).join(" · ")}
          </p>
        )}
        {anonymous && (
          <p className="learn-struggle">Ohne Anmeldung wird dein Verlauf nur in diesem Browser gespeichert.</p>
        )}
      </div>

      {data.sessions.length === 0 ? (
        <p className="panel muted">Noch keine Gespräche. Beende eine Übung, um sie hier zu sehen.</p>
      ) : (
        <ul className="fb-list">
          {data.sessions.map((s) => (
            <SessionRow key={s.id} s={s} onOpen={onOpen} />
          ))}
        </ul>
      )}

      {data.nextCursor && (
        <div className="btn-row">
          <button className="btn" onClick={onMore} disabled={busy}>
            {busy ? "…" : "Mehr laden"}
          </button>
        </div>
      )}
    </>
  );
}

// A past conversation reopened from the Verlauf: the stored evaluation rendered by the
// same component as right after the run, so a correction missed back then can still be
// starred, plus the transcript it was judged on.
function SessionDetail({ session, favorites, onToggleFav, onBack }) {
  const favKeys = new Set(favorites.map(favKey));
  return (
    <main className="container narrow">
      <button className="btn-ghost" onClick={onBack}>
        ← Zurück zum Verlauf
      </button>

      <h1 className="title" style={{ marginTop: 16 }}>{session.title}</h1>
      <p className="subtitle" style={{ marginTop: 12 }}>
        {new Date(session.createdAt).toLocaleString("pt-BR")}
      </p>

      {session.pending ? (
        <p className="panel muted" style={{ marginTop: 24 }}>Gespräch lädt…</p>
      ) : (
        <>
          <Evaluation ev={session.evaluation} favorites={favorites} onToggleFav={onToggleFav} />

          <details className="mastered">
            <summary>Gesprächsverlauf</summary>
            <div className="chat">
              {(session.transcript || []).map((m, i) => {
                const item = { type: "message", text: m.content };
                return (
                  <div key={i} className={`bubble ${m.role}`}>
                    {m.content}
                    {m.role === "assistant" && (
                      <StarButton active={favKeys.has(favKey(item))} onClick={() => onToggleFav(item)} />
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        </>
      )}
    </main>
  );
}

// Reading screen: tap glossary words for a translation, listen with sentence-by-sentence highlight.
function TextReader({ text, favKeys, onToggleFav, onBack }) {
  const [playIdx, setPlayIdx] = useState(-1); // global sentence index being spoken (-1 = idle)
  const [rate, setRate] = useState(1);
  const [sel, setSel] = useState(null); // panel content: { kind: "word"|"sentence", de, en, pos?, surface?, loading? }
  const [selId, setSelId] = useState(null); // "gi:ti" of the tapped word (word highlight)
  const [selSent, setSelSent] = useState(-1); // global index of the tapped sentence (sentence highlight)
  const stopRef = useRef(false);
  const reqRef = useRef(0); // guards against a slow translation overwriting a newer tap
  const clickTimer = useRef(null); // single-click waits briefly so a double-click can cancel it

  // Flatten paragraphs -> sentences with a running global index, so playback can highlight one at a time.
  const paras = text.paragraphs.map((p) => splitSentences(p));
  const flat = [];
  paras.forEach((sents) => sents.forEach((s) => flat.push({ s, gi: flat.length })));

  useEffect(() => () => { stopRef.current = true; speechSynthesis.cancel(); }, []);

  function stop() {
    stopRef.current = true;
    speechSynthesis.cancel();
    setPlayIdx(-1);
  }

  // Speak one sentence per utterance and advance on end: reliable sentence highlight without boundary events.
  function playFrom(start) {
    speechSynthesis.cancel();
    stopRef.current = false;
    const speakOne = (i) => {
      if (stopRef.current || i >= flat.length) return setPlayIdx(-1);
      setPlayIdx(i);
      const u = new SpeechSynthesisUtterance(flat[i].s);
      u.lang = "de-DE";
      u.rate = rate;
      u.onend = () => { if (!stopRef.current) speakOne(i + 1); };
      speechSynthesis.speak(u);
    };
    speakOne(start);
  }

  function speakWord(w) {
    speechSynthesis.cancel();
    stopRef.current = true;
    setPlayIdx(-1);
    const u = new SpeechSynthesisUtterance(w);
    u.lang = "de-DE";
    speechSynthesis.speak(u);
  }

  // Tap any word: glossary hit is instant, otherwise ask the translate API (with the sentence as context).
  async function pickWord(tok, sentence, id) {
    const myReq = ++reqRef.current;
    setSelSent(-1);
    setSelId(id);
    const g = text.glossary[glossKey(tok)] || (text.words && text.words[glossKey(tok)]);
    posthog.capture("word_looked_up", {
      text_id: text.id,
      kind: "word",
      in_glossary: Boolean(g),
      word: tok,
    });
    if (g) { setSel({ kind: "word", surface: tok, de: g.lemma, pos: g.pos, en: g.en }); return; }
    setSel({ kind: "word", surface: tok, de: tok, en: "", loading: true });
    try {
      const r = await postJSON("/api/translate", { de: tok, kind: "word", context: sentence });
      if (reqRef.current === myReq) setSel({ kind: "word", surface: tok, de: r.lemma, pos: r.pos, en: r.en });
    } catch {
      if (reqRef.current === myReq) setSel({ kind: "word", surface: tok, de: tok, en: "Übersetzung fehlgeschlagen." });
    }
  }

  // Tap a sentence (anywhere that is not a word): get its meaning from the translate API.
  async function pickSentence(s, gi) {
    const myReq = ++reqRef.current;
    setSelId(null);
    setSelSent(gi);
    const st = text.sentences && text.sentences[s];
    posthog.capture("word_looked_up", { text_id: text.id, kind: "sentence", in_glossary: Boolean(st) });
    if (st) { setSel({ kind: "sentence", surface: s, de: s, en: st }); return; }
    setSel({ kind: "sentence", surface: s, de: s, en: "", loading: true });
    try {
      const r = await postJSON("/api/translate", { de: s, kind: "sentence" });
      if (reqRef.current === myReq) setSel({ kind: "sentence", surface: s, de: s, en: r.en });
    } catch {
      if (reqRef.current === myReq) setSel({ kind: "sentence", surface: s, de: s, en: "Übersetzung fehlgeschlagen." });
    }
  }

  // Single click selects the word; a double click within 250ms cancels it and selects the sentence.
  function clickWord(tok, s, id) {
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => pickWord(tok, s, id), 250);
  }
  function doubleSentence(s, gi) {
    clearTimeout(clickTimer.current);
    pickSentence(s, gi);
  }

  const playing = playIdx >= 0;
  const savedItem = sel && sel.kind === "word" ? { type: "keyword", de: sel.de, en: sel.en, pos: sel.pos, level: text.level } : null;

  let gi = -1; // running sentence index while rendering
  return (
    <main className="container narrow reader">
      <button className="btn-ghost" onClick={() => { stop(); onBack(); }}>
        ← Zurück zu den Texten
      </button>

      <div className="scene-media">
        <img src={text.photo} alt="" />
        <div className="scene-tags">
          <span className="scene-cat">{text.category}</span>
          <span className={`level level-${text.level[0]}`}>{text.level}</span>
        </div>
      </div>

      <h1 className="title" style={{ marginTop: 16 }}>{text.title}</h1>

      <div className="reader-toolbar">
        <button className="btn btn-primary" onClick={() => (playing ? stop() : playFrom(0))}>
          {playing ? "Pause" : "Hören"}
        </button>
        <button className="btn" onClick={() => setRate((r) => (r === 1 ? 1.25 : r === 1.25 ? 0.75 : 1))}>
          {rate}x
        </button>
      </div>

      <div className="reader-body">
        {paras.map((sents, pi) => (
          <p key={pi} className="rpara">
            {sents.map((s, si) => {
              gi += 1;
              const myGi = gi;
              const active = myGi === playIdx;
              return (
                <span
                  key={si}
                  className={`sentence ${active ? "playing" : ""} ${selSent === myGi ? "picked" : ""}`}
                  onDoubleClick={() => doubleSentence(s, myGi)}
                >
                  {tokenize(s).map((tok, ti) => {
                    if (!isWord(tok)) return <span key={ti}>{tok}</span>;
                    const id = `${myGi}:${ti}`;
                    return (
                      <span
                        key={ti}
                        className={`word ${text.glossary[glossKey(tok)] ? "gloss" : ""} ${selId === id ? "sel" : ""}`}
                        onClick={() => clickWord(tok, s, id)}
                      >
                        {tok}
                      </span>
                    );
                  })}{" "}
                </span>
              );
            })}
          </p>
        ))}
      </div>

      {sel && (
        <div className="wordbar">
          <div className="wordbar-main">
            <div className="wordbar-head">
              <span className="wordbar-lemma">{sel.de}</span>
              {sel.pos ? <span className="wordbar-pos">{sel.pos}</span> : null}
            </div>
            <div className="wordbar-en">{sel.loading ? "…" : sel.en}</div>
          </div>
          <button className="wordbar-speak" onClick={() => speakWord(sel.surface)} title="Vorlesen" aria-label="Vorlesen">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
              <path d="M16.5 8.5a5 5 0 010 7" />
            </svg>
          </button>
          {sel.kind === "word" && (
            <StarButton active={favKeys.has(favKey(savedItem))} onClick={() => onToggleFav(savedItem)} />
          )}
          <button className="wordbar-close" onClick={() => { setSel(null); setSelId(null); setSelSent(-1); }} aria-label="Schließen">×</button>
        </div>
      )}
    </main>
  );
}

// ponytail: Web Speech API é nativo mas só confiável no Chrome. Trocar por Realtime API se a voz robótica incomodar.
export default function Home() {
  const { status: authStatus } = useSession(); // "loading" | "authenticated" | "unauthenticated"
  const [scenario, setScenario] = useState(null);
  const [stage, setStage] = useState("intro"); // intro | chat | leaderboard | feedback
  const [showEn, setShowEn] = useState(false); // intro em inglês?
  const [showTr, setShowTr] = useState(false); // mostrar tradução ao lado (oculta por padrão)
  const [showVocabEn, setShowVocabEn] = useState(false);
  const [showPhrasesEn, setShowPhrasesEn] = useState(false);
  const [tab, setTab] = useState("practice"); // main screen: practice | feedback | texts
  const [reviewView, setReviewView] = useState("collection"); // Review tab: collection | history
  const [history, setHistory] = useState(null); // { sessions, stats, nextCursor }; null = not loaded
  const [historyBusy, setHistoryBusy] = useState(false);
  const [openSession, setOpenSession] = useState(null); // a past conversation being read
  const [openText, setOpenText] = useState(null); // currently open reading text
  const [cat, setCat] = useState("Alle"); // scenario category filter
  const [lvl, setLvl] = useState("Alle"); // CEFR level filter
  const [messages, setMessages] = useState([]);
  const [feedback, setFeedback] = useState(null); // evaluation object
  const [board, setBoard] = useState(null); // leaderboard for the conversation that just ended
  const [boardBusy, setBoardBusy] = useState(false);
  const [me, setMe] = useState(null); // { id, email, anonymous, streak } from /api/me
  const [favorites, setFavorites] = useState([]); // favorited items, loaded from D1
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false); // partner voice running; drives the mouth
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const chatStartedAt = useRef(null);
  const historyAsked = useRef(false);

  // One name for the screen, shared by the UI, the analytics and the docs.
  const screen = openSession
    ? "session"
    : openText
    ? "reading"
    : scenario
    ? stage === "chat"
      ? "conversation"
      : stage === "leaderboard"
      ? "leaderboard"
      : stage === "feedback"
      ? "evaluation"
      : "intro"
    : tab === "texts"
    ? "texts"
    : tab === "feedback"
    ? "feedback"
    : "home";

  // Tie the analytics identity to the account once there is one, using the server's
  // pseudonymous id rather than anything that identifies the person.
  useEffect(() => {
    if (me?.analyticsId) posthog.identify(me.analyticsId);
  }, [me?.analyticsId]);

  // The app is a single route, so a pageview says almost nothing. This is the real
  // navigation signal, and registering the screen makes every later event (including
  // autocapture clicks and $pageleave) carry where it happened.
  useEffect(() => {
    posthog.register({ app_screen: screen });
    posthog.capture("screen_viewed", {
      screen,
      scenario_id: scenario?.id ?? null,
      text_id: openText?.id ?? null,
    });
  }, [screen, scenario?.id, openText?.id]);

  // Who am I and what have I saved. Both come from D1; nothing is kept in the browser any more.
  // Only fires once signed in: the app is gated below, so there is no anonymous bootstrap.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let alive = true;
    (async () => {
      try {
        // Sequential on purpose: the first call is what mints the anonymous id and sets the
        // cookie, so firing both at once would create two users and attach the data to one.
        const profile = await getJSON("/api/me");
        const saved = await getJSON("/api/favorites");
        if (!alive) return;
        setMe(profile);
        setFavorites(saved.favorites || []);
      } catch (e) {
        if (alive) setError("Daten konnten nicht geladen werden: " + e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authStatus]);

  // The history is fetched the first time the Verlauf view is opened, never in the
  // bootstrap effect above: that one runs on every page load and its calls must stay
  // sequential, so a third request there would slow down every first paint.
  // One attempt per visit to the view: a failure shows the error instead of looping.
  useEffect(() => {
    const onHistory = tab === "feedback" && reviewView === "history";
    if (!onHistory) {
      historyAsked.current = false;
      return;
    }
    if (history || historyAsked.current) return;
    historyAsked.current = true;
    let alive = true;
    setHistoryBusy(true);
    getJSON("/api/sessions")
      .then((d) => {
        if (alive) setHistory(d);
      })
      .catch((e) => {
        if (alive) setError("Verlauf konnte nicht geladen werden: " + e.message);
      })
      .finally(() => {
        if (alive) setHistoryBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [tab, reviewView, history]);

  // Next page of the history. `stats` belongs to the first page and is kept as it is.
  async function loadMoreHistory() {
    if (!history?.nextCursor || historyBusy) return;
    setHistoryBusy(true);
    try {
      const d = await getJSON(`/api/sessions?before=${encodeURIComponent(history.nextCursor)}`);
      setHistory((h) => ({ ...h, sessions: [...h.sessions, ...d.sessions], nextCursor: d.nextCursor }));
    } catch (e) {
      setError("Verlauf konnte nicht geladen werden: " + e.message);
    } finally {
      setHistoryBusy(false);
    }
  }

  // The row is shown at once (title, score and date are already in the list) and the
  // transcript and evaluation are merged in when they land.
  async function openPast(row) {
    setOpenSession({ ...row, pending: true });
    setError("");
    try {
      const { session } = await getJSON(`/api/sessions?id=${row.id}`);
      setOpenSession(session);
    } catch (e) {
      setError("Gespräch konnte nicht geladen werden: " + e.message);
      setOpenSession(null);
    }
  }

  // Star/unstar any item (correction, vocab, phrase, message, word) into the "Learn more" repo.
  // The list updates first and the request follows, so the star never lags behind the tap;
  // a failed write rolls the list back rather than lying about what was saved.
  // `scenarioTitle` is passed explicitly from the history screens, where no scenario is
  // open and the label would otherwise be lost.
  async function toggleFav(item, scenarioTitle = scenario?.title) {
    const key = favKey(item);
    const has = favorites.some((f) => favKey(f) === key);
    const before = favorites;
    const entry = { ...item, scenario: scenarioTitle, createdAt: new Date().toISOString(), reviews: 0 };
    setFavorites(has ? favorites.filter((f) => favKey(f) !== key) : [entry, ...favorites]);
    try {
      if (has) await delJSON(`/api/favorites?key=${encodeURIComponent(key)}`);
      else await postJSON("/api/favorites", { ...item, scenario: scenarioTitle });
      posthog.capture("favorite_toggled", {
        fav_type: item.type || "correction",
        action: has ? "removed" : "added",
        scenario_id: scenario?.id ?? null,
      });
    } catch (e) {
      setFavorites(before);
      setError("Favorit nicht gespeichert: " + e.message);
    }
  }

  // "Got it" +1: at MASTER_AT the card moves to the collapsed "Gemeistert" pile.
  async function markReviewed(item) {
    const key = favKey(item);
    const before = favorites;
    setFavorites(favorites.map((f) => (favKey(f) === key ? { ...f, reviews: (f.reviews || 0) + 1 } : f)));
    try {
      const res = await postJSON("/api/favorites/review", { key });
      posthog.capture("review_marked", {
        fav_type: item.type || "correction",
        reviews: res.reviews,
        mastered: Boolean(res.mastered),
      });
    } catch (e) {
      setFavorites(before);
      setError("Fortschritt nicht gespeichert: " + e.message);
    }
  }

  function open(s) {
    posthog.capture("scenario_opened", {
      scenario_id: s.id,
      scenario_title: s.title,
      level: s.level,
      category: s.category,
      locked: Boolean(s.locked),
    });
    setScenario(s);
    setStage("intro");
    setShowEn(false);
    setMessages([]);
    setFeedback(null);
    setBoard(null);
    setError("");
  }

  function back() {
    if (stage === "chat" && messages.length > 0) {
      posthog.capture("conversation_ended", {
        scenario_id: scenario?.id,
        reason: "abandoned",
        user_turns: messages.filter((m) => m.role === "user").length,
        assistant_turns: messages.filter((m) => m.role === "assistant").length,
        duration_ms: chatStartedAt.current ? Date.now() - chatStartedAt.current : null,
      });
    }
    recRef.current?.abort?.();
    stopSpeaking();
    setScenario(null);
    setListening(false);
    setBusy(false);
  }

  function startConversation() {
    chatStartedAt.current = Date.now();
    posthog.capture("conversation_started", { scenario_id: scenario.id, level: scenario.level });
    setStage("chat");
  }

  function speak(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    // The mouth follows the utterance's own lifecycle, not a timer: only these events know
    // when the OS voice really starts and stops. Browsers disagree on what a cancel() fires
    // (end in Chrome, error elsewhere), so both close the mouth.
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    speechSynthesis.speak(u);
  }

  // Every exit from the conversation goes through here: relying on the utterance events
  // alone would leave the mouth moving if a cancel() silences a voice that never started.
  function stopSpeaking() {
    speechSynthesis.cancel();
    setSpeaking(false);
  }

  async function send(userText) {
    const next = [...messages, { role: "user", content: userText }];
    setMessages(next);
    setBusy(true);
    try {
      const { text } = await postJSON("/api/chat", { messages: next, scenarioId: scenario.id });
      setMessages([...next, { role: "assistant", content: text }]);
      speak(text);
    } catch (e) {
      setError("Fehler beim Server: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function endConversation() {
    recRef.current?.abort?.();
    stopSpeaking();
    setBusy(true);
    setError("");
    const turns = {
      user_turns: messages.filter((m) => m.role === "user").length,
      assistant_turns: messages.filter((m) => m.role === "assistant").length,
      duration_ms: chatStartedAt.current ? Date.now() - chatStartedAt.current : null,
    };
    // Captured before the request, so a conversation someone finished still counts as
    // finished even when the scoring call fails.
    posthog.capture("conversation_ended", { scenario_id: scenario.id, reason: "finished", ...turns });
    try {
      // The server scores the conversation, stores it, and returns the board with it:
      // the client never sends a score, so it cannot invent one.
      const res = await postJSON("/api/feedback", { messages, scenarioId: scenario.id });
      setFeedback(res.evaluation);
      setBoard(res.board);
      // The run that just finished is now a row in `sessions`; drop the cached list so
      // the next visit to the Verlauf includes it.
      setHistory(null);
      historyAsked.current = false;
      if (res.streak != null) setMe((m) => (m ? { ...m, streak: res.streak } : m));
      setStage("leaderboard");
      const b = res.evaluation?.breakdown || {};
      posthog.capture("conversation_scored", {
        scenario_id: scenario.id,
        score: res.score,
        score_band: scoreClass(res.score),
        grammar: b.grammar ?? null,
        vocabulary: b.vocabulary ?? null,
        goal_reached: (res.evaluation?.goalCompletion ?? 0) >= 2,
        user_turns: turns.user_turns,
      });
    } catch (e) {
      setError("Feedback fehlgeschlagen: " + e.message);
      posthog.capture("conversation_ended", { scenario_id: scenario.id, reason: "failed", ...turns });
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Dieser Browser unterstützt keine Spracherkennung. Nutze Chrome.");
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "de-DE";
    rec.interimResults = false;
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setError("Spracherkennung: " + e.error);
      setListening(false);
    };
    setError("");
    setListening(true);
    rec.start();
  }

  function openReading(t) {
    posthog.capture("text_opened", { text_id: t.id, text_title: t.title, level: t.level });
    setOpenText(t);
  }

  // Nav from anywhere: switch tab and close any open scenario or text.
  const navTo = (t) => {
    setTab(t);
    setOpenText(null);
    setOpenSession(null);
    stopSpeaking();
    if (scenario) back();
  };

  // Login gate: nothing renders until a Google session exists.
  if (authStatus !== "authenticated") return <LoginScreen loading={authStatus === "loading"} />;

  const topbar = (
    <header className="topbar">
      <div className="brand">
        RolePartner <span className="brand-tag">DE</span>
      </div>
      <div className="topbar-inner">
        <nav className="nav">
          <button className={`nav-item ${!scenario && tab === "practice" ? "active" : ""}`} onClick={() => navTo("practice")}>
            Home
          </button>
          <button className={`nav-item ${!scenario && tab === "texts" ? "active" : ""}`} onClick={() => navTo("texts")}>
            Texts
          </button>
          <button className={`nav-item ${!scenario && !openText && !openSession && tab === "feedback" ? "active" : ""}`} onClick={() => navTo("feedback")}>
            Review {favorites.length ? <span className="count">({favorites.length})</span> : null}
          </button>
        </nav>
        <div className="topbar-right">
          {/* Only shown to an admin, and only as a shortcut: /admin and /api/admin both
              re-check the allow list server-side, so a forged flag here opens nothing. */}
          {me?.admin && (
            <Link className="nav-item" href="/admin">
              Admin
            </Link>
          )}
          <span className="streak" title="Serie">{me?.streak ?? 0} Tage</span>
          <AuthButton />
        </div>
      </div>
    </header>
  );

  // ---- Session screen (a past conversation is open) ----
  if (openSession) {
    return (
      <div className="app">
        {topbar}
        {error && <p className="error container">{error}</p>}
        <SessionDetail
          session={openSession}
          favorites={favorites}
          onToggleFav={(item) => toggleFav(item, openSession.title)}
          onBack={() => setOpenSession(null)}
        />
      </div>
    );
  }

  // ---- Reading screen (a text is open) ----
  if (openText) {
    return (
      <div className="app">
        {topbar}
        {error && <p className="error container">{error}</p>}
        <TextReader
          text={openText}
          favKeys={new Set(favorites.map(favKey))}
          onToggleFav={toggleFav}
          onBack={() => setOpenText(null)}
        />
      </div>
    );
  }

  // ---- Main screen (no scenario open) ----
  if (!scenario) {
    const cats = ["Alle", ...new Set(scenarios.map((s) => s.category).filter(Boolean))];
    const levels = ["Alle", ...[...new Set(scenarios.map((s) => s.level).filter(Boolean))].sort()];
    const featured = scenarios.find((s) => s.featured) || scenarios[0];
    const list = scenarios.filter(
      (s) => (cat === "Alle" || s.category === cat) && (lvl === "Alle" || s.level === lvl)
    );

    // ---- "Learn more" repo derived data ----
    const active = favorites.filter((f) => (f.reviews || 0) < MASTER_AT);
    const mastered = favorites.filter((f) => (f.reviews || 0) >= MASTER_AT);
    const groups = GROUP_ORDER
      .map((t) => ({ t, items: active.filter((f) => groupOf(f) === t) }))
      .filter((g) => g.items.length > 0);

    // Struggle highlight: most-collected correction tag among active favorites.
    const tagCounts = {};
    active
      .filter((f) => f.type === "correction" || !f.type)
      .forEach((f) => {
        const t = f.tag || "Sonstiges";
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    const topStruggle = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];

    return (
      <div className="app">
        {topbar}

        <main className="container">
          {error && <p className="error">{error}</p>}
          {tab === "practice" ? (
            <>
              <div className="filters">
                <div className="chips">
                  {cats.map((c) => (
                    <button key={c} className={`chip ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
                      {c}
                    </button>
                  ))}
                </div>
                <label className="level-filter">
                  Niveau
                  <select value={lvl} onChange={(e) => setLvl(e.target.value)}>
                    {levels.map((l) => (
                      <option key={l} value={l}>{l === "Alle" ? "Alle" : l}</option>
                    ))}
                  </select>
                </label>
              </div>

              {featured && (
                <button className="hero" onClick={() => open(featured)}>
                  <div className="hero-media">
                    <img src={featured.photo} alt="" />
                  </div>
                  <div className="hero-body">
                    <div className="hero-eyebrow">
                      Empfohlenes Szenario
                      <span className={`level level-${featured.level[0]}`}>{featured.level}</span>
                      {featured.lektion && <span className="lektion">{featured.lektion}</span>}
                    </div>
                    <div className="hero-title">{featured.title}</div>
                    <div className="hero-sub">{featured.desc}</div>
                    <span className="hero-cta">Los geht's</span>
                  </div>
                </button>
              )}

              <h2 className="section">Szenarien</h2>
              {list.length === 0 && (
                <p className="panel muted">Kein Szenario für dieses Niveau.</p>
              )}
              <div className="rows">
                {list.map((s) => (
                  <button
                    key={s.id}
                    className="row"
                    onClick={() => !s.locked && open(s)}
                    aria-disabled={s.locked}
                  >
                    <div className="row-thumb">
                      <img src={s.photo} alt="" />
                    </div>
                    <div className="row-text">
                      <div className="row-title">{s.title}</div>
                      <div className="row-sub">{s.desc}</div>
                    </div>
                    <div className="row-meta">
                      <span className="level-stack">
                        <span className={`level level-${s.level[0]}`}>{s.level}</span>
                        {s.lektion && <span className="lektion">{s.lektion}</span>}
                      </span>
                      <span>{s.locked ? "Gesperrt" : s.category}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : tab === "texts" ? (
            <>
              {(() => {
                const hero = texts.find((t) => t.featured) || texts[0];
                return (
                  <>
                    {hero && (
                      <button className="hero" onClick={() => openReading(hero)}>
                        <div className="hero-media">
                          <img src={hero.photo} alt="" />
                        </div>
                        <div className="hero-body">
                          <div className="hero-eyebrow">
                            Empfohlener Text
                            <span className={`level level-${hero.level[0]}`}>{hero.level}</span>
                          </div>
                          <div className="hero-title">{hero.title}</div>
                          <div className="hero-sub">{hero.desc}</div>
                          <span className="hero-cta">Lesen</span>
                        </div>
                      </button>
                    )}
                    <h2 className="section">Texte</h2>
                    <div className="rows">
                      {texts.map((t) => (
                        <button key={t.id} className="row" onClick={() => openReading(t)}>
                          <div className="row-thumb">
                            <img src={t.photo} alt="" />
                          </div>
                          <div className="row-text">
                            <div className="row-title">{t.title}</div>
                            <div className="row-sub">{t.desc}</div>
                          </div>
                          <div className="row-meta">
                            <span className={`level level-${t.level[0]}`}>{t.level}</span>
                            <span>{t.category}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            <>
              <div className="tabs">
                <button
                  className={`tab ${reviewView === "collection" ? "active" : ""}`}
                  onClick={() => setReviewView("collection")}
                >
                  Sammlung {favorites.length ? <span className="count">({favorites.length})</span> : null}
                </button>
                <button
                  className={`tab ${reviewView === "history" ? "active" : ""}`}
                  onClick={() => setReviewView("history")}
                >
                  Verlauf {history?.stats?.plays ? <span className="count">({history.stats.plays})</span> : null}
                </button>
              </div>

              {reviewView === "history" ? (
                <HistoryList
                  data={history}
                  busy={historyBusy}
                  anonymous={Boolean(me?.anonymous)}
                  onOpen={openPast}
                  onMore={loadMoreHistory}
                />
              ) : favorites.length === 0 ? (
                <p className="panel muted">Noch keine Favoriten. Tippe auf den Stern bei einer Korrektur, Vokabel, einem Satz oder einer Nachricht, um sie hier zu sammeln.</p>
              ) : (
                <>
                <div className="learn-hero">
                  <div className="hero-eyebrow">Deine Sammlung</div>
                  <div className="learn-stats">
                    <div className="lstat"><span className="lstat-num">{active.length}</span> Zu üben</div>
                    <div className="lstat"><span className="lstat-num">{mastered.length}</span> Gemeistert</div>
                    <div className="lstat"><span className="lstat-num">{me?.streak ?? 0}</span> Tage Serie</div>
                  </div>
                  {topStruggle && (
                    <p className="learn-struggle">
                      Du sammelst oft Korrekturen zu <strong>{topStruggle[0]}</strong> ({topStruggle[1]}).
                    </p>
                  )}
                </div>

                {groups.map((g) => (
                  <div key={g.t} className="panel learn-group">
                    <div className="brief-label">{GROUP_LABEL[g.t]} ({g.items.length})</div>
                    <ul className="corr-list">
                      {g.items.map((f) => (
                        <FavItem key={favKey(f)} f={f} onReview={markReviewed} onToggle={toggleFav} />
                      ))}
                    </ul>
                  </div>
                ))}

                {mastered.length > 0 && (
                  <details className="mastered">
                    <summary>Gemeistert ({mastered.length})</summary>
                    <ul className="corr-list">
                      {mastered.map((f) => (
                        <FavItem key={favKey(f)} f={f} onToggle={toggleFav} />
                      ))}
                    </ul>
                  </details>
                )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  // ---- Scenario open ----
  const favKeys = new Set(favorites.map(favKey));
  return (
    <div className="app">
      {topbar}
      <main className={`container ${stage === "intro" ? "" : "narrow"}`}>
      <button className="btn-ghost" onClick={back}>
        ← Zurück zur Übersicht
      </button>

      {stage === "intro" && (
        <div className="scene-media">
          <img src={scenario.photo} alt="" />
          <div className="scene-tags">
            <span className="scene-cat">{scenario.category}</span>
            <span className={`level level-${scenario.level[0]}`}>{scenario.level}</span>
            {scenario.lektion && <span className="lektion">{scenario.lektion}</span>}
          </div>
        </div>
      )}

      <h1 className="title" style={{ marginTop: 16 }}>{scenario.title}</h1>

      {stage === "intro" && (
        <>
          <p className="subtitle" style={{ marginTop: 12 }}>
            {showEn ? scenario.placeEn : scenario.place}
          </p>

          <GoalPanel scenario={scenario} showEn={showTr} onToggleEn={() => setShowTr((v) => !v)} />

          {scenario.vocab?.length > 0 && (
            <div className="panel brief-section">
              <div className="brief-head">
                <div className="brief-label">Wortschatz / Vocabulary</div>
                <button className="brief-toggle" onClick={() => setShowVocabEn((v) => !v)}>
                  {showVocabEn ? "Hide English" : "Show English"}
                </button>
              </div>
              <ul className="vocab-list">
                {scenario.vocab.map((w, i) => {
                  const item = { type: "vocab", de: w.de, en: w.en };
                  return (
                    <li key={i}>
                      <span className="vocab-de">{w.de}</span>
                      <span className={`vocab-en ${showVocabEn ? "" : "brief-blur"}`}>{w.en}</span>
                      <StarButton active={favKeys.has(favKey(item))} onClick={() => toggleFav(item)} />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {scenario.phrases?.length > 0 && (
            <div className="panel brief-section">
              <div className="brief-head">
                <div className="brief-label">Nützliche Sätze / Useful phrases</div>
                <button className="brief-toggle" onClick={() => setShowPhrasesEn((v) => !v)}>
                  {showPhrasesEn ? "Hide English" : "Show English"}
                </button>
              </div>
              <ul className="vocab-list">
                {scenario.phrases.map((p, i) => {
                  const item = { type: "phrase", de: p.de, en: p.en };
                  return (
                    <li key={i}>
                      <span className="vocab-de">{p.de}</span>
                      <span className={`vocab-en ${showPhrasesEn ? "" : "brief-blur"}`}>{p.en}</span>
                      <StarButton active={favKeys.has(favKey(item))} onClick={() => toggleFav(item)} />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="btn-row">
            <button className="btn btn-primary" onClick={startConversation}>
              Los geht's
            </button>
          </div>
        </>
      )}

      {stage === "chat" && (
        <>
          <p className="subtitle">{scenario.desc}</p>
          <PartnerStage partner={scenario.partner} speaking={speaking} />
          <div className="btn-row">
            <button className="btn btn-primary" onClick={listen} disabled={listening || busy}>
              {listening ? "Höre zu…" : busy ? "…" : "Sprechen"}
            </button>
            <button className="btn" onClick={endConversation} disabled={busy || messages.length === 0}>
              Gespräch beenden
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          {/* After the controls, so "Sprechen" stays reachable without scrolling. */}
          <GoalPanel
            scenario={scenario}
            showEn={showTr}
            onToggleEn={() => setShowTr((v) => !v)}
            collapsible
          />

          <div className="chat">
            {messages.map((m, i) => {
              const item = { type: "message", text: m.content };
              return (
                <div key={i} className={`bubble ${m.role}`}>
                  {m.content}
                  {m.role === "assistant" && (
                    <StarButton active={favKeys.has(favKey(item))} onClick={() => toggleFav(item)} />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {stage === "leaderboard" && feedback && (
        <>
          <h2 style={{ margin: "24px 0 12px" }}>Dein Ergebnis</h2>
          {error && <p className="error">{error}</p>}
          <Leaderboard
            score={feedback.score}
            board={board}
            scenario={scenario.title}
            loading={boardBusy}
            onContinue={() => setStage("feedback")}
          />
        </>
      )}

      {stage === "feedback" && (
        <>
          <h2 style={{ margin: "24px 0 12px" }}>Dein Feedback</h2>
          {feedback && <Evaluation ev={feedback} favorites={favorites} onToggleFav={toggleFav} />}

          <div className="btn-row">
            <button className="btn btn-primary" onClick={back}>
              Zur Übersicht
            </button>
          </div>
        </>
      )}
      </main>
    </div>
  );
}
