import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { byId } from "../../scenarios";

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
  const { messages, scenarioId } = await req.json();
  const scenario = byId(scenarioId);
  if (!scenario) return Response.json({ error: "Unbekanntes Szenario." }, { status: 400 });
  try {
    const { text } = await generateText({
      // OpenAI direto. Lê OPENAI_API_KEY do .env.local.
      model: openai("gpt-5-nano"),
      system: buildSystem(scenario),
      messages,
    });
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: e.message || "KI-Fehler" }, { status: 500 });
  }
}
