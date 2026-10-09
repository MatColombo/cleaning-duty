import { renderPrimitiveSvg, type RenderPrimitiveOptions } from './render'
import { getPrimitiveDefinition } from './registry'
import { renderExpressionMark, type ExpressionId } from './expressions'
import { renderPoseLayers, type PoseId } from './poses'
import { renderDecorationMarkup, type DecorationId } from './decorations'
import { CSS_VECTOR_PALETTE } from './palette'

/**
 * Explicit/manual Phase 4 character assembler. Not a procedural generator.
 * Every expression, pose and accent is chosen by the caller, never by a seed.
 */
export interface ManualDecoration {
  readonly id: DecorationId
  readonly x: number
  readonly y: number
  readonly scale?: number
}
export interface ManualCharacterOptions extends RenderPrimitiveOptions {
  readonly expression?: ExpressionId
  readonly pose?: PoseId
  readonly decorations?: readonly ManualDecoration[]
}
export function renderManualCharacterSvg(primitiveId: string, options: ManualCharacterOptions): string {
  const definition = getPrimitiveDefinition(primitiveId)
  const palette = options.palette ?? CSS_VECTOR_PALETTE
  let svg = renderPrimitiveSvg(primitiveId, options)
  const pose = options.pose ? renderPoseLayers(options.pose, palette, definition.metadata.limbAnchors) : undefined
  if (pose) {
    svg = svg.replace('<g data-hc-layer="body">', `${pose.behind}<g data-hc-layer="body">`)
  }
  const anchor = definition.metadata.faceAnchor
  const face = options.expression && anchor
    ? `<g aria-hidden="true" data-hc-expression="${options.expression}" transform="translate(${(anchor.x-24).toFixed(1)} ${(anchor.y-24).toFixed(1)}) scale(.75)">${renderExpressionMark(options.expression,palette)}</g>`
    : ''
  const ornament = (options.decorations ?? []).map(({id,x,y,scale=0.35}) => `<g aria-hidden="true" data-hc-decoration="${id}" transform="translate(${x} ${y}) scale(${Math.max(0.1, Math.min(.75,scale))})">${renderDecorationMarkup(id,palette)}</g>`).join('')
  const overlay = `<g data-hc-layer="manual-overlay">${face}${pose?.foreground ?? ''}${ornament}</g>`
  return svg.replace('</svg>', `${overlay}</svg>`)
}
