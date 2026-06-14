-- ─────────────────────────────────────────────────────────────
-- MIGRATION: self-seeding future days (database-side, pg_cron)
-- Ensures the next 15 days always have the default slot template, so
-- clients can book newly-opened days even before the owner logs in.
-- Idempotent and NON-DESTRUCTIVE: only seeds days that have zero slots,
-- so the owner's per-day customizations are never overwritten.
-- Run once in Supabase → SQL Editor → New query → Run.
-- ─────────────────────────────────────────────────────────────

create extension if not exists pg_cron;

-- The default slot template, encoded as (slot_idx, start_min, end_min, label).
-- end_min NULL = single-time (express) slot.
create or replace function public.seed_default_days(horizon_days int default 15)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date;
  tomorrow date := (now() at time zone 'Asia/Manila')::date + 1;
begin
  for i in 0..(horizon_days - 1) loop
    d := tomorrow + i;
    -- only seed days that have no slots at all (never overwrite custom days)
    if not exists (select 1 from public.day_slots where date_key = to_char(d, 'YYYY-MM-DD')) then
      insert into public.day_slots (date_key, slot_idx, start_min, end_min, label) values
        (to_char(d,'YYYY-MM-DD'), 0,  480, 600,  '8am – 10am'),
        (to_char(d,'YYYY-MM-DD'), 1,  480, 600,  '8am – 10am'),
        (to_char(d,'YYYY-MM-DD'), 2,  540, 660,  '9am – 11am'),
        (to_char(d,'YYYY-MM-DD'), 3,  600, 720,  '10am – 12nn'),
        (to_char(d,'YYYY-MM-DD'), 4,  630, null, '10:30am'),
        (to_char(d,'YYYY-MM-DD'), 5,  780, 900,  '1pm – 3pm'),
        (to_char(d,'YYYY-MM-DD'), 6,  780, 900,  '1pm – 3pm'),
        (to_char(d,'YYYY-MM-DD'), 7,  840, 960,  '2pm – 4pm'),
        (to_char(d,'YYYY-MM-DD'), 8,  900, 1020, '3pm – 5pm'),
        (to_char(d,'YYYY-MM-DD'), 9,  930, null, '3:30pm'),
        (to_char(d,'YYYY-MM-DD'), 10, 960, 1080, '4pm – 6pm'),
        (to_char(d,'YYYY-MM-DD'), 11, 1020, 1140,'5pm – 7pm'),
        (to_char(d,'YYYY-MM-DD'), 12, 1050, null, '5:30pm'),
        (to_char(d,'YYYY-MM-DD'), 13, 1080, 1200,'6pm – 8pm'),
        (to_char(d,'YYYY-MM-DD'), 14, 1140, 1260,'7pm – 9pm');
    end if;
  end loop;
end;
$$;

-- Seed immediately so the next 15 days are ready right now.
select public.seed_default_days(15);

-- Schedule it daily at 20:00 UTC (= 4:00 AM Manila), so each new day that
-- rolls into the booking window is born with slots before clients wake up.
-- Unschedule any previous version first to avoid duplicates.
select cron.unschedule('seed-default-days')
  where exists (select 1 from cron.job where jobname = 'seed-default-days');

select cron.schedule(
  'seed-default-days',
  '0 20 * * *',
  $$ select public.seed_default_days(15); $$
);
