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
  const eye = (x: number, y = 26) => `<ellipse cx="${x}" cy="${y}" rx="3.8" ry="5.6" fill="${ink}"/>`
  const eyes = `${eye(22)}${eye(42)}`
  const path = (d: string, color = ink, width = 3.7) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  const brow = (left: string, right: string) => path(left, ink, 3.6) + path(right, ink, 3.6)
  const happy = `${path('M18 40 Q32 55 46 40',ink,4.5)}`
  const shut = path('M16 27 Q22 32 28 27') + path('M36 27 Q42 32 48 27')
  const cheek = `<circle cx="13" cy="37" r="4.6" fill="${p.coral}" opacity=".58"/><circle cx="51" cy="37" r="4.6" fill="${p.coral}" opacity=".58"/>`
  switch (id) {
    case 'joyful': return `${shut}${cheek}<path d="M20 38 Q32 59 44 38 Z" fill="${ink}"/><path d="M27 46 Q32 42 37 46" ${`stroke="${p.coral}" stroke-width="4"`} fill="none"/>`
    case 'smile': return `${eyes}${cheek}${happy}`
    case 'proud': return `${eye(23)}${path('M35 26 Q43 32 49 25')}${brow('M16 16 L26 14','M38 15 L46 18')}${path('M19 40 Q32 52 45 39')}${cheek}`
    case 'neutral': return `${eyes}${path('M23 44 H41')}`
    case 'focused': return `${eyes}${brow('M15 20 L28 16','M36 16 L49 20')}${path('M26 45 H40')}`
    case 'worried': return `${eyes}${brow('M16 19 Q23 12 29 21','M35 21 Q41 12 48 19')}${path('M22 48 Q32 35 43 48')}`
    case 'tired': return `${path('M17 27 L29 30')}${path('M35 30 L47 27')}${brow('M16 16 H28','M36 16 H48')}<ellipse cx="32" cy="46" rx="6" ry="4" fill="${ink}" opacity=".7"/>`
    case 'sweaty': return `${eyes}${brow('M16 19 L29 15','M35 15 L49 19')}${path('M23 48 Q32 38 42 48')}<path d="M49 10 Q54 1 58 11 Q60 19 54 19 Q47 19 49 10 Z" fill="${p.turquoise}"/>`
    case 'angry': return `${eyes}${brow('M14 13 L29 22','M35 22 L50 13')}${path('M20 48 Q32 35 44 48')}`
    case 'sleepy': return `${shut}${path('M26 42 Q32 36 38 42')}<path d="M47 11 H59 L48 21 H59" fill="none" stroke="${p.turquoise}" stroke-width="3" stroke-linejoin="round"/>`
    case 'relieved': return `${shut}${happy}${cheek}${path('M17 16 Q22 13 27 16')}${path('M37 16 Q42 13 47 16')}`
    case 'surprised': return `<circle cx="22" cy="27" r="6" fill="${p.surface}" stroke="${ink}" stroke-width="3"/><circle cx="42" cy="27" r="6" fill="${p.surface}" stroke="${ink}" stroke-width="3"/><ellipse cx="32" cy="46" rx="7" ry="9" fill="${ink}"/>`
  }
}

export function renderExpressionPreviewSvg(id: ExpressionId, p: VectorPalette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="${id} expression"><circle cx="40" cy="40" r="32" fill="${p.mustard}" opacity=".28"/><circle cx="40" cy="40" r="32" fill="none" stroke="${p.ink}" stroke-width="2"/><g transform="translate(8 8)">${renderExpressionMark(id, p)}</g></svg>`
}
