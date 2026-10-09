import { VECTOR_ARTBOARDS } from '../artboards'
import { createSvgIdScope, stableVisualHash } from '../id'
import { CSS_VECTOR_PALETTE } from '../palette'
import { renderVectorDefs } from '../patterns'
import { renderManualCharacterSvg } from '../compose'
import { renderDecorationMarkup } from '../decorations'
import type { VectorPalette, VectorPatternKey } from '../types'
import type { CardVisualRecipe } from './recipe'

export interface RenderCardVisualOptions {
  /** Unique within a rendered document; identity / registration come from the recipe instead. */
  readonly instanceKey: string
  readonly palette?: VectorPalette
  readonly title?: string
  readonly decorative?: boolean
}
function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character]!))
}

/** Theme substitution is applied *after* recipe creation; the seed never depends on appearance settings. */
export function cardPaletteForVariant(base: VectorPalette, recipe: Pick<CardVisualRecipe, 'paletteVariant'>): VectorPalette {
  const primary = {
    teal: base.primary, coral: base.coral, mustard: base.mustard, turquoise: base.turquoise,
  }[recipe.paletteVariant]
  // Exactly five possible hard inks per card: surface, outline, main ink,
  // supporting soft ink and one attention ink. Halftone opacity is not an ink.
  // This is appearance-only; the existing recipe seed and renderer identity stay unchanged.
  const attention = recipe.paletteVariant === 'coral' ? base.mustard : base.coral
  return Object.freeze({
    ...base, paper: base.surface, inkMuted: base.ink,
    primary, turquoise: primary, mustard: attention, coral: attention, danger: attention,
  })
}

function artPlacement(svg: string, x: number, y: number, width: number, height: number): string {
  return svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${width}" height="${height}" `)
}

function sceneGeometry(environment: CardVisualRecipe['semantics']['environment'], p: VectorPalette): string {
  const floor = `<path d="M0 337 L640 335 V420 H0 Z" fill="${p.primarySoft}" opacity=".5"/>`
  switch (environment) {
    case 'kitchen': case 'bathroom': case 'utility':
      return `<g stroke="${p.ink}" stroke-width="2" opacity=".11">${Array.from({length:7},(_,i)=>`<path d="M${i*110} 0 V420"/>`).join('')}${Array.from({length:5},(_,i)=>`<path d="M0 ${i*104} H640"/>`).join('')}</g>${floor}`
    case 'living': case 'bedroom': case 'dining':
      return `<path d="M0 250 Q200 198 360 264 T640 248 V420 H0 Z" fill="${p.primarySoft}" opacity=".48"/><circle cx="510" cy="65" r="52" fill="${p.mustard}" opacity=".12"/>`
    case 'outdoor':
      return `<path d="M0 300 Q140 230 280 290 T640 285 V420 H0 Z" fill="${p.turquoise}" opacity=".22"/>${[75,190,550].map(x=>`<path d="M${x} 280 L${x+15} 230 L${x+30} 280" fill="${p.primary}" opacity=".14"/>`).join('')}`
    default:
      return `${floor}<path d="M0 90 L260 0 H640" fill="none" stroke="${p.primary}" stroke-width="7" opacity=".16"/>`
  }
}

function printBorder(border: CardVisualRecipe['border'], p: VectorPalette): string {
  const basic = `<rect x="12" y="12" width="616" height="396" rx="23" fill="none" stroke="${p.ink}" stroke-width="5"/>`
  if (border === 'single') return basic
  if (border === 'double') return `${basic}<rect x="24" y="24" width="592" height="372" rx="18" fill="none" stroke="${p.ink}" stroke-width="2.5" opacity=".5"/>`
  if (border === 'ticket') return `${basic}<path d="M32 76 H608 M32 344 H608" stroke="${p.ink}" stroke-dasharray="8 9" opacity=".25" stroke-width="2"/>`
  return `${basic}<rect x="18" y="18" width="604" height="384" rx="23" fill="none" stroke="${p.coral}" stroke-width="3" opacity=".35"/>`
}

/** Curated, text-free mark. A later Care Card can localize the stamp caption in HTML. */
function editionMark(stamp: CardVisualRecipe['edition']['stamp'], p: VectorPalette): string {
  const x = 586, y = 62
  const shape = stamp === 'extra-care'
    ? '<polygon points="0,-24 8,-9 24,-7 12,5 15,22 0,14 -15,22 -12,5 -24,-7 -8,-9"/>'
    : stamp === 'daily-care'
      ? '<circle r="19"/><path d="M-11 0 H11 M0 -11 V11" fill="none" stroke-width="3"/>'
      : stamp === 'fine-print'
        ? '<rect x="-19" y="-19" width="38" height="38" rx="6"/><path d="M-12 -6 H12 M-12 2 H12 M-12 10 H6" fill="none" stroke-width="3"/>'
        : stamp === 'house-care'
          ? '<path d="M-20 1 L0 -18 L20 1 V19 H-20 Z"/><path d="M-5 19 V1 H5 V19" fill="none" stroke-width="3"/>'
          : '<circle r="20"/><path d="M0 -15 L5 -5 L15 0 L5 5 L0 15 L-5 5 L-15 0 L-5 -5 Z"/>'
  return `<g aria-hidden="true" transform="translate(${x} ${y})" fill="${p.surface}" stroke="${p.ink}" stroke-width="3.5" stroke-linejoin="round">${shape}</g>`
}

