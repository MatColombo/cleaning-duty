declare const require: (name: string) => any
declare const process: { cwd(): string }

import type { WorkspaceData } from '../src/types/domain'
import {
  SUBJECT_FAMILIES, ACTION_FAMILIES, ENVIRONMENT_FAMILIES,
  CARD_TEMPLATES, CARD_PALETTE_VARIANTS, CARD_BORDER_STYLES, CARD_STAMPS,
  normalizeVisualPhrase, matchActionFamily, matchExactSubject, matchEnvironment,
  resolveCardVisualSemantics, cardVisualInputFromDomain,
  stableRoutineVisualSeed, occurrenceVisualSeed, generateCardVisualRecipe,
  CardVisualRecipeCache, getCardVisualRecipe, clearCardVisualRecipeCache,
  renderCardVisualSvg, cardPaletteForVariant,
  type CardVisualInput,
} from '../src/visual/procedural'
import { EXPRESSION_IDS } from '../src/visual/expressions'
import { POSE_IDS } from '../src/visual/poses'
import { DECORATION_IDS } from '../src/visual/decorations'
import { VECTOR_PATTERN_KEYS } from '../src/visual/patterns'
import { hasPrimitiveDefinition, listPrimitiveDefinitions } from '../src/visual/registry'
import { themePreset } from '../src/lib/theme'
import { vectorPaletteFromTheme } from '../src/visual/palette'
import { HOUSE_CARE_VISUAL_VERSION } from '../src/visual/version'

const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { validateSvgSource } = require(join(process.cwd(), 'tools/svg-validation.cjs'))

function assert(test: unknown, message: string): asserts test {
  if (!test) throw new Error(message)
}
function equal<T>(actual: T, expected: T, label: string): void {
  assert(actual === expected, `${label}: got ${String(actual)}, expected ${String(expected)}`)
}

assert(HOUSE_CARE_VISUAL_VERSION === 1, 'Visual recipe generator must be version 1')
equal(SUBJECT_FAMILIES.length, 11, 'All subject families')
equal(ACTION_FAMILIES.length, 17, 'All action families')
equal(ENVIRONMENT_FAMILIES.length, 9, 'All environments')
assert(CARD_TEMPLATES.length === 6 && CARD_PALETTE_VARIANTS.length === 4, 'Controlled templates and palette variants')
assert(CARD_BORDER_STYLES.length === 4 && CARD_STAMPS.length === 5, 'Controlled border/stamp language')

// Locale-agnostic EN/IT aliases, token boundaries, and accented words.
equal(normalizeVisualPhrase('  Macchina del Caffè!  '), 'macchina del caffe', 'Accent normalization')
equal(matchExactSubject('Il soffione della doccia')?.primitiveId, 'shower-head', 'IT shower recognition')
equal(matchExactSubject('Macchina del caffè')?.primitiveId, 'coffee-machine', 'IT coffee recognition')
equal(matchExactSubject('piano cottura')?.primitiveId, 'stovetop', 'IT stovetop recognition')
equal(matchExactSubject('Kitchen sink')?.primitiveId, 'sink', 'EN sink recognition')
equal(matchExactSubject('ovenish artifact'), undefined, 'No partial-substring subject matching')
equal(matchActionFamily('Sgrassare il forno'), 'degrease', 'IT degrease recognition')
equal(matchActionFamily('Descale the kettle'), 'descale', 'EN descale recognition')
equal(matchActionFamily('Lavare pavimenti'), 'mop', 'IT mop recognition')
equal(matchActionFamily('Spolverare il divano'), 'dust', 'IT dust recognition')
equal(matchEnvironment('Camera da letto'), 'bedroom', 'IT bedroom recognition')
equal(matchEnvironment('Living Room'), 'living', 'EN living room recognition')

