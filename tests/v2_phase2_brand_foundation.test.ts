declare const require: (name: string) => any
declare const process: { cwd(): string }

import { contrastIssues, defaultThemeId, sanitizePalette, themePreset, themePresets } from '../src/lib/theme'
import { HOUSE_CARE_BRAND_ASSETS } from '../src/visual/brand'

const { readFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

const retro = themePreset('house-care-retro')
assert(retro.id === 'house-care-retro', 'House Care Retro preset must be resolvable')
assert(retro.category === 'classic', 'House Care Retro belongs to the Classic preset family')
assert(contrastIssues(retro.palette).length === 0, 'House Care Retro must pass current contrast guardrails')
assert(themePresets.some((preset) => preset.id === 'fresh-sage'), 'Existing presets must remain available')
assert(defaultThemeId === 'fresh-sage', 'Phase 2 must not silently change the existing default theme')
assert(sanitizePalette({}, themePreset('fresh-sage').palette).canvas === themePreset('fresh-sage').palette.canvas, 'Existing custom-palette fallback behavior must remain intact')

const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')
assert(tokens.includes('--hc-art-paper: var(--color-canvas)'), 'V2 art paper must derive from semantic canvas')
assert(tokens.includes('--hc-art-mustard: var(--color-due)'), 'V2 mustard art ink must derive from semantic due')
assert(tokens.includes('--hc-art-coral: var(--color-overdue)'), 'V2 coral art ink must derive from semantic overdue')
assert(tokens.includes('--hc-art-turquoise: color-mix'), 'V2 supporting turquoise must be derived rather than persisted')

const paths = Object.values(HOUSE_CARE_BRAND_ASSETS)
for (const asset of paths) {
  const diskPath = join(process.cwd(), 'public', asset.replace(/^\//, ''))
  assert(existsSync(diskPath), `Brand runtime asset must exist: ${asset}`)
  const svg = readFileSync(diskPath, 'utf8')
  assert(svg.includes('<svg'), `${asset} must be an SVG`)
  assert(!svg.includes('<image'), `${asset} must not embed raster artwork`)
  assert(!svg.includes('data:image'), `${asset} must not embed raster data URLs`)
}

const wordmark = readFileSync(join(process.cwd(), 'public/brand/v2/house-care-wordmark.svg'), 'utf8')
assert(wordmark.includes('<text'), 'Wordmark lettering should remain text rather than vector outlines')

const appMark = readFileSync(join(process.cwd(), 'public/brand/v2/house-care-app-mark.svg'), 'utf8')
assert(!appMark.includes('<pattern'), 'Launcher-sized app mark must not use dense halftone/pattern texture')

console.log('V2 Phase 2 brand foundation tests passed')
