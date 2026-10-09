import { createSvgIdScope } from './id'
import { deterministicInkOffset } from './misregistration'
import { CSS_VECTOR_PALETTE } from './palette'
import { renderVectorDefs } from './patterns'
import { getPrimitiveDefinition } from './registry'
import type { InkRegistrationOffset, VectorPalette, VectorPatternKey } from './types'

export interface RenderPrimitiveOptions {
  readonly instanceKey: string
  readonly palette?: VectorPalette
  readonly title?: string
  readonly decorative?: boolean
  readonly includeHalftoneDefs?: boolean
  readonly misregistration?: boolean
  readonly misregistrationOpacity?: number
  /** Stable print offset supplied by a card recipe; independent of the SVG instance ID. */
  readonly registrationOffset?: InkRegistrationOffset
  readonly className?: string
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character] as string))
}

export function renderPrimitiveSvg(primitiveId: string, options: RenderPrimitiveOptions): string {
  const definition = getPrimitiveDefinition(primitiveId)
  const ids = createSvgIdScope(`${primitiveId}|${options.instanceKey}`)
  const palette = options.palette ?? CSS_VECTOR_PALETTE
  const artboard = definition.metadata.artboard
  const patterns = new Set<VectorPatternKey>()
  const context = {
    palette,
    ids,
    pattern(key: VectorPatternKey) {
      patterns.add(key)
      return ids.url(key)
    },
  }
  const layers = definition.render(context)
  const defs = options.includeHalftoneDefs === false || patterns.size === 0 ? '' : renderVectorDefs(ids, palette, [...patterns])
  const registration = options.misregistration !== false && layers.registration
    ? (() => {
        const generated = deterministicInkOffset(`${primitiveId}|${options.instanceKey}|registration`)
        const offset = options.registrationOffset ?? generated
        const x = Math.max(-1.5, Math.min(1.5, Number.isFinite(offset.x) ? offset.x : 0))
        const y = Math.max(-1.5, Math.min(1.5, Number.isFinite(offset.y) ? offset.y : 0))
        const opacity = Math.max(0, Math.min(0.35, options.misregistrationOpacity ?? 0.16))
        return `<g aria-hidden="true" transform="translate(${x} ${y})" fill="${palette.coral}" stroke="${palette.coral}" opacity="${opacity}">${layers.registration}</g>`
      })()
    : ''
  const titleId = ids.id('title')
  const accessible = options.decorative === true
    ? 'aria-hidden="true" focusable="false"'
    : `role="img" aria-labelledby="${titleId}" focusable="false"`
  const title = options.decorative === true ? '' : `<title id="${titleId}">${escapeXml(options.title ?? primitiveId)}</title>`
  const className = options.className ? ` class="${escapeXml(options.className)}"` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${artboard.viewBox}"${className} ${accessible} data-hc-primitive="${escapeXml(primitiveId)}" data-hc-id-scope="${ids.prefix}">
    ${title}
    ${defs}
    ${registration}
    <g data-hc-layer="body">${layers.body}</g>
    ${layers.foreground ? `<g data-hc-layer="foreground">${layers.foreground}</g>` : ''}
  </svg>`
}
