import "server-only";
import { createClaudeClassifier } from "./claude";
import { createGeminiClassifier } from "./gemini";
import type { Classifier, ClassifierInput, ClassifierResult } from "./types";

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 20_000);

/** Low-confidence stub so the pipeline works without an API key (always routes to review). */
const mockClassifier: Classifier = {
  model: "mock",
  async classify() {
    return { incidentType: "other", severity: "moderate", confidence: 0, hazards: [], raw: null, latencyMs: 0, costUsd: 0 };
  },
};

export function getClassifier(): Classifier {
  const provider = process.env.AI_PROVIDER ?? "gemini";
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || undefined;
  if (provider === "mock" || !key) return mockClassifier;
  if (provider === "gemini") return createGeminiClassifier(key, model);
  if (provider === "claude") return createClaudeClassifier(key, model);
  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}

/** Classify with a hard timeout so a slow provider can't hold up report intake. */
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
