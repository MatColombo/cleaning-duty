# House Care V2 — Cloudflare Worker Preview patch

This patch is for the `v2-testing` branch only, based on the Phase 15 V2 release candidate.
Do not upload these files to `main` or run `wrangler deploy` locally.

## Apply without npm on your computer

1. In GitHub, open repository `MatColombo/cleaning-duty`, select the **v2-testing** branch.
2. Open `wrangler.jsonc` -> Edit -> replace its entire contents with the patched file -> Commit changes to **v2-testing**.
3. Open `package.json` -> Edit -> replace its entire contents with the patched file -> Commit changes to **v2-testing**.
4. On Cloudflare Workers & Pages -> `cleaning-duty` -> Settings -> Builds:
   - Production branch must remain `main`.
   - Non-production builds enabled.
   - Build command: `npm run build`.
   - Preview command (after setup): `npx wrangler preview`.
   - Root directory: repository root, if configurable.
5. Ensure the **preview build environment** exposes these Vite build-time variables, using the SAME public values as V1:
   - `VITE_APP_MODE=cloud`
   - `VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<your existing public publishable/anon key>`
   - `VITE_VAPID_PUBLIC_KEY` only if production uses browser push.
   Never put Supabase service-role keys into frontend variables or Git.
6. After preview settings are correctly configured, complete Cloudflare's one-time **Set up Worker Previews** wizard. It is not reversible. Check build logs and preview URL.
7. In Supabase Auth -> URL Configuration, allowlist the *actual preview URL* and required callback paths. Do not change the production Site URL.
8. Test preview with a disposable test household before mutating production data.

## Exact code changes

- `wrangler.jsonc`: set name to `cleaning-duty` (matching your Cloudflare screenshot) and add `"previews": {}`.
- `package.json`: change Wrangler from `^4.127.0` to `^4.135.0`. No lockfile exists in Phase 15 source. Cloudflare's npm install step can resolve it.

## Caveats

This is **source configuration**, not a precompiled website. Cloudflare must install npm packages and run the build. Full build/typecheck and actual Worker Preview deployment cannot be verified here. The V2 candidate is still RC1, not a validated production release.

If Cloudflare cannot find the preview settings or its build install fails, do not switch the production branch or deploy to `main`. Capture the build log and resolve on the testing branch.
