// The model, and what each call to it cost.
//
// The model id used to be typed out in each of the three AI routes. It is here now
// because `ai_tokens.model` records which model spent the tokens, and a recorded model
// that can drift from the one actually called is worse than no record at all.

export const MODEL = "gpt-5-nano";

/**
 * Price per million tokens, in USD.
 *
 * Hardcoded on purpose: the provider does not expose prices over the API, so a number
 * has to be written down somewhere, and one place beats one per report. It is a rate
 * card, not a receipt -- the admin page labels every figure derived from it "estimated",
 * and it goes stale the moment the provider changes prices or the app changes model.
 * Check https://platform.openai.com/docs/pricing before trusting a total.
 * Last checked: 19.09.2026.
 *
 * Reasoning tokens are part of `output` for billing, so they are not priced separately
 * here; they are recorded only to show how much of the output nobody ever reads.
 */
export const PRICING = {
  "gpt-5-nano": { input: 0.05, output: 0.4 },
};

export const costOf = ({ model, inputTokens = 0, outputTokens = 0 }) => {
  const rate = PRICING[model];
  if (!rate) return null; // unknown model: no total is better than a wrong one
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
};

/**
 * Books one AI call against the caller's token ledger.
 *
 * Never throws: this is bookkeeping, and a person practising German must not lose the
 * answer they already paid for because a counter could not be written. A provider that
 * reports no usage still books the call, so `calls` stays a true count.
 */
export async function recordUsage(db, { userId, route, usage }) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    await db
      .prepare(
        `INSERT INTO ai_tokens (user_id, day, route, model, calls, input_tokens, output_tokens, reasoning_tokens)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)
         ON CONFLICT (user_id, day, route, model) DO UPDATE SET
           calls            = calls + 1,
           input_tokens     = input_tokens + excluded.input_tokens,
           output_tokens    = output_tokens + excluded.output_tokens,
           reasoning_tokens = reasoning_tokens + excluded.reasoning_tokens`
      )
      .bind(
        userId,
        day,
        route,
        MODEL,
        Number(usage?.inputTokens) || 0,
        Number(usage?.outputTokens) || 0,
        Number(usage?.outputTokenDetails?.reasoningTokens) || 0
      )
      .run();
  } catch (e) {
    console.error("[recordUsage]", e?.stack || e);
  }
}
