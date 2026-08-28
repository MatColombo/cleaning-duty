# House Care v1.0 — online deployment

Verified against the Supabase and Cloudflare documentation on 2026-08-28.

This deployment uses:

- Supabase: Postgres, Auth, RLS, Edge Function, Cron/Vault
- Cloudflare Workers Static Assets: HTTPS hosting for the React/Vite PWA
- Standard Web Push with VAPID

For the intended two-person household, all required pieces fit the providers' free tiers at the time of this release.

## 0. Prerequisites

Install Node.js 22+ and npm. Create free Supabase and Cloudflare accounts.

From the extracted project directory:

```bash
npm install
```

Do not put `sb_secret_...`, VAPID private keys, database passwords, or cron secrets in any `VITE_*` variable. Vite variables are bundled into browser code.

## 1. Create the Supabase project

1. In Supabase, create a new project.
2. Choose a region near the users.
3. Save the database password in a password manager.
4. Copy the **Project ref** from the project dashboard URL or Connect dialog.

In a terminal from this project folder:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
```

When requested, enter the database password created above.

## 2. Apply the database migrations

Preview first:

```bash
npx supabase@latest db push --dry-run
```

You should see the six v1 migrations under `supabase/migrations/`.

Apply them:

```bash
npx supabase@latest db push
```

For a fresh project, do not create or edit application tables manually in the Supabase Table Editor before this step.

## 3. Copy the browser-safe Supabase values

In Supabase, open **Connect** or **Settings → API Keys**.

Copy:

- Project URL, for example `https://abc123.supabase.co`
- **Publishable** key, beginning with `sb_publishable_...`

Do not use a secret key in the frontend.

## 4. Generate Web Push keys

Run:

```bash
npx web-push generate-vapid-keys
```

Save both values. The public key goes into the frontend. The private key goes only into Supabase Edge Function secrets.

Generate a separate random cron secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save it securely.

## 5. Create the production frontend environment

Create `.env.production` in the project root:

```dotenv
VITE_APP_MODE=cloud
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VITE_ENABLE_SW_DEV=false
```

`.env.production` is ignored by Git in this release.

Build locally:

```bash
npm run build
```

The build must finish successfully before deployment.

## 6. Deploy the PWA to Cloudflare

Authenticate Wrangler:

```bash
npx wrangler login
```

Then deploy:

```bash
npx wrangler deploy
```

The included `wrangler.jsonc` serves `dist/` as Workers Static Assets and uses SPA fallback routing. Wrangler will print the final HTTPS URL, normally similar to:

```text
https://house-care-pwa.YOUR_SUBDOMAIN.workers.dev
```

If the Worker name is already used in your Cloudflare account, change the `name` field in `wrangler.jsonc` and deploy again.

Keep the final HTTPS URL for the next step.

## 7. Configure Supabase Auth URLs

In Supabase Dashboard, open **Authentication → URL Configuration**.

Set:

```text
Site URL = https://YOUR_FINAL_WORKERS_DEV_URL
```

Add this Redirect URL:

```text
https://YOUR_FINAL_WORKERS_DEV_URL/**
```

Optional for local development:

```text
http://localhost:5173/**
```

Keep **Authentication → Providers → Email** enabled.

House Care currently uses email/password. When email confirmation is enabled, Supabase sends the confirmation link and returns the user to the configured Site URL.

## 8. Configure and deploy the push Edge Function

Set only the custom function secrets. Supabase automatically provides the project URL and named secret API keys to hosted Edge Functions.

```bash
npx supabase@latest secrets set \
  VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY \
  VAPID_PRIVATE_KEY=YOUR_VAPID_PRIVATE_KEY \
  VAPID_SUBJECT=mailto:YOUR_REAL_EMAIL \
  CRON_SECRET=YOUR_RANDOM_CRON_SECRET
```

Confirm they exist:

```bash
npx supabase@latest secrets list
```

Deploy the function:

```bash
npx supabase@latest functions deploy send-push
```

`supabase/config.toml` sets `verify_jwt = false` for this function because it is invoked by Cron, not a signed-in browser. The function itself rejects requests unless `x-cron-secret` matches `CRON_SECRET`.

## 9. Schedule push delivery

Open:

```text
supabase/setup/phase4_schedule.sql.example
```

Make a temporary copy and replace:

- `CHANGE_ME` with the Supabase project ref
- `CHANGE_ME_RANDOM_CRON_SECRET` with the exact `CRON_SECRET` from step 8

In Supabase Dashboard, open **SQL Editor**, paste the edited SQL and run it once.

It enables `pg_cron` + `pg_net`, stores the function URL/cron secret in Vault, and calls `send-push` every minute.

Optional immediate function check:

```bash
curl -i -X POST \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_RANDOM_CRON_SECRET" \
  -d '{}'
```

With no due notifications, a successful response may simply report zero processed jobs.

## 10. Create the first household

1. Open the Cloudflare HTTPS URL.
2. Select **Create account**.
3. Use the first person's email/password.
4. If email confirmation is enabled, confirm the email.
5. Sign in.
6. Create the household.
7. Optionally use **Settings → Starter pack** for example structure without any automatic routines.

## 11. Add the second person

On the owner's account:

1. Go to **Settings → People → Add person**.
2. Enter the second person's exact email address.

On the second device/account:

1. Create/sign in with exactly that email.
2. The pending membership is claimed automatically.
3. Confirm both users see the same household.

## 12. Install the PWA and enable notifications

On each device:

1. Open the HTTPS site.
2. Install/Add House Care to the Home Screen.
3. Open the installed app.
4. Go to **Settings → Notifications**.
5. Select **Enable on this device**.
6. Accept the operating-system/browser notification permission.

On iPhone/iPad, install the site to the Home Screen before enabling Web Push.

## 13. Production smoke test

Before relying on it for daily use, verify:

1. Both people can sign in and see the same household.
2. Create one Action, target and Routine.
3. Set a task a few minutes ahead with an at-due reminder.
4. Confirm the task appears on Today for the intended person.
5. Confirm push arrives on that person's installed PWA.
6. Complete it on one device and confirm the other device sees the result after sync/reload.
7. Put one device offline, complete another task, reconnect, and confirm it synchronizes.
8. Change one supply status and verify it appears in **Insights → Audit explorer**.
9. Use **Settings → Backup → Export JSON** and keep the file somewhere safe.

## 14. Updating the deployed app later

After changing source code:

```bash
npm install
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push --dry-run
npx supabase@latest db push
npx supabase@latest functions deploy send-push
npm run deploy
```

The service worker detects a new app version and offers an in-app update.

## 15. Optional custom domain

The `workers.dev` address is sufficient for this personal deployment. A custom domain can be added later in Cloudflare. If you change the public URL, also update Supabase **Authentication → URL Configuration**.

## 16. Backup policy for v1

v1 deliberately keeps backup simple and free:

- Export JSON manually after meaningful configuration changes and periodically during use.
- Keep at least two recent copies outside the browser/device.
- Import is owner-only in cloud mode.
- Push subscriptions and derived notification jobs are intentionally not in the JSON backup.

Automated off-site backups are a post-v1 option if the household becomes important enough to justify paid infrastructure.
