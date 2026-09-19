# Evaluation model: three methodologies

Three candidate methodologies for turning a role-play conversation into a **score (0-100) plus written feedback**. Each is a self-contained plan; they take deliberately different bets so we can pick or mix.

## How it works today (baseline)

`POST /api/feedback` receives `{ messages, scenarioId }` (transcript, `role: "user"` = student). An LLM (`gpt-5-nano`) returns **observations only**, never a score: `goalReached`, `taskResults[]`, `grammar` 0-5, `vocab` 0-5, `corrections[]`, plus `summary`/`strengths`/`tip` prose. Server code in `app/scoring.js` computes the number from fixed weights: goal 30, tasks 20, grammar 20, vocabulary 20 (12 measured by string-matching target words + 8 from the model rating), engagement 10 (student turns capped at 6), minus a penalty of 1pt per correction beyond 2 free. Clamped 0-100.

Rationale the current authors gave: a client-sent score can be forged; a single "rate 0-100" LLM call drifts run-to-run. Fixed weights over measured facts give reproducible scores so the leaderboard means something.

## The three bets at a glance

| | Version A | Version B | Version C |
|---|---|---|---|
| **Who assigns the score** | server code from LLM observations | LLM judges, aggregated | server code from NLP metrics |
| **LLM calls** | 1 (observe) | 4 (3 judges + 1 feedback) | 1 (goal + prose) or 0 |
| **Reproducibility** | exact | within a few points | exact |
| **Cost** | ~current | ~4x | lowest |
| **Main risk** | trusts model 0-5 ratings for most points | model-version drift, not bit-deterministic | most engineering up front (NLP services) |
| **Best when** | want the current design, corrected | want fluency/severity captured, cost OK | want cheap, offline-capable, forge-proof |

---

## Version A: Deterministic Weighted Rubric, Refined

### Overview and philosophy

Keep the core rule the current system got right: **the LLM never emits the score.** It reports observations it is reliable at (did a task happen, how clean was the grammar), and server code in `app/scoring.js` turns those observations, plus facts measured directly from the transcript, into a number. This keeps the score forge-proof and reproducible so the leaderboard means something.

Version A keeps that skeleton but fixes five concrete weaknesses:

1. **All-or-nothing goal** to graded 0-3 goal completion, so a near-miss beats a no-show.
2. **Brittle vocab string-matching** to the LLM judges *communicative* vocab use; string-matching stays only as a fraud floor, not the main signal.
3. **Penalty double-counts grammar** to grammar errors already lower the grammar rating; the separate per-correction penalty is removed and replaced with a fluency band the LLM sets from CEFR descriptors.
4. **No CEFR grounding** to every rated dimension is anchored to an explicit A2 descriptor in the prompt, so ratings are calibrated to a fixed reference instead of the model's mood.
5. **Turn-count engagement** to replaced with an interaction-quality signal (did the student initiate, repair, respond on-topic) that a two-word "ja/nein" reply cannot game.

### LLM observation schema

The model returns observations only, all CEFR-A2 anchored. Same `generateObject` call, richer schema:

```js
{
  // Goal, graded not binary. 0 not attempted, 1 attempted, 2 mostly done, 3 fully achieved.
  goalCompletion: { type: "integer", minimum: 0, maximum: 3 },

  // One 0-2 per briefing task, same order (0 skipped, 1 partial, 2 done).
  taskResults: { type: "array", items: { type: "integer", minimum: 0, maximum: 2 } },

  // CEFR-anchored 0-5 ratings. Prompt gives the A2 descriptor for each.
  grammar:  { type: "integer", minimum: 0, maximum: 5 }, // range/accuracy of A2 structures
  vocab:    { type: "integer", minimum: 0, maximum: 5 }, // range and aptness for the situation
  fluency:  { type: "integer", minimum: 0, maximum: 5 }, // coherence, turn-taking, repair

  // Was the exchange a real interaction? initiated a request, responded on-topic,
  // asked/answered a clarifying question. This is what "engagement" should have measured.
  interaction: { type: "integer", minimum: 0, maximum: 5 },

  corrections: {                       // still capped at 5, still tagged from TAGS
    type: "array", maxItems: 5,
    items: { wrong, right, note, tag, severity: {enum:["minor","major"]} }
  },
  summary, strengths[], tip           // prose, English, unchanged
}
```

