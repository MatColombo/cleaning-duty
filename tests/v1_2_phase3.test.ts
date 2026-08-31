import type { LayoutElement, Routine, TaskOccurrence, WorkspaceData } from '../src/types/domain'
import { homeCleanlinessSummary } from '../src/lib/home'
import { applyMutationLocally } from '../src/lib/mutations'
import { buildRoomWorkflow, roomStatusMap } from '../src/lib/room'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function close(actual: number | null, expected: number, tolerance: number, message: string) {
  assert(actual != null && Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`)
}

const wid = '10000000-0000-4000-8000-000000000001'
const mid = '10000000-0000-4000-8000-000000000002'
const room1 = '10000000-0000-4000-8000-000000000010'
const room2 = '10000000-0000-4000-8000-000000000011'
const item1 = '10000000-0000-4000-8000-000000000020'
const item2 = '10000000-0000-4000-8000-000000000021'
const routine1 = '10000000-0000-4000-8000-000000000030'
const routine2 = '10000000-0000-4000-8000-000000000031'
const taskBaseId = '10000000-0000-4000-8000-000000000040'

function routine(id: string, targetId: string, status: Routine['status'] = 'active'): Routine {
  return {
    id, workspaceId: wid, name: `Routine ${id.slice(-2)}`, actionId: `action-${id}`,
    targetEntityIds: [targetId], includeDescendantTargetIds: [],
    recurrence: { kind: 'daily', interval: 1, anchorDate: '2026-08-01' }, timeOfDay: '09:00', routineTimezone: 'UTC',
    scheduleMode: 'fixed', exceptions: { excludedDates: [], includedDateTimes: [] }, assignment: { mode: 'member', memberId: mid },
    reminder: { mode: 'none' }, cleanlinessChannel: 'regular', careLevel: 'routine', refreshLevelPct: 100, status, revision: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
  }
}

function task(id: string, routineId: string, targetId: string, due: string, slot = due, overrides: Partial<TaskOccurrence> = {}): TaskOccurrence {
  return {
    id, workspaceId: wid, routineId, routineRevision: 1, routineNameSnapshot: `Routine ${routineId.slice(-2)}`,
    actionNameSnapshot: `Clean ${targetId === item1 ? 'sink' : 'desk'}`, cleanlinessChannel: 'regular', careLevel: 'routine',
    scheduledSlotAt: slot, effectiveDueAt: due, originalDueAt: slot, dueAt: due, state: 'scheduled', assigneeMemberId: mid,
    targets: [{ entityId: targetId, entityName: targetId === item1 ? 'Sink' : 'Desk', entityTypeName: 'Item', matchReasons: ['Selected'] }],
    supplies: [], explanation: { schedule: 'Daily', assignment: 'A', targetSummary: 'Item' }, version: 1, createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function layout(id: string, entityId: string, x: number): LayoutElement {
  return { id, workspaceId: wid, sceneId: 'scene', entityId, role: 'area', shape: 'rect', x, y: 20, width: 300, height: 220, rotation: 0, zIndex: 1, labelPosition: 'center', createdAt: '2026-08-01T00:00:00.000Z' }
}

function data(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  const r1 = routine(routine1, item1)
  const r2 = routine(routine2, item2)
  return {
    workspace: { id: wid, name: 'Home', timezone: 'UTC', careSensitivity: 'balanced', createdAt: '2026-08-01T00:00:00.000Z' },
    members: [{ id: mid, workspaceId: wid, displayName: 'A', role: 'owner', status: 'active', labels: [], createdAt: '2026-08-01T00:00:00.000Z' }],
    fieldDefinitions: [], entityTypes: [{ id: 'room-type', workspaceId: wid, name: 'Room', createdAt: '2026-08-01T00:00:00.000Z' }, { id: 'item-type', workspaceId: wid, name: 'Item', createdAt: '2026-08-01T00:00:00.000Z' }],
    entities: [
      { id: room1, workspaceId: wid, typeId: 'room-type', name: 'Bathroom', labels: [], metadata: {}, createdAt: '2026-08-01T00:00:00.000Z' },
      { id: room2, workspaceId: wid, typeId: 'room-type', name: 'Office', labels: [], metadata: {}, createdAt: '2026-08-01T00:00:00.000Z' },
      { id: item1, workspaceId: wid, typeId: 'item-type', parentId: room1, name: 'Sink', labels: [], metadata: {}, createdAt: '2026-08-01T00:00:00.000Z' },
      { id: item2, workspaceId: wid, typeId: 'item-type', parentId: room2, name: 'Desk', labels: [], metadata: {}, createdAt: '2026-08-01T00:00:00.000Z' },
    ],
    layoutScenes: [{ id: 'scene', workspaceId: wid, name: 'Ground floor', kind: 'floor', order: 0, createdAt: '2026-08-01T00:00:00.000Z' }],
    layoutElements: [layout('layout1', room1, 20), layout('layout2', room2, 360)], entityRelations: [],
    actions: [
      { id: `action-${routine1}`, workspaceId: wid, name: 'Clean sink', defaultSupplyIds: [], metadata: {}, revision: 1, createdAt: '2026-08-01T00:00:00.000Z' },
      { id: `action-${routine2}`, workspaceId: wid, name: 'Clean desk', defaultSupplyIds: [], metadata: {}, revision: 1, createdAt: '2026-08-01T00:00:00.000Z' },
    ],
    routines: [r1, r2], tasks: [], taskEvents: [],
    healthTrajectories: [
      { workspaceId: wid, itemId: item1, routineId: routine1, cleanlinessChannel: 'regular', healthAnchorAt: '2026-08-30T00:00:00.000Z', healthAnchorPct: 100, healthDueAt: '2026-09-01T00:00:00.000Z', healthOverdueEndAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z' },
      { workspaceId: wid, itemId: item2, routineId: routine2, cleanlinessChannel: 'regular', healthAnchorAt: '2026-08-30T00:00:00.000Z', healthAnchorPct: 50, healthDueAt: '2026-09-01T00:00:00.000Z', healthOverdueEndAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z' },
    ], completionSnapshots: [], supplies: [], supplyEvents: [], ...overrides,
  }
}

const now = new Date('2026-08-31T12:00:00.000Z')

// Home cleanliness is the equal-per-item canonical aggregate, not occurrence weighted.
{
  const summary = homeCleanlinessSummary(data(), now)
  // item1 = 25, item2 = 12.5 at the midpoint between Aug 30 and Sep 1.
  close(summary.regular, 18.75, 0.001, 'home regular cleanliness must average eligible items once')
  assert(summary.deep === null, 'untracked Deep home cleanliness must be Not tracked/null')
}

// A room can visibly carry overdue and due-today state at the same time.
{
  const d = data({ tasks: [
    task('overdue-task', routine1, item1, '2026-08-30T08:00:00.000Z'),
    task('today-task', routine1, item1, '2026-08-31T15:00:00.000Z', '2026-08-31T15:00:00.000Z'),
    task('future-task', routine1, item1, '2026-09-02T09:00:00.000Z'),
  ] })
  const workflow = buildRoomWorkflow(d, room1, now)
  assert(workflow.status === 'both', 'room with overdue and today work must expose both status')
  assert(workflow.overdue.map((row) => row.id).join(',') === 'overdue-task', 'room overdue list must be room-scoped')
  assert(workflow.dueToday.map((row) => row.id).join(',') === 'today-task', 'room today list must be room-scoped')
  assert(workflow.upcoming.map((row) => row.id).join(',') === 'future-task', 'room upcoming list must cover next 7 days')
  assert(workflow.queue.map((row) => row.id).join(',') === 'overdue-task,today-task', 'Start room queue must be overdue then today')
}

// Rescheduling an occurrence into today makes it eligible for room mode without mutating its theoretical slot.
{
  const moved = task('moved-task', routine1, item1, '2026-08-31T18:00:00.000Z', '2026-09-02T09:00:00.000Z')
  const workflow = buildRoomWorkflow(data({ tasks: [moved] }), room1, now)
  assert(workflow.dueToday.length === 1 && workflow.queue[0].id === 'moved-task', 'effective due today must enter Start room')
  assert(workflow.queue[0].scheduledSlotAt === '2026-09-02T09:00:00.000Z', 'room projection must preserve scheduled slot')
}

// Future-only work does not decorate the room.
{
  const d = data({ tasks: [task('future-only', routine1, item1, '2026-09-03T09:00:00.000Z')] })
  const statuses = roomStatusMap(d, [room1, room2], now)
  assert(statuses.get(room1) === 'none', 'future-only work must not add room status')
  assert(statuses.get(room2) === 'none', 'room without current work must stay undecorated')
}

// Duplicate same-slot rows do not duplicate room work; paused routines contribute no due state.
{
  const original = task(taskBaseId, routine1, item1, '2026-08-31T09:00:00.000Z')
  const duplicate = task('duplicate-id', routine1, item1, '2026-08-31T09:00:00.000Z')
  const active = buildRoomWorkflow(data({ tasks: [original, duplicate] }), room1, now)
  assert(active.queue.length === 1, 'room mode must reuse Overview same-slot deduplication')
  const pausedRoutine = routine(routine1, item1, 'paused')
  const paused = buildRoomWorkflow(data({ routines: [pausedRoutine, routine(routine2, item2)], tasks: [original] }), room1, now)
  assert(paused.queue.length === 0 && paused.status === 'none', 'paused routine must not create room due state')
}

// Room mode mutations remain the canonical task mutations: Skip removes the task and exact-action Undo restores it.
{
  const source = task(taskBaseId, routine1, item1, '2026-08-31T09:00:00.000Z')
  const base = data({ tasks: [source] })
  const skipped = applyMutationLocally(base, { id: 'm1', workspaceId: wid, kind: 'skip', taskId: taskBaseId, expectedVersion: 1, eventId: 'skip-event', eventAt: '2026-08-31T12:01:00.000Z', actorMemberId: mid })
  assert(buildRoomWorkflow(skipped, room1, now).queue.length === 0, 'canonical Skip must immediately clear room queue')
  const undone = applyMutationLocally(skipped, { id: 'm2', workspaceId: wid, kind: 'undo', taskId: taskBaseId, expectedVersion: 2, sourceEventId: 'skip-event', eventId: 'undo-event', eventAt: '2026-08-31T12:02:00.000Z', actorMemberId: mid })
  assert(buildRoomWorkflow(undone, room1, now).queue.length === 1, 'canonical Undo must restore room queue without shadow state')
}

console.log('v1.2.0 Phase 3 tests passed')
