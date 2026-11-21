import { withStaff } from "@/lib/auth";
import { parseRange, summarize, type AnalyticsRow } from "@/lib/reports/analytics";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE = 1000;
const MAX_ROWS = 10_000;

/**
 * Incident volume by type, severity, status, band, area and day (Philippine time).
 * Query: from, to (ISO dates; default last 7 days; at most 92 days). Staff only.
 */
export const GET = withStaff(async (request) => {
  const params = new URL(request.url).searchParams;
  const range = parseRange(params.get("from"), params.get("to"));
  if ("error" in range) return Response.json({ error: range.error }, { status: 400 });

  const db = createAdminClient();
  const rows: AnalyticsRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await db
      .from("incidents")
      .select("status, confirmed_type, confirmed_severity, band, area_name, created_at")
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString())
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1)
      .returns<AnalyticsRow[]>();
    if (error) {
      console.error("Analytics query failed", error);
      return Response.json({ error: "Could not load analytics" }, { status: 500 });
    }
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  return Response.json({ ...summarize(rows, range.from, range.to), truncated: rows.length >= MAX_ROWS });
});
