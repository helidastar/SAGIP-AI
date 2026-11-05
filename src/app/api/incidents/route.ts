import { withStaff } from "@/lib/auth";
import { INCIDENT_TYPES, REPORT_STATUSES } from "@/lib/constants";
import { OPEN_STATUSES, toIncident, type IncidentRow } from "@/lib/reports/incidents";
import { PRIORITY_BANDS } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";

const csv = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

/**
 * Ranked incident list (highest priority first).
 * Query: status=a,b (default: open), band=P1,P2, type=flood, teamId, limit (≤100), offset
 */
export const GET = withStaff(async (request) => {
  const params = new URL(request.url).searchParams;
  const statuses = csv(params.get("status"));
  const bands = csv(params.get("band"));
  const types = csv(params.get("type"));
  const teamId = params.get("teamId");
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 50));
  const offset = Math.max(0, Number(params.get("offset")) || 0);

  const bad =
    statuses.find((s) => !(REPORT_STATUSES as readonly string[]).includes(s)) ??
    bands.find((b) => !PRIORITY_BANDS.some((p) => p.band === b)) ??
    types.find((t) => !(INCIDENT_TYPES as readonly string[]).includes(t));
  if (bad) return Response.json({ error: `Invalid filter value: ${bad}` }, { status: 400 });

  let query = createAdminClient()
    .from("incidents")
    .select("*", { count: "exact" })
    .in("status", statuses.length ? statuses : OPEN_STATUSES)
    .order("score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (bands.length) query = query.in("band", bands);
  if (types.length) query = query.in("confirmed_type", types);
  if (teamId) query = query.eq("team_id", teamId);

  const { data, count, error } = await query.returns<IncidentRow[]>();
  if (error) {
    console.error("Incident list failed", error);
    return Response.json({ error: "Could not load incidents" }, { status: 500 });
  }
  return Response.json({ items: data.map(toIncident), total: count ?? 0, limit, offset });
});
