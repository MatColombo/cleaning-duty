declare const require: (name: string) => any
declare const process: { cwd(): string }
import { AUTHORED_OBJECT_IDS } from '../src/visual/primitives/authored'
import { EXPANDED_OBJECT_IDS } from '../src/visual/primitives/expanded'
import { EXPRESSION_IDS, renderExpressionPreviewSvg } from '../src/visual/expressions'
import { POSE_IDS } from '../src/visual/poses'
import { DECORATION_IDS, renderDecorationSvg } from '../src/visual/decorations'
import { renderManualCharacterSvg } from '../src/visual/compose'
import { getPrimitiveDefinition, listPrimitiveDefinitions } from '../src/visual/registry'
import { renderPrimitiveSvg } from '../src/visual/render'
import { CSS_VECTOR_PALETTE, vectorPaletteFromTheme } from '../src/visual/palette'
import { themePreset } from '../src/lib/theme'
import { HOUSE_CARE_VISUAL_VERSION } from '../src/visual/version'

const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const { validateSvgSource } = require(join(process.cwd(), 'tools/svg-validation.cjs'))
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
function unique<T>(items: readonly T[]): boolean { return new Set(items).size === items.length }

assert(HOUSE_CARE_VISUAL_VERSION === 1, 'Phase 4 must not change visual-generation version')
assert(AUTHORED_OBJECT_IDS.length === 20, 'Exactly the initial twenty approved semantic objects are authored')
assert(EXPRESSION_IDS.length === 12, 'All 12 expressions must be authored')
assert(POSE_IDS.length === 12, 'All 12 poses must be authored')
assert(DECORATION_IDS.length >= 13, 'Phase 4 requires all initial decoration categories')
for (const [name, ids] of [['object', AUTHORED_OBJECT_IDS], ['expression', EXPRESSION_IDS], ['pose', POSE_IDS], ['decoration', DECORATION_IDS]] as const) {
  assert(unique(ids), `Duplicate ${name} id in authored vocabulary`)
}
const retro = vectorPaletteFromTheme(themePreset('house-care-retro').palette)
const alternate = vectorPaletteFromTheme(themePreset('coastal-blue').palette)
const renderedIds = new Set<string>()
for (const [index, id] of AUTHORED_OBJECT_IDS.entries()) {
  const definition = getPrimitiveDefinition(id)
  const {metadata} = definition
  assert(!metadata.demoOnly, `${id} must be production-ready, not a demo primitive`)
  assert(metadata.artboard.viewBox === '0 0 240 240', `${id} must use main-object artboard`)
  assert(metadata.safeInset.top >= 8 && metadata.safeInset.left >= 8, `${id} must supply 8-unit minimum safe inset`)
  assert(metadata.safeInset.right >= 8 && metadata.safeInset.bottom >= 8, `${id} must declare safe insets`)
  assert(Array.isArray(metadata.supportedActionFamilies), `${id} must have action metadata`)
  assert(Array.isArray(metadata.supportedEnvironmentFamilies), `${id} must have environment metadata`)
  if (metadata.faceAnchor) {
    assert(metadata.faceAnchor.x >= 8 && metadata.faceAnchor.x <= 232, `${id} face x outside canvas`)
    assert(metadata.faceAnchor.y >= 8 && metadata.faceAnchor.y <= 232, `${id} face y outside canvas`)
  }
  const plain = renderPrimitiveSvg(id, { instanceKey:`plain-${index}`, palette:retro })
  assert(!plain.includes('data-hc-expression'), `${id} object must not have a baked face`)
  assert(!plain.includes('data-hc-pose'), `${id} object must not have baked limb poses`)
  assert(!plain.includes('<image'), `${id} must not embed raster art`)
  assert(validateSvgSource(plain,{allowFixedColors:true}).valid, `${id} base SVG is invalid`)
  const decorated = renderManualCharacterSvg(id, {
    instanceKey: `manual-${index}`,
    palette: retro,
    expression:'joyful',
    pose:'thumbs-up',
    decorations:[{id:'sparkle-4',x:34,y:21,scale:.32}],
  })
  assert(validateSvgSource(decorated,{allowFixedColors:true}).valid, `${id} assembled SVG is invalid`)
  assert(decorated.includes('data-hc-layer="manual-overlay"'), `${id} must have manual composition overlay`)
  if (metadata.faceAnchor) assert(decorated.includes('data-hc-expression="joyful"'), `${id} facial anchor not used`)
  const allIds = [...decorated.matchAll(/\bid="([^"]+)"/g)].map((match)=>match[1])
  for (const scoped of allIds) { assert(!renderedIds.has(scoped), `Cross-instance SVG collision: ${scoped}`); renderedIds.add(scoped) }
}
assert(listPrimitiveDefinitions().length === AUTHORED_OBJECT_IDS.length + EXPANDED_OBJECT_IDS.length + 3, 'Phase 3 demos, original Phase 4 vocabulary and Phase 9 additions must remain separately identified')
for (const expression of EXPRESSION_IDS) {
  const svg = renderExpressionPreviewSvg(expression, retro)
  assert(svg.includes('<svg') && svg.includes('</svg>'), `Expression ${expression} preview invalid`)
  assert(!svg.includes('<image'), `Expression ${expression} cannot embed raster`)
}
for (const pose of POSE_IDS) {
  const svg = renderManualCharacterSvg('generic-appliance',{instanceKey:`pose-qa-${pose}`,palette:retro,pose,expression:'neutral'})
  assert(svg.includes(`data-hc-pose="${pose}"`), `Pose ${pose} missing authored markup`)
  assert(svg.includes('stroke-linecap="round"'), 'Gloved arm language must include round contours')
  assert(validateSvgSource(svg,{allowFixedColors:true}).valid, `Pose ${pose} invalid SVG`)
}
for (const decoration of DECORATION_IDS) {
  const svg = renderDecorationSvg(decoration, retro)
  assert(svg.startsWith('<svg') && svg.endsWith('</svg>'), `Decoration ${decoration} missing SVG root`)
  assert(validateSvgSource(svg,{allowFixedColors:true}).valid, `Decoration ${decoration} invalid SVG`)
}
const retroSvg = renderManualCharacterSvg('spray-bottle',{instanceKey:'palette-retro',palette:retro,expression:'joyful'})
const alternateSvg = renderManualCharacterSvg('spray-bottle',{instanceKey:'palette-alt',palette:alternate,expression:'joyful'})
assert(retroSvg.includes(retro.primary) && alternateSvg.includes(alternate.primary), 'Palette substitution must affect the same authored subject')
assert(retroSvg !== alternateSvg, 'Different palettes must not produce identical output')
const themeable = renderPrimitiveSvg('house',{instanceKey:'themeable',palette:CSS_VECTOR_PALETTE})
assert(themeable.includes('var(--hc-art-'), 'Themeable SVG must use semantic palette CSS variables')

