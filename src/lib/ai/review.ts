import { CONFIDENCE_THRESHOLD, REVIEW_SEVERITIES } from "@/lib/constants";
import type { IncidentClassification } from "./types";

/**
 * A report needs human review if the AI is unsure (type or severity confidence below the
 * threshold), the incident is high/critical, or a hoax is suspected. Severity confidence is
 * only checked when the provider gives one (null = not measured, e.g. keyword severity).
 */
export function needsReview({ confidence, severity, severityConfidence, hoaxSuspected }: IncidentClassification): boolean {
  return (
    confidence < CONFIDENCE_THRESHOLD ||
    (severityConfidence != null && severityConfidence < CONFIDENCE_THRESHOLD) ||
    (REVIEW_SEVERITIES as readonly string[]).includes(severity) ||
    hoaxSuspected
  );
}