Note `severity` on corrections: it feeds the feedback text, **not** the score. Scoring never re-penalizes errors that the grammar/vocab ratings already reflect.

### Deterministic scoring formula

Weights sum to 100. Every term is a clean fraction of its weight, so partial credit is smooth.

| Dimension | Weight | Formula |
|---|---|---|
| Goal | 25 | `25 * goalCompletion / 3` |
| Tasks | 20 | `20 * (sum taskResults) / (2 * nTasks)`; if `nTasks == 0` then full 20 |
| Grammar | 20 | `20 * grammar / 5` |
| Vocabulary | 20 | `12 * vocabJudged/5 + 8 * min(hits, pool)/pool` |
| Interaction | 15 | `15 * min(interaction, interactionFloor()) / 5` |

**Vocabulary detail.** The split is inverted from today: the LLM's *judged* use is now the larger part (12), the string-matched *measured* hits are the smaller floor (8). Rationale: a learner who paraphrases correctly ("eine Karte nach Koeln, bitte") should not be punished for not saying the exact briefing lemma, but a fluent improviser who ignores the briefing entirely still cannot max out vocab without demonstrating some target range. `pool = min(TARGET_SAMPLE, nVocab + nPhrases)`. Keep the existing `targetsUsed()` normalizer (lowercasing, article stripping, 60% phrase-word threshold) for `hits`; it is a fine cheap floor.

**Interaction floor (anti-degenerate-length).** `interactionFloor()` caps how high the interaction score can reach when the transcript is too short to prove it: `min(5, ceil(5 * studentTurns / MIN_MEANINGFUL_TURNS))` with `MIN_MEANINGFUL_TURNS = 4`. A one-line conversation caps interaction at ~1/5 even if the model was generous; a full exchange lets the model's rating stand. This measures *quality* (model) gated by *sufficiency* (code), the thing raw turn count could not do.

**No standalone error penalty.** Removed. Grammar accuracy is the grammar rating's job; charging again per correction double-counts and made the penalty an accidental function of how many errors the model chose to *report* (capped at 5) rather than how many were *made*.

```
score = clamp(round(goal + tasks + grammar + vocabulary + interaction), 0, 100)
```

### Edge cases

- **Empty / one-turn transcript:** interaction floor collapses it; goal/tasks will be 0-1 from the model. Score lands low without special-casing.
- **Scenario with no tasks:** tasks term returns full weight (cannot lose points it never offered), same as today.
- **Model returns out-of-range integer:** clamp each field before use, exactly as the current code clamps `grammar`.
- **Model omits a field:** treat as 0 (`Number(x) || 0`), so a malformed judgement scores conservatively, never crashes.
- **Reproducibility:** call the model at `temperature: 0`. Same transcript to same observations to identical score, which the deterministic layer guarantees.

### How feedback text is produced

Feedback is not re-generated; it is assembled from the same observation object, so the numbers and the words can never disagree:

- **Headline score band** from the total: 0-49 "Weiter ueben", 50-74 "Solide", 75-89 "Stark", 90-100 "Ausgezeichnet".
- **Breakdown bars** straight from the five weighted terms (already returned in `breakdown`), so the student sees *where* points came from.
- **Strengths / tip / summary**: the model's prose verbatim.
- **Corrections**: the model's list, sorted `major` before `minor`, each shown as `wrong to right` with its `note` and `TAG` chip. `severity` only drives ordering and emphasis, not points.
- **One derived nudge** in code: if `hits < pool`, append "Try using more of the briefing's Wortschatz", because that gap is measured, not judged, and is the cheapest concrete win for the learner.

