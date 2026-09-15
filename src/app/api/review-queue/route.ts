import { withStaff } from "@/lib/auth";
import { createAdminClient, PHOTO_BUCKET } from "@/lib/supabase/admin";

const SIGNED_URL_SECONDS = 60 * 10;

/** Reports awaiting human review, oldest first, with their latest AI classification. */
export const GET = withStaff(async () => {
  const db = createAdminClient();
  const { data, error } = await db
    .from("reports")
    .select(`
      id, tracking_code, description, photo_path, created_at,
      area:areas ( name ),
      classifications ( model, incident_type, severity, confidence, hazards, created_at )
    `)
    .eq("status", "pending_review")
    .order("created_at", { ascending: true })
    .order("created_at", { referencedTable: "classifications", ascending: false })
    .limit(1, { referencedTable: "classifications" });
  if (error) {
    console.error("Review queue failed", error);
    return Response.json({ error: "Could not load review queue" }, { status: 500 });
  }

  const paths = data.map((r) => r.photo_path).filter((p): p is string => !!p);
  const { data: signed } = paths.length
    ? await db.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
    : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return Response.json({
    items: data.map((r) => {
      const c = r.classifications[0];
      const area = Array.isArray(r.area) ? r.area[0] : r.area;
      return {
        id: r.id,
        trackingCode: r.tracking_code,
        description: r.description,
        photoUrl: r.photo_path ? urlByPath.get(r.photo_path) ?? null : null,
        area: area?.name ?? null,
        createdAt: r.created_at,
        classification: c
          ? {
              model: c.model,
              incidentType: c.incident_type,
              severity: c.severity,
              confidence: Number(c.confidence),
              hazards: c.hazards,
            }
          : null,
      };
    }),
  });
});
