import { useId, useMemo } from 'react'
import { renderManualCharacterSvg, type ManualCharacterOptions, type ManualDecoration } from './compose'
import type { ExpressionId } from './expressions'
import type { PoseId } from './poses'
import type { VectorPalette } from './types'
import type { StudioOverrides } from './studio/draft'

export interface SvgCharacterProps {
  id: string
  instanceKey?: string
  label?: string
  decorative?: boolean
  expression?: ExpressionId
  pose?: PoseId
  decorations?: readonly ManualDecoration[]
  palette?: VectorPalette
  misregistration?: boolean
  className?: string
  studio?: StudioOverrides
}

/**
 * Thin React host for explicitly composed, authored V2 character art.
 * No task data, classification, seeded choices or domain logic live here.
 */
export function SvgCharacter({
  id, instanceKey, label, decorative = false, expression, pose,
  decorations, palette, misregistration = true, className = '', studio,
}: SvgCharacterProps) {
  const reactId = useId()
  const source = useMemo(() => renderManualCharacterSvg(id, {
    instanceKey: instanceKey ?? reactId,
    title: label,
    decorative,
    expression: studio?.expression ?? expression,
    pose: studio?.pose ?? pose,
    faceParts: studio?.eyes || studio?.mouth || studio?.brows ? { eyes:studio.eyes, brows:studio.brows, mouth:studio.mouth } : undefined,
    rightHand: studio?.handGesture,
    decorations,
    palette,
    misregistration,
  } satisfies ManualCharacterOptions), [id, instanceKey, reactId, label, decorative, expression, pose, decorations, palette, misregistration, studio])
  return <span className={`hc-v2-svg-primitive ${className}`.trim()}
    style={studio?.scale && studio.scale !== 1 ? {transform:`scale(${studio.scale})`} : undefined}
    dangerouslySetInnerHTML={{__html: source}} />
}
