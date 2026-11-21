// Seeds teams and areas into Supabase.
// Usage: node --env-file=.env.local scripts/seed.mjs [path/to/areas.geojson]
//
// The GeoJSON must be a FeatureCollection of Polygon/MultiPolygon features with properties:
//   name (string), population (number), riskIndex (0 to 1)
// Defaults to scripts/data/areas.cebu-city.geojson: SIMULATION data for the Cebu City demo (real barangay
// names, rough rectangles, estimated populations, simulation risk indices; not official data).
// Demo reports are loaded separately: npm run seed:demo
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const TEAMS = ["Fire Response", "Medical Response", "Search and Rescue", "Road Clearing"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const file = process.argv[2] ?? new URL("./data/areas.cebu-city.geojson", import.meta.url);
const geojson = JSON.parse(await readFile(file, "utf8"));

const { data: existing, error: teamReadError } = await db.from("teams").select("name");
if (teamReadError) throw teamReadError;
const missing = TEAMS.filter((name) => !existing.some((t) => t.name === name));
if (missing.length) {
  const { error } = await db.from("teams").insert(missing.map((name) => ({ name })));
  if (error) throw error;
}
console.log(`Teams: ${missing.length} added, ${TEAMS.length - missing.length} already present`);

// The old placeholder areas overlapped the Cebu City ones, so remove them. Reports linked to them are
// unlinked first, then re-linked to the Cebu City area they fall in by the backfill below.
const OLD_PLACEHOLDER_AREAS = ["Sample Area A", "Sample Area B", "Sample Area C"];
const { data: oldAreas, error: oldReadError } = await db.from("areas").select("id").in("name", OLD_PLACEHOLDER_AREAS);
if (oldReadError) throw oldReadError;
if (oldAreas.length) {
  const ids = oldAreas.map((a) => a.id);
  const { error: unlinkError } = await db.from("reports").update({ area_id: null }).in("area_id", ids);
  if (unlinkError) throw unlinkError;
  const { error: deleteError } = await db.from("areas").delete().in("id", ids);
  if (deleteError) throw deleteError;
  console.log(`Old placeholder areas removed: ${ids.length}`);
}

let ok = 0;
for (const f of geojson.features) {
  const { name, population, riskIndex } = f.properties ?? {};
  if (!name || !["Polygon", "MultiPolygon"].includes(f.geometry?.type)) {
    console.warn(`Skipping feature without name or polygon geometry: ${name ?? "(unnamed)"}`);
    continue;
  }
  const { error } = await db.rpc("upsert_area", {
    p_name: name,
    p_population: Math.round(Number(population) || 0),
    p_risk_index: Math.min(1, Math.max(0, Number(riskIndex) || 0)),
    p_geojson: f.geometry,
  });
  if (error) console.error(`Area "${name}" failed:`, error.message);
  else ok++;
}
console.log(`Areas: ${ok}/${geojson.features.length} upserted`);

const { data: backfilled, error: backfillError } = await db.rpc("backfill_report_areas");
if (backfillError) throw backfillError;
console.log(`Reports linked to areas: ${backfilled}`);
