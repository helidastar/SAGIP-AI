-- The AI classifier can now flag a report as a likely hoax/prank/spam (see
-- src/lib/ai/prompt.ts). It never auto-rejects one — a flagged report still goes to
-- human review, this just helps reviewers spot it faster.
alter table public.classifications
  add column hoax_suspected boolean not null default false;
