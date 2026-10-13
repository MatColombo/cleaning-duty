import type { CardVisualRecipe } from '../procedural/recipe'
import { renderCardVisualSvg } from '../procedural/render-card'
import { overlayStudioRecipe, sanitizeStudioOverrides } from './draft'
import type { VectorPalette } from '../types'

/** Same deterministic renderer as Overview; draft changes only this transient projection. */
export function renderStudioPreviewSvg(auto: CardVisualRecipe, raw: unknown, instanceKey: string, palette: VectorPalette): string {
  const draft = sanitizeStudioOverrides(raw)
  const visual = overlayStudioRecipe(auto, draft)
  return renderCardVisualSvg(visual, { instanceKey, palette, decorative: true,
    studio: Object.keys(draft).length > 0 ? draft : undefined })
}
