import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { estimateCost, normalizeClassification } from "./normalize";
import { CLASSIFY_PROMPT, CLASSIFY_SCHEMA } from "./prompt";
import type { Classifier } from "./types";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

// Structured outputs require additionalProperties: false and don't accept numeric min/max.
const CLAUDE_SCHEMA = {
  ...CLASSIFY_SCHEMA,
  properties: { ...CLASSIFY_SCHEMA.properties, confidence: { type: "number" } },
  additionalProperties: false,
};

export function createClaudeClassifier(apiKey: string, model = "claude-opus-5"): Classifier {
  const client = new Anthropic({ apiKey, maxRetries: 1 });

  return {
    model,
    async classify({ image, description }, options) {
      const started = Date.now();
      const content: Anthropic.ContentBlockParam[] = [];
      if (image) {
        if (!IMAGE_TYPES.includes(image.mimeType as ImageType)) {
          throw new Error(`Unsupported image type for Claude: ${image.mimeType}`);
        }
        content.push({
          type: "image",
          source: { type: "base64", media_type: image.mimeType as ImageType, data: image.data.toString("base64") },
        });
      }
      content.push({ type: "text", text: `Citizen description: """${description}"""` });

      const res = await client.messages.create(
        {
          model,
          max_tokens: 1024,
          system: CLASSIFY_PROMPT,
          messages: [{ role: "user", content }],
          output_config: { format: { type: "json_schema", schema: CLAUDE_SCHEMA } },
        },
        { signal: options?.signal },
      );

      if (res.stop_reason === "refusal") throw new Error("Classifier declined the request");
      const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
      const raw = JSON.parse(text);
      const { input_tokens: inputTokens, output_tokens: outputTokens } = res.usage;

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
