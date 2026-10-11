import "server-only";
import { createGeminiClassifier } from "./gemini";
import { createLocalClassifier } from "./local";
import type { Classifier, ClassifierInput, ClassifierResult } from "./types";

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 20_000);

/** For local, `model` is the path to the .onnx file and apiKey is ignored. */
export function createProvider(provider: string, apiKey: string, model?: string): Classifier {
  if (provider === "local") return createLocalClassifier(model);
  if (provider === "gemini") return createGeminiClassifier(apiKey, model);
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
