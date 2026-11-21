import { CONFIDENCE_THRESHOLD, REVIEW_SEVERITIES } from "@/lib/constants";
import type { IncidentClassification } from "./types";

/**
 * Why a report should be checked first. low_confidence = type confidence, or severity confidence when the
 * classifier gives one, below the threshold. Keyword fallback shows up as low_confidence (confidence is always 0).
 */
export type CheckFirstReason = "low_confidence" | "high_severity" | "possible_hoax";

/**
 * Every report goes to a person first (review-first, decided 2026-11-13): the AI's type and
 * severity are only a pre-filled draft. These 4 triggers no longer decide WHETHER a report is
 * reviewed; they flag it to be checked first, at the top of the review queue.
 */
export function checkFirstReasons({ confidence, severity, severityConfidence, hoaxSuspected }: IncidentClassification): CheckFirstReason[] {
  const reasons: CheckFirstReason[] = [];
  const unsureSeverity = severityConfidence != null && severityConfidence < CONFIDENCE_THRESHOLD;
  if (confidence < CONFIDENCE_THRESHOLD || unsureSeverity) reasons.push("low_confidence");
  if ((REVIEW_SEVERITIES as readonly string[]).includes(severity)) reasons.push("high_severity");
  if (hoaxSuspected) reasons.push("possible_hoax");
  return reasons;
}

/** True if any check-first trigger fires. The benchmark counts urgent photos without one as "missed urgent". */
export function needsReview(result: IncidentClassification): boolean {
  return checkFirstReasons(result).length > 0;
}
