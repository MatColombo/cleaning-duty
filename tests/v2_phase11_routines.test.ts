declare const require: (name: string) => any
import type { Routine, WorkspaceData } from '../src/types/domain'
import { parentRoutines, linkedRoutineConfigs, routineLibraryCounts, filterRoutinesForLibrary } from '../src/components/routines/routinePresentation'
import { routineIdentityVisualInput, getRoutineIdentityRecipe } from '../src/visual/procedural/routine-identity'
import { getCardVisualRecipe } from '../src/visual/procedural/cache'
import { cardVisualInputFromDomain } from '../src/visual/procedural/resolver'
import { stableRoutineVisualSeed } from '../src/visual/procedural/recipe'
import { getPrimitiveDefinition } from '../src/visual/registry'
import { previewDueAts } from '../src/lib/scheduler'
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const data: WorkspaceData = JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json', 'utf8')).data
const parents = parentRoutines(data)
assert.ok(parents.length > 0)
assert.ok(parents.every((routine) => !routine.archivedAt && !routine.parentRoutineId))
const counts = routineLibraryCounts(parents)
assert.equal(counts.regularActive + counts.deepActive, parents.filter((routine) => routine.status === 'active').length)
assert.equal(counts.paused, parents.filter((routine) => routine.status === 'paused').length)
assert.equal(counts.ended, parents.filter((routine) => routine.status === 'ended').length)
assert.deepEqual(filterRoutinesForLibrary(parents, data, '', 'all', 'all').map((r) => r.id), parents.map((r) => r.id))
assert.ok(filterRoutinesForLibrary(parents, data, '', 'active', 'deep').every((r) => r.status === 'active' && r.careLevel === 'deep'))
assert.ok(filterRoutinesForLibrary(parents, data, '', 'paused', 'all').every((r) => r.status === 'paused'))
assert.ok(filterRoutinesForLibrary(parents, data, '', 'ended', 'all').every((r) => r.status === 'ended'))
for (const routine of parents) {
  const selection = routineIdentityVisualInput(routine, data)
  const first = getRoutineIdentityRecipe(routine, data)
  const second = getRoutineIdentityRecipe(structuredClone(routine), structuredClone(data))
  assert.deepEqual(first, second, 'Routine identity is deterministic across cache/data cloning')
  assert.equal(first.stableSeed, stableRoutineVisualSeed(selection))
  assert.equal(first.occurrenceSeed, first.stableSeed, 'Artwork uses stable routine identity, not task editions')
  assert.equal(first.edition.ordinal, null, 'Routine config is not a task occurrence')
  assert.equal(first.edition.stamp, 'house-care', 'No fictional side-quest/earned stamp')
  assert.ok(getPrimitiveDefinition(first.semantics.subjectId))
  if (first.semantics.toolId) assert.ok(getPrimitiveDefinition(first.semantics.toolId))
  assert.ok(first.decorations.length <= 3)
  const changedName = {...routine, name: 'Another name / un altro nome'}
  assert.equal(getRoutineIdentityRecipe(changedName, data).stableSeed, first.stableSeed,
    'Routine identity is keyed by IDs rather than cosmetic title')
  const linked = linkedRoutineConfigs(data, routine.id)
  assert.ok(linked.every((child) => child.parentRoutineId === routine.id && !child.archivedAt))
  for (const child of linked) assert.ok((child.triggerEvery ?? 0) >= 1)
  assert.ok(previewDueAts(data, routine, 2).length >= 0, 'The unchanged scheduler owns recurrence previews')
}

// A given routine has ONE artwork identity even if different canonical task editions exist.
for (const routine of parents) {
  const occurrences = data.tasks.filter((task) => task.routineId === routine.id)
  const identity = getRoutineIdentityRecipe(routine, data)
  for (const task of occurrences) {
    const taskVisual = getCardVisualRecipe(cardVisualInputFromDomain(task, data))
    assert.equal(taskVisual.stableSeed, identity.stableSeed)
    assert.equal(getRoutineIdentityRecipe(routine, data).stableSeed, identity.stableSeed)
  }
}