### Pros / cons

**Pros:** reproducible and forge-proof (score is pure function of observations); partial credit everywhere removes the harsh cliffs; CEFR anchoring calibrates the 0-5 ratings; no double-counting of errors; interaction cannot be gamed by length or by monosyllables; feedback is guaranteed consistent with the score because both read one object.

**Cons:** more the model must observe per call (slightly higher latency/cost than the current lean schema); weights and floors are hand-tuned constants that need occasional recalibration against real transcripts; still trusts the model's 0-5 ratings for 55 of 100 points, so a systematically biased model shifts every score (mitigated by temperature 0 + fixed descriptors, not eliminated).

### How this differs from the other approaches

Version A is the **conservative evolution**: same architecture as today (LLM observes, code scores), just corrected. It deliberately does *not* hand the model the score, and does *not* add a second grading pass or rubric-per-scenario machinery. Version A's bet is that the cheapest reliable system is a well-designed fixed rubric over well-chosen observations.

---

## Version B: LLM-as-Judge, Calibrated Ensemble

### Philosophy

The current design distrusts the LLM with numbers and hard-codes weights. Version B takes the opposite bet: **a modern LLM, given a concrete rubric and forced to reason before it commits, is a better judge of "how good was this A2 conversation" than any fixed formula**, because it can weigh fluency, appropriateness, and recovery from mistakes that a keyword-and-weight scheme cannot see.

Drift is real but it is an *engineering* problem, not a reason to give up on judged scores. We defeat it the way ML evaluation harnesses do: **anchor the scale with a rubric, sample multiple independent judgments, and aggregate by median.** Run-to-run variance collapses as `~1/sqrt(n)`; a rubric kills systematic bias; the median kills outliers.

### Pipeline overview

```
transcript --+--> Judge call 1 (temp 0.4) --+
             +--> Judge call 2 (temp 0.4) --+--> aggregate (median + trim) --> score 0-100
             +--> Judge call 3 (temp 0.4) --+                                     |
transcript ----> Feedback call (temp 0.7) ------------------------> summary/strengths/corrections/tip
```

- **3 judge calls**, identical prompt, run in parallel (`Promise.all`). Each returns per-dimension sub-scores plus reasoning, *not* a single blob number.
- **1 feedback call**, separate, tuned for prose quality.
- Total 4 calls, all `gpt-5-nano`-class, fully parallel to latency approx one call.

### The judge prompt and rubric

Each judge scores **five CEFR-anchored dimensions, each 0-20**, so they sum to a natural 0-100. The rubric is embedded verbatim so every judge anchors to the same scale.

```
You are a CEFR examiner scoring a German A2 role-play. The scenario goal was:
"{goal}". The tasks were: {tasks}.

Think step by step in a "reasoning" field FIRST, then assign each dimension.
Anchor strictly to this rubric, do not grade on a curve.

TASK COMPLETION (0-20): did the student reach the goal and cover each task?
  20 all tasks done + goal reached · 12 goal reached, gaps in tasks
  6 partial · 0 goal not reached
GRAMMAR (0-20): A2 accuracy, verb position, cases, articles.
  20 A2-clean, errors do not impede · 12 frequent A2 errors, still understandable
  6 errors impede meaning · 0 not German / unintelligible
VOCABULARY (0-20): range + use of the briefing's target words/phrases.
  20 rich, used target vocab naturally · 12 adequate, some targets · 6 minimal · 0 none
FLUENCY AND COHERENCE (0-20): turn-taking, relevance, natural flow.
  20 held a real conversation · 12 stilted but coherent · 6 one-word replies · 0 no exchange
INTERACTION (0-20): did they respond to the partner, ask, repair misunderstandings?
  20 initiates + repairs · 12 reactive only · 6 barely engaged · 0 ignored partner
```

Output schema per judge:

