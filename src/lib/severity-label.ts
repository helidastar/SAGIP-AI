import type { Severity } from "@/types";

/**
 * Severity chip text with the AI's severity confidence (DOCUMENTATION.md 6.4), e.g. "High · 82%".
 * Shows "–" when the classifier gave no severity confidence (keyword matcher, or a model without the severity head).
 */
export function severityWithPercent(severity: Severity | string, severityConfidence?: number | null): string {
  const name = severity.charAt(0).toUpperCase() + severity.slice(1).replace(/_/g, " ");
  if (severityConfidence == null || !Number.isFinite(severityConfidence)) return `${name} · –`;
  const pct = Math.round(Math.min(1, Math.max(0, severityConfidence)) * 100);
  return `${name} · ${pct}%`;
}
