-- SAGIP-AI initial schema. Run in Supabase SQL Editor (or `supabase db push`).
create extension if not exists postgis;

-- Staff profiles (id = auth.users.id)
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'responder' check (role in ('responder', 'admin')),
  team_id uuid references public.teams (id)
);

-- Barangay / zone polygons used by scoring
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  population int not null default 0,
  risk_index numeric not null default 0 check (risk_index between 0 and 1),
  boundary geography(multipolygon, 4326) not null
);
create index areas_boundary_idx on public.areas using gist (boundary);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  description text not null default '',
  photo_path text,
  location geography(point, 4326) not null,
  area_id uuid references public.areas (id),
  status text not null default 'received' check (status in
    ('received', 'pending_review', 'classified', 'assigned', 'in_progress', 'resolved', 'rejected')),
  confirmed_type text,
  confirmed_severity text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_location_idx on public.reports using gist (location);
create index reports_status_idx on public.reports (status);

-- Append-only log of every AI run
create table public.classifications (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  model text not null,
  incident_type text not null,
  severity text not null,
  confidence numeric not null,
  hazards text[] not null default '{}',
  raw_response jsonb,
  latency_ms int,
  cost_usd numeric,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.reports (id) on delete cascade,
  reviewer_id uuid references public.profiles (id),
  final_type text not null,
  final_severity text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.priority_scores (
  report_id uuid primary key references public.reports (id) on delete cascade,
  score numeric not null,
  band text not null,
  breakdown jsonb not null,
  overridden boolean not null default false,
  computed_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  team_id uuid not null references public.teams (id),
  assigned_by uuid references public.profiles (id),
  assigned_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete cascade,
  actor_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

-- Find the area containing a point, with population normalized against the largest area.
create or replace function public.area_for_point(lat double precision, lng double precision)
returns table (id uuid, name text, population_norm double precision, risk_index double precision)
language sql stable as $$
  select a.id, a.name,
         coalesce(a.population::float / nullif((select max(population) from public.areas), 0), 0),
         a.risk_index::float
  from public.areas a
  where st_intersects(a.boundary, st_setsrid(st_makepoint(lng, lat), 4326)::geography)
  limit 1
$$;

-- Row Level Security. The API uses the service role key (bypasses RLS) for citizen intake;
-- these policies govern direct access from logged-in staff in the browser.
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.reports enable row level security;
alter table public.classifications enable row level security;
alter table public.reviews enable row level security;
alter table public.priority_scores enable row level security;
alter table public.assignments enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_staff() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid())
$$;

create policy "staff read" on public.teams for select using (public.is_staff());
create policy "staff read" on public.profiles for select using (public.is_staff());
create policy "public read" on public.areas for select using (true);
create policy "staff read" on public.reports for select using (public.is_staff());
create policy "staff read" on public.classifications for select using (public.is_staff());
create policy "staff read" on public.reviews for select using (public.is_staff());
create policy "staff read" on public.priority_scores for select using (public.is_staff());
create policy "staff read" on public.assignments for select using (public.is_staff());
create policy "staff read" on public.audit_logs for select using (public.is_staff());

-- Private bucket for report photos (dashboard uses signed URLs)
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

-- Realtime for the dashboard's ranked list
alter publication supabase_realtime add table public.reports, public.priority_scores;
