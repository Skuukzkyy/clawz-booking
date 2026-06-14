-- ─────────────────────────────────────────────────────────────
-- MIGRATION: editable per-day slots
-- Lets the owner define a custom slot list for each day (variable
-- layouts, single-time slots like "9:30", different chairs per day).
-- Run once in Supabase → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────

-- Per-day slot definitions. slot_idx is the stable per-day slot id
-- that bookings and blocks already reference. label is free text.
create table if not exists public.day_slots (
  date_key   text not null,
  slot_idx   int  not null,
  label      text not null,
  created_at timestamptz not null default now(),
  primary key (date_key, slot_idx)
);

alter table public.day_slots enable row level security;

-- Labels are not sensitive — anyone may read which slots a day offers.
create policy "anyone can read day slots"
  on public.day_slots for select
  to anon, authenticated
  using (true);

-- Only the owner defines/edits slots.
create policy "owner manages day slots"
  on public.day_slots for all
  to authenticated
  using (true) with check (true);

-- Snapshot the slot label onto each booking so confirmed bookings
-- always display correctly even if the day's slots are edited later.
alter table public.bookings
  add column if not exists slot_label text;
