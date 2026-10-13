declare const require: (name: string) => any
declare const process: { cwd(): string }

import { generateCardVisualRecipe } from '../src/visual/procedural/recipe'
import { renderCardVisualSvg } from '../src/visual/procedural/render-card'
import { renderStudioPreviewSvg } from '../src/visual/studio/preview'
import { STUDIO_ANIMATIONS, STUDIO_GESTURES, STUDIO_OBJECT_IDS, STUDIO_PROPORTIONS, STUDIO_PROPS,
  overlayStudioRecipe, sanitizeStudioOverrides, studioUndo } from '../src/visual/studio/draft'
import { EXPRESSION_IDS } from '../src/visual/expressions'
import { POSE_IDS } from '../src/visual/poses'
import { CARD_PALETTE_VARIANTS, ENVIRONMENT_FAMILIES } from '../src/visual/procedural/taxonomy'
import { vectorPaletteFromTheme } from '../src/visual/palette'
import { themePreset } from '../src/lib/theme'

const assert = require('node:assert/strict')
const { readFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')
const { validateSvgSource } = require(join(process.cwd(), 'tools/svg-validation.cjs'))

const input = { routineId: 'studio-fixture', actionId: 'wipe', primaryTargetId: 'fixture-sink',
  occurrenceId: 'studio-preview-fixed', triggerOrdinal: 1, subjectName: 'Kitchen sink',
  subjectTypeName: 'Surface', actionName: 'Wipe', environmentName: 'Kitchen' }
const auto = generateCardVisualRecipe(input)
const retro = vectorPaletteFromTheme(themePreset('house-care-retro').palette)
const night = vectorPaletteFromTheme(themePreset('night-garden').palette)
const standard = renderCardVisualSvg(auto, { instanceKey: 'test18a', decorative:true, palette:retro })
assert.equal(renderStudioPreviewSvg(auto, {}, 'test18a', retro), standard, 'Auto must preserve the original renderer output byte-for-byte')
assert.equal(renderStudioPreviewSvg(auto, null, 'test18a', retro), standard, 'Null draft resolves to Auto')
assert.equal(renderStudioPreviewSvg(auto, { html:'<script>alert(1)</script>' }, 'test18a', retro), standard, 'Invalid keys do not reach SVG')
assert.equal(JSON.stringify(auto), JSON.stringify(generateCardVisualRecipe(input)), 'Automatic recipe stays immutable and deterministic')
assert.ok(STUDIO_OBJECT_IDS.length > 20 && STUDIO_OBJECT_IDS.every((id) => !id.includes('demo')), 'Preview object picker offers curated real assets, not demos')
assert.ok(STUDIO_OBJECT_IDS.includes('spray-bottle') && STUDIO_OBJECT_IDS.includes('generic-surface'))

const candidates: Array<[string, unknown]> = [
  ...STUDIO_OBJECT_IDS.map((subjectId) => ['subjectId', {subjectId}] as [string, unknown]),
  ...EXPRESSION_IDS.map((expression) => ['expression', {expression}] as [string, unknown]),
  ...EXPRESSION_IDS.map((eyes) => ['eyes', {eyes}] as [string, unknown]),
  ...EXPRESSION_IDS.map((mouth) => ['mouth', {mouth}] as [string, unknown]),
  ...EXPRESSION_IDS.map((brows) => ['brows', {brows}] as [string, unknown]),
  ...POSE_IDS.map((pose) => ['pose', {pose}] as [string, unknown]),
  ...STUDIO_GESTURES.map((handGesture) => ['handGesture', {handGesture}] as [string, unknown]),
  ...STUDIO_PROPORTIONS.map((proportion) => ['proportion', {proportion}] as [string, unknown]),
  ...STUDIO_PROPS.map((prop) => ['prop', {prop}] as [string, unknown]),
  ...ENVIRONMENT_FAMILIES.map((scene) => ['scene', {scene}] as [string, unknown]),
  ...CARD_PALETTE_VARIANTS.map((paletteVariant) => ['paletteVariant', {paletteVariant}] as [string, unknown]),
  ...STUDIO_ANIMATIONS.map((animation) => ['animation', {animation}] as [string, unknown]),
  ...[.75, 1, 1.25].map((scale) => ['scale', {scale}] as [string, unknown]),
]
for (const [field, override] of candidates) {
  const sanitized = sanitizeStudioOverrides(override)
  const svg = renderStudioPreviewSvg(auto, override, `field-${field}`, retro)
  const repeated = renderStudioPreviewSvg(auto, override, `field-${field}`, retro)
  assert.equal(svg, repeated, `Determinism: ${field} ${JSON.stringify(override)}`)
  const result = validateSvgSource(svg, { allowFixedColors: true, maxBytes: 65000, maxPaths: 250 })
  assert.ok(result.valid, `SVG validation: ${field} ${JSON.stringify(result.issues)}`)
  assert.ok(svg.length < 65000, 'Editor render remains bounded')
  assert.ok(!svg.includes('<image') && !svg.includes('<foreignObject'), 'No media SVG payload')
  assert.equal(Object.isFrozen(sanitized), true, 'Sanitizer returns immutable drafts')
}
const alt = renderStudioPreviewSvg(auto, {subjectId:'spray-bottle', eyes:'worried', brows:'angry', mouth:'joyful',
  pose:'thumbs-up', handGesture:'thumb', scale:1.2, proportion:'tall', prop:'steam', scene:'bathroom', paletteVariant:'coral'}, 'test18a',retro)
assert.notEqual(alt, standard, 'Every valid change is applied without modifying automatic baseline')
assert.ok(alt.includes('data-hc-thumb="up"') && alt.includes('data-hc-studio-prop="steam"'))
assert.ok(alt.includes('data-hc-card-subject="spray-bottle"') && alt.includes('data-hc-card-scene="bathroom"'))
assert.equal(renderStudioPreviewSvg(auto, {}, 'test18a', retro), standard, 'Reset to Auto restores byte-exact artwork after changes')
assert.notEqual(renderStudioPreviewSvg(auto, {}, 'test18a', night), standard, 'Preview light/night palettes are independent of the recipe')
assert.equal(JSON.stringify(overlayStudioRecipe(auto, {})), JSON.stringify(auto), 'Empty overlay returns original identity')

const invalid = sanitizeStudioOverrides({subjectId:'<svg onload=alert(1)>', eyes:'unexpected', pose:'bogus',
  scene:'unknown-room', paletteVariant:'var(--bad)', proportion:'stretched', scale:Infinity,
  animation:'http://evil.invalid', prop:'<script>', handGesture:'middle-finger', nested:{foo:1}})
assert.deepEqual(invalid, {}, 'Unsupported assets, URLs, markup, nonfinite numbers and fake gestures are rejected')
assert.equal(sanitizeStudioOverrides({scale:500}).scale, 1.25, 'Scale capped at 125%')
assert.equal(sanitizeStudioOverrides({scale:-1}).scale, .75, 'Scale floored at 75%')
assert.equal(sanitizeStudioOverrides({scale:1.035}).scale, 1.05, 'Scale is quantized to 5% steps')
const unknownAuto = generateCardVisualRecipe({ ...input, subjectName:'Invented ϟ物件', subjectTypeName:'nonsense', actionName:'blorp', environmentName:'Unknown' })
assert.equal(unknownAuto.semantics.subjectId, 'generic-surface', 'Unknown custom label retains intentional generic fallback')
assert.ok(renderStudioPreviewSvg(unknownAuto,{subjectId:'spray-bottle'},'fallback',retro).includes('data-hc-card-subject="spray-bottle"'))
const first = sanitizeStudioOverrides({pose:'wave'})
const second = sanitizeStudioOverrides({pose:'thumbs-up', expression:'proud'})
assert.deepEqual(studioUndo([{}, first, second]), {history:[{},first],current:first}, 'Undo restores previous preview snapshot')
assert.deepEqual(studioUndo([{}, first, {}]), {history:[{},first],current:first}, 'Undo after Reset to Auto restores draft')
assert.deepEqual(studioUndo([{}]), {history:[{}],current:{}}, 'Undo has safe empty-history behavior')

const component = readFileSync('src/components/studio/CharacterStudioSheet.tsx','utf8')
const css = readFileSync('src/styles/character-studio-v2.css','utf8')
const routine = readFileSync('src/pages/RoutinesPage.tsx','utf8')
const action = readFileSync('src/pages/ActionsPage.tsx','utf8')
const home = readFileSync('src/components/home/HomeInspector.tsx','utf8')
assert.ok(component.includes('<Sheet') && component.includes('sanitizeStudioOverrides'), 'Studio uses existing accessible sheet and bounded model')
assert.ok(component.includes('setHistory') && component.includes('studioUndo') && component.includes('push({})'), 'History, Undo and Reset to Auto implemented')
assert.ok(component.includes("'night-garden'") && component.includes("'house-care-retro'"), 'Preview supports light and night modes')
assert.ok(component.includes('Local draft') && component.includes('Bozza locale') && component.includes('confirmArtwork'), 'Explicit EN/IT confirmation with local draft')
assert.ok(css.includes('prefers-reduced-motion:reduce'), 'User motion preference disables animation')
assert.ok(routine.includes('onArtwork={openStudio}') && action.includes('onArtwork={openStudio}') && home.includes("kind: 'entity'"), 'All three entry points open Studio')
const forbidden = /\b(supabase|fetch|localStorage|sessionStorage|indexedDB|XMLHttpRequest|upload|saveToCloud|writeFile)\b/i
for (const source of ['src/components/studio/CharacterStudioSheet.tsx', 'src/visual/studio/draft.ts', 'src/visual/studio/preview.ts']) {
  assert.equal(forbidden.test(readFileSync(source,'utf8')), false, `Studio module has no backend/media/storage access: ${source}`)
}
assert.ok(!existsSync('supabase/migrations/20261012_phase18a_visual_overrides.sql'), 'Phase 18A must introduce no persistence schema')
console.log(`Phase 18A: ${candidates.length} deterministic option previews, Auto/Undo/reset, invalid fallback, EN/IT, light/night and client-only isolation passed`)
