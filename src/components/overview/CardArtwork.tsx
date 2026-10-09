import { useId, useMemo } from 'react'
import type { WorkspaceData, TaskOccurrence } from '../../types/domain'
import { cardVisualInputFromDomain } from '../../visual/procedural/resolver'
import { getCardVisualRecipe } from '../../visual/procedural/cache'
import { renderCardVisualSvg } from '../../visual/procedural/render-card'
import type { VectorPalette } from '../../visual/types'

/** Five effective inks for printed Care Cards. All roles derive from the existing
 * semantic theme; no new persisted colors or generator-v1 changes are needed. */
const FIVE_INK_CARD_PALETTE: VectorPalette = Object.freeze({
  paper: 'var(--hc-art-surface)', surface: 'var(--hc-art-surface)',
  ink: 'var(--hc-art-ink)', inkMuted: 'var(--hc-art-ink)',
  primary: 'var(--hc-art-primary)', primarySoft: 'var(--hc-art-surface)',
  turquoise: 'var(--hc-art-primary)', mustard: 'var(--hc-art-mustard)',
  coral: 'var(--hc-art-coral)', danger: 'var(--hc-art-coral)',
})

/** Render the one visible card only. All SVG is generated locally from authored primitives. */
export function CardArtwork({ task, data }: { task: TaskOccurrence; data: WorkspaceData }) {
  const instanceKey = useId()
  const artwork = useMemo(() => {
    const recipe = getCardVisualRecipe(cardVisualInputFromDomain(task, data))
    return renderCardVisualSvg(recipe, { instanceKey, decorative: true, palette: FIVE_INK_CARD_PALETTE })
  }, [instanceKey, task, data])
  return <span className="v2-card-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: artwork }} />
}
