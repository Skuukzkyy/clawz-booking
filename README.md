# Clawz By Nurin — Online Slot Booking

A real-time appointment booking system built for a home-based nail studio in
Guimba, Nueva Ecija, replacing a Facebook comment-based scheduling workflow.

**Before:** the studio posted weekly slot lists on Facebook; clients raced to
comment "mine + date and time"; the owner manually edited the post and replied
to every comment to confirm. Double-claims, buried comments, and an edit per
booking.

**After:** clients tap an open slot, the slot locks instantly for everyone,
and the owner confirms with one tap from an authenticated dashboard.

## Stack

- **React + Vite** — static SPA, hash-routed (`/` clients, `/#/admin` owner)
- **Supabase** — Postgres, Row Level Security, email auth
- **Cloudflare Pages** — hosting, free tier, commercial use permitted

## Design decisions worth noting

- **Double-booking is prevented by the database, not the app.** A partial
  unique index (`one_active_booking_per_slot`) guarantees at most one active
  booking per slot — concurrent requests race safely; the loser gets a
  `23505` and a friendly "slot just taken" message.
- **Client privacy by schema.** Anonymous users can only read a
  `public_slots` view exposing first name + removal tag. Phone numbers and
  full names are unreachable without authentication — enforced by RLS and
  grants, not by frontend code.
- **Domain modeling mirrors the real business**: promo vs regular days,
  two concurrent chairs (duplicate slots), express slots, `(r)`/`(r.o)`
  removal notation, and the studio's actual policies (no same-day booking,
  48-hour reschedule, late fees).

## Setup

### 1. Supabase
1. Create a project (region: Southeast Asia / Singapore).
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Authentication → Users → **Add user** → create the owner's email +
   password (signups are not exposed in the UI by design).
4. Project Settings → API → copy the **Project URL** and **anon public key**.

### 2. Cloudflare Pages
1. Workers & Pages → Create → Pages → **Connect to Git** → pick this repo.
2. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
3. Environment variables (Production):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Client page at `/`, owner dashboard at `/#/admin`.

### Local dev
```bash
npm install
cp .env.example .env   # fill in your Supabase values
npm run dev
```

## Roadmap
- Supabase Realtime subscription to replace 8s polling
- Messenger/SMS notification on confirm (e.g. Semaphore for PH SMS)
- Booking history + no-show tracking per client
- Owner-editable slot templates and price list

# Deployed via GitHub Actions → Cloudflare Pages

<!-- ci check -->
