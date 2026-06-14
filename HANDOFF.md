# Clawz By Nurin — Project Handoff

A real-time booking system for a home-based nail studio in Guimba, Nueva Ecija,
replacing their Facebook comment-based scheduling. Built as a portfolio project
by Jerick (GitHub: Skuukzkyy) with the intent of having real users.

This document is the single source of truth for resuming work in a new session.

---

## 1. What this replaces

The studio posts a weekly "Slots for next week‼️" list on Facebook. Clients
comment "mine + date/time"; the owner manually edits the post after each claim
and replies to confirm. Problems: double-claims, buried comments, and one post
edit per booking. The app makes slots tap-to-claim with instant locking and
one-tap owner confirmation.

---

## 2. Live URLs

- **Client booking page:** https://clawz-booking.pages.dev
- **Owner dashboard:** https://clawz-booking.pages.dev/#/admin
- **Repo:** https://github.com/Skuukzkyy/clawz-booking (public)

---

## 3. Architecture

```
Browser (React SPA, hash-routed)
  /        → Booking.jsx  (public, anon role)
  /#/admin → Admin.jsx    (owner, authenticated via Supabase email/password)
        │
        │  @supabase/supabase-js  (publishable key, safe in browser)
        ▼
Cloudflare Pages (static host + CDN + SSL)   Supabase (Postgres + Auth)
  serves built dist/                            Auth: owner email/password
                                                Postgres tables + RLS + views
```

Key principles:
- **No backend server.** React talks directly to Postgres via Supabase client.
- **Security is enforced in the database (RLS), not the frontend.** The
  publishable key is meant to ship in browser code; Row Level Security is the
  real boundary.
- **Double-booking prevented by a Postgres partial unique index**, not app
  logic. Concurrent inserts race safely; the loser gets error 23505.
- **Client privacy by schema.** Anonymous users read only privacy-safe VIEWS
  (first name + tag). Phone numbers / full names are unreachable without an
  authenticated session.

---

## 4. Tech stack & accounts

| Service | Role | Account |
|---|---|---|
| GitHub | Repo + CI/CD (Actions) | Skuukzkyy |
| Cloudflare Pages | Hosting, CDN, SSL | Arlanticojerick09@gmail.com |
| Supabase | Postgres + Auth | project ref `qnvrzydzxnajivkjolaz` |

- **Supabase URL:** `https://qnvrzydzxnajivkjolaz.supabase.co`
- **Supabase publishable key:** `sb_publishable_LQXBWzErYWiCObgbBkAflQ_wMYY6Dt4`
  (public by design — protected by RLS; safe to commit/share)
- Supabase region: Singapore (Southeast Asia)
- New user signups are DISABLED in Supabase Auth (owner accounts created
  manually only).

### Secrets (never in repo — stored in GitHub repo secrets)
- `CLOUDFLARE_API_TOKEN` — scoped to Pages:Edit only
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

GitHub PATs used during setup were fine-grained, single-repo, short-expiry, and
revoked after use. A working PAT may still be active for the current session;
revoke when iteration is done.

---

## 5. CI/CD

Two GitHub Actions workflows (`.github/workflows/`):

- **deploy.yml** — on push to `main` (and manual dispatch): `npm ci` → build
  with VITE_ secrets → `wrangler pages deploy dist --project-name=clawz-booking`.
  Uses `cloudflare/wrangler-action@v3`.
- **keepalive.yml** — cron every 3 days (and manual): curls the `public_slots`
  REST endpoint to keep the Supabase free-tier project from pausing after 7
  days of inactivity. Reuses the VITE_ secrets.

To deploy a change: push to `main`. To verify: GitHub → Actions → green check,
then check the live URL.

Note: Cloudflare Git integration was NOT used (the connect flow has an OAuth
loop bug on mobile). Deploys go through GitHub Actions instead. The repo is
otherwise fully CI-ready if someone wants to connect Git from a desktop later.

---

## 6. Data model (Supabase Postgres)

Base tables (owner-only writes via RLS unless noted):
- **bookings** — id, date_key ('YYYY-MM-DD'), slot_idx (int), name, fb, phone,
  service_id, service, service_group, price, removal, removal_price, note,
  status ('pending'|'confirmed'|'declined'), created_at.
  - anon may INSERT only rows with status='pending'. No anon SELECT/UPDATE/DELETE.
  - partial unique index `one_active_booking_per_slot` on (date_key, slot_idx)
    where status <> 'declined' — the double-booking guard.
- **day_config** — date_key (pk), mode ('promo'|'regular'). anon read, owner write.
- **slot_blocks** — id, date_key, slot_idx, reason, created_at. Owner-managed
  time-off / closed slots. Unique index `one_block_per_slot`. (SEE MIGRATION
  STATUS BELOW.)

