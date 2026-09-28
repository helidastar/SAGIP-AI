import { withStaff } from "@/lib/auth";
import { INCIDENT_TYPES, SEVERITY } from "@/lib/constants";
import { getAreaFactors, scoreReport } from "@/lib/reports/score";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IncidentType, Severity } from "@/types";

/**
 * Confirm or correct a flagged report's classification.
 * Body: { finalType, finalSeverity, notes? } or { reject: true, notes? }
 */
export const POST = withStaff(async (request, ctx: RouteContext<"/api/reports/[id]/review">, staff) => {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  const reject = body?.reject === true;
  const finalType = body?.finalType as IncidentType;
  const finalSeverity = body?.finalSeverity as Severity;

  if (!reject && (!INCIDENT_TYPES.includes(finalType) || !(finalSeverity in SEVERITY))) {
    return Response.json(
      { error: `finalType must be one of ${INCIDENT_TYPES.join(", ")}; finalSeverity one of ${Object.keys(SEVERITY).join(", ")}` },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data: report } = await db
    .from("reports")
    .select("id, status, area_id, confirmed_type, confirmed_severity")
    .eq("id", id)
    .maybeSingle();
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status !== "pending_review") {
    return Response.json({ error: `Report is not pending review (status: ${report.status})` }, { status: 409 });
  }

  // Claim the report atomically so two reviewers can't both submit.
  const newStatus = reject ? "rejected" : "classified";
  const { data: claimed, error: updateError } = await db
    .from("reports")
    .update({
      status: newStatus,
      confirmed_type: reject ? null : finalType,
      confirmed_severity: reject ? null : finalSeverity,
    })
    .eq("id", id)
    .eq("status", "pending_review")
    .select("id");
  if (updateError) throw updateError;
  if (!claimed?.length) return Response.json({ error: "Report was already reviewed" }, { status: 409 });

  if (!reject) {
    const { error } = await db.from("reviews").insert({
      report_id: id,
      reviewer_id: staff.id,
      final_type: finalType,
      final_severity: finalSeverity,
      notes,
    });
    if (error) throw error;
  }

  const priority = reject
    ? null
    : await scoreReport(db, id, {
        severity: finalSeverity,
        incidentType: finalType,
        ...(await getAreaFactors(db, report.area_id)),
      });

  await db.from("audit_logs").insert({
    report_id: id,
    actor_id: staff.id,
    action: reject ? "report_rejected" : "report_reviewed",
    before: { status: report.status, confirmedType: report.confirmed_type, confirmedSeverity: report.confirmed_severity },
    after: { status: newStatus, confirmedType: reject ? null : finalType, confirmedSeverity: reject ? null : finalSeverity, notes },
  });

  return Response.json({
    id,
    status: newStatus,
    review: reject ? null : { finalType, finalSeverity, notes, reviewerId: staff.id },
    priority: priority && { score: priority.score, band: priority.band.band, breakdown: priority.breakdown },
  });
});
