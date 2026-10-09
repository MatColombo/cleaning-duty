import type { ThemePalette } from '../lib/theme'
import type { VectorPalette } from './types'
import { artMixHex, deriveVisualInkRoles } from './VisualPaletteAdapter'

/** Deterministic sRGB mix for standalone SVGs without CSS color-mix(). */
export const mixHex = artMixHex

/** Maps the six controlled theme inks to the legacy authored vector vocabulary. */
export function vectorPaletteFromTheme(theme: ThemePalette): VectorPalette {
  const art = deriveVisualInkRoles(theme)
  return Object.freeze({
    paper: art.paper,
    surface: theme.surface.toUpperCase(),
    ink: art.outline,
    inkMuted: art.outline,
    primary: art.primary,
    primarySoft: art.soft,
    mustard: art.warning,
    coral: art.overdue,
    danger: art.overdue,
    // Supporting turquoise is a translucent/soft usage of primary ink;
    // avoid introducing an additional hard ink in card compositions.
    turquoise: art.primary,
  })
}

/** Inline SVGs use exactly the same art-only adjusted inks as standalone SVGs. */
export const CSS_VECTOR_PALETTE: VectorPalette = Object.freeze({
  paper: 'var(--hc-art-paper, #F4E8D0)',
  surface: 'var(--hc-art-surface, #FFF9EC)',
  ink: 'var(--hc-art-ink, #153D3A)',
  inkMuted: 'var(--hc-art-ink-muted, #153D3A)',
  primary: 'var(--hc-art-primary, #1F6B63)',
  primarySoft: 'var(--hc-art-primary-soft, #C7D7CB)',
  mustard: 'var(--hc-art-mustard, #C38A32)',
  coral: 'var(--hc-art-coral, #C65E48)',
  danger: 'var(--hc-art-danger, #C65E48)',
  turquoise: 'var(--hc-art-turquoise, #1F6B63)',
})
