import { withStaff } from "@/lib/auth";
import { checkFirstReasons } from "@/lib/ai";
import { keywordClassifier } from "@/lib/ai/keyword";
import { createAdminClient, PHOTO_BUCKET } from "@/lib/supabase/admin";

const SIGNED_URL_SECONDS = 60 * 10;
/** "received" reports older than this are treated as stuck (background classification died) and shown for review. */
const STUCK_AFTER_MS = 5 * 60 * 1000;
const URGENT_SEVERITIES = ["high", "critical"];

/**
 * Every report awaiting human review (review-first: all reports come here), with the AI's
 * latest classification as a draft and its draft priority score.
 * Order: check-first reports (a review trigger fired, stuck, or no AI result) first, keyword-fallback
 * high/critical at the very top; then highest draft score; then oldest first.
 */
export const GET = withStaff(async () => {
  const db = createAdminClient();
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const { data, error } = await db
    .from("reports")
    .select(`
      id, tracking_code, description, photo_path, status, created_at,
      area:areas ( name ),
      priority:priority_scores ( score, band ),
      classifications ( model, incident_type, severity, confidence, severity_confidence, hazards, hoax_suspected, created_at )
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
    const priority = Array.isArray(r.priority) ? r.priority[0] : r.priority;
    const classification = c
      ? {
          model: c.model,
          incidentType: c.incident_type,
          severity: c.severity,
          confidence: Number(c.confidence),
          severityConfidence: c.severity_confidence == null ? null : Number(c.severity_confidence),
          hazards: c.hazards,
          hoaxSuspected: c.hoax_suspected,
        }
      : null;
    const checkFirst = classification ? checkFirstReasons(classification) : [];
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
      /** Review triggers that fired (low_confidence, high_severity, possible_hoax): check these first. */
      checkFirst,
      /** Draft score from the AI's answer; replaced when staff confirm. Null if not scored yet. */
      draftPriority: priority ? { score: Number(priority.score), band: priority.band } : null,
      classification,
    };
  });

  // Stable sort keeps oldest-first within each group.
  const group = (i: (typeof items)[number]) =>
    i.urgentUnverified ? 2 : i.checkFirst.length > 0 || i.stuck || !i.classification ? 1 : 0;
  items.sort((a, b) => group(b) - group(a) || (b.draftPriority?.score ?? -1) - (a.draftPriority?.score ?? -1));

  return Response.json({ items });
});
