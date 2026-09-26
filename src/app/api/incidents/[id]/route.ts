import { withStaff } from "@/lib/auth";
import { getIncidentRow, toIncident } from "@/lib/reports/incidents";
import { createAdminClient, PHOTO_BUCKET } from "@/lib/supabase/admin";

/** Full incident detail: classifications, review, priority, assignments, audit log. */
export const GET = withStaff(async (_request, ctx: RouteContext<"/api/incidents/[id]">) => {
  const { id } = await ctx.params;
  const db = createAdminClient();

  const row = await getIncidentRow(db, id);
  if (!row) return Response.json({ error: "Incident not found" }, { status: 404 });

  const [classifications, review, assignments, audit, photo] = await Promise.all([
    db.from("classifications")
      .select("id, model, incident_type, severity, confidence, hazards, hoax_suspected, latency_ms, created_at")
      .eq("report_id", id).order("created_at", { ascending: false }),
    db.from("reviews")
      .select("final_type, final_severity, notes, created_at, reviewer:profiles ( id, full_name )")
      .eq("report_id", id).maybeSingle(),
    db.from("assignments")
      .select("id, assigned_at, team:teams ( id, name ), assigned_by:profiles ( id, full_name )")
      .eq("report_id", id).order("assigned_at", { ascending: false }),
    db.from("audit_logs")
      .select("id, actor_id, action, before, after, created_at")
      .eq("report_id", id).order("created_at", { ascending: false }),
    row.photo_path
      ? db.storage.from(PHOTO_BUCKET).createSignedUrl(row.photo_path, 600)
      : Promise.resolve({ data: null }),
  ]);

  return Response.json({
    ...toIncident(row),
    photoUrl: photo.data?.signedUrl ?? null,
    classifications: (classifications.data ?? []).map((c) => ({
      id: c.id,
      model: c.model,
      incidentType: c.incident_type,
      severity: c.severity,
      confidence: Number(c.confidence),
      hazards: c.hazards,
      hoaxSuspected: c.hoax_suspected,
      latencyMs: c.latency_ms,
      createdAt: c.created_at,
    })),
    review: review.data && {
      finalType: review.data.final_type,
      finalSeverity: review.data.final_severity,
      notes: review.data.notes,
      reviewer: review.data.reviewer,
      createdAt: review.data.created_at,
    },
    assignments: (assignments.data ?? []).map((a) => ({
      id: a.id,
      team: a.team,
      assignedBy: a.assigned_by,
      assignedAt: a.assigned_at,
    })),
    auditLog: (audit.data ?? []).map((l) => ({
      id: l.id,
      actorId: l.actor_id,
      action: l.action,
      before: l.before,
      after: l.after,
      createdAt: l.created_at,
    })),
  });
});
