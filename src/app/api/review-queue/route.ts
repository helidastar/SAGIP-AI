import { withStaff } from "@/lib/auth";
import { keywordClassifier } from "@/lib/ai/keyword";
import { createAdminClient, PHOTO_BUCKET } from "@/lib/supabase/admin";

const SIGNED_URL_SECONDS = 60 * 10;
/** "received" reports older than this are treated as stuck (background classification died) and shown for review. */
const STUCK_AFTER_MS = 5 * 60 * 1000;
const URGENT_SEVERITIES = ["high", "critical"];

/**
 * Reports awaiting human review, with their latest classification.
 * Order: keyword-fallback high/critical first (no AI looked at these), then oldest first.
 */
export const GET = withStaff(async () => {
  const db = createAdminClient();
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const { data, error } = await db
    .from("reports")
    .select(`
      id, tracking_code, description, photo_path, status, created_at,
      area:areas ( name ),
      classifications ( model, incident_type, severity, confidence, hazards, created_at )
    `)
    .or(`status.eq.pending_review,and(status.eq.received,created_at.lt.${stuckBefore})`)
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

  const items = data.map((r) => {
    const c = r.classifications[0];
    const area = Array.isArray(r.area) ? r.area[0] : r.area;
    const keywordOnly = c?.model === keywordClassifier.model;
    return {
      id: r.id,
      trackingCode: r.tracking_code,
      description: r.description,
      photoUrl: r.photo_path ? urlByPath.get(r.photo_path) ?? null : null,
      area: area?.name ?? null,
      status: r.status,
      stuck: r.status === "received",
      createdAt: r.created_at,
      /** True when no AI reviewed this report (providers failed or over budget). */
      keywordOnly,
      urgentUnverified: keywordOnly && URGENT_SEVERITIES.includes(c?.severity),
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
  });

  // Stable sort keeps oldest-first within each group.
  items.sort((a, b) => Number(b.urgentUnverified) - Number(a.urgentUnverified));

  return Response.json({ items });
});
