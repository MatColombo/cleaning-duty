# House Care v1.0.2

Maintenance release focused on continuity, mobile usability, duplicate prevention and diagnostics.

## Fixed

- Home switcher now renders through a document-level portal as a safe-area-aware mobile bottom sheet, avoiding clipping caused by the sticky blurred header on iOS.
- Cloud accounts remember the last selected active home in Supabase Auth user metadata, with a per-device fallback. If no saved selection is valid, the newest active home opens. The create-home screen appears only when the account has no active homes.
- English/Italian selection is remembered per account in Supabase Auth user metadata, with local fallback for offline startup.
- Routine Save is protected against repeated taps while a save is in progress and exact duplicate routine definitions in the current state are ignored.
- Newly generated Task occurrence IDs are deterministic from workspace + routine + revision + original due time, complementing the existing database uniqueness constraint. Local cached duplicate occurrences are collapsed during normalization.
- Structured Supabase/client errors are rendered as readable messages instead of `[object Object]`.
- Added a local-only diagnostic log under Settings. It keeps at most 40 entries, groups repeated identical errors within 30 seconds, and captures page, home, online state, subsystem and recent button/form actions. It does not capture form values or passwords and writes nothing to Supabase.

## Upgrade

Frontend-only release. No SQL migration, Edge Function update, Supabase secret, cron, VAPID or Cloudflare environment-variable change is required. Replace the GitHub source with this release and commit; Cloudflare will rebuild automatically.

Existing duplicate Routines are not automatically archived because identical routines may be intentional. If a duplicate Routine already exists from an earlier double-save, archive the extra Routine once after upgrading.
