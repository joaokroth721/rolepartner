import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getDb, resolveUser, json, fail, oops } from "../../db";
import { wrongOrigin, overQuota, LIMITS } from "../../guard";

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
      const { text } = await generateText({
        model: openai("gpt-5-nano"),
        system: "Translate the German sentence to natural English. Reply with only the translation, no quotes, no extra text.",
        prompt: de,
      });
      return json({ en: text.trim() }, { setCookie, clearCookie });
    }
    // word: one line, LEMMA | POS | ENGLISH
    const { text } = await generateText({
      model: openai("gpt-5-nano"),
      system:
        "You are a German-English dictionary. Given a German word (with its sentence for context), reply with exactly one line: LEMMA | POS | ENGLISH. " +
        "LEMMA is the dictionary form (nouns with article, e.g. 'die Daten'). POS is one of: noun, verb, adjective, adverb, preposition, pronoun, conjunction, other. " +
        "ENGLISH is a short gloss. No quotes, no extra text.",
      prompt: context ? `Word: ${de}\nSentence: ${context}` : `Word: ${de}`,
    });
    const [lemma, pos, en] = text.trim().split("|").map((s) => s.trim());
    return json({ lemma: lemma || de, pos: pos || "", en: en || "" }, { setCookie, clearCookie });
  } catch (e) {
    return oops("translate", e);
  }
}
