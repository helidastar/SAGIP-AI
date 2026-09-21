import { withStaff } from "@/lib/auth";
import { getIncidentRow } from "@/lib/reports/incidents";
import { createAdminClient } from "@/lib/supabase/admin";

const ASSIGNABLE = ["classified", "assigned", "in_progress"];

/** Admin only. Body: { teamId }. Reassigning keeps history in `assignments`. */
export const POST = withStaff(async (request, ctx: RouteContext<"/api/incidents/[id]/assign">, staff) => {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const teamId = typeof body?.teamId === "string" ? body.teamId : "";
  if (!teamId) return Response.json({ error: "teamId is required" }, { status: 400 });

  const db = createAdminClient();
  const [row, { data: team }] = await Promise.all([
    getIncidentRow(db, id),
    db.from("teams").select("id, name").eq("id", teamId).maybeSingle(),
  ]);
  if (!row) return Response.json({ error: "Incident not found" }, { status: 404 });
  if (!team) return Response.json({ error: "Team not found" }, { status: 404 });
  if (!ASSIGNABLE.includes(row.status)) {
    return Response.json({ error: `Cannot assign an incident with status ${row.status}` }, { status: 409 });
  }

  const { data: assignment, error } = await db
    .from("assignments")
    .insert({ report_id: id, team_id: teamId, assigned_by: staff.id })
    .select("id, assigned_at")
    .single();
  if (error) throw error;

  const status = row.status === "classified" ? "assigned" : row.status;
  if (status !== row.status) {
    const { error: updateError } = await db.from("reports").update({ status }).eq("id", id);
    if (updateError) throw updateError;
  }

  await db.from("audit_logs").insert({
    report_id: id,
    actor_id: staff.id,
    action: "team_assigned",
    before: { status: row.status, teamId: row.team_id },
    after: { status, teamId },
  });

  return Response.json(
    { id, status, assignment: { id: assignment.id, team, assignedAt: assignment.assigned_at } },
    { status: 201 },
  );
}, "admin");
