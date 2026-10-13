import { VECTOR_ARTBOARDS } from '../artboards'
import { createSvgIdScope, stableVisualHash } from '../id'
import { CSS_VECTOR_PALETTE } from '../palette'
import { renderVectorDefs } from '../patterns'
import { renderManualCharacterSvg } from '../compose'
import { renderDecorationMarkup } from '../decorations'
import type { VectorPalette, VectorPatternKey } from '../types'
import type { CardVisualRecipe } from './recipe'
import { sanitizeStudioOverrides, type StudioOverrides } from '../studio/draft'

export interface RenderCardVisualOptions {
  /** Unique within a rendered document; identity / registration come from the recipe instead. */
  readonly instanceKey: string
  readonly palette?: VectorPalette
  readonly title?: string
  readonly decorative?: boolean
  /** Preview-only; no mutation to the automatic recipe or persistence. */
  readonly studio?: StudioOverrides
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
    ...base,
    paper: base.surface,
    inkMuted: base.ink,
    primary,
    turquoise: primary,
    mustard: attention,
    coral: attention,
    danger: attention,
  })
}

function artPlacement(svg: string, x: number, y: number, width: number, height: number): string {
  return svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${width}" height="${height}" `)
}

function sceneGeometry(environment: CardVisualRecipe['semantics']['environment'], p: VectorPalette): string {
  const floor = `<path d="M0 336 L640 334 V420 H0 Z" fill="${p.primarySoft}" opacity=".48"/>`
  const sunburst = `<circle cx="96" cy="89" r="68" fill="${p.mustard}" opacity=".10"/><path d="M96 20 V158 M27 89 H165 M45 39 L147 141 M45 141 L147 39" stroke="${p.mustard}" stroke-width="4" stroke-linecap="round" opacity=".14"/>`
  switch (environment) {
    case 'kitchen':
      return `<g data-hc-card-scene="kitchen"><rect x="32" y="62" width="576" height="184" rx="22" fill="${p.surface}" opacity=".35"/><g stroke="${p.ink}" stroke-width="2" opacity=".10">${Array.from({ length: 7 }, (_, i) => `<path d="M${i * 92 + 24} 62 V246"/>`).join('')}${Array.from({ length: 4 }, (_, i) => `<path d="M32 ${i * 46 + 62} H608"/>`).join('')}</g><path d="M56 262 H584" stroke="${p.ink}" stroke-width="7" opacity=".13"/>${floor}</g>`
    case 'bathroom':
      return `<g data-hc-card-scene="bathroom"><rect x="38" y="58" width="566" height="196" rx="28" fill="${p.surface}" opacity=".30"/><g stroke="${p.ink}" stroke-width="2" opacity=".09">${Array.from({ length: 6 }, (_, i) => `<path d="M${i * 100 + 62} 58 V254"/>`).join('')}${Array.from({ length: 5 }, (_, i) => `<path d="M38 ${i * 39 + 58} H604"/>`).join('')}</g><path d="M487 71 Q515 35 544 71" fill="none" stroke="${p.primary}" stroke-width="6" opacity=".18"/>${floor}</g>`
    case 'living':
    case 'bedroom':
    case 'dining':
      return `<g data-hc-card-scene="domestic">${sunburst}<path d="M0 258 Q210 183 356 253 T640 245 V420 H0 Z" fill="${p.primarySoft}" opacity=".52"/><rect x="419" y="72" width="146" height="95" rx="14" fill="${p.surface}" opacity=".18" stroke="${p.ink}" stroke-width="4" stroke-opacity=".12"/><path d="M444 92 H540 M444 118 H517 M444 144 H531" stroke="${p.ink}" stroke-width="4" stroke-linecap="round" opacity=".12"/></g>`
    case 'outdoor':
      return `<g data-hc-card-scene="outdoor"><path d="M0 293 Q144 226 278 287 T640 281 V420 H0 Z" fill="${p.primarySoft}" opacity=".50"/><circle cx="529" cy="84" r="44" fill="${p.mustard}" opacity=".13"/>${[85, 192, 544].map((x) => `<path d="M${x} 286 L${x + 14} 234 L${x + 28} 286" fill="${p.primary}" opacity=".16"/>`).join('')}</g>`
    default:
      return `<g data-hc-card-scene="generic">${sunburst}${floor}<path d="M0 96 L240 0 H640" fill="none" stroke="${p.primary}" stroke-width="7" opacity=".16"/><rect x="406" y="89" width="152" height="83" rx="16" fill="${p.surface}" opacity=".14" stroke="${p.ink}" stroke-width="4" stroke-opacity=".10"/></g>`
  }
}

