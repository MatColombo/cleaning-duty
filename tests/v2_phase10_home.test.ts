declare const require: (name: string) => any
import type { TaskOccurrence, WorkspaceData } from '../src/types/domain'
import { homeCleanlinessSummary, careEstimateForEntity, scheduledTasksForEntity, supplyAlertsForEntity } from '../src/lib/home'
import { buildRoomWorkflow, roomStatusMap } from '../src/lib/room'
import { applyMutationLocally } from '../src/lib/mutations'
import { homeEntityArtId, homeMoodExpression, homeRoomStatusLabel } from '../src/components/home/homeArtwork'
import { resolveHomeItemSelection } from '../src/components/home/homeSelection'
import { orderedRoomSessionQueue, deferRoomSessionTask } from '../src/components/home/roomPresentation'
import { homeTaskDue, homeTaskWhen } from '../src/components/home/homeTaskTime'
import { getPrimitiveDefinition } from '../src/visual/registry'
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const data: WorkspaceData = JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json', 'utf8')).data
const now = new Date('2026-09-16T12:00:00.000Z')

// Existing domain stays authoritative: the visual motif never drives cleanliness, room status or task mutations.
const summary = homeCleanlinessSummary(data, now)
assert.ok(summary.regular !== undefined && summary.deep !== undefined)
const room = data.entities.find((entity) => data.layoutElements.some((placement) => placement.entityId === entity.id && placement.role === 'area'))!
assert.ok(room)
const care = careEstimateForEntity(data, room.id, now)
assert.equal(typeof care.routine.tracked, 'boolean')
const roomWorkflow = buildRoomWorkflow(data, room.id, now)
assert.ok(roomStatusMap(data, [room.id], now).has(room.id))
assert.ok(Array.isArray(scheduledTasksForEntity(data, room.id)))
assert.ok(Array.isArray(supplyAlertsForEntity(data, room.id)))

// Art uses the authored registry, not a new image table, runtime AI, or domain fields.
for (const [name, typeName, isRoom, expected] of [
  ['Kitchen', 'Room', true, 'countertop'], ['Cucina', 'Stanza', true, 'countertop'],
  ['Bathroom', 'Room', true, 'shower-head'], ['Bagno', 'Stanza', true, 'shower-head'],
  ['Living room', 'Room', true, 'sofa'], ['Camera da letto', 'Stanza', true, 'bed'],
  ['Oven', 'Appliance', false, 'oven'], ['Forno', 'Elettrodomestico', false, 'oven'],
  ['Unrecognized Zorgbristle', 'Thingy', false, 'generic-surface'],
] as const) {
  const chosen = homeEntityArtId({ name }, { name: typeName }, isRoom)
  assert.equal(chosen, expected, `Incorrect decorative motif for ${name}`)
  assert.ok(getPrimitiveDefinition(chosen), `Missing authored SVG: ${chosen}`)
}
assert.equal(homeMoodExpression(null), 'neutral')
assert.equal(homeMoodExpression(80), 'proud')
assert.equal(homeMoodExpression(8), 'sweaty')
assert.equal(homeRoomStatusLabel('none','Today','Overdue'), null)
assert.equal(homeRoomStatusLabel('both','Today','Overdue'), 'Overdue · Today')

// Existing /home?item= compatibility opens the semantic item and its scene when placed.
const placed = data.layoutElements.find((element) => !element.archivedAt)!
assert.deepEqual(resolveHomeItemSelection(data, placed.entityId), { entityId: placed.entityId, elementId: placed.id, sceneId: placed.sceneId })
const unplaced = data.entities.find((entity) => !entity.archivedAt && !data.layoutElements.some((element) => element.entityId === entity.id && !element.archivedAt))
if (unplaced) assert.deepEqual(resolveHomeItemSelection(data, unplaced.id), {entityId:unplaced.id,elementId:'',sceneId:null})
assert.equal(resolveHomeItemSelection(data, 'missing-item'), null)
assert.equal(resolveHomeItemSelection(data, null), null)

// Visual Later order does not mutate or reassign any canonical occurrence.
const tasks = data.tasks.filter((task) => task.state === 'scheduled').slice(0, 3)
assert.ok(tasks.length >= 2)
const originalIds = tasks.map((task) => task.id)
const deferred = deferRoomSessionTask([], tasks[0].id)
const reordered = orderedRoomSessionQueue(tasks, deferred)
assert.deepEqual(reordered.map((task) => task.id), [...originalIds.slice(1), originalIds[0]])
assert.deepEqual(tasks.map((task) => task.id), originalIds, 'Source queue stays untouched')
assert.deepEqual(deferRoomSessionTask([tasks[0].id], tasks[0].id), [tasks[0].id], 'No deferred duplicate')
const synthetic = { ...tasks[0], dueAt:'2026-09-20T14:00:00.000Z', effectiveDueAt:'2026-09-16T14:00:00.000Z' } as TaskOccurrence
assert.equal(homeTaskDue(synthetic), synthetic.effectiveDueAt)
assert.ok(homeTaskWhen(synthetic, 'it', data.workspace.timezone, now).length > 0)

