import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getDb, resolveUser, json, fail, oops } from "../../db";
import { wrongOrigin, knownScenario, badTranscript, overQuota } from "../../guard";
import { chatSystem } from "../../prompts";
import { MODEL, recordUsage } from "../../ai";

export async function POST(req) {
  const bad = wrongOrigin(req);
  if (bad) return bad;

  try {
    const { messages, scenarioId } = await req.json();
    const scenario = knownScenario(scenarioId);
    if (!scenario) return fail("Unbekanntes Szenario.", 400);
    const badShape = badTranscript(messages);
    if (badShape) return badShape;

    const db = await getDb();
    const { user, setCookie, clearCookie } = await resolveUser(db, req);
    const limited = await overQuota(db, user.id);
    if (limited) return limited;

    const { text: raw, usage } = await generateText({
      // OpenAI direto. Lê OPENAI_API_KEY do .env.local (ou do secret do Workers).
      model: openai(MODEL),
      system: chatSystem(scenario),
      messages,
    });
    await recordUsage(db, { userId: user.id, route: "chat", usage });
    // The partner marks a finished conversation with [[ENDE]] (see chatSystem). Strip it so
    // the learner never sees or hears the marker; the flag tells the client to offer scoring.
    const done = raw.includes("[[ENDE]]");
    const text = raw.replace(/\[\[ENDE\]\]/g, "").trim();
    return json({ text, done }, { setCookie, clearCookie });
  } catch (e) {
    return oops("chat", e);
  }
}
