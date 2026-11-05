import { createAdminClient } from "@/lib/supabase/admin";

const PUBLIC_STATUS: Record<string, string> = {
  received: "Report received",
  pending_review: "Being reviewed by responders",
  classified: "Verified, awaiting dispatch",
  assigned: "Responder assigned",
  in_progress: "Responders on the way",
  resolved: "Resolved",
  rejected: "Closed",
};

export async function GET(_request: Request, ctx: RouteContext<"/api/reports/track/[trackingCode]">) {
  const { trackingCode } = await ctx.params;
  const { data, error } = await createAdminClient()
    .from("reports")
    .select("tracking_code, status, confirmed_type, updated_at")
    .eq("tracking_code", trackingCode.toUpperCase())
    .maybeSingle();

  if (error) return Response.json({ error: "Lookup failed" }, { status: 500 });
  if (!data) return Response.json({ error: "Report not found" }, { status: 404 });

  return Response.json({
    trackingCode: data.tracking_code,
    status: data.status,
    publicStatus: PUBLIC_STATUS[data.status] ?? data.status,
    incidentType: data.confirmed_type,
    updatedAt: data.updated_at,
  });
}