// Real room mutations still run through the original service and exact task identity.
const source = roomWorkflow.queue[0] ?? tasks[0]
const sourceData = {...data, tasks:data.tasks.map((task) => task.id === source.id ? {...task, state:'scheduled' as const} : task)}
const version = sourceData.tasks.find((task)=>task.id===source.id)!.version
const skipped = applyMutationLocally(sourceData, { id:'p10-skip', workspaceId:data.workspace.id, kind:'skip', taskId:source.id, expectedVersion:version, eventId:'p10-skip-event', eventAt:'2026-09-16T12:03:00.000Z' })
assert.equal(skipped.tasks.length, data.tasks.length, 'Skip does not create a shadow task')
assert.equal(skipped.tasks.find((task)=>task.id===source.id)!.state, 'skipped')
const skippedVersion = skipped.tasks.find((task)=>task.id===source.id)!.version
const restored = applyMutationLocally(skipped, { id:'p10-undo', workspaceId:data.workspace.id, kind:'undo', taskId:source.id, expectedVersion:skippedVersion, sourceEventId:'p10-skip-event', eventId:'p10-undo-event', eventAt:'2026-09-16T12:05:00.000Z' })
assert.equal(restored.tasks.length, data.tasks.length)
assert.equal(restored.tasks.find((task)=>task.id===source.id)!.state, 'scheduled')

// Source architecture: HomeLayoutCanvas is still the one authoritative geometry, editor, pan/zoom host.
const homePage = readFileSync('src/pages/HomePage.tsx', 'utf8')
const canvas = readFileSync('src/components/HomeLayoutCanvas.tsx', 'utf8')
const inspector = readFileSync('src/components/home/HomeInspector.tsx', 'utf8')
const controller = readFileSync('src/components/home/RoomModeController.tsx','utf8')
const roomSheet = readFileSync('src/components/home/RoomModeSheet.tsx', 'utf8')
const css = readFileSync('src/styles/home-v2.css','utf8')
assert.ok(homePage.includes('<HomeLayoutCanvas') && homePage.includes('onGeometryCommit={(id, patch) => updateLayoutElement(id, patch)}'))
// The canvas emits onSelectElement followed by onSelectEntity on every element
// click/pointer-down. The latter must NOT clear selectedElementId or editing,
// polygon handles, and geometry controls become unreachable.
assert.ok(homePage.includes('onSelectEntity={setSelectedEntityId}'))
assert.ok(canvas.includes('onSelectElement?.(element.id)') && canvas.includes('onSelectEntity?.(element.entityId)'))
assert.ok(homePage.includes('overlay="objects"') && homePage.includes('roomStatuses={editMode ? new Map() : roomStatuses}'))
assert.ok(canvas.includes('fittedBaseViewBox') && canvas.includes('room-status-outline') && canvas.includes('onGeometryCommit'))
assert.ok(homePage.includes('<HomeStatusHeader') && homePage.includes('<HomeInspector') && homePage.includes('<RoomModeController'))
assert.ok(homePage.includes("resolveHomeItemSelection(data"))
assert.ok(inspector.includes('groupLinkedTaskOccurrences(') && inspector.includes('additionalActivityAppendix(') && inspector.includes('ProductStockList'))
assert.ok(inspector.includes('<HomeStockAlerts supplies={selectedSupplies} />'))
assert.ok(controller.includes('await completeTask(current.id)') && controller.includes('await skipTask(current.id)'))
assert.ok(controller.includes('onRememberUndo(current, eventId') && controller.includes('onDeferredIds('))
assert.ok(roomSheet.includes('<CardArtwork task={current}') && roomSheet.includes('onComplete') && roomSheet.includes('onSkip') && roomSheet.includes('onLater'))
assert.ok(css.includes('prefers-reduced-motion') && css.includes('body[data-v2-no-art'))
assert.ok(!css.includes('.layout-element .layout-shape'), 'V2 should not mutate the geometry/shape visual rules')
console.log('V2 Phase 10 Home tests passed: spatial workflow, semantic artwork, selection/deep links, room order, real Skip/Undo and styling guards')
