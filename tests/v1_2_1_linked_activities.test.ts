import type { AdditionalActivityInput, Routine, WorkspaceData } from '../src/types/domain'
import { saveAdditionalActivities, additionalActivityFromRoutine } from '../src/lib/linkedRoutines'
import { materializeAdditionalActivities, materializeRoutineSlot, nextTheoreticalSlotAfter, occurrenceSlots, theoreticalOccurrenceSlots } from '../src/lib/scheduler'
import { aggregateCleanliness, buildCompletionHealthEffects } from '../src/lib/cleanliness'
import { normalizeWorkspaceData } from '../src/lib/dataMigrations'
import { applyMutationLocally } from '../src/lib/mutations'
import { createHouseholdBackup, parseHouseholdBackup } from '../src/lib/backup'
import { buildCriticalItems, buildOverviewGroups, mergeCriticalItemsByEntity } from '../src/lib/overview'
import { activityTitle, activitySubtitle, cleanlinessMood, groupLinkedTaskOccurrences } from '../src/lib/presentation'
import { translations } from '../src/lib/translations'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function same(actual: unknown, expected: unknown, message: string) { assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}\n${JSON.stringify(actual)} != ${JSON.stringify(expected)}`) }
const wid = '00000000-0000-4000-8000-000000000701'
const mid = '00000000-0000-4000-8000-000000000702'
const rid = '00000000-0000-4000-8000-000000000703'
const created = '2026-09-01T00:00:00.000Z'
const parent: Routine = {
  id: rid, workspaceId: wid, name: 'Clean living room', actionId: 'clean', targetEntityIds: ['room'], includeDescendantTargetIds: [],
  recurrence: { kind: 'interval', interval: 1, unit: 'day', anchorDate: '2026-09-01' }, timeOfDay: '10:00', routineTimezone: 'UTC',
  scheduleMode: 'fixed', exceptions: { excludedDates: [], includedDateTimes: [] }, assignment: { mode: 'everyone' }, reminder: { mode: 'at_due' },
  cleanlinessChannel: 'regular', careLevel: 'routine', refreshLevelPct: 100, affectsCleanliness: true, status: 'active', revision: 1, createdAt: created,
}
const base: WorkspaceData = {
  workspace: { id: wid, name: 'Home', timezone: 'UTC', careSensitivity: 'balanced', createdAt: created },
  members: [{ id: mid, workspaceId: wid, userId: 'user', displayName: 'One', role: 'owner', status: 'active', labels: [], createdAt: created }],
  fieldDefinitions: [], entityTypes: [{ id: 'type', workspaceId: wid, name: 'Object', createdAt: created }],
  entities: [
    { id: 'room', workspaceId: wid, typeId: 'type', name: 'Living room', labels: [], metadata: {}, createdAt: created },
    { id: 'books', workspaceId: wid, typeId: 'type', parentId: 'room', name: 'Bookshelf', labels: [], metadata: {}, createdAt: created },
  ],
  layoutScenes: [], layoutElements: [], entityRelations: [],
  actions: [
    { id: 'clean', workspaceId: wid, name: 'Clean', defaultSupplyIds: ['soap'], metadata: {}, revision: 1, createdAt: created },
    { id: 'dust', workspaceId: wid, name: 'Dust', defaultSupplyIds: ['soap'], metadata: {}, revision: 1, createdAt: created },
  ],
  routines: [parent], tasks: [], taskEvents: [], healthTrajectories: [], completionSnapshots: [],
  supplies: [
    { id: 'soap', workspaceId: wid, name: 'Soap', status: 'available', metadata: {}, version: 1, createdAt: created },
    { id: 'polish', workspaceId: wid, name: 'Wood polish', status: 'low', quantity: 1, unit: 'bottle', metadata: {}, version: 1, createdAt: created },
  ], supplyEvents: [],
}
const extra: AdditionalActivityInput = {
  name: 'Dust the bookshelf', actionId: 'dust', targetEntityIds: ['books'], includeDescendantTargetIds: [],
  every: 3, careLevel: 'deep', affectsCleanliness: true, refreshLevelPct: 100, supplyIdsOverride: ['polish'],
}
let configured = saveAdditionalActivities(base, parent, [extra], mid)
const childId = configured.routines.find((routine) => routine.parentRoutineId === parent.id)!.id
// The user configured this fixture at the parent's start date.
configured = { ...configured, routines: configured.routines.map((routine) => ({ ...routine, createdAt: created })) }
let data = configured
for (let day = 1; day <= 9; day++) data = materializeRoutineSlot(data, parent, `2026-09-${String(day).padStart(2, '0')}T10:00:00.000Z`)
data = materializeAdditionalActivities(data)
const children = data.tasks.filter((task) => task.routineId === childId)
same(children.map((task) => task.triggerOrdinal), [3, 6, 9], 'Extras must fire on N, 2N, 3N')
assert(data.tasks.filter((task) => task.routineId === parent.id).length === 9, 'Attaching must not replace or multiply parent tasks')
assert(children.every((task) => task.parentOccurrenceId && task.assignmentScope === 'everyone'), 'Extra must link to exact parent occurrence and inherit household assignment')
same(children[0].supplies, [{ supplyId: 'polish', supplyName: 'Wood polish' }], 'Extra stock must be its own override, not the parent products')
same(materializeAdditionalActivities(data).tasks, data.tasks, 'Refresh must not duplicate attached work')
same(activityTitle(children[0]), 'Dust the bookshelf', 'Activity title must use explicit title')
same(activitySubtitle(children[0]), 'Bookshelf - Dust', 'Subtitle must be item - action')

const fixedChild = configured.routines.find((routine) => routine.id === childId)!
same(occurrenceSlots(parent, '2026-09-03', '2026-09-07', 'UTC').map((slot) => slot.ordinal), [3, 4, 5, 6, 7], 'Ordinals must not reset with a display window')
same(theoreticalOccurrenceSlots(fixedChild, '2026-09-03', '2026-09-07', 'UTC').map((slot) => slot.ordinal), [3, 6], 'Linked cadence must use the same global ordinals')
same(nextTheoreticalSlotAfter(fixedChild, '2026-09-03T10:00:00.000Z', 'UTC'), '2026-09-06T10:00:00.000Z', 'Extra cleanliness must use every N parent slots')
const movedParent = data.tasks.find((task) => task.id === children[0].parentOccurrenceId)!
const moved = { ...data, tasks: data.tasks.map((task) => task.id === movedParent.id ? { ...task, effectiveDueAt: '2026-09-05T14:00:00.000Z', dueAt: '2026-09-05T14:00:00.000Z' } : task) }
same(materializeAdditionalActivities(moved).tasks.filter((task) => task.routineId === childId), children, 'Moving a parent must not move or duplicate existing independent extras')
const skipped = applyMutationLocally(data, { id: 'skip-mutation', workspaceId: wid, kind: 'skip', taskId: movedParent.id, expectedVersion: movedParent.version, eventId: 'skip-event', eventAt: '2026-09-03T10:01:00.000Z' })
same(materializeAdditionalActivities(skipped).tasks.filter((task) => task.routineId === childId), children, 'Skipping the parent must leave extra work actionable')
const skippedChild = applyMutationLocally(data, { id: 'skip-extra', workspaceId: wid, kind: 'skip', taskId: children[0].id, expectedVersion: children[0].version, eventId: 'skip-extra-event', eventAt: '2026-09-03T10:02:00.000Z' })
assert(materializeAdditionalActivities(skippedChild).tasks.find((task) => task.id === children[0].id)?.state === 'skipped', 'Skipped attached work must not resurrect')
const paused = { ...data, routines: data.routines.map((routine) => routine.id === parent.id ? { ...routine, status: 'paused' as const } : routine), tasks: data.tasks.filter((task) => task.routineId === parent.id) }
assert(materializeAdditionalActivities(paused).tasks.every((task) => task.routineId === parent.id), 'Paused parent must not generate extras')

const byPolicy = saveAdditionalActivities(data, parent, [{ ...additionalActivityFromRoutine(fixedChild), affectsCleanliness: false, refreshLevelPct: 60 }], mid)
assert(byPolicy.routines.find((routine) => routine.id === childId)?.revision === fixedChild.revision, 'Cleanliness-only change must not revise the schedule')
same(byPolicy.tasks, data.tasks, 'Cleanliness-only change must leave tasks untouched')
const optedOut = normalizeWorkspaceData({ ...byPolicy, routines: byPolicy.routines.map((routine) => ({ ...routine, affectsCleanliness: false })) })
assert(aggregateCleanliness(optedOut, ['room', 'books'], 'regular').score === null && aggregateCleanliness(optedOut, ['room', 'books'], 'deep').score === null, 'All opted-out routines must yield Not tracked, not 0')
same(buildCompletionHealthEffects(optedOut, children[0], '2026-09-03T10:00:00.000Z', ['books']), [], 'Opt-out completion must have no physical health effect')
const childOnly = normalizeWorkspaceData({ ...data, routines: data.routines.map((routine) => routine.id === parent.id ? { ...routine, affectsCleanliness: false } : routine) })
assert(aggregateCleanliness(childOnly, ['books'], 'deep', '2026-09-02T10:00:00.000Z').score !== null, 'A child may track cleanliness independently of an opted-out parent')
const changed = saveAdditionalActivities(data, parent, [{ ...additionalActivityFromRoutine(fixedChild), every: 4 }], mid)
same(changed.tasks.filter((task) => task.routineId === parent.id), data.tasks.filter((task) => task.routineId === parent.id), 'Editing an extra must not recreate the parent')
assert(changed.routines.find((routine) => routine.id === childId)?.revision === fixedChild.revision + 1, 'Changed interval must revise only the extra')
const removed = saveAdditionalActivities(data, parent, [], mid)
assert(Boolean(removed.routines.find((routine) => routine.id === childId)?.archivedAt), 'Removing extra must preserve its routine as archived history')
assert(removed.tasks.filter((task) => task.routineId === childId).every((task) => task.state === 'cancelled'), 'Removing extra must cancel its pending work')

const dynamicParent: Routine = { ...parent, scheduleMode: 'after_completion' }
let dynamic: WorkspaceData = { ...configured, routines: configured.routines.map((routine) => ({ ...routine, scheduleMode: 'after_completion' as const })) }
for (let day = 1; day <= 3; day++) dynamic = materializeRoutineSlot(dynamic, dynamicParent, `2026-09-${String(day).padStart(2, '0')}T10:00:00.000Z`)
same(dynamic.tasks.map((task) => task.triggerOrdinal), [1, 2, 3], 'Completion-relative parent must retain monotonic ordinals')
assert(materializeAdditionalActivities(dynamic).tasks.filter((task) => task.routineId === childId).length === 1, 'Third completion-relative trigger must append one task')

const monthly: Routine = { ...fixedChild, recurrence: { kind: 'interval', unit: 'month', interval: 1, anchorDate: '2026-01-31' }, triggerEvery: 2 }
same(theoreticalOccurrenceSlots(monthly, '2026-01-01', '2026-05-31', 'UTC').map((slot) => slot.date), ['2026-02-28', '2026-04-30'], 'Month-length cadence must count actual calendar slots')
const weekly: Routine = { ...fixedChild, recurrence: { kind: 'weekdays', weekdays: [1, 4], intervalWeeks: 1, anchorDate: '2026-09-01' }, triggerEvery: 2 }
same(theoreticalOccurrenceSlots(weekly, '2026-09-01', '2026-09-14', 'UTC').map((slot) => slot.ordinal), [2, 4], 'Selected weekdays must count triggers, not days')
const hourly: Routine = { ...fixedChild, recurrence: { kind: 'interval', unit: 'hour', interval: 1, anchorDate: '2026-09-01' }, triggerEvery: 3 }
same(theoreticalOccurrenceSlots(hourly, '2026-09-02', '2026-09-02', 'UTC').slice(0, 2).map((slot) => slot.ordinal), [15, 18], 'Hourly ordinal must be stable across day windows')
const manualParent = { ...parent, exceptions: { excludedDates: [], includedDateTimes: ['2026-09-02T14:00'] } }
const manualData = materializeRoutineSlot({ ...configured, routines: configured.routines.map((routine) => routine.id === parent.id ? manualParent : routine) }, manualParent, '2026-09-02T14:00:00.000Z')
assert(materializeAdditionalActivities(manualData).tasks.length === 1, 'Manual extra date must not silently increment the recurring trigger count')

let invalid = false
try { saveAdditionalActivities(base, parent, [{ ...extra, every: 0 }]) } catch { invalid = true }
assert(invalid, 'Zero trigger interval must be rejected')
const backup = parseHouseholdBackup(JSON.stringify(createHouseholdBackup(data)))
assert(backup.schema_version === 9 && backup.data.routines.find((routine) => routine.id === childId)?.parentRoutineId === parent.id, 'Backup must retain linked routines and upgrade schema')
same(backup.data.tasks.find((task) => task.id === children[0].id)?.supplies, children[0].supplies, 'Backup must retain attached stock snapshots')
const legacyBackup = { ...createHouseholdBackup(base), schema_version: 8 }
assert(parseHouseholdBackup(JSON.stringify(legacyBackup)).schema_version === 9, 'v1.2.0 backups must remain importable')
same(Object.keys(translations.en).sort(), Object.keys(translations.it).sort(), 'All new strings require EN/IT parity')
same([100, 89, 69, 39, 19, 9].map((score) => cleanlinessMood(score)?.label), ['moodExcellent', 'moodGood', 'moodFair', 'moodAttention', 'moodUrgent', 'moodCritical'], 'Mood bands must be distinct and ordered')
assert(cleanlinessMood(null) === null, 'Untracked must not show an angry face')

const todayTask = data.tasks[0]
const sameDayMove = { ...data, tasks: [{ ...todayTask, effectiveDueAt: '2026-09-01T15:00:00.000Z', dueAt: '2026-09-01T15:00:00.000Z' }], taskEvents: [{ id: 'move', workspaceId: wid, taskId: todayTask.id, type: 'POSTPONED' as const, at: '2026-09-01T12:00:00.000Z', metadata: {} }] }
const groups = buildOverviewGroups(sameDayMove, { now: new Date('2026-09-01T13:00:00.000Z') })
assert(groups.laterToday.length === 1 && groups.finished.length === 0, 'Same-day reschedule must not render in active and Finished at once')

// A selected item's other low channel must stay visible even when its rank in
// that channel lies outside the per-channel selection limit.
const dualNow = '2026-09-03T10:00:00.000Z'
const dualRoutines: Routine[] = [
  { ...parent, id: 'dual-regular', targetEntityIds: ['books'] },
  { ...parent, id: 'dual-deep', targetEntityIds: ['books'], careLevel: 'deep', cleanlinessChannel: 'deep' },
  { ...parent, id: 'worse-deep', targetEntityIds: ['room'], careLevel: 'deep', cleanlinessChannel: 'deep' },
]
const dual: WorkspaceData = { ...base, routines: dualRoutines, healthTrajectories: dualRoutines.map((routine, index) => ({
  workspaceId: wid, itemId: routine.targetEntityIds[0], routineId: routine.id, cleanlinessChannel: routine.cleanlinessChannel!,
  healthAnchorAt: dualNow, healthAnchorPct: [5, 15, 2][index], healthDueAt: '2026-09-04T10:00:00.000Z',
  healthOverdueEndAt: '2026-09-05T10:00:00.000Z', updatedAt: dualNow,
})) }
const dualCard = mergeCriticalItemsByEntity(buildCriticalItems(dual, new Date(dualNow), 20, 1)).find((item) => item.itemId === 'books')
same(dualCard?.channels.map((channel) => channel.channel), ['regular', 'deep'], 'A selected critical item must identify both low channels')



// UI projection: linked work is grouped under its parent only when both are in
// the same view; otherwise it remains standalone and therefore cannot vanish.
const parentThird = data.tasks.find((task) => task.routineId === parent.id && task.triggerOrdinal === 3)!
const childThird = data.tasks.find((task) => task.routineId === childId && task.triggerOrdinal === 3)!
const groupedProjection = groupLinkedTaskOccurrences([parentThird, childThird])
same(groupedProjection.map((group) => [group.task.id, group.linkedActivities.map((task) => task.id)]), [[parentThird.id, [childThird.id]]], 'Overview/Home projections must nest linked work under the visible parent')
same(groupLinkedTaskOccurrences([childThird]).map((group) => group.task.id), [childThird.id], 'Linked work must remain visible when its parent is not in the same projection')

// Race recovery: if the parent becomes terminal before the linked task was
// materialized, the child must still be generated and remain independently actionable.
const parentOnlyThird: WorkspaceData = { ...configured, tasks: [], taskEvents: [] }
let raceData = materializeRoutineSlot(parentOnlyThird, parent, '2026-09-03T10:00:00.000Z')
const raceParent = raceData.tasks.find((task) => task.routineId === parent.id)!
raceData = { ...raceData, tasks: raceData.tasks.map((task) => task.id === raceParent.id ? { ...task, state: 'completed' as const, completedAt: '2026-09-03T10:01:00.000Z' } : task) }
raceData = materializeAdditionalActivities(raceData)
assert(raceData.tasks.some((task) => task.routineId === childId && task.parentOccurrenceId === raceParent.id && task.state === 'scheduled'), 'Terminal parent must not suppress a due linked activity during materialization recovery')

console.log('v1.2.1 linked activities, stock, cleanliness, presentation and backup tests passed')
