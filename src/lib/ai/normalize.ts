import { INCIDENT_TYPES, SEVERITY } from "@/lib/constants";
import type { IncidentClassification } from "./types";

/**
 * USD per 1M tokens [input, output], paid-tier standard list prices for text/image input
 * (ai.google.dev/gemini-api/docs/pricing, checked 2026-10-29). The free tier is billed $0,
 * so on the free tier these are what the call would cost if paid; the daily cap counts that.
 * 3.6/3.8 flash rise to [1.5, 7.5] on 2027-01-01, after the defense.
 */
const PRICES: Record<string, [number, number]> = {
  "gemini-2.5-flash": [0.3, 2.5],
  "gemini-2.5-flash-lite": [0.1, 0.4],
  "gemini-3-flash-preview": [0.5, 3.0],
  "gemini-3.1-flash-lite": [0.25, 1.5],
  "gemini-3.5-flash-lite": [0.3, 2.5],
  "gemini-3.6-flash": [0.75, 3.75],
  "gemini-3.8-flash": [0.75, 3.75],
};

export function estimateCost(model: string, inputTokens?: number, outputTokens?: number) {
  const price = PRICES[model];
  if (!price || inputTokens === undefined || outputTokens === undefined) return null;
  return (inputTokens * price[0] + outputTokens * price[1]) / 1_000_000;
}

/** Validate model output — never trust it blindly. Unknown values fall back to safe defaults. */
export function normalizeClassification(raw: unknown): IncidentClassification {
  const r = (raw ?? {}) as Record<string, unknown>;
  const incidentType = (INCIDENT_TYPES as readonly unknown[]).includes(r.incidentType)
    ? (r.incidentType as IncidentClassification["incidentType"])
    : "other";
  const severity = typeof r.severity === "string" && r.severity in SEVERITY
    ? (r.severity as IncidentClassification["severity"])
    : "moderate";
  const confidence = Math.min(1, Math.max(0, Number(r.confidence) || 0));
  const hazards = Array.isArray(r.hazards) ? r.hazards.map(String).slice(0, 10) : [];
  const hoaxSuspected = r.hoaxSuspected === true;
  // Severity % (DOCUMENTATION.md 6.4). Missing or invalid = null, shown as "–".
  const sc = Number(r.severityConfidence);
  const severityConfidence = r.severityConfidence == null || !Number.isFinite(sc) ? null : Math.min(1, Math.max(0, sc));
  return { incidentType, severity, confidence, hazards, hoaxSuspected, severityConfidence };
}
