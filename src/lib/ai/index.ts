import "server-only";
import { createGeminiClassifier } from "./gemini";
import type { Classifier } from "./types";

/** Low-confidence stub so the pipeline works without an API key (always routes to review). */
const mockClassifier: Classifier = {
  model: "mock",
  async classify() {
    return { incidentType: "other", severity: "moderate", confidence: 0, hazards: [], raw: null, latencyMs: 0 };
  },
};

export function getClassifier(): Classifier {
  const provider = process.env.AI_PROVIDER ?? "gemini";
  const key = process.env.AI_API_KEY;
  if (provider === "mock" || !key) return mockClassifier;
  if (provider === "gemini") return createGeminiClassifier(key, process.env.AI_MODEL);
  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}

export { needsReview } from "./review";
export type * from "./types";
