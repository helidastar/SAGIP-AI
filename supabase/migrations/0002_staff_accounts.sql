-- Auto-create a profile when a staff user is created in Supabase Auth.
-- Create users in Dashboard → Authentication → Add user. Role/name come from user metadata, e.g.
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = '...';
-- app_metadata (not user_metadata) is used for role because users cannot edit it themselves.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(nullif(new.raw_app_meta_data ->> 'role', ''), 'responder')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper for policies
create or replace function public.is_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- Admins manage teams and profiles
create policy "admin write" on public.teams for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
