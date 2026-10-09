declare const require: (name: string) => any
import { AUTHORED_OBJECT_IDS } from '../src/visual/primitives/authored'
import { EXPANDED_OBJECT_IDS } from '../src/visual/primitives/expanded'
import { listPrimitiveDefinitions, getPrimitiveDefinition, hasPrimitiveDefinition } from '../src/visual/registry'
import { renderPrimitiveSvg } from '../src/visual/render'
import { renderManualCharacterSvg } from '../src/visual/compose'
import { vectorPaletteFromTheme, CSS_VECTOR_PALETTE } from '../src/visual/palette'
import { themePreset } from '../src/lib/theme'
import { resolveCardVisualSemantics } from '../src/visual/procedural/resolver'
import { generateCardVisualRecipe } from '../src/visual/procedural/recipe'
import { renderCardVisualSvg } from '../src/visual/procedural/render-card'
import { HOUSE_CARE_VISUAL_VERSION } from '../src/visual/version'
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { validateSvgSource } = require(join(process.cwd(), 'tools/svg-validation.cjs'))
declare const process: { cwd(): string }

assert.equal(HOUSE_CARE_VISUAL_VERSION, 1, 'Do not silently bump generator version')
assert.equal(AUTHORED_OBJECT_IDS.length, 20, 'Preserve original Phase 4 IDs')
assert.equal(EXPANDED_OBJECT_IDS.length, 28, 'Phase 9 adds 28 reusable objects')
const all = listPrimitiveDefinitions().filter((entry) => !entry.metadata.demoOnly)
assert.equal(all.length, 48, 'Complete vocabulary = 20 base + 28 new')
assert.equal(new Set(all.map((entry) => entry.metadata.id)).size, all.length)
const palette = vectorPaletteFromTheme(themePreset('house-care-retro').palette)
const nightly = vectorPaletteFromTheme(themePreset('night-garden').palette)
const ids = new Set<string>()
for (const [index, item] of all.entries()) {
  const id = item.metadata.id
  const { metadata } = item
  assert.equal(metadata.artboard.viewBox, '0 0 240 240', `Wrong artboard: ${id}`)
  assert.ok(metadata.safeInset.left >= 8 && metadata.safeInset.right >= 8)
  assert.ok(metadata.supportedActionFamilies.length && metadata.supportedEnvironmentFamilies.length, `${id}: missing semantic metadata`)
  const clean = renderPrimitiveSvg(id,{instanceKey:`v2-p9-plain-${index}`,palette})
  assert.ok(!clean.includes('data-hc-expression') && !clean.includes('data-hc-pose'), `${id}: baked expression or pose`)
  const validation = validateSvgSource(clean,{allowFixedColors:true})
  assert.ok(validation.valid, `${id}: ${JSON.stringify(validation.issues)}`)
  assert.ok(validation.metrics.pathCount < 120 && validation.metrics.bytes < 160*1024)
  assert.ok(!clean.includes('<image') && !clean.includes('feTurbulence') && !clean.includes('<text'), `${id}: raster/filter or copy in object`)
  const assembled = renderManualCharacterSvg(id, {
    instanceKey:`v2-p9-${index}`,palette,decorative:true,
    expression:metadata.faceAnchor?'smile':undefined,
    pose:metadata.limbAnchors?'arms-down':undefined,
  })
  assert.ok(validateSvgSource(assembled,{allowFixedColors:true}).valid, `${id}: invalid character composition`)
  for (const match of assembled.matchAll(/\bid="([^"]+)"/g)) {
    assert.ok(!ids.has(match[1]), `SVG scope collision at ${id}: ${match[1]}`)
    ids.add(match[1])
  }
  const themed = renderPrimitiveSvg(id, {instanceKey:`v2-theme-${index}`,palette:CSS_VECTOR_PALETTE})
  assert.ok(themed.includes('var(--hc-art-'), `${id}: no semantic CSS ink`)
  assert.ok(getPrimitiveDefinition(id) === item && hasPrimitiveDefinition(id))
}
assert.ok(ids.size > 40, 'Scoped SVG definitions should be generated for patterns')

