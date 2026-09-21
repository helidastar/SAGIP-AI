-- Functions are executable by PUBLIC by default, so revoking from anon/authenticated alone
-- (0004) left these callable through the Data API. Only the service role should run them.
revoke execute on function public.upsert_area(text, int, numeric, jsonb) from public, anon, authenticated;
revoke execute on function public.backfill_report_areas() from public, anon, authenticated;
grant execute on function public.upsert_area(text, int, numeric, jsonb) to service_role;
grant execute on function public.backfill_report_areas() to service_role;
