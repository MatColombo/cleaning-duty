import type { VectorPalette } from './types'

/** Reusable face ink only. Never contains a subject silhouette or fill plate. */
export const EXPRESSION_IDS = [
  'joyful', 'smile', 'proud', 'neutral', 'focused', 'worried',
  'tired', 'sweaty', 'angry', 'sleepy', 'relieved', 'surprised',
] as const
export type ExpressionId = typeof EXPRESSION_IDS[number]

export function isExpressionId(id: string): id is ExpressionId {
  return (EXPRESSION_IDS as readonly string[]).includes(id)
}

export function renderExpressionMark(id: ExpressionId, p: VectorPalette): string {
  const ink = p.ink
  const stroke = (d: string, width = 4, color = ink, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`
  const fillPath = (d: string, color = ink, extra = '') => `<path d="${d}" fill="${color}" ${extra}/>`
  const eye = (x: number, y = 27, rx = 4.8, ry = 6.6) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${ink}"/>`
  const openEyes = `<g data-hc-face-part="eyes">${eye(20)}${eye(44)}</g>`
  const closedEyes = `<g data-hc-face-part="eyes">${stroke('M13 28 Q20 33 27 28', 3.8)}${stroke('M37 28 Q44 33 51 28', 3.8)}</g>`
  const wideEyes = `<g data-hc-face-part="eyes"><circle cx="20" cy="27" r="6.4" fill="${p.surface}" stroke="${ink}" stroke-width="3.4"/><circle cx="44" cy="27" r="6.4" fill="${p.surface}" stroke="${ink}" stroke-width="3.4"/><circle cx="20" cy="28.2" r="2.2" fill="${ink}"/><circle cx="44" cy="28.2" r="2.2" fill="${ink}"/></g>`
  const brows = (left: string, right: string, width = 4.1) => `<g data-hc-face-part="brows">${stroke(left, width)}${stroke(right, width)}</g>`
  const blush = `<g data-hc-face-part="cheeks"><ellipse cx="9.5" cy="40" rx="5.7" ry="4.2" fill="${p.coral}" opacity=".48"/><ellipse cx="54.5" cy="40" rx="5.7" ry="4.2" fill="${p.coral}" opacity=".48"/></g>`
  const smile = `<g data-hc-face-part="mouth">${stroke('M17 43 Q32 55 47 43', 4.6)}</g>`
  const confidentSmile = `<g data-hc-face-part="mouth">${stroke('M18 42 Q31 51 45 40', 4.4)}</g>`
  const frown = `<g data-hc-face-part="mouth">${stroke('M20 49 Q32 38 44 49', 4.4)}</g>`
  const flat = `<g data-hc-face-part="mouth">${stroke('M22 45 H42', 4.2)}</g>`
  const openLaugh = `<g data-hc-face-part="mouth">${fillPath('M17 39 Q32 60 47 39 Q32 51 17 39 Z')}${stroke('M23 46 Q32 42 41 46', 3.5, p.coral)}</g>`
  const openO = `<g data-hc-face-part="mouth"><ellipse cx="32" cy="47" rx="7.4" ry="9.6" fill="${ink}"/></g>`
  const tiredMouth = `<g data-hc-face-part="mouth"><ellipse cx="32" cy="47" rx="6.8" ry="4.4" fill="${ink}" opacity=".76"/></g>`
  const sweat = `<g data-hc-face-part="accent">${fillPath('M51 8 Q58 -3 62 10 Q63 18 58 20 Q49 20 51 8', p.turquoise)}</g>`
  const sleepyAccent = `<g data-hc-face-part="accent">${stroke('M48 10 H61 L50 21 H61', 3.4, p.turquoise)}</g>`

  switch (id) {
    case 'joyful':
      return `${closedEyes}${brows('M12 18 Q18 15 24 18', 'M40 18 Q46 15 52 18', 3.2)}${blush}${openLaugh}`
    case 'smile':
      return `${openEyes}${brows('M12 18 Q18 16 24 18', 'M40 18 Q46 16 52 18', 3.2)}${blush}${smile}`
    case 'proud':
      return `<g data-hc-face-part="eyes">${eye(21, 27, 4.4, 6.2)}${stroke('M37 27 Q44 34 50 26', 3.8)}</g>${brows('M13 17 L25 14', 'M39 15 L49 18')}${blush}${confidentSmile}`
    case 'neutral':
      return `${openEyes}${brows('M13 18 H25', 'M39 18 H51', 3.2)}${flat}`
    case 'focused':
      return `${openEyes}${brows('M12 20 L25 15', 'M39 15 L52 20')}${flat}`
    case 'worried':
      return `${openEyes}${brows('M13 20 Q20 12 28 21', 'M36 21 Q44 12 51 20')}${frown}`
    case 'tired':
      return `<g data-hc-face-part="eyes">${stroke('M13 28 L27 31', 3.7)}${stroke('M37 31 L51 28', 3.7)}</g>${brows('M13 17 H26', 'M38 17 H51', 3.2)}${tiredMouth}`
    case 'sweaty':
      return `${openEyes}${brows('M13 20 L27 15', 'M37 15 L51 20')}${frown}${sweat}`
    case 'angry':
      return `${openEyes}${brows('M11 15 L27 23', 'M37 23 L53 15')}${frown}`
    case 'sleepy':
      return `${closedEyes}${flat}${sleepyAccent}`
    case 'relieved':
      return `${closedEyes}${brows('M14 18 Q19 15 24 18', 'M40 18 Q45 15 50 18', 3.2)}${blush}${smile}`
    case 'surprised':
      return `${wideEyes}${brows('M12 17 Q18 11 24 17', 'M40 17 Q46 11 52 17', 3.2)}${openO}`
  }
}

export function renderExpressionPreviewSvg(id: ExpressionId, p: VectorPalette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="${id} expression"><circle cx="40" cy="40" r="32" fill="${p.mustard}" opacity=".28"/><circle cx="40" cy="40" r="32" fill="none" stroke="${p.ink}" stroke-width="2"/><g transform="translate(8 8)">${renderExpressionMark(id, p)}</g></svg>`
}

/** Reuses authored face ink; selects only known parts, never accepts SVG markup. */
export function renderStudioExpression(
  base: ExpressionId,
  parts: { eyes?: ExpressionId; mouth?: ExpressionId; brows?: ExpressionId },
  palette: VectorPalette,
): string {
  let markup = renderExpressionMark(base, palette)
  for (const part of ['eyes', 'brows', 'mouth'] as const) {
    const expression = parts[part]
    if (!expression) continue
    const group = new RegExp(`<g data-hc-face-part="${part}">[^]*?</g>`, 'g')
    const replacement = renderExpressionMark(expression, palette).match(group)?.[0]
      ?? renderExpressionMark('neutral', palette).match(group)?.[0]
    if (!replacement) continue
    if (group.test(markup)) markup = markup.replace(group, () => replacement)
    else markup += replacement
  }
  return markup
}
