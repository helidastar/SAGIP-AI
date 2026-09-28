import { withStaff } from "@/lib/auth";
import { getIncidentRow } from "@/lib/reports/incidents";
import { PRIORITY_BANDS, toBand } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin only. Manually override the priority.
 * Body: { score } (band derived) or { band } (score set to band minimum), plus required { reason }.
 */
export const PATCH = withStaff(async (request, ctx: RouteContext<"/api/incidents/[id]/priority">, staff) => {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 2000) : "";
  if (!reason) return Response.json({ error: "reason is required for overrides" }, { status: 400 });

  let score: number;
  let band: string;
  if (typeof body?.score === "number" && body.score >= 0 && body.score <= 100) {
    score = Math.round(body.score * 10) / 10;
    band = toBand(score).band;
  } else if (PRIORITY_BANDS.some((b) => b.band === body?.band)) {
    band = body.band;
    const current = PRIORITY_BANDS.find((b) => b.band === band)!;
    score = current.min;
  } else {
    return Response.json({ error: "Provide score (0–100) or band (P1–P4)" }, { status: 400 });
  }

  const db = createAdminClient();
  const row = await getIncidentRow(db, id);
  if (!row) return Response.json({ error: "Incident not found" }, { status: 404 });

  const { error } = await db.from("priority_scores").upsert({
    report_id: id,
    score,
    band,
    breakdown: row.breakdown ?? {},
    overridden: true,
    computed_at: new Date().toISOString(),
  });
  if (error) throw error;

  await db.from("audit_logs").insert({
    report_id: id,
    actor_id: staff.id,
    action: "priority_overridden",
    before: { score: row.score, band: row.band, overridden: row.overridden },
    after: { score, band, overridden: true, reason },
  });

  return Response.json({ id, priority: { score, band, breakdown: row.breakdown, overridden: true } });
}, "admin");
