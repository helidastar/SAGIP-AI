import "server-only";
import { estimateCost, normalizeClassification } from "./normalize";
import { CLASSIFY_PROMPT, CLASSIFY_SCHEMA } from "./prompt";
import type { Classifier } from "./types";

/**
 * Llama via any OpenAI-compatible Chat Completions endpoint: Groq, Together,
 * OpenRouter, Meta's Llama API, or a self-hosted vLLM. Point AI_BASE_URL at the
 * host you want; the default is Groq.
 */
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

// Structured outputs require additionalProperties: false and don't accept numeric min/max.
const LLAMA_SCHEMA = {
  ...CLASSIFY_SCHEMA,
  properties: { ...CLASSIFY_SCHEMA.properties, confidence: { type: "number" } },
  additionalProperties: false,
};

/** Carries the HTTP status so isTransientError() can tell a 429/5xx from a bad request. */
class LlamaApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "LlamaApiError";
  }
}

export function createLlamaClassifier(apiKey: string, model = "llama-4-scout-17b-16e-instruct", baseUrl = DEFAULT_BASE_URL): Classifier {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  return {
    model,
    async classify({ image, description }, options) {
      const started = Date.now();
      const content: Record<string, unknown>[] = [];
      if (image) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${image.mimeType};base64,${image.data.toString("base64")}` },
        });
      }
      content.push({ type: "text", text: `Citizen description: """${description}"""` });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_completion_tokens: 1024,
          // Classification should be as close to deterministic as the host allows.
          temperature: 0,
          messages: [
            { role: "system", content: CLASSIFY_PROMPT },
            { role: "user", content },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "incident_classification", schema: LLAMA_SCHEMA, strict: true },
          },
        }),
        signal: options?.signal,
      });

      if (!res.ok) {
        throw new LlamaApiError(res.status, `Llama request failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
      }

      const body = await res.json();
      const choice = body.choices?.[0];
      if (choice?.finish_reason === "content_filter") throw new Error("Classifier declined the request");
      const raw = JSON.parse(choice?.message?.content ?? "{}");
      const inputTokens = body.usage?.prompt_tokens;
      const outputTokens = body.usage?.completion_tokens;

      return {
        ...normalizeClassification(raw),
        raw,
        latencyMs: Date.now() - started,
        inputTokens,
        outputTokens,
        costUsd: estimateCost(model, inputTokens, outputTokens),
      };
    },
  };
}
