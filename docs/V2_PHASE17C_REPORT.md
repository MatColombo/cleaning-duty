# House Care V2 — Phase 17C Report

**Baseline:** exact Phase 17B ZIP (`v2.0.0-rc.4`).  
**Output:** `v2.0.0-rc.5`.  
**Scope:** art direction, expression clarity, safer gesture silhouettes, analog micro-motion and tactile sheet transitions. **Stopped after 17C.**

## What changed

### 1) Procedural illustration direction moved closer to the approved retro-advertising concept
- Upgraded the deterministic visual generator from **v1** to **v2** (`HOUSE_CARE_VISUAL_VERSION = 2`).
- Reworked face overlays in `src/visual/expressions.ts` for much larger eyebrows / eyes / mouths with explicit grouped parts (`data-hc-face-part`) so expressions read better at small sizes and can support finite motion safely.
- Reworked glove/arm pose rendering in `src/visual/poses.ts` with more rubber-hose-inspired curvature, clearer cuffs, better silhouette, and an explicit positive-thumb marker (`data-hc-thumb="up"`) to avoid ambiguous small-size interpretation.
- Enlarged hero face placement in `src/visual/compose.ts` to improve readability on compact cards.

### 2) Front-card composition now reads more like a poster than a neutral icon plate
- `src/visual/procedural/render-card.ts` now uses explicit scene / print-base / props / hero / texture layers.
- Added larger scene geometry and simple poster props keyed to environment (kitchen, bathroom, generic interior/outdoor, etc.).
- Tightened the effective print treatment to a **small fixed ink set** derived from the theme rather than many competing accent roles.
- Increased subject scale and rebalanced tool placement for stronger focal hierarchy.

### 3) Motion is local, finite and accessibility-guarded
- `src/components/overview/CardArtwork.tsx` now runs a **local-only** hero-card micro-motion sequence (tilt → blink → gesture emphasis) with:
  - `prefers-reduced-motion` disable path
  - `IntersectionObserver` offscreen guard
  - no backend/network calls
  - no continuous infinite loop
- `src/styles/overview-v2.css` defines finite keyframes for hero tilt, blink and hand emphasis only.
- `src/styles/secondary-v2.css` adds a short tactile sheet/backdrop settle animation.

### 4) Deterministic evidence was refreshed
- Added a new immutable fixture: `tests/fixtures/v2-visual-v2-golden.json`.
- Refreshed the repo proof assets in `design/v2/page-reference/`.
- Added `tests/v2_phase17c_art_direction.test.ts` to protect the 17C visual contract.

## Files changed (functional core)
- `package.json`
- `src/visual/version.ts`
- `src/visual/expressions.ts`
- `src/visual/poses.ts`
- `src/visual/compose.ts`
- `src/visual/procedural/render-card.ts`
- `src/components/overview/CardArtwork.tsx`
- `src/components/overview/CareCard.tsx`
- `src/components/home/RoomModeSheet.tsx`
- `src/styles/overview-v2.css`
- `src/styles/secondary-v2.css`
- `tests/v2_phase5_procedural_cards.test.ts`
- `tests/v2_phase17c_art_direction.test.ts`
- `tests/fixtures/v2-visual-v2-golden.json`
- `tools/build-v2-procedural-proof.cjs`
- `design/v2/page-reference/v2-procedural-cards.html`
- `design/v2/page-reference/v2-procedural-cards-proof.svg`

## Determinism / architecture notes
- No runtime image generation, raster storage, uploads, or backend art persistence were introduced.
- Primitive existence and the authored vocabulary remain intact; 17C changes are on top of the same procedural recipe architecture.
- No task actions, task status mutations, recurrence behavior, notifications, or backend services were changed.
- All hero motion state remains local to the card component.

## Verification results

### Focused deterministic tests
Executed by compiling the relevant art-layer TypeScript modules with the system TypeScript compiler and running the compiled test files under Node.

Passed:
- `tests/v2_phase5_procedural_cards.test.ts`
- `tests/v2_phase17c_art_direction.test.ts`

Observed output from the large deterministic slice:
- `V2 Phase 5 procedural tests passed (10,000 synthetic cases, 118 generic fallbacks, 3259 ms)`

### Targeted TSX syntax audit
- `src/components/overview/CardArtwork.tsx` was compiled with a minimal local React type stub to ensure the introduced hook/JSX changes parse correctly in isolation.
- Result: **passed**.

## Performance results
See `../../HOUSE_CARE_V2_PHASE17C_PERFORMANCE.json` for machine-readable output.

Highlights:
- 10,000 recipe generations: **1386 ms**
- 1,000 SVG card renders: **255 ms**
- Sample card size: **7.1 KB min / 9.6 KB avg / 11.1 KB max**
- Sample card path count: **21 min / 38 avg / 47 max**
- Combined proof sheet: **59,350 bytes**, **229 paths**, **142 groups**
- SVG validation: **6 / 6** sample proof cards valid

## Accessibility notes
- Reduced motion: supported; nonessential hero/sheet motion is disabled under `prefers-reduced-motion: reduce`.
- Functional UI remains outside the procedural artwork layer; art stays decorative and does not become the only carrier of state.
- Existing buttons / controls / labels remain intact; 17C does not remove keyboard or semantic alternatives.
- Offscreen guards prevent needless hero-card animation work.

## Manual review status / limitations
- The result is **materially closer** to the approved retro-advertising / screenprint mascot direction, but **not claimed identical**. Human visual review is still required for concept approval.
- The “positive gesture never reads like a middle finger” requirement was addressed structurally in the pose design and should still be spot-checked by human reviewers at 48 px, 72 px and large card sizes.
- Physical-device review for low-power mobile browsers is still recommended even though DOM/path counts are bounded and motion is finite.

## Deliverables produced
- Updated source ZIP: `../../HOUSE_CARE_V2_PHASE17C_UPDATED.zip`
- Before contact sheet: `../../HOUSE_CARE_V2_PHASE17C_CONTACT_SHEET_BEFORE.svg`
- After contact sheet: `../../HOUSE_CARE_V2_PHASE17C_CONTACT_SHEET_AFTER.svg`
- Before/after comparison: `../../HOUSE_CARE_V2_PHASE17C_CONTACT_SHEET_BEFORE_AFTER.svg`
- Art-direction guide: `../../HOUSE_CARE_V2_PHASE17C_ART_DIRECTION_GUIDE.md`
- Performance JSON: `../../HOUSE_CARE_V2_PHASE17C_PERFORMANCE.json`
- Changed files list: `../../HOUSE_CARE_V2_PHASE17C_CHANGED_FILES.txt`

