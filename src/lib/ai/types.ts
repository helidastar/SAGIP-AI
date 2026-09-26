import type { IncidentType, Severity } from "@/types";

export interface IncidentClassification {
  incidentType: IncidentType;
  severity: Severity;
  /** 0 to 1 */
  confidence: number;
  hazards: string[];
  /** True if the AI suspects this isn't a genuine report. Never auto-rejects — only flags it for review. */
  hoaxSuspected: boolean;
}

export interface ClassifierInput {
  image?: { data: Buffer; mimeType: string };
  description: string;
}

export interface ClassifierResult extends IncidentClassification {
  raw: unknown;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Estimated from list prices; null if the model has no known price. */
  costUsd: number | null;
}

/** Provider-agnostic classifier so the vision-LLM can be swapped after benchmarking. */
export interface Classifier {
  model: string;
  classify(input: ClassifierInput, options?: { signal?: AbortSignal }): Promise<ClassifierResult>;
}
