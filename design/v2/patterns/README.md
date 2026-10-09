# V2 patterns

Runtime halftone, sparkle and action-ray definitions live in `src/visual/patterns.ts` so every inline SVG instance can receive collision-safe IDs.

Do not create global document-level pattern IDs. Do not add per-card `feTurbulence`.
