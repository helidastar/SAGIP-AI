-- Flattened, ranked view of reports for the dashboard (lat/lng extracted from PostGIS).
create or replace view public.incidents
with (security_invoker = true) as
select
  r.id,
  r.tracking_code,
  r.description,
  r.photo_path,
  r.status,
  r.confirmed_type,
  r.confirmed_severity,
  st_y(r.location::geometry) as lat,
  st_x(r.location::geometry) as lng,
  r.area_id,
  a.name as area_name,
  p.score,
  p.band,
  p.breakdown,
  p.overridden,
  (select s.team_id from public.assignments s
    where s.report_id = r.id order by s.assigned_at desc limit 1) as team_id,
  r.created_at,
  r.updated_at
from public.reports r
left join public.areas a on a.id = r.area_id
left join public.priority_scores p on p.report_id = r.id;

create index if not exists assignments_report_idx on public.assignments (report_id, assigned_at desc);

-- Responders update status on reports assigned to their team; admins on any report.
create policy "responder status update" on public.reports for update
  using (
    public.is_admin() or exists (
      select 1 from public.assignments s join public.profiles pr on pr.team_id = s.team_id
      where s.report_id = reports.id and pr.id = auth.uid()
    )
  );
