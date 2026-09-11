import { CONFIDENCE_THRESHOLD, REVIEW_SEVERITIES } from "@/lib/constants";
import type { IncidentClassification } from "./types";

/** A report needs human review if the AI is unsure or the incident is high/critical. */
export function needsReview({ confidence, severity }: IncidentClassification): boolean {
  return (
    confidence < CONFIDENCE_THRESHOLD ||
    (REVIEW_SEVERITIES as readonly string[]).includes(severity)
  );
}
