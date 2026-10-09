# House Care V2 — Authored SVG vocabulary (Phase 4)

This directory contains **generated semantic-color SVG handoff assets** exported
from `src/visual/`. Do not hand-edit these exports; modify the TypeScript
primitive definitions or expression/pose/decorative renderer and re-export.

- `objects/`: 20 intentionally face-free silhouettes, 240×240.
- `expressions/`: 12 reusable ink faces, shown on a temporary plate for preview.
- `poses/`: 12 white-gloved arm/leg poses, shown on a generic appliance for preview.
- `decorations/`: 14 print embellishments, 128×128.
- `patterns/`: seven Phase 3 screenprint pattern samples.
- `vocabulary-manifest.json`: export IDs, families, safe insets and face/limb anchors.

Object and pose previews use semantic CSS ink variables (for example
`--hc-art-primary`), **not fixed brand colors**. Open the generated interactive
`../page-reference/v2-visual-lab.html` to inspect real theme colors.

## Commands

```bash
npm run build:v2-vocabulary
npm run build:v2-visual-lab
npm run build:v2-proof
npm run validate:vectors
npm test
```

The HTML Visual Lab is development-only under `design/v2/page-reference/` and
is intentionally not imported by the production app. Its source files are
regenerated, not saved to the database. Card recipes and semantic matching are
**Phase 5**, and do not exist here.