// Unicode/Italian search remains text-only and handles accent variation.
const searchable = parents[0]
const accentRoutine = {...searchable, name: 'Pulizia caffè e lavandino'} as Routine
const accentList = [accentRoutine]
assert.equal(filterRoutinesForLibrary(accentList, data, 'CAFFE', 'all', 'all').length, 1)
assert.equal(filterRoutinesForLibrary(accentList, data, 'pulizia', 'all', 'all').length, 1)
assert.equal(filterRoutinesForLibrary(accentList, data, 'definitely not here', 'all', 'all').length, 0)

// Explicit unknown custom subject still creates safe, real authored geometry.
const unknown = {...searchable, id: 'a-user-routine', actionId: 'not-an-action', targetEntityIds: ['not-a-target'], name: 'Spazzola Xylophonic Thing'} as Routine
const fallback = getRoutineIdentityRecipe(unknown, data)
assert.equal(fallback.semantics.level, 'generic')
assert.ok(getPrimitiveDefinition(fallback.semantics.subjectId))

// The new UI does not create or persist an extra artwork/schema field or reinterpret children.
const page = readFileSync('src/pages/RoutinesPage.tsx','utf8')
const card = readFileSync('src/components/routines/RoutineLibraryCard.tsx','utf8')
const art = readFileSync('src/components/routines/RoutineIdentityArtwork.tsx','utf8')
const builder = readFileSync('src/components/routines/RoutineBuilderSheet.tsx','utf8')
const css = readFileSync('src/styles/routines-v2.css','utf8')
assert.ok(page.includes('<RoutineLibraryCard') && page.includes('<RoutineBuilderSheet'))
assert.ok(!page.includes('scheduleTask(') && !page.includes('createTask('))
assert.ok(card.includes('linkedRoutineConfigs(') && card.includes('Configured · not an issued task'))
assert.ok(card.includes("onStatusChange(routine.id, 'paused')") && card.includes("onStatusChange(routine.id, 'active')") && card.includes("onStatusChange(routine.id, 'ended')"))
assert.ok(card.includes('onArchive(routine.id)') && card.includes('onEdit(routine)'))
assert.ok(art.includes('getRoutineIdentityRecipe') && !art.includes("import type { TaskOccurrence"))
assert.ok(!builder.includes('artworkOverride') && !builder.includes('visualSeed:') && !builder.includes('Math.random'))
assert.ok(builder.includes('await updateRoutine(routine.id, input)') && builder.includes('await addRoutine(input)'))
for (const field of ['affectsCleanliness', 'additionalActivities', 'targetEntityIds: targets', 'includeDescendantTargetIds', 'advancedTargetSelector', 'recurrence', 'timeOfDay: time', 'scheduleMode', 'excludedDates', 'includedDateTimes', 'assignment', 'reminder', 'careLevel', 'refreshLevelPct', 'supplyIdsOverride']) {
  assert.ok(builder.includes(field), `Preserved builder payload field missing: ${field}`)
}
for (const path of ['RoutineTargetPicker', 'AdvancedTargetBuilder', 'AdvancedAssignmentBuilder', 'AdditionalActivitiesBuilder', 'RoutineSimulation']) {
  assert.ok(builder.includes(`<${path}`), `Missing existing control ${path}`)
}
for (const section of ["t('what')", "t('where')", "t('when')", "t('who')", "t('reminder')", "t('supplies')", "t('additionalActivities')", "t('moreOptions')"]) {
  assert.ok(builder.includes(section), `Missing step ${section}`)
}
for (const lifecycle of ['setScheduleMode', 'setExcludedDates', 'setIncludedDateTimes', 'setMoveOriginalDate', 'setMoveNewDateTime', 'setUseAdvancedAssignment', 'setRefreshLevelPct', 'previewDueAts']) {
  assert.ok(builder.includes(lifecycle), `Preserved builder behavior missing: ${lifecycle}`)
}
assert.ok(css.includes('prefers-reduced-motion') && css.includes('body[data-v2-no-art'))
assert.ok(css.includes('overflow-wrap: anywhere') && css.includes('max-width: 420px'))
assert.ok(readFileSync('src/main.tsx','utf8').includes("import './styles/routines-v2.css'"))

console.log('Phase 11 Routines tests passed: stable routine-only identity, EN/IT/filtering, linked config, unchanged builder/lifecycle payload and no-art/reduced-motion guards')
