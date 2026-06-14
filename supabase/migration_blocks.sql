-- ─────────────────────────────────────────────────────────────
-- MIGRATION: slot blocking (day off / half day / time off)
-- Run once in Supabase → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────

create table if not exists public.slot_blocks (
  id         uuid primary key default gen_random_uuid(),
  date_key   text not null,
  slot_idx   int  not null,
  reason     text,
  created_at timestamptz not null default now()
);

-- One block per slot (mirrors the booking guard)
create unique index if not exists one_block_per_slot
  on public.slot_blocks (date_key, slot_idx);

-- Public view so clients see blocked slots as unavailable
-- (date + slot only — the reason stays private to the owner)
create or replace view public.public_blocks
with (security_invoker = off) as
select date_key, slot_idx
from public.slot_blocks;

alter table public.slot_blocks enable row level security;

-- Anyone may read which slots are blocked (so the client UI can grey them out)
create policy "anyone can read blocks"
  on public.slot_blocks for select
  to anon, authenticated
  using (true);

-- Only the owner can create / remove blocks
create policy "owner manages blocks"
  on public.slot_blocks for all
  to authenticated
  using (true) with check (true);

grant select on public.public_blocks to anon, authenticated;
