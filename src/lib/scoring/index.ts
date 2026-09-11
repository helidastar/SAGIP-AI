import { PRIORITY_WEIGHTS, SEVERITY, TYPE_WEIGHTS } from "@/lib/constants";
import type { IncidentType, Severity } from "@/types";

export const PRIORITY_BANDS = [
  { band: "P1", min: 80, label: "Immediate" },
  { band: "P2", min: 60, label: "Urgent" },
  { band: "P3", min: 40, label: "Standard" },
  { band: "P4", min: 0, label: "Low" },
] as const;

export type PriorityBand = (typeof PRIORITY_BANDS)[number];

export interface PriorityInput {
  severity: Severity;
  incidentType: IncidentType;
  /** Affected population, normalized to 0 to 1 */
  populationNorm: number;
  /** Area risk index, normalized to 0 to 1 */
  locationRiskNorm: number;
}

export interface PriorityResult {
  score: number;
  band: PriorityBand;
  breakdown: { severity: number; population: number; locationRisk: number; type: number };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function toBand(score: number): PriorityBand {
  return PRIORITY_BANDS.find((b) => score >= b.min) ?? PRIORITY_BANDS[PRIORITY_BANDS.length - 1];
}

/** Deterministic, explainable priority score (0 to 100). No LLM calls here. */
export function computePriority(input: PriorityInput): PriorityResult {
  const severityNorm = SEVERITY[input.severity] / SEVERITY.critical;
  const breakdown = {
    severity: round1(100 * PRIORITY_WEIGHTS.severity * severityNorm),
    population: round1(100 * PRIORITY_WEIGHTS.population * clamp01(input.populationNorm)),
    locationRisk: round1(100 * PRIORITY_WEIGHTS.locationRisk * clamp01(input.locationRiskNorm)),
    type: round1(100 * PRIORITY_WEIGHTS.type * TYPE_WEIGHTS[input.incidentType]),
  };
  const score = round1(
    breakdown.severity + breakdown.population + breakdown.locationRisk + breakdown.type,
  );
  return { score, band: toBand(score), breakdown };
}