```json
{
  "reasoning": "string (2-4 sentences, forces CoT before numbers)",
  "taskCompletion": 0-20, "grammar": 0-20, "vocabulary": 0-20,
  "fluency": 0-20, "interaction": 0-20
}
```

Chain-of-thought is mandatory and comes **before** the numbers in the schema. This alone is the single biggest variance reducer, because the number becomes a summary of stated reasons rather than a reflex.

### Reference anchoring (optional, recommended)

Store one short **exemplar transcript per scenario** with a known human score (e.g. a 75/100 "solid pass"). Inject it into the judge prompt as a calibration anchor: *"For reference, this example transcript scored 75: {exemplar}."* Reference-anchored scoring is dramatically more stable than absolute scoring because the judge grades *relative to a fixed point* instead of an imagined scale. One exemplar per scenario is cheap to author and pins the whole distribution.

### Aggregation math

```
For each dimension d:
  scores_d = [judge1[d], judge2[d], judge3[d]]
  dim_d    = median(scores_d)          // robust to a single rogue judge
final = sum over d of dim_d            // 0..100 by construction, no clamp needed
```

Median over 3 discards the worst outlier per dimension for free. Dimension-wise median (not median of the total) prevents one judge's harsh grammar mark from dragging an otherwise-agreed score.

**Confidence signal:** compute `spread = max(total_j) - min(total_j)` across the 3 judges. If `spread > 20`, the judges disagree, fire a 4th judge and take the median of 4, or flag the session `lowConfidence: true` for later review. Cheap insurance on the ambiguous transcripts that actually need it.

### Variance / reproducibility controls (summary)

1. **Rubric anchoring** — fixed 0-20 bands, no free-floating scale.
2. **Mandatory CoT before the number** — reasoning-first schema.
3. **Ensemble of 3 + dimension-wise median** — averages out sampling noise, trims outliers.
4. **Low but non-zero temperature (~0.4)** on judges — temp 0 seems reproducible but gives a *single* draw with no way to detect instability; a small temperature + ensemble both smooths *and* surfaces disagreement via spread.
5. **Reference exemplar** — pins the absolute scale per scenario.
6. **Frozen prompt + model version** — pin the model snapshot; treat the rubric/prompt as versioned config so scores stay comparable over time.

### Feedback generation

A separate call (temperature ~0.7 for warmer prose) receives the transcript **plus the aggregated sub-scores and the judges' concatenated reasoning**, and produces:

```json
{
  "summary": "one sentence, English",
  "strengths": ["1-3 items"],
  "corrections": [{ "wrong", "right", "note", "tag" }],  // max 5
  "tip": "one actionable tip"
}
```

Feeding the judges' reasoning into the feedback call keeps the prose consistent with the number the student sees; the score and the words explaining it come from the same evidence, so a 45 never arrives with glowing praise.

### Forgery / trust

The score is **proposed by the LLM but assembled and finalized server-side.** The client never sends a score; it sends only the transcript. All judge calls, aggregation, and the DB insert happen in `/api/feedback` exactly as today. The only change is *what* computes the number inside the route, so the trust boundary is unchanged and the "client can forge a score" concern does not apply.

### Pros / cons

**Pros**
- Captures fluency, appropriateness, and error *severity* that fixed weights miss.
- Rubric + ensemble + median give reproducibility within a few points, empirically close to human inter-rater agreement.
- Adding a new scenario needs no scoring-formula changes, just a goal, tasks, and (ideally) one exemplar.
- Spread metric gives a free confidence signal and auto-escalation path.

**Cons**
- 4 LLM calls per evaluation vs 1, so ~4x token cost.
- Depends on model-version stability; a silent model update can shift the distribution (mitigated by pinning + periodic re-scoring of the exemplars).
- Still not bit-for-bit deterministic; two runs can differ by a few points. Acceptable for practice feedback, worth noting for a competitive leaderboard.

### Cost / latency

