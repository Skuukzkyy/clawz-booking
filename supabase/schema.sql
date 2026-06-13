-- ─────────────────────────────────────────────────────────────
-- CLAWZ BY NURIN · Booking system schema
-- Run this once in Supabase → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────

-- Bookings ----------------------------------------------------
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  date_key      text not null,                 -- 'YYYY-MM-DD'
  slot_idx      int  not null,                 -- index into the slot template
  name          text not null,
  fb            text,
  phone         text not null,
  service_id    text not null,
  service       text not null,
  service_group text,
  price         int  not null default 0,
  removal       text,
  removal_price int  not null default 0,
  note          text,
  status        text not null default 'pending'
                check (status in ('pending', 'confirmed', 'declined')),
  created_at    timestamptz not null default now()
);

-- THE double-booking guard: at most one active booking per slot.
-- Two simultaneous requests can both pass an app-level check, but
-- they cannot both pass this index.
create unique index if not exists one_active_booking_per_slot
  on public.bookings (date_key, slot_idx)
  where status <> 'declined';

-- Day config (promo vs regular) -------------------------------
create table if not exists public.day_config (
  date_key text primary key,
  mode     text not null check (mode in ('promo', 'regular'))
);

-- Public view: what anonymous clients may see.
-- First name + removal tag only — phone numbers and full names
-- never leave the database for unauthenticated users.
create or replace view public.public_slots
with (security_invoker = off) as
select
  date_key,
  slot_idx,
  status,
  split_part(trim(name), ' ', 1) as display_name,
  case
    when service_id = 'removal-only' then 'r.o'
    when removal is not null then 'r'
    else null
  end as tag
from public.bookings
where status <> 'declined';

-- Row Level Security ------------------------------------------
alter table public.bookings  enable row level security;
alter table public.day_config enable row level security;

-- Anonymous clients: may ONLY insert pending bookings.
-- No select/update/delete on the base table.
create policy "anon can request a slot"
  on public.bookings for insert
  to anon
  with check (status = 'pending');

-- Owner (any authenticated user): full access.
create policy "owner full access to bookings"
  on public.bookings for all
  to authenticated
  using (true) with check (true);

-- Day config: anyone may read, only owner may change.
create policy "anyone can read day config"
  on public.day_config for select
  to anon, authenticated
  using (true);

create policy "owner manages day config"
  on public.day_config for all
  to authenticated
  using (true) with check (true);

-- Grants -------------------------------------------------------
grant select on public.public_slots to anon, authenticated;
