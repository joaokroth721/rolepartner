import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getDb, resolveUser, json, fail, oops } from "../../db";
import { wrongOrigin, knownScenario, badTranscript, overQuota } from "../../guard";

function buildSystem(s) {
  const lines = [s.system, ""];
  if (s.level) lines.push(`Niveau des Nutzers: ${s.level}. Passe deine Sprache daran an.`);
  if (s.goal) lines.push(`Ziel des Nutzers: ${s.goal}`);
  if (s.tasks?.length) lines.push(`Aufgaben: ${s.tasks.join("; ")}`);
  if (s.vocab?.length) lines.push(`Zielvokabular (bevorzugt einsetzen): ${s.vocab.map((v) => v.de).join(", ")}`);
  if (s.phrases?.length) lines.push(`Nützliche Sätze: ${s.phrases.map((p) => p.de).join(" | ")}`);
  return lines.join("\n");
}

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

    const { text } = await generateText({
      // OpenAI direto. Lê OPENAI_API_KEY do .env.local (ou do secret do Workers).
      model: openai("gpt-5-nano"),
      system: buildSystem(scenario),
      messages,
    });
    return json({ text }, { setCookie, clearCookie });
  } catch (e) {
    return oops("chat", e);
  }
}
