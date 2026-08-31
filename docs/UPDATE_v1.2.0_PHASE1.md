# Update House Care v1.1.2 → v1.2.0 Phase 1

This is a foundation milestone for v1.2.0. Visible navigation/Overview redesign is intentionally deferred to Phase 2.

## 1. Supabase — run once first

Open **Supabase → SQL Editor → New query** and run the full contents of:

`supabase/migrations/20260831113000_v1_2_phase1_cleanliness_engine.sql`

The migration is non-destructive. It adds canonical cadence/execution fields, Routine cleanliness fields, completion snapshots, health trajectories, RLS, and transactional runtime mutation updates. Legacy task date/care columns remain mirrored during the v1.2 transition.

## 2. GitHub / Cloudflare

Replace the existing repository files with this package and commit. Cloudflare will rebuild/deploy automatically.

No changes are required to:

- VAPID keys;
- `CRON_SECRET`;
- Supabase Edge Function secrets;
- `send-push` source;
- Cloudflare build variables.

## First load

On first load, the client deterministically reconstructs any missing health trajectories from valid completion history plus canonical recurrence rules and persists only missing/changed canonical state. Repeating the process is idempotent.