function componentPositions(template: CardVisualRecipe['template']): { main: [number,number,number]; tool: [number,number,number] } {
  switch (template) {
    case 'subject-left': return {main:[70,74,290],tool:[430,220,140]}
    case 'subject-right': return {main:[300,66,300],tool:[73,220,140]}
    case 'center-stage': return {main:[188,45,315],tool:[68,235,138]}
    case 'medallion': return {main:[205,60,280],tool:[60,195,150]}
    case 'diagonal': return {main:[277,65,287],tool:[92,180,155]}
    case 'split-panel': return {main:[304,82,268],tool:[108,97,195]}
  }
}

/**
 * Phase 5 art-only rendering proof. No operational labels are embedded; the future
 * Care Card will present title, due state, status and actions using accessible HTML.
 */
export function renderCardVisualSvg(recipe: CardVisualRecipe, options: RenderCardVisualOptions): string {
  const palette = cardPaletteForVariant(options.palette ?? CSS_VECTOR_PALETTE, recipe)
  const ids = createSvgIdScope(`${options.instanceKey}|${recipe.stableSeed}|${recipe.occurrenceSeed}`, 'hc-card')
  const bgKey = recipe.backgroundPattern
  const halftoneKey: VectorPatternKey = ({
    fine: 'halftoneFine', medium: 'halftoneMedium', coarse: 'halftoneCoarse',
  } as const)[recipe.halftone]
  const defs = renderVectorDefs(ids, palette, [...new Set([bgKey, halftoneKey])])
  const area = VECTOR_ARTBOARDS.cardArt
  const accentFill = `<path d="M38 52 Q270 6 597 55 L574 267 Q253 351 55 261 Z" fill="${palette.primary}" opacity=".14"/>`
  const pattern = `<rect x="34" y="36" width="572" height="348" rx="18" fill="${ids.url(bgKey)}" opacity=".13"/><path d="M33 316 H611 V390 H33 Z" fill="${ids.url(halftoneKey)}" opacity=".14"/>`
  const positions = componentPositions(recipe.template)
  const main = renderManualCharacterSvg(recipe.semantics.subjectId, {
    instanceKey: `${options.instanceKey}|${recipe.occurrenceSeed}|subject`,
    palette, decorative: true, expression: recipe.expression, pose: recipe.pose,
    registrationOffset: recipe.inkOffset,
  })
  const subject = artPlacement(main, positions.main[0], positions.main[1], positions.main[2], positions.main[2])
  const tool = recipe.semantics.toolId
    ? artPlacement(renderManualCharacterSvg(recipe.semantics.toolId, {
        instanceKey: `${options.instanceKey}|${recipe.occurrenceSeed}|tool`,
        palette, decorative: true, misregistration: false,
      }), positions.tool[0], positions.tool[1], positions.tool[2], positions.tool[2])
    : ''
  const decorations = recipe.decorations.map(({id,x,y,scale}) =>
    `<g aria-hidden="true" transform="translate(${x} ${y}) scale(${scale})">${renderDecorationMarkup(id,palette)}</g>`).join('')
  // A few small deterministic ink specks, no expensive filters or runtime randomness.
  const wear = Array.from({length:5},(_,index)=>{
    const hash = Number.parseInt(stableVisualHash(`${recipe.occurrenceSeed}|wear|${index}`),36)
    const x = 32 + (hash % 575), y = 37 + (Math.floor(hash/577) % 337)
    return `<circle cx="${x}" cy="${y}" r="${1+(hash%3)}" fill="${palette.ink}" opacity="${(recipe.distress*.2).toFixed(3)}"/>`
  }).join('')
  const titleId = ids.id('title')
  const decorative = options.decorative !== false
  const a11y = decorative ? 'aria-hidden="true" focusable="false"' : `role="img" aria-labelledby="${titleId}" focusable="false"`
  const title = decorative ? '' : `<title id="${titleId}">${escapeXml(options.title ?? 'House Care card illustration')}</title>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${area.viewBox}" ${a11y} data-hc-card-version="${recipe.version}" data-hc-card-subject="${recipe.semantics.subjectId}" data-hc-card-template="${recipe.template}">
  ${title}${defs}
  <rect width="640" height="420" rx="30" fill="${palette.surface}"/>
  ${sceneGeometry(recipe.semantics.environment,palette)}${accentFill}${pattern}${tool}${subject}${decorations}${wear}${editionMark(recipe.edition.stamp,palette)}${printBorder(recipe.border,palette)}
  </svg>`
}
