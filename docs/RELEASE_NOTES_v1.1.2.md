# House Care v1.1.2 — Task lifecycle integrity

This maintenance release fixes a cloud write race that could reopen a completed or skipped occurrence as `scheduled` while its task targets remained completed. That state also allowed a reminder job to be scheduled again.

## Fixed

- Runtime task mutations and whole-household saves are serialized in the client.
- The client reconciles task state from immutable lifecycle events and completed target snapshots.
- Today never treats an occurrence with terminal history/all targets complete as actionable.
- Supabase rejects stale task occurrence updates whose version is older than the current row.
- Existing affected rows are repaired from `COMPLETED`, `SKIPPED`, and `CANCELLED` history.
- Pending/processing/failed notification jobs for terminal tasks are cancelled.
- Notification scheduling refuses an occurrence whose entire target snapshot is already complete.

No Edge Function, VAPID, cron, or Cloudflare variable change is required.
Backup schema remains v7. Application version is 1.1.2.
