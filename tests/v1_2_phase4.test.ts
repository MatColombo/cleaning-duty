import { activityOutcomeSummary, cleanlinessTrend, historyEntriesV12, todayActivitySummary } from '../src/lib/analytics'
import { contrastIssues, themePresets } from '../src/lib/theme'
import type { Routine, TaskOccurrence, WorkspaceData } from '../src/types/domain'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function close(actual: number | null, expected: number, tolerance: number, message: string) {
  assert(actual != null && Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`)
}

const wid = 'w'
const mid = 'm'
const room = 'room'
const item = 'item'
const rid = 'routine'

const routine: Routine = {
  id: rid, workspaceId: wid, name: 'Daily sink', actionId: 'action', targetEntityIds: [item], includeDescendantTargetIds: [],
  recurrence: { kind: 'daily', interval: 1, anchorDate: '2026-08-29' }, timeOfDay: '10:00', routineTimezone: 'UTC',
  scheduleMode: 'fixed', exceptions: { excludedDates: [], includedDateTimes: [] }, assignment: { mode: 'member', memberId: mid }, reminder: { mode: 'none' },
  cleanlinessChannel: 'regular', careLevel: 'routine', refreshLevelPct: 100, status: 'active', revision: 1, createdAt: '2026-08-29T10:00:00.000Z',
}

function task(id: string, due: string, state: TaskOccurrence['state']): TaskOccurrence {
  return {
    id, workspaceId: wid, routineId: rid, routineRevision: 1, routineNameSnapshot: 'Daily sink', actionNameSnapshot: 'Clean sink', cleanlinessChannel: 'regular', careLevel: 'routine',
    scheduledSlotAt: due, effectiveDueAt: due, originalDueAt: due, dueAt: due, state, completedAt: state === 'completed' ? due : undefined, assignmentScope: 'member', assigneeMemberId: mid,
    targets: [{ entityId: item, entityName: 'Sink', entityTypeName: 'Fixture', matchReasons: ['Selected'] }], supplies: [],
    explanation: { schedule: 'Daily', assignment: 'A', targetSummary: 'Sink' }, version: 1, createdAt: '2026-08-29T10:00:00.000Z',
  }
}

const data: WorkspaceData = {
  workspace: { id: wid, name: 'Home', timezone: 'UTC', careSensitivity: 'balanced', createdAt: '2026-08-01T00:00:00.000Z' },
  members: [{ id: mid, workspaceId: wid, displayName: 'A', role: 'owner', status: 'active', labels: [], createdAt: '2026-08-01T00:00:00.000Z' }],
  fieldDefinitions: [], entityTypes: [{ id: 'room-type', workspaceId: wid, name: 'Room', createdAt: '2026-08-01T00:00:00.000Z' }, { id: 'fixture', workspaceId: wid, name: 'Fixture', createdAt: '2026-08-01T00:00:00.000Z' }],
  entities: [{ id: room, workspaceId: wid, typeId: 'room-type', name: 'Bathroom', labels: [], metadata: {}, createdAt: '2026-08-01T00:00:00.000Z' }, { id: item, workspaceId: wid, typeId: 'fixture', parentId: room, name: 'Sink', labels: [], metadata: {}, createdAt: '2026-08-01T00:00:00.000Z' }],
  layoutScenes: [{ id: 'scene', workspaceId: wid, name: 'Floor', kind: 'floor', order: 0, createdAt: '2026-08-01T00:00:00.000Z' }],
  layoutElements: [{ id: 'layout', workspaceId: wid, sceneId: 'scene', entityId: room, role: 'area', shape: 'rect', x: 0, y: 0, width: 200, height: 200, rotation: 0, zIndex: 1, labelPosition: 'center', createdAt: '2026-08-01T00:00:00.000Z' }], entityRelations: [],
  actions: [{ id: 'action', workspaceId: wid, name: 'Clean sink', defaultSupplyIds: [], metadata: {}, revision: 1, createdAt: '2026-08-01T00:00:00.000Z' }], routines: [routine],
  tasks: [task('done', '2026-08-31T08:00:00.000Z', 'completed'), task('skip', '2026-08-31T09:00:00.000Z', 'skipped')],
  taskEvents: [
    { id: 'complete-event', workspaceId: wid, taskId: 'done', type: 'COMPLETED', at: '2026-08-31T08:15:00.000Z', actorMemberId: mid, metadata: { cleanlinessSnapshots: ['snap'] } },
    { id: 'skip-event', workspaceId: wid, taskId: 'skip', type: 'SKIPPED', at: '2026-08-31T09:05:00.000Z', actorMemberId: mid, metadata: {} },
    { id: 'move-event', workspaceId: wid, taskId: 'skip', type: 'POSTPONED', at: '2026-08-31T09:01:00.000Z', actorMemberId: mid, metadata: { from: '2026-08-31T08:30:00.000Z', to: '2026-08-31T09:00:00.000Z' } },
  ],
  healthTrajectories: [{ workspaceId: wid, itemId: item, routineId: rid, cleanlinessChannel: 'regular', healthAnchorAt: '2026-08-31T08:15:00.000Z', healthAnchorPct: 100, healthDueAt: '2026-09-01T10:00:00.000Z', healthOverdueEndAt: '2026-09-02T10:00:00.000Z', lastRefreshCompletionId: 'snap', updatedAt: '2026-08-31T08:15:00.000Z' }],
  completionSnapshots: [{ id: 'snap', workspaceId: wid, occurrenceId: 'done', sourceRoutineId: rid, trajectoryRoutineId: rid, itemId: item, cleanlinessChannel: 'regular', completedAt: '2026-08-31T08:15:00.000Z', refreshLevelPctSnapshot: 100, cleanlinessBeforePct: 4, cleanlinessAfterPct: 100, healthRefreshApplied: true, scheduledSlotAt: '2026-08-31T08:00:00.000Z', actorMemberId: mid }],
  supplies: [], supplyEvents: [],
}

assert(themePresets.length >= 17, 'appearance library must expose the expanded built-in preset set')
assert(themePresets.filter((preset) => preset.category === 'night').length >= 3, 'appearance library must include three night presets')
assert(themePresets.some((preset) => preset.category === 'mono'), 'appearance library must include a greyscale preset')
assert(themePresets.some((preset) => preset.category === 'accessible'), 'appearance library must include a colourblind-safe preset')
assert(themePresets.filter((preset) => preset.category === 'colorful').length >= 3, 'appearance library must include colourful presets')
assert(themePresets.filter((preset) => preset.category === 'cool').length >= 4, 'appearance library must include cool presets')
for (const preset of themePresets) assert(contrastIssues(preset.palette).length === 0, `${preset.name} must pass configured contrast guardrails`)

const now = new Date('2026-08-31T10:00:00.000Z')
const today = todayActivitySummary(data, now)
assert(today.completed === 1 && today.skipped === 1 && today.rescheduled === 1, 'Today summary must count completed, skipped and rescheduled events')
assert(today.roomsMaintained === 1, 'Today summary must count unique maintained rooms')
assert(today.everythingHandled, 'Today summary must recognize when all planned work is terminal')

const outcomes = activityOutcomeSummary(data, 7, now)
assert(outcomes.completed === 1 && outcomes.skipped === 1 && outcomes.rescheduled === 1, 'Outcome analysis must remain simple counts')

const trend = cleanlinessTrend(data, 1, now)
assert(trend.length === 1, 'Cleanliness trend must honor selected period')
close(trend[0].regular, 10, 0.001, 'Historical trend must rebuild current cadence trajectory from completion snapshot')
assert(trend[0].deep === null, 'Untracked Deep trend must remain Not tracked/null')

const history = historyEntriesV12(data, 7, now)
const completion = history.find((entry) => entry.id === 'complete-event')
assert(completion?.room === 'Bathroom' && completion.health.length === 1, 'History completion must expose room and health audit context')
const reschedule = history.find((entry) => entry.id === 'move-event')
assert(reschedule?.previousDueAt === '2026-08-31T08:30:00.000Z' && reschedule.newDueAt === '2026-08-31T09:00:00.000Z', 'History reschedule must expose previous and new due time')

console.log('v1.2.0 Phase 4 tests passed')