const base: CardVisualInput = {
  routineId: 'routine-oven', actionId: 'action-degrease', primaryTargetId: 'entity-oven',
  occurrenceId: 'task-oven-0005', triggerOrdinal: 5, subjectName: 'Oven',
  subjectTypeName: 'Appliance', actionName: 'Degrease', environmentName: 'Kitchen',
}
const semantics = resolveCardVisualSemantics(base)
equal(semantics.subjectId, 'oven', 'Exact subject wins')
equal(semantics.level, 'exact-subject', 'Exact resolution level')
equal(semantics.toolId, 'spray-bottle', 'Compatible tool choice')
equal(semantics.environment, 'kitchen', 'Environment from structured context')
const typed = resolveCardVisualSemantics({ ...base, subjectName: 'Xylophonic Widget', subjectTypeName: 'Appliance' })
equal(typed.subjectId, 'generic-appliance', 'Entity-family fallback')
equal(typed.level, 'entity-family', 'Entity-family resolution level')
const incompatible = resolveCardVisualSemantics({ ...base, subjectName: 'Oven', subjectTypeName: 'Furniture' })
equal(incompatible.subjectId, 'generic-surface', 'Specific incompatible entity type beats a misleading name')
equal(incompatible.level, 'entity-family', 'Structured type remains preferred')
const broadSurface = resolveCardVisualSemantics({ ...base, subjectName: 'Kitchen sink', subjectTypeName: 'Surface' })
equal(broadSurface.subjectId, 'sink', 'Specific entity name within a broad Surface type')
const action = resolveCardVisualSemantics({ ...base, subjectName: '???', subjectTypeName: undefined, actionName: 'Vacuum' })
equal(action.subjectId, 'vacuum', 'Action-family fallback')
equal(action.level, 'action-family', 'Action-family resolution level')
const generic = resolveCardVisualSemantics({ ...base, subjectName: 'Glorbian Flub', subjectTypeName: 'Mystery', actionName: 'Blorp', environmentName: 'Zed' })
equal(generic.subjectId, 'generic-surface', 'Unknown activity must render intentional generic art')
equal(generic.level, 'generic', 'Generic fallback level')
equal(generic.environment, 'generic-interior', 'Generic environment fallback')

