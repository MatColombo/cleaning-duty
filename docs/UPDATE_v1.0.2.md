# Update House Care v1.0.1 → v1.0.2

1. Download and extract the v1.0.2 browser-deploy ZIP.
2. Replace the files in your existing GitHub repository with the contents of its `cleaning-duty-pwa` folder.
3. Commit the changes to the production branch connected to Cloudflare.
4. Wait for the Cloudflare build/deployment to finish, then reload the installed PWA. If it shows an update prompt, apply it.

No Supabase SQL migration is required. Do not rerun the v1 database installer or v1.0.1 SQL migration. No changes are required to `send-push`, Supabase secrets, cron/Vault, VAPID keys, Cloudflare build variables, or authentication URLs.

If duplicate Routines were already created before this update, v1.0.2 intentionally does not guess which one to delete. Open Routines and archive the unwanted duplicate once.