- **Latency:** all 4 calls parallel, so wall-clock approx 1 call (~1-3 s on nano). The `spread > 20` 4th judge adds one serial round only on the minority of ambiguous transcripts.
- **Cost:** ~4x current per evaluation. On a nano-class model a role-play transcript is small (hundreds of tokens), so absolute cost stays fractions of a cent. If cost matters, drop to **2 judges + median-of-2-with-tiebreak**, or gate the ensemble behind leaderboard submissions only and use a single judge for casual practice.

---

## Version C: Measurable-Metrics-First Hybrid (Minimal LLM)

### Overview / Philosophy

Score almost everything with deterministic NLP over the transcript, so a run is reproducible, cheap, and impossible to forge from the client. The LLM is called **at most once**, only for the two things that genuinely resist measurement: judging whether the scenario's *goal* was reached (semantic intent, not keywords) and writing the natural-language feedback prose. Every point that can be earned by measurable evidence is measured. If the LLM call fails or is disabled, the score still computes (goal falls back to a heuristic) so the app degrades gracefully to fully offline.

Input assumptions: `messages` (role `user` = student), `scenario` (target `vocab[]`, `phrases[]`, `tasks[]`, `goal`). Only student turns are scored for language; partner turns are context.

### Preprocessing pipeline

1. Concatenate student turns to `studentTurns[]`, `studentText`.
2. **Tokenize + lemmatize** each turn (German). Store `tokens[]` (surface) and `lemmas[]`.
3. **Sentence-split** for length/complexity metrics.
4. Run one **grammar/spell pass** over `studentText` to get an error list.

### Metrics and point mapping (total = 100)

| Component | Points | How measured |
|---|---|---|
| Goal reached | 25 | LLM boolean (heuristic fallback) |
| Task coverage | 15 | keyword/intent detection per task |
| Target-vocab coverage | 15 | fuzzy lemma match |
| Grammar correctness | 20 | error density from grammar pass |
| Vocabulary level and diversity | 15 | CEFR frequency + TTR |
| Sentence complexity | 5 | mean length + subordination |
| Engagement | 5 | turn count + substance |

**1. Goal reached — 25 pts (LLM, with fallback).**
Single boolean from the LLM: "Did the student achieve: `{scenario.goal}`? Answer strictly from the transcript." `goal = reached ? 25 : 0`.
Fallback if no LLM: `reached` when task coverage >= 0.7 AND student turns >= FULL_TURNS.

**2. Task coverage — 15 pts (deterministic).**
Each `scenario.tasks[i]` carries a small `cues` list (verbs/nouns that signal it, authored per task, or auto-derived by lemmatizing the task string). A task counts as done if >=1 cue lemma appears in `studentLemmas`.
`tasks = 15 * doneTasks / totalTasks` (full marks if no tasks).

**3. Target-vocab coverage — 15 pts (deterministic, fuzzy).**
Improves the current brittle exact-match. Match on **lemmas**, not surface forms, so `"moechte" ~ "moechten"`, `"Fahrkarte" ~ "Fahrkarten"`. Vocab entry hits when its head lemma is present; phrase hits when >=60% of its content lemmas are present (drop articles + "..."). Optionally allow Levenshtein <=1 on lemmas to forgive minor typos.
`coverage = min(hits, SAMPLE) / SAMPLE`, `SAMPLE = min(5, |vocab|+|phrases|)`; `vocabCov = 15 * coverage`.

**4. Grammar correctness — 20 pts (deterministic).**
Run LanguageTool (self-hosted `de-DE`) or `nodehun` + Hunspell German dictionary. Compute **error density** = matches per 100 tokens, ignoring style-only rules.
`grammar = 20 * clamp(1 - density/DENSITY_CAP, 0, 1)`, e.g. `DENSITY_CAP = 15` (>=15 errors/100 tokens to 0). Robust to length because it is normalized.