function posterProps(environment: CardVisualRecipe['semantics']['environment'], p: VectorPalette): string {
  if (environment === 'kitchen') {
    return `<g data-hc-card-props="kitchen" opacity=".95"><rect x="78" y="252" width="119" height="15" rx="7" fill="${p.ink}" opacity=".13"/><rect x="85" y="233" width="38" height="25" rx="5" fill="${p.mustard}" opacity=".72" stroke="${p.ink}" stroke-width="3"/><rect x="133" y="210" width="17" height="48" rx="8" fill="${p.primary}" opacity=".32" stroke="${p.ink}" stroke-width="3"/></g>`
  }
  if (environment === 'bathroom') {
    return `<g data-hc-card-props="bathroom"><rect x="84" y="236" width="48" height="48" rx="10" fill="${p.surface}" opacity=".60" stroke="${p.ink}" stroke-width="3"/><path d="M144 218 h66 v14 h-66 z" fill="${p.turquoise}" opacity=".25"/><path d="M214 225 q24 -24 49 0" fill="none" stroke="${p.ink}" stroke-width="4" opacity=".14"/></g>`
  }
  if (environment === 'living' || environment === 'bedroom' || environment === 'dining') {
    return `<g data-hc-card-props="interior"><rect x="84" y="242" width="94" height="19" rx="10" fill="${p.ink}" opacity=".13"/><rect x="104" y="208" width="56" height="38" rx="10" fill="${p.primary}" opacity=".28" stroke="${p.ink}" stroke-width="3"/><circle cx="206" cy="240" r="17" fill="${p.mustard}" opacity=".44"/></g>`
  }
  return `<g data-hc-card-props="generic"><rect x="86" y="228" width="40" height="54" rx="12" fill="${p.primary}" opacity=".23" stroke="${p.ink}" stroke-width="3"/><circle cx="170" cy="250" r="19" fill="${p.mustard}" opacity=".32"/></g>`
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

function componentPositions(template: CardVisualRecipe['template']): { main: [number, number, number]; tool: [number, number, number] } {
  switch (template) {
    case 'subject-left': return { main: [44, 56, 330], tool: [418, 208, 152] }
    case 'subject-right': return { main: [284, 52, 326], tool: [61, 214, 154] }
    case 'center-stage': return { main: [172, 28, 342], tool: [56, 230, 140] }
    case 'medallion': return { main: [190, 38, 310], tool: [60, 193, 156] }
    case 'diagonal': return { main: [270, 48, 304], tool: [82, 170, 163] }
    case 'split-panel': return { main: [296, 72, 290], tool: [92, 85, 205] }
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
  const accentFill = `<path d="M44 58 Q272 6 596 53 L578 265 Q275 341 56 270 Z" fill="${palette.primary}" opacity=".16"/>`
  const posterHalo = `<circle cx="458" cy="139" r="118" fill="${palette.mustard}" opacity=".08"/><path d="M372 204 Q447 149 530 199" fill="none" stroke="${palette.coral}" stroke-width="8" stroke-linecap="round" opacity=".10"/>`
  const pattern = `<rect x="34" y="36" width="572" height="348" rx="18" fill="${ids.url(bgKey)}" opacity=".12"/><path d="M34 308 H609 V390 H34 Z" fill="${ids.url(halftoneKey)}" opacity=".13"/>`
  const positions = componentPositions(recipe.template)
  const studio = sanitizeStudioOverrides(options.studio)
  const scale = studio.scale ?? 1
  const proportion = studio.proportion === 'compact' ? .85 : studio.proportion === 'tall' ? 1.13 : 1
  const mainSize = positions.main[2] * scale
  const mainX = positions.main[0] + (positions.main[2] - mainSize) / 2
  const mainHeight = mainSize * proportion
  const mainY = positions.main[1] + (positions.main[2] - mainHeight) / 2
  const main = renderManualCharacterSvg(recipe.semantics.subjectId, {
    instanceKey: `${options.instanceKey}|${recipe.occurrenceSeed}|subject`,
    palette,
    decorative: true,
    expression: recipe.expression,
    pose: recipe.pose,
    faceParts: studio.eyes || studio.brows || studio.mouth ? { eyes: studio.eyes, brows: studio.brows, mouth: studio.mouth } : undefined,
    rightHand: studio.handGesture,
    registrationOffset: recipe.inkOffset,
  }).replace('<svg ', '<svg data-hc-card-role="subject" ')
  const subject = artPlacement(
    studio.proportion && studio.proportion !== 'standard' ? main.replace('<svg ', '<svg preserveAspectRatio="none" ') : main,
    mainX, mainY, mainSize, mainHeight,
  )
  const tool = recipe.semantics.toolId
    ? artPlacement(renderManualCharacterSvg(recipe.semantics.toolId, {
      instanceKey: `${options.instanceKey}|${recipe.occurrenceSeed}|tool`,
      palette,
      decorative: true,
      misregistration: false,
    }).replace('<svg ', '<svg data-hc-card-role="tool" '), positions.tool[0], positions.tool[1], positions.tool[2], positions.tool[2])
    : ''
  const studioProp = studio.prop && studio.prop !== 'none' ? `<g data-hc-studio-prop="${studio.prop}" aria-hidden="true" transform="translate(530 297) scale(.48)">${renderDecorationMarkup(studio.prop, palette)}</g>` : ''
  const decorations = recipe.decorations.map(({ id, x, y, scale }) =>
    `<g aria-hidden="true" transform="translate(${x} ${y}) scale(${Math.max(.2, Math.min(.45, scale + .03))})">${renderDecorationMarkup(id, palette)}</g>`).join('')
  // A few small deterministic ink specks, no expensive filters or runtime randomness.
  const wear = Array.from({ length: 8 }, (_, index) => {
    const hash = Number.parseInt(stableVisualHash(`${recipe.occurrenceSeed}|wear|${index}`), 36)
    const x = 30 + (hash % 579)
    const y = 35 + (Math.floor(hash / 577) % 341)
    const opacity = (recipe.distress * .26 + ((hash % 5) * .006)).toFixed(3)
    return `<circle cx="${x}" cy="${y}" r="${1 + (hash % 3)}" fill="${palette.ink}" opacity="${opacity}"/>`
  }).join('')
  const titleId = ids.id('title')
  const decorative = options.decorative !== false
  const a11y = decorative ? 'aria-hidden="true" focusable="false"' : `role="img" aria-labelledby="${titleId}" focusable="false"`
  const title = decorative ? '' : `<title id="${titleId}">${escapeXml(options.title ?? 'House Care card illustration')}</title>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${area.viewBox}" ${a11y} data-hc-card-version="${recipe.version}" data-hc-card-subject="${recipe.semantics.subjectId}" data-hc-card-template="${recipe.template}">
  ${title}${defs}
  <rect width="640" height="420" rx="30" fill="${palette.surface}"/>
  <g data-hc-card-layer="scene">${sceneGeometry(recipe.semantics.environment, palette)}</g>
  <g data-hc-card-layer="print-base">${accentFill}${posterHalo}${pattern}${posterProps(recipe.semantics.environment, palette)}</g>
  <g data-hc-card-layer="props">${tool}${decorations}${studioProp}</g>
  <g data-hc-card-layer="hero">${subject}</g>
  <g data-hc-card-layer="texture">${wear}</g>
  ${editionMark(recipe.edition.stamp, palette)}${printBorder(recipe.border, palette)}
  </svg>`
}
