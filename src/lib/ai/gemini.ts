import "server-only";
import { GoogleGenAI } from "@google/genai";
import { estimateCost, normalizeClassification } from "./normalize";
import { CLASSIFY_PROMPT, CLASSIFY_SCHEMA } from "./prompt";
import type { Classifier } from "./types";

export function createGeminiClassifier(apiKey: string, model = "gemini-3.6-flash"): Classifier {
  const ai = new GoogleGenAI({ apiKey });

  return {
    model,
    async classify({ image, description }, options) {
      const started = Date.now();
      const parts = [
        { text: CLASSIFY_PROMPT },
        ...(image ? [{ inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } }] : []),
        { text: `Citizen description: """${description}"""` },
      ];
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: CLASSIFY_SCHEMA,
          // Classification doesn't benefit from thinking; disabling it cuts latency and cost.
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: options?.signal,
        },
      });
      const raw = JSON.parse(res.text ?? "{}");
      const inputTokens = res.usageMetadata?.promptTokenCount;
      // Thinking tokens are billed as output.
      const outputTokens = res.usageMetadata && (res.usageMetadata.candidatesTokenCount ?? 0) + (res.usageMetadata.thoughtsTokenCount ?? 0);

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
