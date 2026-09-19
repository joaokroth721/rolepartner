import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getDb, resolveUser, json, fail, oops } from "../../db";
import { wrongOrigin, overQuota, LIMITS } from "../../guard";
import { TRANSLATE_SENTENCE_SYSTEM, TRANSLATE_WORD_SYSTEM } from "../../prompts";
import { MODEL, recordUsage } from "../../ai";

// On-demand German->English lookup for the Texts reader: any word or whole sentence.
// Glossary words are resolved client-side; this only runs for words not in the glossary
// and for sentences, which makes it the easiest of the three routes to call in a loop.
export async function POST(req) {
  const bad = wrongOrigin(req);
  if (bad) return bad;

  try {
    const { de, kind, context } = await req.json();
    if (typeof de !== "string" || !de.trim()) return fail("Nichts zu übersetzen.", 400);
    if (de.length > LIMITS.translateChars) return fail("Text zu lang.", 413);
    if (typeof context === "string" && context.length > LIMITS.translateChars) {
      return fail("Kontext zu lang.", 413);
    }

    const db = await getDb();
    const { user, setCookie, clearCookie } = await resolveUser(db, req);
    const limited = await overQuota(db, user.id);
    if (limited) return limited;

    if (kind === "sentence") {
      const { text, usage } = await generateText({
        model: openai(MODEL),
        system: TRANSLATE_SENTENCE_SYSTEM,
        prompt: de,
      });
      await recordUsage(db, { userId: user.id, route: "translate", usage });
      return json({ en: text.trim() }, { setCookie, clearCookie });
    }
    // word: one line, LEMMA | POS | ENGLISH
    const { text, usage } = await generateText({
      model: openai(MODEL),
      system: TRANSLATE_WORD_SYSTEM,
      prompt: context ? `Word: ${de}\nSentence: ${context}` : `Word: ${de}`,
    });
    await recordUsage(db, { userId: user.id, route: "translate", usage });
    const [lemma, pos, en] = text.trim().split("|").map((s) => s.trim());
    return json({ lemma: lemma || de, pos: pos || "", en: en || "" }, { setCookie, clearCookie });
  } catch (e) {
    return oops("translate", e);
  }
}
