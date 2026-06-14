-- ─────────────────────────────────────────────────────────────
-- MIGRATION: prevent booking a slot that was removed (race condition)
-- A foreign key ties each booking to an existing day_slots row, so if
-- the owner removes a slot while a client is mid-booking, the client's
-- insert fails at the database instead of creating an orphan booking.
-- Run once in Supabase → SQL Editor → New query → Run.
-- ─────────────────────────────────────────────────────────────

-- day_slots already has primary key (date_key, slot_idx), which the FK needs.

-- Clean any orphan bookings first (defensive; normally none), so the FK
-- can be created. This only removes bookings whose slot no longer exists.
delete from public.bookings b
where not exists (
  select 1 from public.day_slots s
  where s.date_key = b.date_key and s.slot_idx = b.slot_idx
);

alter table public.bookings
  drop constraint if exists bookings_slot_fk;

alter table public.bookings
  add constraint bookings_slot_fk
  foreign key (date_key, slot_idx)
  references public.day_slots (date_key, slot_idx)
  on delete restrict;

-- on delete restrict = Postgres will refuse to delete a day_slots row that
-- still has a booking. This is the same guarantee the app's "can't remove a
-- booked slot" check gives, now enforced at the database level too.
