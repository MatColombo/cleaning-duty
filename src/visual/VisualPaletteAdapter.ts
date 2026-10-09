import type { ThemePalette } from '../lib/theme'

/**
 * Six theme-derived inks for V2 vector illustration. The user's ten persisted
 * semantic theme values are never rewritten; only decorative SVG ink is adjusted.
 * Artwork has one safe outline, one main ink, two contextual accents, and a soft
 * tone against the active canvas/surface. Alpha halftone does not add ink colors.
 */
export interface VisualInkRoles {
  readonly paper: string
  readonly outline: string
  readonly primary: string
  readonly warning: string
  readonly overdue: string
  readonly soft: string
  readonly adjustedRoles: readonly ('outline' | 'primary' | 'warning' | 'overdue')[]
}

const HEX = /^#[0-9A-Fa-f]{6}$/
function rgb(color: string): [number, number, number] {
  if (!HEX.test(color)) return [0, 0, 0]
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16)) as [number, number, number]
}
function toHex(channels: readonly number[]): string {
  return `#${channels.map((n) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}
export function artMixHex(a: string, b: string, weightA = 0.5): string {
  const weight = Math.min(1, Math.max(0, weightA))
  const lhs = rgb(a), rhs = rgb(b)
  return toHex(lhs.map((channel, index) => channel * weight + rhs[index]! * (1 - weight)))
}
function luminance(color: string): number {
  const linear = rgb(color).map((byte) => {
    const c = byte / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
}
export function artContrastRatio(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a)
  return (values[0]! + 0.05) / (values[1]! + 0.05)
}
function bestOutline(background: string): string {
  return artContrastRatio('#111111', background) >= artContrastRatio('#FFFFFF', background) ? '#111111' : '#FFFFFF'
}
function ensureArtInk(candidate: string, surface: string, safeOutline: string, minimum: number): string {
  if (artContrastRatio(candidate, surface) >= minimum) return candidate.toUpperCase()
  // Move along the segment towards the accessible outline. No stored palette edits.
  for (let step = 1; step <= 32; step++) {
    const adjusted = artMixHex(candidate, safeOutline, 1 - step / 32)
    if (artContrastRatio(adjusted, surface) >= minimum) return adjusted
  }
  return safeOutline
}

export function deriveVisualInkRoles(theme: ThemePalette): VisualInkRoles {
  const surface = theme.surface
  const adjustedRoles: Array<'outline' | 'primary' | 'warning' | 'overdue'> = []
  const outline = artContrastRatio(theme.ink, surface) >= 4.5 ? theme.ink.toUpperCase() : bestOutline(surface)
  if (outline.toUpperCase() !== theme.ink.toUpperCase()) adjustedRoles.push('outline')
  const accent = (key: 'primary' | 'warning' | 'overdue', original: string) => {
    const next = ensureArtInk(original, surface, outline, 3)
    if (next.toUpperCase() !== original.toUpperCase()) adjustedRoles.push(key)
    return next
  }
  return Object.freeze({
    paper: theme.canvas.toUpperCase(),
    outline,
    primary: accent('primary', theme.primary),
    warning: accent('warning', theme.due),
    overdue: accent('overdue', theme.overdue),
    soft: theme.primarySoft.toUpperCase(),
    adjustedRoles: Object.freeze(adjustedRoles),
  })
}
