import { withStaff } from "@/lib/auth";
import { OPEN_STATUSES, type IncidentRow } from "@/lib/reports/incidents";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FEATURES = 1000;

/**
 * Open incidents as GeoJSON points.
 * Query: bbox=minLng,minLat,maxLng,maxLat (optional; omit for all open incidents)
 */
export const GET = withStaff(async (request) => {
  const bboxParam = new URL(request.url).searchParams.get("bbox");
  let query = createAdminClient()
    .from("incidents")
    .select("id, tracking_code, status, confirmed_type, confirmed_severity, lat, lng, area_name, score, band, created_at")
    .in("status", OPEN_STATUSES)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(MAX_FEATURES);

  if (bboxParam) {
    const bbox = bboxParam.split(",").map(Number);
    const [minLng, minLat, maxLng, maxLat] = bbox;
    if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n)) || minLng > maxLng || minLat > maxLat) {
      return Response.json({ error: "bbox must be minLng,minLat,maxLng,maxLat" }, { status: 400 });
    }
    query = query.gte("lng", minLng).lte("lng", maxLng).gte("lat", minLat).lte("lat", maxLat);
  }

  const { data, error } = await query.returns<IncidentRow[]>();
  if (error) {
    console.error("Incident map failed", error);
    return Response.json({ error: "Could not load map data" }, { status: 500 });
  }

  return Response.json({
    type: "FeatureCollection",
    features: data.map((r) => ({
      type: "Feature",
      id: r.id,
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        trackingCode: r.tracking_code,
        status: r.status,
        incidentType: r.confirmed_type,
        severity: r.confirmed_severity,
        area: r.area_name,
        score: r.score === null ? null : Number(r.score),
        band: r.band,
        createdAt: r.created_at,
      },
    })),
  });
});
