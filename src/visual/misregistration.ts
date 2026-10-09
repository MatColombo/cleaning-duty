import { stableVisualHash } from './id'
import type { InkRegistrationOffset } from './types'

export function deterministicInkOffset(seed: string, maxOffset = 1.5): InkRegistrationOffset {
  const hash = Number.parseInt(stableVisualHash(seed), 36) >>> 0
  const xUnit = ((hash & 0xffff) / 0xffff) * 2 - 1
  const yUnit = (((hash >>> 16) & 0xffff) / 0xffff) * 2 - 1
  const quantize = (value: number) => Math.round(value * maxOffset * 10) / 10
  return Object.freeze({ x: quantize(xUnit), y: quantize(yUnit) })
}
