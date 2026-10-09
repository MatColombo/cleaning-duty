# House Care V2 — Phase 14: Theme, boot, and PWA brand assets

**Baseline:** Phase 13 (`cleaning-duty-phase13-analysis-secondary.zip`).
**Scope:** presentation and asset-only. No analytics, recurrence, mutation, database, schema, workspace or routing changes. V2 release/version bump is deliberately left for Phase 15.

## Delivered

### 1. Controlled theme-derived SVG ink adapter

- `src/visual/VisualPaletteAdapter.ts` derives six visual roles: paper, outline, primary, warning, overdue, soft.
- Outline is corrected to **at least 4.5:1** against the current illustration surface. Main and contextual inks are corrected to **at least 3:1**. Corrections affect art only; the user's original ten semantic theme values (including intentionally low-contrast custom values) are not rewritten.
- `src/visual/palette.ts` maps those roles to the established primitive vocabulary. `applyTheme` writes derived `--hc-art-*` CSS variables in addition to, but never instead of, the original `--color-*` values. Inline SVGs and the theme-explicit renderer share the adapter.
- The V2 procedural card presentation palette collapses aliases to **five distinct hard inks maximum per card**. Recipe seed/version/IDs/meaning and storage are unchanged.
- Existing 18 presets remain, including **House Care Retro**. The pre-V2 **Fresh Sage** fallback is deliberately retained for current users. House Care Retro is selectable; no implicit migration rewrites saved appearance preferences.

### 2. Settings live preview

- A new `VisualInkPreview` is mounted in Appearance below the palette editor. It shows authored SVGs, six named role chips, hex colors and a note when artwork contrast was adjusted.
- Preview reacts to palette edits **before Save** and supports English and Italian.
- No additional appearance fields, DB columns, preferences, or API writes were added.

### 3. V2 startup identity

- Startup uses `/brand/v2/house-care-app-mark.svg` and two authored SVG characters with a restrained print motif.
- Existing 18 localized rotating phrases, authentication/data readiness, minimum 520 ms boot visibility, 360 ms exit and updating logic remain unchanged.
- Reduced motion disables the phrase interval, sparkle/spinner/ambient motion and transition effects; loading text remains visible.
- `index.html`'s preboot icon, background, spinner ink, favicon/touch icon references and initial theme color are updated to V2.

### 4. Installed PWA identity

- **Authoritative scalable sources:** `public/brand/v2/house-care-app-mark.svg`, `public/brand/v2/house-care-maskable-mark.svg`.
- **Generated/committed assets:** standard PNG at 192/512, maskable PNG at 192/512, Apple touch PNG 180, favicon PNG 32, and compatible copies at legacy root asset paths for existing push/app consumers. `public/icon.svg` is replaced with the same V2 art.
- Maskable art uses a **solid full-bleed** paper background and an inset motif, keeping important geometry within the Android safe zone. Standard icons retain a clean rounded panel, no halftone at launcher scale.
- `manifest.webmanifest` now references new `/brand/v2/` PNG URL paths, a warm paper `background_color` and deep teal `theme_color`. Shortcut icons use the same brand.
- Service-worker caches carry a `retro-assets-p14` asset revision while keeping the current app VERSION, so older shell assets can be invalidated before the Phase 15 release. Install precache includes the new icons and source SVGs. Existing skip-waiting, offline, push and click handlers were left intact.
- Rebuild icons with `npm run build:v2-pwa-icons` (requires Python CairoSVG + Pillow, **only for asset authoring**). Runtime app/install does not need those packages.

## Visual references

- `design/v2/page-reference/v2-phase14-theme-proof.svg` / `.png`: actual authored SVGs under Retro, Sage, Night, Mono, Clear Spectrum, and extreme custom themes. Rebuild SVG with `npm run build:v2-phase14-theme-proof`.
- `design/v2/page-reference/v2-phase14-launcher-light-dark.png`: launcher contact sheet, normal and round maskable icon on light/dark backgrounds.

## Verification performed

- `npm test` **passed all V1 and V2 tests**, including new Phase 14 tests across 23 theme cases/palette extremes, save-unchanged semantics, EN/IT labels, output SVG validation, ink-card limits, boot contract, PWA manifest, PNG dimensions/format, and service-worker cache contracts.
- SVG validator passed **109 sources**, with no raster SVG embedding.
- Service worker syntax (`node --check`), 9 edited TypeScript/TSX syntax smokes, 2 stylesheet parses, Phase 13 rendering smoke, and version consistency all passed.
- Preservation audit: **16 core domain/projection/persistence and page files identical to Phase 13.**
- Launcher contact sheet inspected against light/dark backgrounds with a simulated round crop. This is **asset inspection**, not proof of launcher rendering on a physical device.

## Remaining acceptance and known limitations

The host still cannot install frontend dependencies from npm, so **full React/Vite typecheck, production build and live browser tests are not yet certified**. The typecheck reports missing React/Vite modules and their cascading JSX type diagnostics. No lockfile was fabricated.

Before Phase 15 production release, on a dependency-complete machine:

1. Run `npm install`, `npm run typecheck`, `npm run build`, and `npm test`.
2. In Settings, switch Retro / Fresh Sage / Night Garden / Graphite Mono / Clear Spectrum, and edit an extreme white-on-white custom palette. Confirm illustrations stay readable while the saved palette remains unmodified.
3. Launch in EN/IT with `prefers-reduced-motion` both on and off. Verify loader visible timing, phrase behavior, focus and exit.
4. Install on Android and iOS, compare standard/maskable/Apple launcher icons on light/dark backgrounds, and check full-bleed safe zones.
5. Upgrade an existing installed PWA through the waiting-worker banner. Confirm new manifest/icon URLs, cache invalidation, and offline launch. Verify reminder and notification task deep links.
6. Check monochrome and reduced-animation/no-art presentation, especially custom extreme contrasts.

**Phase 14 stops here. No Phase 15 release-hardening or version bump has been undertaken.**
