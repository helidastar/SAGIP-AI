import { INCIDENT_TYPES, SEVERITY } from "@/lib/constants";
import type { IncidentClassification } from "./types";

/** USD per 1M tokens [input, output]. List prices; reconfirm before benchmarking. */
const PRICES: Record<string, [number, number]> = {
  "gemini-2.5-flash": [0.3, 2.5],
  "gemini-2.5-flash-lite": [0.1, 0.4],
  "claude-haiku-4-5": [1, 5],
  "claude-sonnet-5": [2, 10],
  "claude-opus-5": [5, 25],
  // Llama prices vary by host (Groq, Together, OpenRouter, self-hosted). These are
  // Groq's; override them if you point AI_BASE_URL somewhere else, or the cost
  // component of the benchmark score will be wrong.
  "llama-4-scout-17b-16e-instruct": [0.11, 0.34],
  "llama-4-maverick-17b-128e-instruct": [0.2, 0.6],
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
  return { incidentType, severity, confidence, hazards };
}
