import "server-only";
import { randomBytes } from "node:crypto";
import { getClassifier, needsReview } from "@/lib/ai";
import { computePriority } from "@/lib/scoring";
import { createAdminClient, PHOTO_BUCKET } from "@/lib/supabase/admin";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generateTrackingCode() {
  const bytes = randomBytes(6);
  return "SGP-" + Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export interface IntakeInput {
  description: string;
  lat: number;
  lng: number;
  photo?: File;
}

/** Store report → upload photo → AI classify → route to review or score. */
export async function submitReport({ description, lat, lng, photo }: IntakeInput) {
  const db = createAdminClient();
  const trackingCode = generateTrackingCode();

  const { data: area } = await db.rpc("area_for_point", { lat, lng }).maybeSingle<{
    id: string; population_norm: number; risk_index: number;
  }>();

  let photoPath: string | undefined;
  let image: { data: Buffer; mimeType: string } | undefined;
  if (photo && photo.size > 0) {
    image = { data: Buffer.from(await photo.arrayBuffer()), mimeType: photo.type };
    photoPath = `${trackingCode}/${Date.now()}-${photo.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await db.storage.from(PHOTO_BUCKET).upload(photoPath, image.data, { contentType: photo.type });
    if (error) throw error;
  }

  const { data: report, error } = await db
    .from("reports")
    .insert({
      tracking_code: trackingCode,
      description,
      photo_path: photoPath,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      area_id: area?.id,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Classification failures must not lose the report — fall back to human review.
  let status: "pending_review" | "classified" = "pending_review";
  try {
    const classifier = getClassifier();
    const result = await classifier.classify({ image, description });
    await db.from("classifications").insert({
      report_id: report.id,
      model: classifier.model,
      incident_type: result.incidentType,
      severity: result.severity,
      confidence: result.confidence,
      hazards: result.hazards,
      raw_response: result.raw,
      latency_ms: result.latencyMs,
    });

    if (!needsReview(result)) {
      status = "classified";
      const priority = computePriority({
        severity: result.severity,
        incidentType: result.incidentType,
        populationNorm: area?.population_norm ?? 0,
        locationRiskNorm: area?.risk_index ?? 0,
      });
      await db.from("priority_scores").upsert({
        report_id: report.id,
        score: priority.score,
        band: priority.band.band,
        breakdown: priority.breakdown,
      });
      await db.from("reports").update({
        confirmed_type: result.incidentType,
        confirmed_severity: result.severity,
      }).eq("id", report.id);
    }
  } catch (err) {
    console.error("Classification failed", report.id, err);
  }

  await db.from("reports").update({ status }).eq("id", report.id);
  await db.from("audit_logs").insert({ report_id: report.id, action: "report_submitted", after: { status } });

  return { id: report.id as string, trackingCode, status };
}
