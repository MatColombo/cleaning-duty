import { useId, useMemo } from 'react'
import { renderPrimitiveSvg, type RenderPrimitiveOptions } from './render'
import type { VectorPalette } from './types'

export interface SvgPrimitiveProps {
  id: string
  instanceKey?: string
  label?: string
  decorative?: boolean
  palette?: VectorPalette
  misregistration?: boolean
  className?: string
}

/**
 * Thin React host for authored multicolor V2 SVGs.
 * This is separate from the legacy monochrome CSS-mask Illustration component.
 */
export function SvgPrimitive({ id, instanceKey, label, decorative = false, palette, misregistration = true, className = '' }: SvgPrimitiveProps) {
  const reactId = useId()
  const source = useMemo(() => renderPrimitiveSvg(id, {
    instanceKey: instanceKey ?? reactId,
    title: label,
    decorative,
    palette,
    misregistration,
  } satisfies RenderPrimitiveOptions), [id, instanceKey, reactId, label, decorative, palette, misregistration])

  return <span className={`hc-v2-svg-primitive ${className}`.trim()} dangerouslySetInnerHTML={{ __html: source }} />
}
