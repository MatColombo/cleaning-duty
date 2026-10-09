import type { VectorIdScope, VectorPalette, VectorPatternKey } from './types'

export const VECTOR_PATTERN_KEYS: readonly VectorPatternKey[] = Object.freeze([
  'halftoneFine',
  'halftoneMedium',
  'halftoneCoarse',
  'halftoneDiagonal',
  'halftoneRadialComic',
  'sparkles',
  'actionRays',
])

export function renderVectorDefs(ids: VectorIdScope, palette: VectorPalette, keys: readonly VectorPatternKey[] = VECTOR_PATTERN_KEYS): string {
  const id = (key: VectorPatternKey) => ids.id(key)
  const fragments: Record<VectorPatternKey, string> = {
    halftoneFine: `<pattern id="${id('halftoneFine')}" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.8" fill="${palette.ink}" opacity="0.22" /></pattern>`,
    halftoneMedium: `<pattern id="${id('halftoneMedium')}" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.45" fill="${palette.ink}" opacity="0.2" /></pattern>`,
    halftoneCoarse: `<pattern id="${id('halftoneCoarse')}" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.55" fill="${palette.ink}" opacity="0.18" /></pattern>`,
    halftoneDiagonal: `<pattern id="${id('halftoneDiagonal')}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(24)"><rect x="0" y="0" width="3" height="12" fill="${palette.ink}" opacity="0.12" /></pattern>`,
    halftoneRadialComic: `<pattern id="${id('halftoneRadialComic')}" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="3.1" fill="${palette.ink}" opacity="0.18" /><circle cx="0" cy="0" r="1.2" fill="${palette.ink}" opacity="0.12" /><circle cx="20" cy="20" r="1.2" fill="${palette.ink}" opacity="0.12" /></pattern>`,
    sparkles: `<pattern id="${id('sparkles')}" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M8 1 L10 6 L15 8 L10 10 L8 15 L6 10 L1 8 L6 6 Z" fill="${palette.mustard}" opacity="0.88" /><path d="M24 17 L25.5 21 L29 22.5 L25.5 24 L24 28 L22.5 24 L19 22.5 L22.5 21 Z" fill="${palette.coral}" opacity="0.76" /></pattern>`,
    actionRays: `<pattern id="${id('actionRays')}" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M24 2 V12 M24 36 V46 M2 24 H12 M36 24 H46 M8 8 L15 15 M33 33 L40 40 M40 8 L33 15 M15 33 L8 40" fill="none" stroke="${palette.mustard}" stroke-width="2.4" stroke-linecap="round" opacity="0.7" /></pattern>`,
  }
  const uniqueKeys = [...new Set(keys)]
  return `<defs>${uniqueKeys.map((key) => fragments[key]).join('')}</defs>`
}
