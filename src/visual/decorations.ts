import type { VectorPalette } from './types'

/** Small named print ornaments, all deliberately authored (no seeded choice). */
export const DECORATION_IDS = [
  'sparkle-4', 'sparkle-6', 'starburst-round', 'starburst-jagged',
  'action-rays', 'steam', 'droplets', 'bubbles', 'dust', 'shine',
  'tiles', 'checker', 'halftone-patch', 'diagonal-patch',
] as const
export type DecorationId = typeof DECORATION_IDS[number]
export function isDecorationId(id: string): id is DecorationId { return (DECORATION_IDS as readonly string[]).includes(id) }

function starPoints(cx: number, cy: number, points: number, inner: number, outer: number): string {
  return Array.from({ length: points * 2 }, (_, index) => {
    const angle = index * Math.PI / points - Math.PI / 2
    const radius = index % 2 ? inner : outer
    return `${(cx + radius*Math.cos(angle)).toFixed(1)},${(cy + radius*Math.sin(angle)).toFixed(1)}`
  }).join(' ')
}
export function renderDecorationMarkup(id: DecorationId, p: VectorPalette): string {
  const line = (d: string, color = p.ink, width = 5) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  switch (id) {
    case 'sparkle-4': return `<polygon points="64,12 76,51 116,64 76,77 64,116 52,77 12,64 52,51" fill="${p.mustard}" stroke="${p.ink}" stroke-width="3"/>`
    case 'sparkle-6': return `<polygon points="${starPoints(64,64,6,25,54)}" fill="${p.coral}" stroke="${p.ink}" stroke-width="3"/>`
    case 'starburst-round': return `<polygon points="${starPoints(64,64,12,44,52)}" fill="${p.mustard}" stroke="${p.ink}" stroke-width="3.5"/>`
    case 'starburst-jagged': return `<polygon points="${starPoints(64,64,11,30,58)}" fill="${p.coral}" stroke="${p.ink}" stroke-width="3.5"/>`
    case 'action-rays': return Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;const x1=64+32*Math.cos(a),y1=64+32*Math.sin(a),x2=64+54*Math.cos(a),y2=64+54*Math.sin(a);return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${p.mustard}" stroke-width="7" stroke-linecap="round"/>`}).join('')
    case 'steam': return `${line('M30 109 C5 80 53 68 34 42 Q18 27 32 14',p.coral,6)}${line('M65 112 C41 80 89 66 67 36',p.coral,6)}${line('M99 107 C82 77 118 63 103 29',p.coral,6)}`
    case 'droplets': return `${[[29,60,1],[76,25,.7],[84,92,1.1]].map(([x,y,s])=>`<path transform="translate(${x} ${y}) scale(${s})" d="M0 -19 Q-14 -1 -14 10 Q-13 24 0 24 Q14 24 14 10 Q14 -1 0 -19 Z" fill="${p.turquoise}" stroke="${p.ink}" stroke-width="3"/>`).join('')}`
    case 'bubbles': return `${[[29,90,16],[85,78,22],[65,26,14],[103,24,9]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${p.surface}" stroke="${p.turquoise}" stroke-width="5"/><circle cx="${x-r*.3}" cy="${y-r*.35}" r="${r*.22}" fill="${p.paper}"/>`).join('')}`
    case 'dust': return `${[[12,41,4],[44,24,6],[89,16,4],[104,75,7],[39,106,5],[76,91,3]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${p.inkMuted}" opacity=".7"/>`).join('')}`
    case 'shine': return `<polygon points="58,10 69,50 110,62 69,73 58,114 47,73 8,62 47,50" fill="${p.mustard}"/>${line('M106 12 L106 32 M97 23 H117',p.coral,4)}`
    case 'tiles': return `<rect x="8" y="8" width="112" height="112" rx="5" fill="${p.surface}"/>${[8,36,64,92,120].map(v=>`<path d="M${v} 8 V120 M8 ${v} H120" stroke="${p.turquoise}" stroke-width="2.5"/>`).join('')}<rect x="36" y="36" width="28" height="28" fill="${p.primarySoft}"/>`
    case 'checker': return `<rect x="8" y="8" width="112" height="112" fill="${p.surface}"/>${Array.from({length:7*7},(_,i)=>{const x=i%7,y=Math.floor(i/7);return (x+y)%2 ? `<rect x="${8+x*16}" y="${8+y*16}" width="16" height="16" fill="${p.coral}" opacity=".6"/>` : ''}).join('')}`
    case 'halftone-patch': return Array.from({length:9*9},(_,i)=>{const x=i%9,y=Math.floor(i/9);return `<circle cx="${9+x*13}" cy="${9+y*13}" r="${(1.2+(.3*x+.15*y)).toFixed(2)}" fill="${p.ink}" opacity=".35"/>`}).join('')
    case 'diagonal-patch': return Array.from({length:11},(_,i)=>line(`M${-64+i*18} 120 L${20+i*18} 8`,p.primary,4)).join('')
  }
}

export function renderDecorationSvg(id: DecorationId, palette: VectorPalette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${id} decoration">${renderDecorationMarkup(id,palette)}</svg>`
}
