import { generateObject, jsonSchema } from "ai";
import { openai } from "@ai-sdk/openai";
import { byId } from "../../scenarios";

const evalSchema = jsonSchema({
  type: "object",
  additionalProperties: false,
  required: ["score", "grammar", "vocab", "summary", "strengths", "corrections", "tip"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100, description: "Overall score 0-100" },
    grammar: { type: "integer", minimum: 0, maximum: 5, description: "Grammar rating 0-5" },
    vocab: { type: "integer", minimum: 0, maximum: 5, description: "Vocabulary rating 0-5" },
    summary: { type: "string", description: "One sentence summarizing performance, in English" },
    strengths: {
      type: "array", minItems: 1, maxItems: 3,
      items: { type: "string" },
      description: "What the student did well, in English",
    },
    corrections: {
      type: "array", maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["wrong", "right", "note", "tag"],
        properties: {
          wrong: { type: "string", description: "What the student said (in German)" },
          right: { type: "string", description: "The correct German form" },
          note: { type: "string", description: "Short explanation, in English" },
          tag: {
            type: "string",
            enum: ["Genus/Artikel", "Verbzeit", "Wortstellung", "Falscher Freund", "Wortwahl", "Präposition", "Sonstiges"],
            description: "Error category (closest match)",
          },
        },
      },
      description: "Main grammar or vocabulary mistakes",
    },
    tip: { type: "string", description: "One practical tip for next time, in English" },
  },
});

export async function POST(req) {
  const { messages, scenarioId } = await req.json();
  const scenario = byId(scenarioId);
  if (!scenario) return Response.json({ error: "Unbekanntes Szenario." }, { status: 400 });

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Aluno" : "Personagem"}: ${m.content}`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: evalSchema,
      system: `You are a German teacher evaluating a student after a role-play (scenario: "${scenario.title}").
Write ALL feedback in English, be specific and encouraging. For each mistake, give the corrected German form and classify it with the closest "tag" error category.
Rate the overall score (0-100), grammar (0-5) and vocabulary (0-5). Scores reflect fluency, grammar, vocabulary and whether the student completed the scenario's goal.`,
      prompt: `Conversa:\n${transcript}`,
    });
    return Response.json(object);
  } catch (e) {
    return Response.json({ error: e.message || "KI-Fehler" }, { status: 500 });
  }
}
