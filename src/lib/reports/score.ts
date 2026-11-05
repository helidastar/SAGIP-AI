import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computePriority } from "@/lib/scoring";
import type { IncidentType, Severity } from "@/types";

/** Loads area population/risk for a report's area (0 if unknown). */
export async function getAreaFactors(db: SupabaseClient, areaId: string | null) {
  if (!areaId) return { populationNorm: 0, locationRiskNorm: 0 };
  const [{ data: area }, { data: largest }] = await Promise.all([
    db.from("areas").select("population, risk_index").eq("id", areaId).maybeSingle(),
    db.from("areas").select("population").order("population", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const max = Number(largest?.population) || 0;
  return {
    populationNorm: area && max > 0 ? Number(area.population) / max : 0,
    locationRiskNorm: Number(area?.risk_index) || 0,
  };
}

/** Computes and saves the priority score for a report. */
export async function scoreReport(
  db: SupabaseClient,
  reportId: string,
  input: { severity: Severity; incidentType: IncidentType; populationNorm: number; locationRiskNorm: number },
) {
  const priority = computePriority(input);
  const { error } = await db.from("priority_scores").upsert({
    report_id: reportId,
    score: priority.score,
    band: priority.band.band,
    breakdown: priority.breakdown,
    overridden: false,
    computed_at: new Date().toISOString(),
  });
  if (error) throw error;
  return priority;
}
