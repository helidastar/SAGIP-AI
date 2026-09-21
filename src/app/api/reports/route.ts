import { after } from "next/server";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { processReceivedReport } from "@/lib/reports/classify";
import { submitReport } from "@/lib/reports/intake";
import { createAdminClient } from "@/lib/supabase/admin";

// Background classification (retry + fallback provider) can take up to ~60s.
export const maxDuration = 90;

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const rateLimit = createRateLimiter({
  limit: Number(process.env.REPORT_RATE_LIMIT ?? 5),
  windowMs: Number(process.env.REPORT_RATE_WINDOW_MS ?? 10 * 60 * 1000),
});

export async function POST(request: Request) {
  const limited = rateLimit(clientIp(request));
  if (!limited.allowed) {
    return Response.json(
      { error: "Too many reports from this device. Please wait before submitting again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const form = await request.formData();
  const description = String(form.get("description") ?? "").trim().slice(0, 2000);
  // Number(null) and Number("") are 0, so require non-empty values first.
  const rawLat = String(form.get("lat") ?? "").trim();
  const rawLng = String(form.get("lng") ?? "").trim();
  const lat = rawLat ? Number(rawLat) : NaN;
  const lng = rawLng ? Number(rawLng) : NaN;
  const photo = form.get("photo");

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "Valid lat and lng are required" }, { status: 400 });
  }
  if (photo !== null && !(photo instanceof File)) {
    return Response.json({ error: "photo must be a file" }, { status: 400 });
  }
  if (photo && (!photo.type.startsWith("image/") || photo.size > MAX_PHOTO_BYTES)) {
    return Response.json({ error: "photo must be an image under 10MB" }, { status: 400 });
  }
  if (!description && !photo) {
    return Response.json({ error: "Provide a photo or a description" }, { status: 400 });
  }

  try {
    const result = await submitReport({ description, lat, lng, photo: photo ?? undefined });
    after(() => processReceivedReport(createAdminClient(), result.id));
    return Response.json(
      { ...result, message: "Report received. Save your tracking code to check its status." },
      { status: 201 },
    );
  } catch (err) {
    console.error("Report intake failed", err);
    return Response.json({ error: "Could not submit report" }, { status: 500 });
  }
}
