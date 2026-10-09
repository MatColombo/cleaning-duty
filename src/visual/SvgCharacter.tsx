import { useId, useMemo } from 'react'
import { renderManualCharacterSvg, type ManualCharacterOptions, type ManualDecoration } from './compose'
import type { ExpressionId } from './expressions'
import type { PoseId } from './poses'
import type { VectorPalette } from './types'

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
}

/**
 * Thin React host for explicitly composed, authored V2 character art.
 * No task data, classification, seeded choices or domain logic live here.
 */
export function SvgCharacter({
  id, instanceKey, label, decorative = false, expression, pose,
  decorations, palette, misregistration = true, className = '',
}: SvgCharacterProps) {
  const reactId = useId()
  const source = useMemo(() => renderManualCharacterSvg(id, {
    instanceKey: instanceKey ?? reactId,
    title: label,
    decorative,
    expression,
    pose,
    decorations,
    palette,
    misregistration,
  } satisfies ManualCharacterOptions), [id, instanceKey, reactId, label, decorative, expression, pose, decorations, palette, misregistration])
  return <span className={`hc-v2-svg-primitive ${className}`.trim()} dangerouslySetInnerHTML={{__html: source}} />
}
