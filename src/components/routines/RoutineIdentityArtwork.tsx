import { useMemo } from 'react'
import type { Routine, WorkspaceData } from '../../types/domain'
import { SvgCharacter } from '../../visual/SvgCharacter'
import { getRoutineIdentityRecipe } from '../../visual/procedural/routine-identity'
import { cardPaletteForVariant } from '../../visual/procedural/render-card'
import { CSS_VECTOR_PALETTE } from '../../visual/palette'

interface Props {
  routine: Pick<Routine, 'id' | 'actionId' | 'name' | 'targetEntityIds'>
  data: Pick<WorkspaceData, 'actions' | 'entities' | 'entityTypes'>
  compact?: boolean
}

/** Compact, responsive SVG identity. Never uses TaskOccurrence, dates or card editions. */
export function RoutineIdentityArtwork({ routine, data, compact = false }: Props) {
  const recipe = useMemo(() => getRoutineIdentityRecipe(routine, data), [routine, data])
  const palette = useMemo(() => cardPaletteForVariant(CSS_VECTOR_PALETTE, recipe), [recipe])
  return <div className={`v2-routine-art v2-routine-ink-${recipe.paletteVariant} ${compact ? 'compact' : ''}`}
    data-routine-visual-seed={recipe.stableSeed} data-routine-art-version={recipe.version} aria-hidden="true">
    <span className="v2-routine-art-star" aria-hidden="true">✦</span>
    <SvgCharacter id={recipe.semantics.subjectId} decorative expression={recipe.expression} pose={recipe.pose}
      palette={palette} misregistration={false} className="v2-routine-art-subject" />
    {recipe.semantics.toolId && <SvgCharacter id={recipe.semantics.toolId} decorative
      palette={palette} misregistration={false} className="v2-routine-art-tool" />}
  </div>
}
