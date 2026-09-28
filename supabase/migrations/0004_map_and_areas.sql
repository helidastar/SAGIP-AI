-- Map helpers: GeoJSON in/out for areas, bbox index for incidents.
alter table public.areas add constraint areas_name_key unique (name);

-- Insert or update an area from a GeoJSON Polygon/MultiPolygon geometry.
create or replace function public.upsert_area(
  p_name text, p_population int, p_risk_index numeric, p_geojson jsonb
) returns uuid language sql as $$
  insert into public.areas (name, population, risk_index, boundary)
  values (p_name, p_population, p_risk_index,
          st_multi(st_setsrid(st_geomfromgeojson(p_geojson::text), 4326))::geography)
  on conflict (name) do update
    set population = excluded.population,
        risk_index = excluded.risk_index,
        boundary = excluded.boundary
  returning id
$$;
revoke execute on function public.upsert_area from anon, authenticated;

-- Areas as a GeoJSON FeatureCollection (for map overlays).
create or replace function public.areas_geojson() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature',
      'id', a.id,
      'geometry', st_asgeojson(a.boundary::geometry, 6)::jsonb,
      'properties', jsonb_build_object('name', a.name, 'population', a.population, 'riskIndex', a.risk_index)
    )), '[]'::jsonb)
  )
  from public.areas a
$$;

-- Backfill area_id for reports submitted before their area existed.
create or replace function public.backfill_report_areas() returns int language sql as $$
  with updated as (
    update public.reports r set area_id = a.id
    from public.areas a
    where r.area_id is null and st_intersects(a.boundary, r.location)
    returning 1
  )
  select count(*)::int from updated
$$;
revoke execute on function public.backfill_report_areas from anon, authenticated;
