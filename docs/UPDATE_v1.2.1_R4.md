# House Care v1.2.1-r4 — loading experience and palette expansion

This is a client-side visual/UX update on top of v1.2.1-r3. It does not add or change Supabase schema, reminder scheduling, or `send-push`.

## Loading experience

- A tiny static preloader prevents a blank frame before React starts.
- The application loading state then shows the House Care logo inside a spinning ring, a themed House Care wordmark, and one of 18 rotating playful household-loading phrases.
- Loading phrases are localized in English and Italian from the same saved/browser language mechanism as the rest of the application.
- The splash uses the selected semantic palette as soon as account appearance data is available.
- When authentication/household data is ready, the destination screen renders underneath and the loading layer fades/softens away.
- `prefers-reduced-motion` removes continuous loader movement while preserving visible loading state.

## Appearance library

The built-in palette library now contains 17 presets:

- Classic: Fresh Sage, Warm Clay, Coastal Blue, Lavender Smoke, Charcoal Citrus.
- Night: Night Garden, Midnight Blue, Plum Night.
- Greyscale: Graphite Mono.
- Colourblind safe: Clear Spectrum.
- Very colourful: Candy Pop, Confetti, Electric Garden.
- Cool: Arctic Mint, Glacier Blue, Nordic Fog, Deep Teal.

Night presets set the browser colour scheme to dark and more legacy surfaces now consume semantic theme tokens so dark/custom themes do not leave bright white controls behind.

## Custom palette semantics

Custom palette saving is no longer blocked by WCAG contrast checks. Any valid colour-picker value can be saved for every semantic token. Contrast findings remain visible as an informational warning because very low contrast can make the interface hard to read, but the final choice belongs to the user.

## Deployment

If v1.2.1 is already installed:

1. Replace the web-app files in the Git repository with the contents of the `cleaning-duty-pwa` folder from the r4 ZIP.
2. Commit and push.
3. Let Cloudflare rebuild/deploy.
4. No new Supabase SQL migration is required.
5. No `send-push` Edge Function redeployment is required.
6. The service-worker cache version is `v1.2.1-r4`, so installed PWAs should receive an update prompt/refresh through the existing update flow.

## Suggested checks

1. Cold-open the installed PWA and confirm the static logo/spinner appears immediately, then hands off to the localized branded loader.
2. With Italian selected, confirm the rotating lines are Italian; switch to English and repeat.
3. Select each Night theme and check Overview, Home, Routines, Stock and Settings for readable surfaces/controls.
4. Select Graphite Mono and Clear Spectrum.
5. Try Candy Pop/Confetti/Electric Garden and the four Cool themes.
6. Create a deliberately low-contrast Custom palette. Confirm the warning appears but **Save appearance** remains enabled and the palette saves.
7. Enable reduced motion at OS/browser level and confirm the loader remains informative without continuous spinning/drifting.
