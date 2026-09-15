import { submitReport } from "@/lib/reports/intake";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const description = String(form.get("description") ?? "").trim().slice(0, 2000);
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
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
    return Response.json(
      { ...result, message: "Report received. Save your tracking code to check its status." },
      { status: 201 },
    );
  } catch (err) {
    console.error("Report intake failed", err);
    return Response.json({ error: "Could not submit report" }, { status: 500 });
  }
}
