import "server-only";
import { randomBytes } from "node:crypto";
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

/** Store the report and original photo. Classification runs afterwards (see processReceivedReport). */
export async function submitReport({ description, lat, lng, photo }: IntakeInput) {
  const db = createAdminClient();
  const trackingCode = generateTrackingCode();

  const { data: area } = await db.rpc("area_for_point", { lat, lng }).maybeSingle<{ id: string }>();

  let photoPath: string | undefined;
  if (photo && photo.size > 0) {
    photoPath = `${trackingCode}/${Date.now()}-${photo.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await db.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type });
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
      status: "received",
    })
    .select("id")
    .single();
  if (error) throw error;

  await db.from("audit_logs").insert({ report_id: report.id, action: "report_submitted", after: { status: "received" } });

  return { id: report.id as string, trackingCode, status: "received" as const };
}