**5. Vocabulary level and diversity — 15 pts (deterministic), split 9 + 6.**
- **CEFR/frequency level (9 pts):** map each content lemma to a rank via a German frequency list (Leipzig Corpora / `dwds` / DeReWo). Reward rarer, higher-level words.
 `advancedRatio = |content lemmas beyond top-1000 rank| / |content lemmas|`; `level = 9 * clamp(advancedRatio / 0.35, 0, 1)`.
- **Lexical diversity (6 pts):** use **MTLD** (or MATTR, window 25) instead of raw TTR, since raw TTR is length-biased. Normalize: `diversity = 6 * clamp((mtld - 15) / (60 - 15), 0, 1)`.

**6. Sentence complexity — 5 pts (deterministic).**
`meanLen` = tokens/sentence; `subord` = share of sentences containing a subordinating cue lemma (`weil, dass, wenn, obwohl, damit`) or a comma+verb-final pattern.
`complexity = 5 * clamp((meanLen/8)*0.6 + subord*0.4, 0, 1)`.

**7. Engagement — 5 pts (deterministic).**
`engagement = 5 * min(substantiveTurns, FULL_TURNS)/FULL_TURNS`, where a turn is *substantive* if it has >=3 content lemmas (blocks "ja"/"ok" padding). `FULL_TURNS = 6`.

**Final:** `score = clamp(round(sum of components), 0, 100)`. No separate penalty; grammar and engagement already carry the downside, so errors cannot be double-counted.

### Where the LLM is (and is not) used

- **Used once**, batched in a single `generateObject` call returning `{ goalReached, summary, strengths[], tip }`, the goal boolean plus feedback prose. That is the only network/model cost.
- **Not used** for grammar, vocabulary, diversity, complexity, tasks, engagement, all deterministic.
- **Corrections** come from the grammar pass, not the LLM: each LanguageTool match yields `{ wrong, right (first suggestion), note (rule message), tag (mapped from rule category to your TAGS enum) }`. This makes corrections reproducible and free.

### How feedback text is produced

- **Score + breakdown:** rendered directly from the components table, so the UI can show *why* each bucket earned what it did (e.g. "Vocabulary 11/15, good target coverage, low variety").
- **Corrections list:** top 5 grammar-pass matches, sorted by severity.
- **summary / strengths / tip:** the single LLM call, given the transcript + the computed breakdown so the prose is consistent with the numbers. If the LLM is off, generate template-based prose from the breakdown (e.g. pick the highest bucket for a strength, lowest for the tip).

### Required tooling / data

- **Lemmatizer + tokenizer (German):** `spaCy de_core_news_sm` (Python microservice) or a JS option (`compromise` is weak for German; a WASM spaCy or a hosted endpoint is more reliable). Minimum viable: a German lemma dictionary lookup table.
- **Grammar check:** self-hosted **LanguageTool** server (`de-DE`), Dockerable, no per-call cost; or Hunspell (`nodehun` + `de_DE` dictionary) for spelling-only, cheaper but weaker on grammar.
- **Frequency / CEFR data:** a German frequency list (DeReWo, Leipzig Corpora, or dwds) as a static `rank.json`; optionally a CEFR word list (Goethe A1-B1) for cleaner level bucketing.
- **Diversity:** MTLD/MATTR is ~30 lines of code, no dependency.

### Pros / Cons

**Pros**
- Cheapest of the three: one small LLM call (or zero in offline mode).
- Fully reproducible and forge-proof, the same transcript always yields the same score.
- Rich, honest breakdown; corrections are free and rule-backed.
- Degrades gracefully to offline.

**Cons**
- Most engineering up front: a lemmatizer/grammar service and frequency data must be provisioned and maintained.
- Deterministic grammar checkers over-flag informal speech and miss meaning-level errors (a grammatically clean but off-topic sentence scores well on grammar).
- Keyword/cue task detection needs per-scenario authoring or tuning to avoid false negatives.
- CEFR/frequency scoring rewards rare words, which can be gamed by dropping in fancy vocabulary; the diversity + grammar components partly offset this.