// Every new family is a real drawable object, not a dead alias/filename.
for (const id of EXPANDED_OBJECT_IDS) assert.ok(hasPrimitiveDefinition(id))
const enItPairs: readonly (readonly [string,string,string])[] = [
  ['bathtub','bathtub','vasca da bagno'],['toilet','toilet','wc'],
  ['refrigerator','refrigerator','frigorifero'],['dishwasher','dishwasher','lavastoviglie'],
  ['washer','washing machine','lavatrice'],['dryer','tumble dryer','asciugatrice'],
  ['kettle','kettle','bollitore'],['chair','chair','sedia'],
  ['table','table','tavolo'],['bookcase','bookcase','libreria'],
  ['bed','bed','letto'],['cabinet','cabinet','credenza'],
  ['floor-patch','floor tiles','pavimento'],['mirror','mirror','specchio'],
  ['bucket','bucket','secchio'],['duster','duster','piumino'],
  ['scrub-brush','scrub brush','spazzolone'],['broom','broom','scopa'],
  ['squeegee','squeegee','tergivetro'],['generic-tool','generic tool','attrezzo per pulizia'],
  ['detergent-bottle','detergent bottle','flacone detersivo'],
  ['tablet-pack','tablet pack','pastiglie lavastoviglie'],
  ['paper-roll','paper roll','carta igienica'],
  ['microfiber-stack','microfiber cloths','panni in microfibra'],
  ['generic-supply','generic supply','materiali di pulizia'],
  ['rug','rug','tappeto'], ['shelf-prop','wall shelf','mensola'],
]
for (const [expected,english,italian] of enItPairs) {
  for (const label of [english,italian]) {
    const result = resolveCardVisualSemantics({routineId:'t',occurrenceId:`p9-${label}`,subjectName:label,actionName:'inspect'})
    assert.equal(result.subjectId,expected,`Wrong EN/IT subject for ${label}`)
    assert.equal(result.level,'exact-subject')
  }
}

// The versioned, frozen V1 generator must keep stable routine composition and
// bound occurrence details; unrecognized names always have branded fallback art.
const input = {routineId:'p9-oven',actionId:'degrease',primaryTargetId:'oven',occurrenceId:'oven-5',triggerOrdinal:5,
  subjectName:'Oven', subjectTypeName:'Appliance', actionName:'Degrease'}
const first=generateCardVisualRecipe(input)
const second=generateCardVisualRecipe({...input,occurrenceId:'oven-6',triggerOrdinal:6})
assert.deepEqual(generateCardVisualRecipe(input),first)
for (const key of ['stableSeed','paletteVariant','template','border','backgroundPattern','personality'] as const)
  assert.equal(first[key],second[key],`Routine identity changed: ${key}`)
assert.notEqual(first.occurrenceSeed,second.occurrenceSeed)
assert.ok(first.decorations.length>=1 && first.decorations.length<=3)
const nonsense = generateCardVisualRecipe({routineId:'unknown',occurrenceId:'random',subjectName:'unclassifiable zxylo',subjectTypeName:'plok',actionName:'flibber'})
assert.equal(nonsense.semantics.level,'generic')
assert.equal(nonsense.semantics.subjectId,'generic-surface')
assert.ok(renderCardVisualSvg(nonsense,{instanceKey:'p9-unknown',palette}).includes('data-hc-card-subject="generic-surface"'))
const fallbackNight=renderCardVisualSvg(nonsense,{instanceKey:'p9-unknown-night',palette:nightly})
assert.ok(fallbackNight.includes(nightly.ink) && fallbackNight.includes(nightly.surface), 'Art must recolor with semantic night palette')

// Use source-level checks where browser/React dependencies are unavailable.
// The text/actions are independent of decorative SVG in the current UI.
const care=readFileSync('src/components/overview/CareCard.tsx','utf8') as string
const artwork=readFileSync('src/components/overview/CardArtwork.tsx','utf8') as string
const house=readFileSync('src/components/overview/HouseState.tsx','utf8') as string
const deck=readFileSync('src/components/overview/ActiveDeck.tsx','utf8') as string
const meta=readFileSync('src/components/overview/CareCardMeta.tsx','utf8') as string
const css=readFileSync('src/styles/overview-v2.css','utf8') as string
assert.ok(care.includes('<h3') && care.includes('activitySubtitle(task)') && care.includes('<CareCardMeta') && care.includes('onComplete(task.id)'))
assert.ok(meta.includes('context.cleanlinessScore') && meta.includes('context.supplyAlerts'))
assert.ok(artwork.includes('aria-hidden="true"') && !artwork.includes('onClick'))
assert.ok(deck.includes('<CareCard') && deck.includes('nextDeckIndex('))
assert.ok(house.includes('<CleanlinessPanel') && house.includes('<CriticalEntityCard'))
assert.ok(css.includes('data-v2-no-art="true"') && css.includes('grid-template-columns: minmax(0,1fr)'))
assert.ok(css.includes('overflow-wrap: anywhere') && css.includes('max-width: 350px'))
assert.ok(css.includes('prefers-reduced-motion: reduce') && css.includes('animation: none !important'))
assert.ok(css.includes('.v2-care-card {') && css.includes('overflow-y: auto'), 'Card must be scrollable rather than clipped')
assert.ok(!artwork.includes('Math.random(') && !care.includes('Math.random('))

const broken = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M1 2" stroke="red" stroke="blue"/></svg>'
assert.ok(validateSvgSource(broken,{allowFixedColors:true}).issues.some((issue: {code:string})=>issue.code==='duplicate-attribute'))
console.log(`V2 Phase 9 stabilization tests passed: ${all.length} SVG objects, ${enItPairs.length*2} EN/IT aliases, stable editions, no-art/text/motion guards, validator negative case`)
