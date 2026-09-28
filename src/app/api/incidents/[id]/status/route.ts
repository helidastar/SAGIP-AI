import { withStaff } from "@/lib/auth";
import { REPORT_STATUSES } from "@/lib/constants";
import { getIncidentRow, STATUS_TRANSITIONS } from "@/lib/reports/incidents";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportStatus } from "@/types";

/** Body: { status, notes? }. Responders may only update incidents assigned to their team. */
export const PATCH = withStaff(async (request, ctx: RouteContext<"/api/incidents/[id]/status">, staff) => {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const status = body?.status as ReportStatus;
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  if (!REPORT_STATUSES.includes(status)) {
    return Response.json({ error: `status must be one of ${REPORT_STATUSES.join(", ")}` }, { status: 400 });
  }

  const db = createAdminClient();
  const row = await getIncidentRow(db, id);
  if (!row) return Response.json({ error: "Incident not found" }, { status: 404 });

  if (staff.role !== "admin") {
    if (!row.team_id || row.team_id !== staff.teamId) {
      return Response.json({ error: "Only the assigned team or an admin can update this incident" }, { status: 403 });
    }
    if (status === "rejected") return Response.json({ error: "Only admins can reject incidents" }, { status: 403 });
  }

  const allowed = STATUS_TRANSITIONS[row.status] ?? [];
  if (!allowed.includes(status)) {
    return Response.json(
      { error: `Cannot change status from ${row.status} to ${status}`, allowed },
      { status: 409 },
    );
  }

  const { data: updated, error } = await db
    .from("reports")
    .update({ status })
    .eq("id", id)
    .eq("status", row.status) // guard against concurrent changes
    .select("id, status, updated_at");
  if (error) throw error;
  if (!updated?.length) return Response.json({ error: "Incident changed, reload and retry" }, { status: 409 });

  await db.from("audit_logs").insert({
    report_id: id,
    actor_id: staff.id,
    action: "status_changed",
    before: { status: row.status },
    after: { status, notes },
  });

  return Response.json({ id, status, updatedAt: updated[0].updated_at });
});