Privacy-safe views (granted to anon):
- **public_slots** — date_key, slot_idx, status, display_name (first name only),
  tag ('r' | 'r.o' | null). Excludes declined.
- **public_blocks** — date_key, slot_idx only (reason stays private).

Full schema: `supabase/schema.sql`. Blocks migration: `supabase/migration_blocks.sql`.

---

## 7. Domain rules (mirrors the real studio)

- **Slot template** (15 slots/day, defined in `src/shared.js` SLOT_TEMPLATE):
  8-10, 8-10 (two chairs), 9-11, 10-12, 10:30 (express), 1-3, 1-3 (two chairs),
  2-4, 3-5, 3:30 (express), 4-6, 5-7, 5:30 (express), 6-8, 7-9.
- **Promo vs Regular days:** promo = ₱299 fixed set. Default Mon/Tue/Wed promo,
  rest regular (`defaultPromo` in shared.js); owner can override per-day.
- **Prices** (shared.js SERVICES): Gel Polish 249/299/349, Softgel 299/349/399.
  Removals: gel ₱49, softgel ₱99. "Removal only" is a bookable service type.
- **Tags:** (r) = booking with removal, (r.o) = removal only. Auto-generated.
- **Policies shown to clients:** no same-day booking (slots start tomorrow),
  non-transferable, 48-hr reschedule, ₱50 late fee at 15min / cancel at 25min,
  one companion, one-week warranty.
- **Owner access:** hidden — the client page has no visible link to /#/admin.

---

## 8. File map

```
src/
  App.jsx        hash router: / → Booking, /#/admin → Admin
  Booking.jsx    client page — reads public views, inserts pending bookings
  Admin.jsx      owner dashboard — auth, confirm/decline, promo toggle,
                 time-off/availability management
  shared.js      SLOT_TEMPLATE, SERVICES, REMOVALS, promo logic, helpers
  lib/supabase.js  Supabase client (reads VITE_ env vars)
  styles.css     all styling (cream/brown/cherry brand)
supabase/
  schema.sql            base tables, RLS, views, double-booking index
  migration_blocks.sql  slot_blocks table + view + RLS
.github/workflows/
  deploy.yml      auto-deploy on push
  keepalive.yml   3-day Supabase ping
```

Brand: cream `#FBF5EF` / blush `#F6DDD3` / brown `#5C4033` / cherry `#D8232A`.
Fonts: Cormorant Garamond (headings), Karla (body), Yellowtail (script byline).

---

## 9. CURRENT STATUS / OPEN ITEMS

### ⚠️ Pending migration (do before/with next deploy)
The **time-off & availability** feature (slot blocking) is CODED and BUILDS, but
its database table is NOT yet created in production. Before the deploy that
includes it goes live, run `supabase/migration_blocks.sql` in the Supabase SQL
editor, or the availability section will error.

As of this handoff: the blocking code is committed locally / about to be pushed;
confirm whether the migration has been run and whether the deploy has shipped.

### To do before sharing with the owner
- [ ] Run the slot_blocks migration in Supabase.
- [ ] Create the owner's own login (Supabase → Auth → Users → Add user →
      Create new user, Auto Confirm ON). Do NOT give them Jerick's personal
      email session. Note the email/password to put in the intro message.
- [ ] Clear test bookings (Joy, Renalyn, Jerick) from the dashboard so they
      see a clean week.
- [ ] Send the intro message (honest portfolio framing; includes both the
      client URL and the owner dashboard URL + their test credentials).

### Known limitations / future hardening (portfolio talking points)
- RLS owner policies use `to authenticated` (any logged-in user = full access).
  Fine for single operator; would scope to a specific email for multi-staff.
- Anyone can POST pending bookings directly via the API (RLS allows it). Worst
  case is spam, not data theft. Mitigations: Cloudflare Turnstile/captcha on the
  form, or an Edge Function in front of inserts for rate-limiting/validation.
- Polling every 8s for updates; could move to Supabase Realtime subscriptions.
- No SMS/Messenger notification on confirm yet (e.g. Semaphore for PH SMS).
- Supabase free tier pauses after 7 days inactivity (keepalive handles this).

### Cost
₱0/month, all free tiers, commercial use permitted on all three services.
Cloudflare Pages: 500 builds/mo. Supabase free: 500MB DB, 50k MAU. Nowhere near.

---

## 10. How to resume in a new session

Paste this file. Then state what you want to do. The most likely next tasks:
- Confirm the slot_blocks migration ran and the blocking feature is live.
- Iterate on UI/features (push to main = auto-deploy via Actions).
- Write ARCHITECTURE.md for the repo (deeper version of section 3).
- Add hardening from section 9 (captcha, realtime, notifications).

To make code changes that auto-deploy, a fresh session needs a GitHub PAT
(fine-grained, repo `clawz-booking`, Contents + Workflows read/write) pushed to
`main`. The four GitHub secrets are already set, so any push deploys cleanly.
