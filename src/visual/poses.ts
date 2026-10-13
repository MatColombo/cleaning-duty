import type { LimbAnchors, VectorPalette, VectorPoint } from './types'

/** Static, curated glove gestures. Positions depend only on the object's authored anchors. */
export const POSE_IDS = [
  'arms-down', 'thumbs-up', 'wave', 'point', 'fist-pump', 'hands-on-hips',
  'hold-sponge', 'hold-cloth', 'scrub', 'shrug', 'celebrate', 'present',
] as const
export type PoseId = typeof POSE_IDS[number]
export function isPoseId(id: string): id is PoseId { return (POSE_IDS as readonly string[]).includes(id) }

type HandKind = 'fist'|'thumb'|'open'|'point'|'hold'
const DEFAULT_LEFT: VectorPoint = { x: 50, y: 144 }
const DEFAULT_RIGHT: VectorPoint = { x: 190, y: 144 }
const endpoint = (anchor: VectorPoint, dx: number, dy: number): VectorPoint => ({ x: Math.max(32, Math.min(208, anchor.x + dx)), y: Math.max(36, Math.min(199, anchor.y + dy)) })

function hand(tip: VectorPoint, p: VectorPalette, side: 'left'|'right', kind: HandKind = 'fist'): string {
  const glove = p.surface
  const border = p.ink
  const outlined = `fill="${glove}" stroke="${border}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"`
  const shape = kind === 'thumb'
    ? `<path d="M-13 10 L-14 -6 Q-14 -11 -10 -14 Q-4 -17 1 -11 L4 -24 Q5 -30 10 -28 Q16 -26 13 -18 L11 -8 L17 -5 Q22 0 19 8 L13 16 Q0 21 -11 16 Z" ${outlined}/><path d="M-7 -5 Q-1 -1 4 -3" fill="none" stroke="${border}" stroke-width="2.2" stroke-linecap="round"/>`
    : kind === 'open'
    ? `<path d="M-15 12 L-15 -5 Q-15 -12 -10 -13 Q-5 -13 -5 -6 V-20 Q-5 -26 0 -26 Q5 -26 5 -18 V-24 Q11 -28 14 -22 V-8 L17 -17 Q22 -19 24 -12 L21 11 Q10 21 -4 20 Z" ${outlined}/>`
    : kind === 'point'
    ? `<path d="M-10 14 L-12 -6 Q-12 -12 -7 -12 Q-2 -12 -1 -7 V-27 Q-1 -32 4 -32 Q10 -32 10 -26 V-5 L14 3 Q20 9 14 16 Z" ${outlined}/>`
    : kind === 'hold'
      ? `<path d="M-14 10 L-14 -6 Q-13 -13 -7 -12 Q-1 -15 4 -10 Q11 -14 15 -6 L15 9 Q10 18 0 18 Q-10 18 -14 10 Z" ${outlined}/>`
      : `<path d="M-13 9 L-13 -5 Q-12 -12 -6 -10 Q0 -14 5 -9 Q12 -13 16 -5 L15 8 Q12 17 0 17 Q-10 17 -13 9 Z" ${outlined}/>`
  const cuff = `<ellipse cx="0" cy="14" rx="11" ry="4" fill="${p.surface}" stroke="${border}" stroke-width="2.8"/>`
  const knuckles = kind === 'thumb' ? '' : `<path d="M-7 3 H8" fill="none" stroke="${border}" stroke-width="1.7" opacity=".35" stroke-linecap="round"/>`
  const thumb = kind === 'thumb' ? ' data-hc-thumb="up"' : ''
  return `<g data-hc-hand="${kind}" data-hc-pose-hand="${side}"${thumb} transform="translate(${tip.x} ${tip.y})">${shape}${cuff}${knuckles}</g>`
}

export interface PoseLayers { readonly behind: string; readonly foreground: string }
export function renderPoseLayers(id: PoseId, p: VectorPalette, anchors: LimbAnchors = {}, rightHand?: HandKind): PoseLayers {
  const left = anchors.leftArm ?? DEFAULT_LEFT
  const right = anchors.rightArm ?? DEFAULT_RIGHT
  const config: Record<PoseId, {l:[number,number],r:[number,number],lh?: HandKind,rh?: HandKind,prop?: 'sponge'|'cloth'|'scrub'}> = {
    'arms-down': { l:[-21,42], r:[21,42] },
    'thumbs-up': { l:[-29,17], r:[30,-40], lh:'open', rh:'thumb' },
    'wave': { l:[-24,35], r:[29,-50], rh:'open' },
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
  const arm = (from: VectorPoint, tip: VectorPoint, side: 'left'|'right') => {
    const controlX = side === 'left' ? from.x - 10 : from.x + 10
    const controlY = from.y + (tip.y - from.y) * 0.14 - (tip.y < from.y ? 10 : -3)
    return `<path d="M${from.x} ${from.y} Q${controlX} ${controlY} ${tip.x} ${tip.y}" fill="none" stroke="${p.ink}" stroke-width="9" stroke-linecap="round" data-hc-arm="${side}"/>`
  }
  const leg = (origin?: VectorPoint, dx = 0) => origin ? `<path d="M${origin.x} ${origin.y} Q${origin.x + dx} ${origin.y + 13} ${origin.x + dx} 216" stroke="${p.ink}" stroke-width="7" fill="none" stroke-linecap="round"/><ellipse cx="${origin.x + dx + 4}" cy="218" rx="13" ry="5" fill="${p.ink}"/>` : ''
  const behind = `<g data-hc-pose="${id}" aria-hidden="true">${arm(left, lTip, 'left')}${arm(right, rTip, 'right')}${leg(anchors.leftLeg, -5)}${leg(anchors.rightLeg, 5)}</g>`
  let prop = ''
  if (spec.prop === 'sponge' || spec.prop === 'scrub') prop = `<rect x="${rTip.x + 8}" y="${rTip.y - 22}" width="29" height="19" rx="4" fill="${p.mustard}" stroke="${p.ink}" stroke-width="3"/>`
  if (spec.prop === 'cloth') prop = `<path d="M${rTip.x + 7} ${rTip.y - 15} l28 0 -7 32 -22 -8 Z" fill="${p.turquoise}" stroke="${p.ink}" stroke-width="3"/>`
  const motion = id === 'wave' || id === 'celebrate' || id === 'fist-pump'
    ? `<path d="M${rTip.x + 14} ${rTip.y - 23} l13 -14 M${rTip.x + 19} ${rTip.y - 11} l18 -4" stroke="${p.mustard}" stroke-width="4" stroke-linecap="round" fill="none" data-hc-pose-accent="motion"/>`
    : ''
  return {
    behind,
    foreground: `<g aria-hidden="true" data-hc-pose-foreground="${id}">${hand(lTip, p, 'left', spec.lh)}${hand(rTip, p, 'right', rightHand ?? spec.rh)}${prop}${motion}</g>`,
  }
}
