import { withStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Area boundaries as GeoJSON, for map overlays. */
export const GET = withStaff(async () => {
  const { data, error } = await createAdminClient().rpc("areas_geojson");
  if (error) {
    console.error("Areas failed", error);
    return Response.json({ error: "Could not load areas" }, { status: 500 });
  }
  return Response.json(data);
});
