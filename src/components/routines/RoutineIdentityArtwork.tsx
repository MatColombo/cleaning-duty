import { useMemo } from 'react'
import type { Routine, WorkspaceData } from '../../types/domain'
import { SvgCharacter } from '../../visual/SvgCharacter'
import { getRoutineIdentityRecipe } from '../../visual/procedural/routine-identity'
import { cardPaletteForVariant } from '../../visual/procedural/render-card'
import { CSS_VECTOR_PALETTE } from '../../visual/palette'
import { effectiveVisualOverrides } from '../../lib/visualOverrides'
import { routineIdentityVisualInput } from '../../visual/procedural/routine-identity'

interface Props {
  routine: Pick<Routine, 'id' | 'actionId' | 'name' | 'targetEntityIds'>
  data: WorkspaceData
  compact?: boolean
}

/** Compact, responsive SVG identity. Never uses TaskOccurrence, dates or card editions. */
export function RoutineIdentityArtwork({ routine, data, compact = false }: Props) {
  const recipe = useMemo(() => getRoutineIdentityRecipe(routine, data), [routine, data])
  const studio = effectiveVisualOverrides(data, routineIdentityVisualInput(routine,data))
  const palette = useMemo(() => cardPaletteForVariant(CSS_VECTOR_PALETTE, {paletteVariant:studio?.paletteVariant ?? recipe.paletteVariant}), [recipe, studio?.paletteVariant])
  return <div className={`v2-routine-art v2-routine-ink-${studio?.paletteVariant ?? recipe.paletteVariant} ${compact ? 'compact' : ''}`}
    data-routine-visual-seed={recipe.stableSeed} data-routine-art-version={recipe.version} aria-hidden="true">
    <span className="v2-routine-art-star" aria-hidden="true">✦</span>
    <SvgCharacter id={studio?.subjectId ?? recipe.semantics.subjectId} decorative expression={recipe.expression} pose={recipe.pose} studio={studio}
      palette={palette} misregistration={false} className="v2-routine-art-subject" />
    {recipe.semantics.toolId && <SvgCharacter id={recipe.semantics.toolId} decorative
      palette={palette} misregistration={false} className="v2-routine-art-tool" />}
  </div>
}
