/** Pure, presentation-only geometry. A gesture never implies a task lifecycle action. */
export type DeckDirection = -1 | 0 | 1
export type GestureAxis = 'undecided' | 'horizontal' | 'vertical'

export const DECK_AXIS_THRESHOLD_PX = 9
export const DECK_VELOCITY_THRESHOLD_PX_MS = 0.48

export function gestureAxis(dx: number, dy: number): GestureAxis {
  if (Math.hypot(dx, dy) < DECK_AXIS_THRESHOLD_PX) return 'undecided'
  if (Math.abs(dx) > Math.abs(dy) * 1.18) return 'horizontal'
  if (Math.abs(dy) > Math.abs(dx) * 1.18) return 'vertical'
  return 'undecided'
}

export function boundedDrag(dx: number, dy: number, cardWidth: number) {
  const maxX = Math.min(220, Math.max(75, cardWidth * 0.58))
  const x = Math.max(-maxX, Math.min(maxX, dx))
  const y = Math.max(-22, Math.min(22, dy * 0.13))
  const angle = Math.max(-7, Math.min(7, (x / Math.max(200, cardWidth)) * 11))
  return { x, y, angle, progress: Math.max(-1, Math.min(1, x / maxX)) }
}

/** Inertia predicts at most 160 ms ahead. A tiny fast jitter cannot navigate. */
export function releaseDirection(dx: number, velocityX: number, width: number, count: number): DeckDirection {
  if (count < 2 || !Number.isFinite(dx) || !Number.isFinite(velocityX)) return 0
  const w = Math.max(width, 200)
  const directThreshold = Math.min(112, Math.max(62, w * 0.27))
  const projected = dx + Math.max(-128, Math.min(128, velocityX * 160))
  if (Math.abs(dx) >= directThreshold) return dx > 0 ? -1 : 1
  if (Math.abs(dx) >= 22 && Math.abs(velocityX) >= DECK_VELOCITY_THRESHOLD_PX_MS && Math.abs(projected) >= directThreshold) {
    return projected > 0 ? -1 : 1
  }
  return 0
}

/** Keep the same card on reorder; when removed, prefer the following survivor. */
export function survivingDeckId(previousIds: string[], nextIds: string[], selectedId: string | null): string | null {
  if (!nextIds.length) return null
  if (selectedId && nextIds.includes(selectedId)) return selectedId
  const index = previousIds.indexOf(selectedId ?? '')
  if (index >= 0) {
    for (let offset = 1; offset < previousIds.length; offset++) {
      const following = previousIds[index + offset]
      if (following && nextIds.includes(following)) return following
      const preceding = previousIds[index - offset]
      if (preceding && nextIds.includes(preceding)) return preceding
    }
  }
  return nextIds[0]
}

export function dragTransform(x: number, y: number, angle: number): string {
  return `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${angle.toFixed(2)}deg)`
}
