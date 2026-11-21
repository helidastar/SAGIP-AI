-- "Severity %" (ISS-027: the AI's confidence in its severity tier, 0-100%) is already
-- computed by every classifier (src/lib/ai/normalize.ts, severityConfidence) but was never
-- saved anywhere (AI 22 / Backend 19). Store it alongside the rest of each classification.
alter table public.classifications
  add column severity_confidence numeric;

comment on column public.classifications.severity_confidence is
  'AI confidence in the severity tier alone, 0-1. Null when the provider did not report one (e.g. the keyword fallback).';