const root = join(process.cwd(), 'design/v2')
const lab = readFileSync(join(root, 'page-reference/v2-visual-lab.html'),'utf8')
const overview = readFileSync(join(root,'page-reference/v2-overview-manual.html'),'utf8')
const manifesto = JSON.parse(readFileSync(join(root,'primitives/vocabulary-manifest.json'),'utf8'))
assert(manifesto.objects.length === 20 + EXPANDED_OBJECT_IDS.length, 'Designer handoff must include original objects and expanded vocabulary')
assert(lab.includes('type="color"') && lab.includes('data-preset="house-care-retro"'), 'Visual Lab needs custom colors and built-in presets')
assert(lab.includes('data-preset="night-garden"') && lab.includes('data-preset="graphite-mono"'), 'Visual Lab must cover night and monochrome palettes')
assert(lab.includes('Eseguire la pulizia approfondita'), 'Visual Lab must test longer Italian labels')
assert(lab.includes('width:48px') && lab.includes('width:240px'), 'Visual Lab must show 48px and 240px examples')
assert(lab.includes('hide-texture') && lab.includes('hide-registration'), 'Visual Lab needs texture/registration inspection toggles')
assert(overview.includes('Regular Cleanliness') && overview.includes('Deep Cleanliness'), 'Manual overview must retain separate cleanliness channels')
assert(overview.includes('Critical Areas') && overview.includes('Active Deck'), 'Manual overview must illustrate the frozen 2-section structure')
assert(overview.includes('Deep Clean Oven') && overview.includes('3 days overdue'), 'Manual overview must communicate actual task information')
assert(!overview.includes('Math.random') && !lab.includes('Math.random'), 'Phase 4 must not introduce procedural decisions')
const sections = ['objects','expressions','poses','decorations','patterns']
for (const key of sections) {
  const fileCount = readdirSync(join(root,'primitives',key)).filter((name:string)=>name.endsWith('.svg')).length
  assert(fileCount === ({objects:20 + EXPANDED_OBJECT_IDS.length, expressions:12, poses:12, decorations:14, patterns:7} as Record<string, number>)[key], `Missing designer handoff exports: ${key}`)
}
const benchStart = Date.now()
for (let i=0;i<1000;i++) renderManualCharacterSvg(AUTHORED_OBJECT_IDS[i%20],{instanceKey:`perf-${i}`,palette:retro,expression:'smile',pose:'arms-down'})
const benchMs = Date.now()-benchStart
assert(benchMs < 4500, `Pure authored rendering should be quick, took ${benchMs}ms`)
console.log(`V2 Phase 4 authored vocabulary tests passed (${AUTHORED_OBJECT_IDS.length} objects, ${EXPRESSION_IDS.length} faces, ${POSE_IDS.length} poses, ${DECORATION_IDS.length} decorations, 1000 renders in ${benchMs}ms)`)
