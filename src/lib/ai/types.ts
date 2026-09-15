import type { IncidentType, Severity } from "@/types";

export interface IncidentClassification {
  incidentType: IncidentType;
  severity: Severity;
  /** 0 to 1 */
  confidence: number;
  hazards: string[];
}

export interface ClassifierInput {
  image?: { data: Buffer; mimeType: string };
  description: string;
}

export interface ClassifierResult extends IncidentClassification {
  raw: unknown;
  latencyMs: number;
}

/** Provider-agnostic classifier so the vision-LLM can be swapped after benchmarking. */
export interface Classifier {
  model: string;
  classify(input: ClassifierInput): Promise<ClassifierResult>;
}
