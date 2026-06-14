-- ─────────────────────────────────────────────────────────────
-- MIGRATION: structured slot times
-- Adds start/end minute columns so slots are picked from dropdowns
-- (validated, consistently formatted) and sorted chronologically.
-- Run once in Supabase → SQL Editor → New query → Run.
-- (Safe to run even if day_slots already exists.)
-- ─────────────────────────────────────────────────────────────

alter table public.day_slots
  add column if not exists start_min int,
  add column if not exists end_min   int;

-- If any rows predate this change, they can be cleared safely since the
-- feature is new and unused in production:
-- delete from public.day_slots where start_min is null;
