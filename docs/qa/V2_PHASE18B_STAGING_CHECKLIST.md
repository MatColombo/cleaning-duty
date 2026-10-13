# Phase 18B — staging, browser and Free-tier acceptance checklist

Status: **NOT RUN** for all SQL/live browser/device checks in this environment.

1. Obtain explicit approval for running staged SQL in a disposable test project. Review 16A/16B/16C outstanding migration sequencing; do not assume production already has them.
2. Apply `supabase/migrations/20261012190000_v2_phase18b_visual_overrides.sql` to STAGING only. Verify read RLS with members A and B, outsider C, and household B. Run `supabase/staging/v2_phase18b_rls_concurrency.sql` with fixture IDs and confirm rollback leaves no changes.
3. Confirm the server rejects script/SVG/URL/unknown keys, `scale` out of range, 2KiB+ JSON, orphan IDs, archived subjects, wrong household, reused mutation ID for another subject, and direct authenticated INSERT/UPDATE/DELETE.
4. Verify CAS create, update, duplicate retry, stale revision, two devices saving at once; no silent overwrites, one revision per committed mutation. Check two members share saved artwork after next app open/ordinary refresh (no Realtime/polling).
5. Browser: save from Routines/Actions/Home; reopen studio; keyboard/touch, EN/IT; Reset to Auto then Confirm; cancel discards; drag slider generates no network calls. Test offline, reload, logout, household switch and account partition.
6. Ensure old V1 login, listing, task completion/Undo, stock, notifications, recurrence and backups still behave unchanged. Confirm a V1 reset removes orphan artwork via triggers and does not mutate other households.
7. Export a v10 backup; validate local v10 import, v9 import without artwork; cloud backup with artwork MUST fail before destructive reset. Verify 16B/C guards still apply.
8. Inspect `pg_total_relation_size('public.visual_overrides')`, `pg_total_relation_size('public.v2_visual_applied_ops')`, `pg_stat_user_tables`, PostgREST request logs and Supabase Free quotas using representative fixtures. Record actual bytes/calls; the supplied JSON-envelope benchmark is not live network evidence.
9. Test browser/PWA offline and session expiry with warmed cache; verify no user B data visible to user A; test PWA service-worker upgrade to rc.7.
10. Only after staging sign-off and a separate explicit deployment approval consider production rollout. Do not run staged SQL or rollback against the shared production project automatically.
