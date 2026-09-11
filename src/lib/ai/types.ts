import type { IncidentType, Severity } from "@/types";

export interface IncidentClassification {
  incidentType: IncidentType;
  severity: Severity;
  /** 0 to 1 */
  confidence: number;
  hazards: string[];
}

/** Provider-agnostic classifier so the vision-LLM can be swapped after benchmarking. */
export interface Classifier {
  model: string;
  classify(input: { imageUrl: string; description: string }): Promise<IncidentClassification>;
}
