import { CONFIDENCE_THRESHOLD, REVIEW_SEVERITIES } from "@/lib/constants";
import type { IncidentClassification } from "./types";

/** A report needs human review if the AI is unsure, the incident is high/critical, or a hoax is suspected. */
export function needsReview({ confidence, severity, hoaxSuspected }: IncidentClassification): boolean {
  return (
    confidence < CONFIDENCE_THRESHOLD ||
    (REVIEW_SEVERITIES as readonly string[]).includes(severity) ||
    hoaxSuspected
  );
}