const recipe = generateCardVisualRecipe(base)
assert(Object.isFrozen(recipe), 'Recipe must be frozen')
assert(Object.isFrozen(recipe.decorations), 'Decoration placements must be frozen')
assert(recipe.version === 1 && recipe.decorations.length >= 1 && recipe.decorations.length <= 3, 'Version/bounded placements')
equal(JSON.stringify(recipe), JSON.stringify(generateCardVisualRecipe(structuredClone(base))), 'Determinism after clone/reload')
assert(!/<svg|<image|data:image|#[0-9a-fA-F]{6}/.test(JSON.stringify(recipe)), 'Recipes must contain no SVG/raster payloads or fixed colors')
assert(JSON.stringify(recipe).length < 1450, 'Recipes should remain compact')
equal(recipe.stableSeed, stableRoutineVisualSeed(base), 'Stable identity seed')
equal(recipe.occurrenceSeed, occurrenceVisualSeed(recipe.stableSeed, base), 'Occurrence edition seed')

const alternateEdition = generateCardVisualRecipe({ ...base, occurrenceId: 'task-oven-0006', triggerOrdinal: 6 })
equal(alternateEdition.stableSeed, recipe.stableSeed, 'All occurrences retain the routine family seed')
assert(alternateEdition.occurrenceSeed !== recipe.occurrenceSeed, 'An edition must have a distinct seed')
equal(alternateEdition.template, recipe.template, 'Stable composition identity')
equal(alternateEdition.paletteVariant, recipe.paletteVariant, 'Stable palette identity')
equal(alternateEdition.border, recipe.border, 'Stable border identity')
equal(alternateEdition.semantics.subjectId, recipe.semantics.subjectId, 'Stable subject identity')
equal(alternateEdition.personality, recipe.personality, 'Stable personality identity')
const rescheduled = generateCardVisualRecipe({ ...base, activityTitle: 'Renamed operational title', environmentName: 'Kitchen' })
equal(rescheduled.occurrenceSeed, recipe.occurrenceSeed, 'Text must not become a seed input')
equal(rescheduled.paletteVariant, recipe.paletteVariant, 'Visual identity must not depend on labels')
const linked = generateCardVisualRecipe({ ...base, isLinkedActivity: true })
equal(linked.edition.stamp, 'extra-care', 'Linked child gets the special stamp')
assert(recipe.edition.stamp !== 'extra-care', 'Unlinked parent cannot show an Extra Care stamp')

const cache = new CardVisualRecipeCache(3)
const one = cache.get(base)
assert(cache.get(base) === one, 'Cache must reuse the same frozen recipe object')
const renamed = cache.get({ ...base, subjectName: 'Sofa', subjectTypeName: 'Furniture' })
assert(renamed !== one && renamed.semantics.subjectId === 'sofa', 'Semantic data changes must invalidate cache entries')
cache.get({ ...base, occurrenceId: 'new-2' })
cache.get({ ...base, occurrenceId: 'new-3' })
equal(cache.size, 3, 'LRU cache must be bounded')
assert(cache.get(base) !== one, 'Oldest cache entry should have been evicted')
cache.clear()
equal(cache.size, 0, 'Cache clear')
clearCardVisualRecipeCache()
equal(JSON.stringify(getCardVisualRecipe(base)), JSON.stringify(recipe), 'Shared cache must reproduce pure output')

const retro = vectorPaletteFromTheme(themePreset('house-care-retro').palette)
const night = vectorPaletteFromTheme(themePreset('night-garden').palette)
const retroArt = renderCardVisualSvg(recipe, { instanceKey: 'deck-1', palette: retro })
const nightArt = renderCardVisualSvg(recipe, { instanceKey: 'deck-2', palette: night })
assert(retroArt.includes('viewBox="0 0 640 420"') && retroArt.includes('data-hc-card-subject="oven"'), 'Renderer uses canonical scene geometry')
assert(retroArt.includes(retro.surface) && nightArt.includes(night.surface), 'Current theme determines print inks')
assert(!retroArt.includes('<image') && !retroArt.includes('<foreignObject') && !retroArt.includes('feTurbulence'), 'No raster, foreign-object or turbulence in art')
assert(!retroArt.includes('Deep clean oven'), 'No operational copy embedded in generated artwork')
assert(retroArt.includes('data-hc-expression') && retroArt.includes('data-hc-pose'), 'Composition must reuse existing face/pose vocabulary')
assert(cardPaletteForVariant(retro, recipe).ink === retro.ink, 'Theme semantics preserve legible outlines')
const ids = [...retroArt.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
assert(new Set(ids).size === ids.length, 'Every card SVG id must be unique within an instance')
const otherIds = [...nightArt.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
assert(ids.every((id) => !otherIds.includes(id)), 'Different instances must not collide')
for (const [label, svg] of [['retro',retroArt],['night',nightArt]]) {
  const result = validateSvgSource(svg,{allowFixedColors:true})
  assert(result.valid, `${label} art must pass SVG validation: ${JSON.stringify(result.issues)}`)
}
const titled = renderCardVisualSvg(recipe, {instanceKey:'safe-title',decorative:false,title:'<bad&unsafe>'})
assert(titled.includes('&lt;bad&amp;unsafe&gt;'), 'Optional accessible title must be XML escaped')
assert(!titled.includes('<bad&unsafe>'), 'SVG must never interpolate unescaped user input')

// The actual Phase 0 pre-V2 archive exercises old task snapshots and real linked work.
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/pre-v2-household-backup.json'), 'utf8'))
const historicalData: WorkspaceData = fixture.data
const before = JSON.stringify(historicalData)
for (const task of historicalData.tasks) {
  const input = cardVisualInputFromDomain(task, historicalData)
  const artRecipe = generateCardVisualRecipe(input)
  assert(hasPrimitiveDefinition(artRecipe.semantics.subjectId), `No art for historical task ${task.id}`)
  assert(artRecipe.version === 1, 'Historical task must use generator v1')
  assert(artRecipe.edition.stamp === 'extra-care' || !task.parentOccurrenceId, 'Linked task must be recognized')
}
equal(JSON.stringify(historicalData), before, 'Visual adapter may not modify domain input')
const kitchenSink = historicalData.tasks.find((t)=>t.targets[0]?.entityName === 'Kitchen sink')
assert(kitchenSink, 'Pre-V2 fixture must include sink task')
equal(resolveCardVisualSemantics(cardVisualInputFromDomain(kitchenSink, historicalData)).subjectId, 'sink', 'Historical broad Surface type + sink name')
const originalTask = historicalData.tasks[0]
assert(originalTask, 'Fixture must contain task')
const oldState = originalTask.state, oldDue = originalTask.effectiveDueAt
const historicalVisual = generateCardVisualRecipe(cardVisualInputFromDomain(originalTask, historicalData))
assert(historicalVisual.semantics.subjectId === 'oven', 'Historical oven must get the correct silhouette')
assert(originalTask.state === oldState && originalTask.effectiveDueAt === oldDue, 'Visual generation cannot modify workflow state')

// Immutable visual v1 golden fixtures protect old collectible editions across refactors.
const golden = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/v2-visual-v1-golden.json'), 'utf8'))
assert(golden.visualGeneratorVersion === HOUSE_CARE_VISUAL_VERSION, 'Golden fixture is bound to visual v1')
assert(golden.cases.length >= 5, 'Golden fixtures cover EN, IT, unknown and linked input')
for (const sample of golden.cases) {
  const actual = generateCardVisualRecipe(sample.input)
  equal(JSON.stringify(actual), JSON.stringify(sample.recipe), `Visual v1 golden ${sample.input.occurrenceId}`)
}

// Development previews are generated from the same recipe + authored vector source.
const proofSvg = readFileSync(join(process.cwd(), 'design/v2/page-reference/v2-procedural-cards-proof.svg'),'utf8')
const proofHtml = readFileSync(join(process.cwd(), 'design/v2/page-reference/v2-procedural-cards.html'),'utf8')
assert(proofSvg.split('data-hc-card-version="1"').length - 1 === 6, 'SVG contact sheet should contain six v1 examples')
assert(proofHtml.includes('Unknown / generic fallback') && proofHtml.includes('Linked coffee / Italian'), 'Development proof covers unknown and linked cases')
assert(!proofHtml.includes('Math.random(') && !proofHtml.includes('data:image/'), 'Development proof must use deterministic vectors')
const proofValidation = validateSvgSource(proofSvg,{allowFixedColors:true,maxBytes:210000,maxPaths:1500})
assert(proofValidation.valid, `Combined development contact sheet must be valid: ${JSON.stringify(proofValidation.issues)}`)
const scripts = [...proofHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match)=>match[1])
assert(scripts.length === 1, 'Procedural proof should have only a tiny local theme script')
new (require('node:vm').Script)(scripts[0]) // Parse without executing any browser code.

// Deterministic, high-volume heterogeneous inputs; no network, no DB, no runtime AI.
const words = ['Vacuum','Sgrassare','Lavare pavimenti','Polish','Descale','Wipe','Spolverare','Blorp','Disinfettare']
const subjects = ['Oven','Lavello','Shower','Caffè machine','Sofa','Xylophonic Widget','Unrecognized 007','window']
const types = ['Appliance','Furniture','Surface','Fixture','Elettrodomestico','Oggetto sconosciuto','']
const rooms = ['Kitchen','Bagno','Living room','Corridoio','Giardino','Unknown room']
const started = Date.now()
let fallbackCount = 0
for (let index = 0; index < 10000; index += 1) {
  const input: CardVisualInput = {
    routineId: `routine-${index % 251}`, actionId: `action-${index % 29}`,
    primaryTargetId: index % 7 === 0 ? undefined : `entity-${index % 937}`,
    occurrenceId: `occurrence-${index}`, triggerOrdinal: index % 49 === 0 ? undefined : (index % 99) + 1,
    subjectName: subjects[index % subjects.length],
    subjectTypeName: types[index % types.length],
    actionName: words[index % words.length],
    environmentName: rooms[index % rooms.length],
    isLinkedActivity: index % 17 === 0,
  }
  const visual = generateCardVisualRecipe(input)
  if (visual.semantics.level === 'generic') fallbackCount += 1
  assert(hasPrimitiveDefinition(visual.semantics.subjectId), `Unknown subject on case ${index}`)
  assert(!visual.semantics.toolId || hasPrimitiveDefinition(visual.semantics.toolId), `Unknown tool on case ${index}`)
  assert(VECTOR_PATTERN_KEYS.includes(visual.backgroundPattern), 'Pattern must be in the registry')
  assert(EXPRESSION_IDS.includes(visual.expression), 'Expression must be authored')
  assert(POSE_IDS.includes(visual.pose), 'Pose must be authored')
  assert(CARD_TEMPLATES.includes(visual.template), 'Template must be valid')
  assert(CARD_PALETTE_VARIANTS.includes(visual.paletteVariant), 'Palette variant must be valid')
  assert(CARD_BORDER_STYLES.includes(visual.border), 'Border must be valid')
  assert(CARD_STAMPS.includes(visual.edition.stamp), 'Stamp must be curated')
  assert(visual.decorations.length >= 1 && visual.decorations.length <= 3, 'Decoration budget')
  assert(visual.decorations.every((placement)=>DECORATION_IDS.includes(placement.id) && placement.scale<=.37 && placement.scale>=.18), 'Decorations have known bounded IDs/scales')
  assert(Math.abs(visual.inkOffset.x)<=1.5 && Math.abs(visual.inkOffset.y)<=1.5, 'Ink offset bound')
  assert(visual.distress>=.04 && visual.distress<=.24, 'Distress bound')
  assert(JSON.stringify(visual) === JSON.stringify(generateCardVisualRecipe(input)), 'High-volume deterministic output')
  if (index < 24) {
    const svg=renderCardVisualSvg(visual,{instanceKey:`stress-render-${index}`,palette:retro})
    assert(validateSvgSource(svg,{allowFixedColors:true}).valid, `Synthetic ${index} must yield valid SVG`)
  }
}
const elapsed = Date.now()-started
assert(listPrimitiveDefinitions().length >= 23, 'Phase 4 source registry must remain intact')
console.log(`V2 Phase 5 procedural tests passed (10,000 synthetic cases, ${fallbackCount} generic fallbacks, ${elapsed} ms)`)
