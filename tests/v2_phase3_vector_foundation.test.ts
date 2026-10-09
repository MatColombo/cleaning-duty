declare const require: (name: string) => any
declare const process: { cwd(): string }

import { VECTOR_ARTBOARDS } from '../src/visual/artboards'
import { createSvgIdScope } from '../src/visual/id'
import { deterministicInkOffset } from '../src/visual/misregistration'
import { vectorPaletteFromTheme } from '../src/visual/palette'
import { VECTOR_PATTERN_KEYS, renderVectorDefs } from '../src/visual/patterns'
import { listPrimitiveDefinitions } from '../src/visual/registry'
import { renderPrimitiveSvg } from '../src/visual/render'
import { HOUSE_CARE_VISUAL_VERSION } from '../src/visual/version'
import { themePreset } from '../src/lib/theme'

const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { validateSvgSource } = require(join(process.cwd(), 'tools/svg-validation.cjs'))

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

assert(HOUSE_CARE_VISUAL_VERSION === 1, 'Phase 3 must establish visual version 1')
assert(VECTOR_ARTBOARDS.icon.viewBox === '0 0 64 64', 'Icon artboard must be 64x64')
assert(VECTOR_ARTBOARDS.smallObject.viewBox === '0 0 128 128', 'Small-object artboard must be 128x128')
assert(VECTOR_ARTBOARDS.mainObject.viewBox === '0 0 240 240', 'Main-object artboard must be 240x240')
assert(VECTOR_ARTBOARDS.scene.viewBox === '0 0 480 320', 'Scene artboard must be 480x320')
assert(VECTOR_ARTBOARDS.cardArt.viewBox === '0 0 640 420', 'Card-art artboard must be 640x420')

const definitions = listPrimitiveDefinitions()
assert(definitions.length >= 3, 'Foundation registry should expose several multicolor demo primitives')
for (const definition of definitions) {
  assert(Boolean(definition.metadata.id), 'Every primitive needs an id')
  assert(Boolean(definition.metadata.family), 'Every primitive needs a family')
  assert(Boolean(definition.metadata.artboard.viewBox), 'Every primitive needs a canonical artboard')
  assert(definition.metadata.safeInset.top >= 0, 'Safe inset must be explicit')
  assert(Array.isArray(definition.metadata.supportedActionFamilies), 'Action-family support must be explicit')
  assert(Array.isArray(definition.metadata.supportedEnvironmentFamilies), 'Environment-family support must be explicit')
}

const scopeA = createSvgIdScope('same display label / instance A')
const scopeB = createSvgIdScope('same display label / instance B')
assert(scopeA.id('halftone') !== scopeB.id('halftone'), 'Different SVG instances must get different scoped ids')
assert(!/[\s:/]/.test(scopeA.id('unsafe local:id')), 'Scoped SVG ids must be sanitized')

const retro = vectorPaletteFromTheme(themePreset('house-care-retro').palette)
const coastal = vectorPaletteFromTheme(themePreset('coastal-blue').palette)
assert(retro.primary !== coastal.primary, 'Theme palettes must produce distinct vector inks')
assert(retro.turquoise.startsWith('#'), 'Standalone vector palette should resolve supporting turquoise to a concrete color')

const renderedA = renderPrimitiveSvg('demo-geometric-house', { instanceKey: 'gallery-a', palette: retro, title: 'House demo' })
const renderedB = renderPrimitiveSvg('demo-geometric-house', { instanceKey: 'gallery-b', palette: coastal, title: 'House demo alternate palette' })
assert(renderedA.includes(retro.primary), 'Renderer must substitute supplied palette inks')
assert(renderedB.includes(coastal.primary), 'Renderer must substitute alternate palette inks')
assert(renderedA.includes('halftoneFine'), 'Renderer should emit reusable scoped halftone definitions')
assert(renderedA.includes('data-hc-id-scope'), 'Renderer should expose its safe id scope for diagnostics')
assert(!renderedA.includes('feTurbulence'), 'Per-primitive turbulence is prohibited')

const idsA = [...renderedA.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
const idsB = [...renderedB.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
assert(idsA.every((id) => !idsB.includes(id)), 'Multiple rendered instances must not collide on SVG ids')
assert(new Set(idsA).size === idsA.length, 'Single rendered SVG must not contain duplicate ids')

const allPatternDefs = renderVectorDefs(createSvgIdScope('all-pattern-test'), retro)
for (const key of VECTOR_PATTERN_KEYS) assert(allPatternDefs.includes(key), `Shared defs should support pattern ${key}`)
assert(renderedA.includes('halftoneFine'), 'House primitive should emit the halftone it uses')
assert(!renderedA.includes('halftoneCoarse'), 'Inline SVG should not emit unused pattern definitions')

const offsetA = deterministicInkOffset('occurrence-123')
const offsetB = deterministicInkOffset('occurrence-123')
assert(offsetA.x === offsetB.x && offsetA.y === offsetB.y, 'Ink registration must be deterministic')
assert(Math.abs(offsetA.x) <= 1.5 && Math.abs(offsetA.y) <= 1.5, 'Ink registration must remain subtle')

const cleanValidation = validateSvgSource(renderedA, { allowFixedColors: true })
assert(cleanValidation.valid, `Rendered foundation SVG should pass structural validation: ${JSON.stringify(cleanValidation.issues)}`)

const invalidSample = `<svg><style>@font-face{font-family:x}</style><image href="https://example.com/x.png"/><path id="dupe" fill="#fff"/><path id="dupe"/></svg>`
const invalidCodes = new Set(validateSvgSource(invalidSample).issues.map((issue: { code: string }) => issue.code))
for (const expected of ['missing-viewbox', 'raster-embed', 'external-reference', 'embedded-font', 'duplicate-id', 'fixed-color']) {
  assert(invalidCodes.has(expected), `SVG validator must detect ${expected}`)
}


const demoHtml = readFileSync(join(process.cwd(), 'design/v2/page-reference/vector-foundation-demo.html'), 'utf8')
const demoIds = [...demoHtml.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
assert(demoHtml.split('<svg').length - 1 >= 20, 'Development demo should exercise many inline SVG instances')
assert(new Set(demoIds).size === demoIds.length, 'Development demo must not contain cross-instance SVG id collisions')

const vectorCss = readFileSync(join(process.cwd(), 'src/styles/vector.css'), 'utf8')
assert(vectorCss.includes('.hc-v2-paper'), 'Page-level lightweight paper treatment must exist')
assert(!vectorCss.includes('feTurbulence'), 'Paper treatment must not rely on per-card SVG turbulence')

const start = Date.now()
for (let index = 0; index < 1500; index += 1) {
  renderPrimitiveSvg(index % 2 ? 'demo-geometric-house' : 'demo-geometric-bottle', {
    instanceKey: `stress-${index}`,
    palette: retro,
    decorative: true,
  })
}
const elapsed = Date.now() - start
assert(elapsed < 4000, `Pure SVG generation budget exceeded: ${elapsed}ms for 1500 renders`)
console.log(`V2 Phase 3 vector foundation tests passed (${elapsed}ms / 1500 pure renders)`)
