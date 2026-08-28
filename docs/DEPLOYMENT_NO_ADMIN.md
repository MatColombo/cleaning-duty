# House Care v1.0 - browser-only deployment (no admin rights / no Node.js)

This route requires only a normal web browser plus the ability to extract a ZIP file. Node.js, Git, Docker, Supabase CLI and Wrangler are not required on your computer.

## Accounts
Create free accounts if you do not already have them:
- GitHub
- Supabase
- Cloudflare

## 1. Put the source on GitHub
1. Extract `cleaning-duty-pwa-v1.0-browser-deploy.zip` using your operating system's built-in ZIP support.
2. Open the `cleaning-duty-pwa` folder inside it.
3. In GitHub, create a new repository. Private is fine. Do not initialize it with a README/license/gitignore.
4. Open the empty repository and choose `uploading an existing file` / `Add file -> Upload files`.
5. Drag the CONTENTS of `cleaning-duty-pwa` into the browser upload area. Do not upload the outer folder as one ZIP.
6. Commit directly to `main` with message `House Care v1.0`.

The repository has fewer than 100 files, so it fits GitHub's current browser-upload limit in one upload. If your browser refuses a folder drag, upload the top-level files and folders in two batches.

## 2. Create Supabase
1. Create a new Supabase project and save its project ref.
2. In `Project Settings / API Keys`, copy:
   - Project URL
   - Publishable key (`sb_publishable_...`)
3. Open `SQL Editor -> New query`.
4. In the GitHub repo, open `supabase/setup/v1_full_database.sql`, choose Raw, select all and copy it.
5. Paste it into the Supabase SQL Editor and Run once.
6. Confirm there is no SQL error.

## 3. Generate push secrets without Node
1. On your computer open `tools/browser-deploy-helper.html` from the extracted project folder. It runs locally.
2. Enter your Supabase project ref and your email address.
3. Select `Generate VAPID keys + cron secret`.
4. Keep the page open until steps 4-7 are finished.

## 4. Deploy the push function in Supabase Dashboard
1. Supabase -> Edge Functions -> Deploy a new function -> Via Editor.
2. Function name: `send-push`.
3. Replace the editor contents with `supabase/functions/send-push/index.ts` from GitHub.
4. Disable JWT verification for this function. The function validates the private `x-cron-secret` itself.
5. Deploy the function.

## 5. Add Edge Function secrets
1. Supabase -> Edge Functions -> Secrets.
2. From the local helper page, copy the four generated values:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
   - `CRON_SECRET`
3. Save them. Never put the VAPID private key or cron secret in GitHub or Cloudflare frontend variables.

## 6. Deploy the frontend with Cloudflare Pages + GitHub
1. Cloudflare Dashboard -> Workers & Pages -> Create application -> Pages -> Connect to Git.
2. Connect GitHub and select the repository from step 1.
3. Build configuration:
   - Framework preset: React (Vite), if offered
   - Production branch: `main`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: leave blank
4. Add Production environment variables:
   - `NODE_VERSION` = `22`
   - `VITE_APP_MODE` = `cloud`
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your `sb_publishable_...` key
   - `VITE_VAPID_PUBLIC_KEY` = the public VAPID key from the helper
   - `VITE_ENABLE_SW_DEV` = `false`
5. Save and Deploy.
6. Cloudflare will install Node/dependencies and run the build on its own servers. Nothing is installed on your computer.
7. When successful, copy the generated `https://<project>.pages.dev` URL.

## 7. Configure Supabase Auth URLs
Supabase -> Authentication -> URL Configuration:
- Site URL: the exact `https://<project>.pages.dev` URL
- Redirect URL: `https://<project>.pages.dev/**`

Keep `http://localhost:5173/**` only if you expect to use local development later.

## 8. Schedule push delivery
1. Return to `tools/browser-deploy-helper.html`.
2. Copy the generated Scheduler SQL.
3. Supabase -> SQL Editor -> New query -> paste -> Run once.
4. In Supabase Cron/Integrations, confirm the `house-care-send-push` job exists and is scheduled once per minute.

## 9. Create accounts and household
1. Open the Cloudflare Pages URL.
2. Sign up/sign in and create the household.
3. Add the other person under Settings -> People using their exact email.
4. They sign up/sign in with that email.

## 10. Install PWA and enable push
On each device:
1. Open the Cloudflare Pages URL in the browser.
2. Install/Add to Home Screen.
3. Open the installed app.
4. Settings -> Notifications -> Enable on this device.

For iPhone/iPad, notification permission is requested from the installed Home Screen PWA, not an ordinary browser tab.

## 11. Production smoke test
Before relying on it:
1. Create a test Action and Routine due a few minutes ahead.
2. Assign it to one person and enable an at-due reminder.
3. Confirm the push arrives.
4. Complete it on one device and verify the other device sees the update.
5. Test one offline completion followed by reconnect.
6. Export a JSON backup from Settings.

## Updating later without Node
Edit/upload changed source files in GitHub. Each commit to `main` triggers a new Cloudflare build automatically. Database changes can continue to be applied through Supabase SQL Editor, and Edge Functions can be updated through the Supabase browser editor.
