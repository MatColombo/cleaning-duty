# House Care v1.1.1 — Today correctness release

## Fixed

- Completed/skipped work no longer appears in the default Today queue.
- Editing a Routine now retires every still-open occurrence from the previous Routine revision, including overdue occurrences.
- Startup automatically cancels stale scheduled occurrences left behind by earlier Routine revisions, repairing old-time/new-time duplicates without touching completed/skipped history.
- Today defensively deduplicates task rows by ID and natural occurrence key before rendering.

## Today UX

- **To do / Completed / All** filters.
- **For me / Household** scope when multiple active people exist.
- Open work split into **Due now** and **Later today**.
- Routine name is the primary task title; Action + target names appear beneath it.
- Task details are visually distinct and include whole-task Complete while scheduled.

## Deployment

Frontend-only update. Replace the GitHub project files and commit; Cloudflare rebuilds automatically. No SQL migration, `send-push` update, secrets, cron, or build-variable change is required.

Backup schema remains v7. Application version is 1.1.1.
