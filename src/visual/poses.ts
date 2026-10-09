import type { LimbAnchors, VectorPalette, VectorPoint } from './types'

/** Static, curated glove gestures. Positions depend only on the object's authored anchors. */
export const POSE_IDS = [
  'arms-down', 'thumbs-up', 'wave', 'point', 'fist-pump', 'hands-on-hips',
  'hold-sponge', 'hold-cloth', 'scrub', 'shrug', 'celebrate', 'present',
] as const
export type PoseId = typeof POSE_IDS[number]
export function isPoseId(id: string): id is PoseId { return (POSE_IDS as readonly string[]).includes(id) }

const DEFAULT_LEFT: VectorPoint = { x: 50, y: 144 }
const DEFAULT_RIGHT: VectorPoint = { x: 190, y: 144 }
const endpoint = (anchor: VectorPoint, dx: number, dy: number): VectorPoint => ({ x: Math.max(32, Math.min(208, anchor.x + dx)), y: Math.max(36, Math.min(199, anchor.y + dy)) })

function hand(tip: VectorPoint, p: VectorPalette, kind: 'fist'|'thumb'|'open'|'point'|'hold' = 'fist'): string {
  const glove = p.surface
  const border = p.ink
  const outlined = `fill="${glove}" stroke="${border}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"`
  const shape = kind === 'thumb'
    ? `<path d="M-10 5 L-9 -7 Q-9 -12 -4 -12 Q-1 -12 0 -5 L3 -19 Q4 -24 9 -22 Q14 -19 11 -12 L10 -4 L15 -3 Q19 0 16 7 L11 13 Q1 17 -8 12 Z" ${outlined}/>`
    : kind === 'open'
    ? `<path d="M-13 11 L-13 -6 Q-13 -12 -8 -12 Q-4 -11 -4 -4 L-4 -18 Q-4 -23 0 -23 Q4 -23 4 -17 V-5 V-20 Q8 -24 11 -20 V-4 L14 -15 Q20 -17 21 -11 L18 10 Q9 20 -4 18 Z" ${outlined}/>`
    : kind === 'point'
    ? `<path d="M-9 13 L-11 -6 Q-11 -12 -6 -12 Q0 -12 0 -6 L0 -24 Q0 -29 5 -29 Q10 -29 10 -23 V-5 L14 3 Q19 9 13 15 Z" ${outlined}/>`
    : `<path d="M-12 9 L-12 -5 Q-11 -12 -5 -10 Q1 -15 6 -9 Q13 -14 16 -5 L14 9 Q11 17 -1 17 Z" ${outlined}/>`
  return `<g transform="translate(${tip.x} ${tip.y})">${shape}<path d="M-9 10 Q0 14 10 10" fill="none" stroke="${border}" stroke-width="1.7" opacity=".45"/></g>`
}

export interface PoseLayers { readonly behind: string; readonly foreground: string }
export function renderPoseLayers(id: PoseId, p: VectorPalette, anchors: LimbAnchors = {}): PoseLayers {
  const left = anchors.leftArm ?? DEFAULT_LEFT
  const right = anchors.rightArm ?? DEFAULT_RIGHT
  const config: Record<PoseId, {l:[number,number],r:[number,number],lh?: 'fist'|'thumb'|'open'|'point'|'hold',rh?: 'fist'|'thumb'|'open'|'point'|'hold',prop?: 'sponge'|'cloth'|'scrub'}> = {
    'arms-down': { l:[-21,42], r:[21,42] },
    'thumbs-up': { l:[-27,20], r:[31,-38], rh:'thumb' },
    'wave': { l:[-26,35], r:[28,-49], rh:'open' },
    'point': { l:[-22,23], r:[35,-8], rh:'point' },
    'fist-pump': { l:[-24,26], r:[26,-54] },
    'hands-on-hips': { l:[-14,28], r:[14,28] },
    'hold-sponge': { l:[-15,30], r:[27,3], rh:'hold', prop:'sponge' },
    'hold-cloth': { l:[-15,30], r:[24,5], rh:'hold', prop:'cloth' },
    'scrub': { l:[-18,29], r:[27,-5], rh:'hold', prop:'scrub' },
    'shrug': { l:[-31,-13], r:[31,-13], lh:'open', rh:'open' },
    'celebrate': { l:[-25,-52], r:[25,-52], lh:'open', rh:'open' },
    'present': { l:[-21,27], r:[34,-25], rh:'open' },
  }
  const spec = config[id]
  const lTip = endpoint(left, spec.l[0], spec.l[1])
  const rTip = endpoint(right, spec.r[0], spec.r[1])
  const arm = (from: VectorPoint, tip: VectorPoint) => `<path d="M${from.x} ${from.y} Q${(from.x + tip.x)/2} ${from.y + (tip.y-from.y)*.17} ${tip.x} ${tip.y}" fill="none" stroke="${p.ink}" stroke-width="8" stroke-linecap="round"/>`
  const leg = (origin?: VectorPoint, dx=0) => origin ? `<path d="M${origin.x} ${origin.y} Q${origin.x+dx} ${origin.y+13} ${origin.x+dx} 216" stroke="${p.ink}" stroke-width="7" fill="none" stroke-linecap="round"/><ellipse cx="${origin.x+dx+4}" cy="218" rx="13" ry="5" fill="${p.ink}"/>` : ''
  const behind = `<g data-hc-pose="${id}" aria-hidden="true">${arm(left,lTip)}${arm(right,rTip)}${leg(anchors.leftLeg,-5)}${leg(anchors.rightLeg,5)}</g>`
  let prop = ''
  if (spec.prop === 'sponge' || spec.prop === 'scrub') prop = `<rect x="${rTip.x+8}" y="${rTip.y-22}" width="29" height="19" rx="4" fill="${p.mustard}" stroke="${p.ink}" stroke-width="3"/>`
  if (spec.prop === 'cloth') prop = `<path d="M${rTip.x+7} ${rTip.y-15} l28 0 -7 32 -22 -8 Z" fill="${p.turquoise}" stroke="${p.ink}" stroke-width="3"/>`
  const motion = id === 'wave' || id === 'celebrate' || id === 'fist-pump' ? `<path d="M${rTip.x+14} ${rTip.y-23} l13 -14 M${rTip.x+19} ${rTip.y-11} l18 -4" stroke="${p.mustard}" stroke-width="4" stroke-linecap="round" fill="none"/>` : ''
  return { behind, foreground: `<g aria-hidden="true">${hand(lTip,p,spec.lh)}${hand(rTip,p,spec.rh)}${prop}${motion}</g>` }
}
