// Seeds SIMULATED Cebu City demo reports (no pilot partner; the defense runs in simulation mode).
// Usage: npm run seed:demo   (run `npm run seed` first so the Cebu City areas and teams exist)
//
// Reads scripts/data/demo-reports.json. Re-running deletes the old demo reports (tracking codes
// starting with SGP-DEM) and inserts them again with fresh timestamps, so the queue looks live.
// No AI provider is called: each report carries a simulated classification, and reports the
// review rules would flag stay in the review queue unless the file gives a simulated review.
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { needsReview } from "@/lib/ai/review";
import { computePriority } from "@/lib/scoring";
import type { IncidentType, ReportStatus, Severity } from "@/types";

const DEMO_CODE_PREFIX = "SGP-DEM";

interface DemoReport {
  code: string;
  area: string;
  lat: number;
  lng: number;
  minutesAgo: number;
  description: string;
  ai: {
    provider: "local" | "gemini" | "keyword";
    incidentType: IncidentType;
    severity: Severity;
    confidence: number;
    severityConfidence: number | null;
    hazards: string[];
    hoaxSuspected: boolean;
  };
  review: { finalType: IncidentType; finalSeverity: Severity; notes: string } | null;
  status: ReportStatus;
  team?: string;
}

async function loadDemoReports(): Promise<DemoReport[]> {
  const file = new URL("./data/demo-reports.json", import.meta.url);
  return JSON.parse(await readFile(file, "utf8")).reports;
}

const MODEL_LABEL = { local: "demo:local", gemini: "demo:gemini", keyword: "keyword-fallback" } as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const reports = await loadDemoReports();

  const [{ data: areas, error: areaError }, { data: teams, error: teamError }] = await Promise.all([
    db.from("areas").select("id, name, population, risk_index"),
    db.from("teams").select("id, name"),
  ]);
  if (areaError) throw areaError;
  if (teamError) throw teamError;
  const maxPopulation = Math.max(0, ...areas.map((a) => Number(a.population) || 0));

  const { error: deleteError, count } = await db
    .from("reports")
    .delete({ count: "exact" })
    .like("tracking_code", `${DEMO_CODE_PREFIX}%`);
  if (deleteError) throw deleteError;
  console.log(`Old demo reports removed: ${count ?? 0}`);

  let ok = 0;
  for (const r of reports) {
    const area = areas.find((a) => a.name === r.area);
    if (!area) throw new Error(`Area "${r.area}" not found. Run \`npm run seed\` first.`);
    const team = r.team ? teams.find((t) => t.name === r.team) : undefined;
    if (r.team && !team) throw new Error(`Team "${r.team}" not found. Run \`npm run seed\` first.`);

    const final = r.review
      ? { type: r.review.finalType, severity: r.review.finalSeverity }
      : r.status === "pending_review"
        ? null
        : { type: r.ai.incidentType, severity: r.ai.severity };
    const createdAt = new Date(Date.now() - r.minutesAgo * 60_000).toISOString();

    const { data: report, error } = await db
      .from("reports")
      .insert({
        tracking_code: r.code,
        description: r.description,
        location: `SRID=4326;POINT(${r.lng} ${r.lat})`,
        area_id: area.id,
        status: r.status,
        confirmed_type: final?.type ?? null,
        confirmed_severity: final?.severity ?? null,
        created_at: createdAt,
      })
      .select("id")
      .single();
    if (error) throw error;

    const rows: PromiseLike<{ error: unknown }>[] = [
      db.from("classifications").insert({
        report_id: report.id,
        model: MODEL_LABEL[r.ai.provider],
        incident_type: r.ai.incidentType,
        severity: r.ai.severity,
        confidence: r.ai.confidence,
        severity_confidence: r.ai.severityConfidence,
        hazards: r.ai.hazards,
        hoax_suspected: r.ai.hoaxSuspected,
        raw_response: { simulated: true, provider: r.ai.provider },
        latency_ms: 0,
        cost_usd: 0,
        created_at: createdAt,
      }),
      db.from("audit_logs").insert({ report_id: report.id, action: "demo_seeded", after: { status: r.status } }),
    ];
    if (r.review) {
      rows.push(db.from("reviews").insert({ report_id: report.id, final_type: r.review.finalType, final_severity: r.review.finalSeverity, notes: r.review.notes }));
    }
    if (final) {
      const priority = computePriority({
        severity: final.severity,
        incidentType: final.type,
        populationNorm: maxPopulation > 0 ? Number(area.population) / maxPopulation : 0,
        locationRiskNorm: Number(area.risk_index) || 0,
      });
      rows.push(db.from("priority_scores").insert({ report_id: report.id, score: priority.score, band: priority.band.band, breakdown: priority.breakdown }));
    }
    if (team) rows.push(db.from("assignments").insert({ report_id: report.id, team_id: team.id, assigned_at: createdAt }));

    for (const { error: rowError } of await Promise.all(rows)) if (rowError) throw rowError;
    ok++;
  }

  const queued = reports.filter((r) => r.status === "pending_review").length;
  const flagged = reports.filter((r) => needsReview(r.ai)).length;
  console.log(`Demo reports: ${ok}/${reports.length} inserted (${queued} in the review queue, ${flagged} flagged by the review rules)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
