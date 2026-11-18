import { CONFIDENCE_THRESHOLD, REVIEW_SEVERITIES } from "@/lib/constants";
import type { IncidentClassification } from "./types";

/**
 * Why a report should be checked first. low_confidence = type confidence, or severity confidence when the
 * classifier gives one, below the threshold. Keyword fallback shows up as low_confidence (confidence is always 0).
 */
export type CheckFirstReason = "low_confidence" | "high_severity" | "possible_hoax" | "risky_type_severity";

/**
 * Types where the local model under-rates severity. All 6 missed urgent photos in the 2026-11-18 laptop
 * benchmark (88% type, 6 missed urgent) were of these types, rated moderate or low. Any report of these
 * types that is not high or critical is checked first, so it moves to the top of the queue.
 */
const SEVERITY_RISK_TYPES: readonly string[] = ["landslide", "structural_damage", "road_accident", "fallen_debris", "medical_emergency"];

/**
 * Every report goes to a person first (review-first, decided 2026-11-13): the AI's type and
 * severity are only a pre-filled draft. These 4 triggers no longer decide WHETHER a report is
 * reviewed; they flag it to be checked first, at the top of the review queue.
 */
export function checkFirstReasons({ incidentType, confidence, severity, severityConfidence, hoaxSuspected }: IncidentClassification): CheckFirstReason[] {
  const reasons: CheckFirstReason[] = [];
  const unsureSeverity = severityConfidence != null && severityConfidence < CONFIDENCE_THRESHOLD;
  if (confidence < CONFIDENCE_THRESHOLD || unsureSeverity) reasons.push("low_confidence");
  if ((REVIEW_SEVERITIES as readonly string[]).includes(severity)) reasons.push("high_severity");
  const urgent = (REVIEW_SEVERITIES as readonly string[]).includes(severity);
  if (!urgent && SEVERITY_RISK_TYPES.includes(incidentType)) reasons.push("risky_type_severity");
  if (hoaxSuspected) reasons.push("possible_hoax");
  return reasons;
}

/** True if any check-first trigger fires. The benchmark counts urgent photos without one as "missed urgent". */
export function needsReview(result: IncidentClassification): boolean {
  return checkFirstReasons(result).length > 0;
}
