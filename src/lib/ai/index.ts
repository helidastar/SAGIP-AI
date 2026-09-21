import "server-only";
import { createClaudeClassifier } from "./claude";
import { createGeminiClassifier } from "./gemini";
import { createLlamaClassifier } from "./llama";
import type { Classifier, ClassifierInput, ClassifierResult } from "./types";

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 20_000);

/** baseUrl only applies to llama, which can run against any OpenAI-compatible host. */
export function createProvider(provider: string, apiKey: string, model?: string, baseUrl?: string): Classifier {
  if (provider === "gemini") return createGeminiClassifier(apiKey, model);
  if (provider === "claude") return createClaudeClassifier(apiKey, model);
  if (provider === "llama") return createLlamaClassifier(apiKey, model, baseUrl || undefined);
  throw new Error(`Unknown AI provider: ${provider}`);
}

/** Classify with a hard timeout so a slow provider can't hold up the chain. */
export async function classifyWithTimeout(classifier: Classifier, input: ClassifierInput): Promise<ClassifierResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await classifier.classify(input, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export { needsReview } from "./review";
export type * from "./types";
