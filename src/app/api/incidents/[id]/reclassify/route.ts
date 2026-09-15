import { withStaff } from "@/lib/auth";
import { classifyReport } from "@/lib/reports/classify";
import { getIncidentRow } from "@/lib/reports/incidents";
import { createAdminClient } from "@/lib/supabase/admin";

const RECLASSIFIABLE = ["received", "pending_review", "classified"];

/**
 * Admin only. Re-run AI classification (e.g. after switching models).
 * A new classification row is always stored. Reviewed reports keep their human decision;
 * unreviewed ones are re-routed (to review or re-scored) based on the new result.
 */
export const POST = withStaff(async (_request, ctx: RouteContext<"/api/incidents/[id]/reclassify">, staff) => {
  const { id } = await ctx.params;
  const db = createAdminClient();

  const row = await getIncidentRow(db, id);
  if (!row) return Response.json({ error: "Incident not found" }, { status: 404 });
  if (!RECLASSIFIABLE.includes(row.status)) {
    return Response.json({ error: `Cannot reclassify an incident with status ${row.status}` }, { status: 409 });
  }

  const { data: review } = await db.from("reviews").select("id").eq("report_id", id).maybeSingle();
  const humanConfirmed = !!review;

  // Reviewed reports: still record the AI run for benchmarking, but don't touch status or score.
  const run = await classifyReport(db, {
    id,
    description: row.description,
    areaId: row.area_id,
    photoPath: row.photo_path,
    route: !humanConfirmed,
  });
  const outcome = humanConfirmed ? { ...run, status: row.status } : run;

  if (!outcome.result) {
    return Response.json({ error: "Classification failed, try again later" }, { status: 502 });
  }

  if (!humanConfirmed) {
    const classified = outcome.status === "classified";
    await db.from("reports").update({
      status: outcome.status,
      confirmed_type: classified ? outcome.result.incidentType : null,
      confirmed_severity: classified ? outcome.result.severity : null,
    }).eq("id", id);
    if (!classified) await db.from("priority_scores").delete().eq("report_id", id);
  }

  await db.from("audit_logs").insert({
    report_id: id,
    actor_id: staff.id,
    action: "reclassified",
    before: { status: row.status, confirmedType: row.confirmed_type, confirmedSeverity: row.confirmed_severity },
    after: { status: outcome.status, model: outcome.model, keptHumanReview: humanConfirmed },
  });

  const r = outcome.result;
  return Response.json({
    id,
    status: outcome.status,
    keptHumanReview: humanConfirmed,
    classification: {
      model: outcome.model,
      incidentType: r.incidentType,
      severity: r.severity,
      confidence: r.confidence,
      hazards: r.hazards,
      latencyMs: r.latencyMs,
      costUsd: r.costUsd,
    },
  });
}, "admin");
