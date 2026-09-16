import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// On-demand German->English lookup for the Texts reader: any word or whole sentence.
// Glossary words are resolved client-side; this only runs for words not in the glossary and for sentences.
export async function POST(req) {
  const { de, kind, context } = await req.json();
  if (!de) return Response.json({ error: "Nichts zu übersetzen." }, { status: 400 });
  try {
    if (kind === "sentence") {
      const { text } = await generateText({
        model: openai("gpt-5-nano"),
        system: "Translate the German sentence to natural English. Reply with only the translation, no quotes, no extra text.",
        prompt: de,
      });
      return Response.json({ en: text.trim() });
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
    return Response.json({ lemma: lemma || de, pos: pos || "", en: en || "" });
  } catch (e) {
    return Response.json({ error: e.message || "KI-Fehler" }, { status: 500 });
  }
}
