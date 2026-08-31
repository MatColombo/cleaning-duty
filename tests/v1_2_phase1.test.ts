import type { HealthTrajectory, Routine, TaskOccurrence, WorkspaceData } from '../src/types/domain'
import {
  aggregateCleanliness,
  applyCompletionHealthEffects,
  buildCompletionHealthEffects,
  cleanlinessForTrajectory,
  itemChannelCleanliness,
  reconcileCleanlinessState,
} from '../src/lib/cleanliness'
import { applyMutationLocally } from '../src/lib/mutations'
import { normalizeWorkspaceData } from '../src/lib/dataMigrations'
import { materializeTasks, nextTheoreticalSlotAfter, followingTheoreticalSlot } from '../src/lib/scheduler'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
function close(actual: number | null, expected: number, epsilon = 0.001, message = 'values differ') {
  assert(actual != null && Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, got ${actual}`)
}
function same(actual: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

const workspaceId = '00000000-0000-4000-8000-000000000001'
const item1 = '00000000-0000-4000-8000-000000000011'
const item2 = '00000000-0000-4000-8000-000000000012'
const routineRegularId = '00000000-0000-4000-8000-000000000021'
const routineDeepId = '00000000-0000-4000-8000-000000000022'
const actionId = '00000000-0000-4000-8000-000000000031'
const memberId = '00000000-0000-4000-8000-000000000041'
const taskId = '00000000-0000-4000-8000-000000000051'

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: routineRegularId,
    workspaceId,
    name: 'Mop floor',
    actionId,
    targetEntityIds: [item1],
    includeDescendantTargetIds: [],
    recurrence: { kind: 'interval', unit: 'day', interval: 2, anchorDate: '2026-08-01' },
    timeOfDay: '10:00',
    routineTimezone: 'UTC',
    scheduleMode: 'fixed',
    exceptions: { excludedDates: [], includedDateTimes: [] },
    assignment: { mode: 'member', memberId },
    reminder: { mode: 'none' },
    cleanlinessChannel: 'regular',
    careLevel: 'routine',
    refreshLevelPct: 100,
    status: 'active',
    revision: 1,
    createdAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  }
}

function task(overrides: Partial<TaskOccurrence> = {}): TaskOccurrence {
  return {
    id: taskId,
    workspaceId,
    routineId: routineRegularId,
    routineRevision: 1,
    routineNameSnapshot: 'Mop floor',
    actionNameSnapshot: 'Mop',
    cleanlinessChannel: 'regular',
    careLevel: 'routine',
    scheduledSlotAt: '2026-08-03T10:00:00.000Z',
    effectiveDueAt: '2026-08-03T10:00:00.000Z',
    originalDueAt: '2026-08-03T10:00:00.000Z',
    dueAt: '2026-08-03T10:00:00.000Z',
    state: 'scheduled',
    assignmentScope: 'member',
    assigneeMemberId: memberId,
    targets: [{ entityId: item1, entityName: 'Kitchen floor', entityTypeName: 'Surface', matchReasons: ['Selected'] }],
    supplies: [],
    explanation: { schedule: 'Every 2 days', assignment: 'Fixed', targetSummary: 'Kitchen floor' },
    version: 1,
    createdAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  }
}

function trajectory(overrides: Partial<HealthTrajectory> = {}): HealthTrajectory {
  return {
    workspaceId,
    itemId: item1,
    routineId: routineRegularId,
    cleanlinessChannel: 'regular',
    healthAnchorAt: '2026-08-01T10:00:00.000Z',
    healthAnchorPct: 100,
    healthDueAt: '2026-08-03T10:00:00.000Z',
    healthOverdueEndAt: '2026-08-05T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  }
}

function data(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  return {
    workspace: { id: workspaceId, name: 'Home', timezone: 'UTC', careSensitivity: 'balanced', createdAt: '2026-08-01T00:00:00.000Z' },
    members: [{ id: memberId, workspaceId, displayName: 'A', role: 'owner', status: 'active', labels: [], createdAt: '2026-08-01T00:00:00.000Z' }],
    fieldDefinitions: [],
    entityTypes: [{ id: '00000000-0000-4000-8000-000000000061', workspaceId, name: 'Surface', createdAt: '2026-08-01T00:00:00.000Z' }],
    entities: [
      { id: item1, workspaceId, typeId: '00000000-0000-4000-8000-000000000061', name: 'Kitchen floor', labels: [], metadata: {}, createdAt: '2026-08-01T00:00:00.000Z' },
      { id: item2, workspaceId, typeId: '00000000-0000-4000-8000-000000000061', name: 'Hall floor', labels: [], metadata: {}, createdAt: '2026-08-01T00:00:00.000Z' },
    ],
    layoutScenes: [], layoutElements: [], entityRelations: [],
    actions: [{ id: actionId, workspaceId, name: 'Mop', defaultSupplyIds: [], metadata: {}, revision: 1, createdAt: '2026-08-01T00:00:00.000Z' }],
    routines: [routine()],
    tasks: [task()],
    taskEvents: [],
    healthTrajectories: [trajectory()],
    completionSnapshots: [],
    supplies: [], supplyEvents: [],
    ...overrides,
  }
}

// 1-6: exact Cleanliness Engine v2 trajectory acceptance values.
close(cleanlinessForTrajectory(trajectory(), '2026-08-02T10:00:00.000Z'), 50, 0.0001, '2-day midpoint')
close(cleanlinessForTrajectory(trajectory(), '2026-08-03T08:00:00.000Z'), 10, 0.0001, 'pre-due floor')
close(cleanlinessForTrajectory(trajectory(), '2026-08-03T10:00:00.000Z'), 10, 0.0001, 'due boundary')
close(cleanlinessForTrajectory(trajectory(), '2026-08-04T10:00:00.000Z'), 5, 0.0001, 'overdue half-cycle')
close(cleanlinessForTrajectory(trajectory(), '2026-08-05T10:00:00.000Z'), 0, 0.0001, 'overdue full-cycle')
close(cleanlinessForTrajectory(trajectory(), '2026-08-09T10:00:00.000Z'), 0, 0.0001, 'long overdue')

// 7: current 50, Refresh to 60 -> 60 and a new trajectory.
{
  const d = data({ routines: [routine({ refreshLevelPct: 60 })] })
  const effects = buildCompletionHealthEffects(d, d.tasks[0], '2026-08-02T10:00:00.000Z', [item1], memberId)
  assert(effects.length === 1, 'refresh raise should create one effect')
  close(effects[0].cleanlinessBeforePct, 50, 0.0001, 'refresh raise before')
  close(effects[0].cleanlinessAfterPct, 60, 0.0001, 'refresh raise after')
  assert(effects[0].healthRefreshApplied, 'refresh raise should apply')
  // Completion is early for the Aug 3 slot, therefore the next due boundary is Aug 5, not Aug 3.
  same(effects[0].healthDueAt, '2026-08-05T10:00:00.000Z', 'effective refresh uses next theoretical slot after associated slot')
  const after = applyCompletionHealthEffects(d, taskId, '2026-08-02T10:00:00.000Z', effects, memberId)
  close(cleanlinessForTrajectory(after.healthTrajectories[0], '2026-08-02T10:00:00.000Z'), 60, 0.0001, 'new trajectory starts at refresh level')
}

// 8: current 80, Refresh to 60 -> no trajectory mutation.
{
  const d = data({ routines: [routine({ refreshLevelPct: 60 })] })
  const at = '2026-08-01T19:36:00.000Z' // 20% of a 48h interval -> 80%
  const effects = buildCompletionHealthEffects(d, d.tasks[0], at, [item1], memberId)
  assert(effects.length === 1 && !effects[0].healthRefreshApplied, 'refresh below current must be a health no-op')
  close(effects[0].cleanlinessBeforePct, 80, 0.0001, 'refresh no-op before')
  close(effects[0].cleanlinessAfterPct, 80, 0.0001, 'refresh no-op after')
  const original = JSON.stringify(d.healthTrajectories)
  const after = applyCompletionHealthEffects(d, taskId, at, effects, memberId)
  same(JSON.stringify(after.healthTrajectories), original, 'refresh no-op must preserve trajectory timestamps')
  assert(after.completionSnapshots.length === 1 && !after.completionSnapshots[0].healthRefreshApplied, 'health no-op remains auditable')
}

// 9: Refresh to 100 from a low score -> full refresh.
{
  const d = data()
  const effects = buildCompletionHealthEffects(d, d.tasks[0], '2026-08-02T23:00:00.000Z', [item1], memberId)
  assert(effects[0].healthRefreshApplied, 'full refresh should apply')
  close(effects[0].cleanlinessAfterPct, 100, 0.0001, 'full refresh')
}

// 10: Skip changes workflow only, never trajectory.
{
  const d = data()
  const beforeHealth = JSON.stringify(d.healthTrajectories)
  const after = applyMutationLocally(d, { id: 'm1', workspaceId, kind: 'skip', taskId, expectedVersion: 1, eventId: 'e1', eventAt: '2026-08-02T12:00:00.000Z', actorMemberId: memberId })
  same(JSON.stringify(after.healthTrajectories), beforeHealth, 'skip must not alter cleanliness')
  assert(after.tasks[0].state === 'skipped', 'skip should terminalize exact occurrence')
}

// 11: One-off reschedule preserves scheduled slot and leaves health untouched.
{
  const d = data()
  const beforeHealth = JSON.stringify(d.healthTrajectories)
  const after = applyMutationLocally(d, { id: 'm2', workspaceId, kind: 'postpone', taskId, expectedVersion: 1, eventId: 'e2', eventAt: '2026-08-02T12:00:00.000Z', effectiveDueAt: '2026-08-04T15:00:00.000Z', actorMemberId: memberId })
  same(after.tasks[0].scheduledSlotAt, d.tasks[0].scheduledSlotAt, 'reschedule must preserve scheduled slot')
  same(after.tasks[0].effectiveDueAt, '2026-08-04T15:00:00.000Z', 'reschedule changes only execution time')
  same(JSON.stringify(after.healthTrajectories), beforeHealth, 'reschedule must not alter cleanliness')
}

// 12-13: Duplicate/deleted occurrences cannot influence canonical health.
{
  const base = data()
  const at = '2026-08-02T10:00:00.000Z'
  const score = itemChannelCleanliness(base, item1, 'regular', at).score
  const duplicate = task({ id: '00000000-0000-4000-8000-000000000052' })
  close(itemChannelCleanliness({ ...base, tasks: [...base.tasks, duplicate] }, item1, 'regular', at).score, score!, 0.0001, 'duplicate occurrence independence')
  close(itemChannelCleanliness({ ...base, tasks: [] }, item1, 'regular', at).score, score!, 0.0001, 'occurrence deletion independence')
}

// 14: Regular completion is isolated from deep. Existing documented behavior is
// intentionally retained in the opposite direction: Deep also refreshes Regular.
{
  const deepRoutine = routine({ id: routineDeepId, name: 'Deep scrub', cleanlinessChannel: 'deep', careLevel: 'deep', refreshLevelPct: 100 })
  const deepTrajectory = trajectory({ routineId: routineDeepId, cleanlinessChannel: 'deep' })
  const d = data({ routines: [routine(), deepRoutine], healthTrajectories: [trajectory(), deepTrajectory] })
  const regularEffects = buildCompletionHealthEffects(d, d.tasks[0], '2026-08-02T10:00:00.000Z', [item1], memberId)
  assert(regularEffects.length === 1 && regularEffects[0].cleanlinessChannel === 'regular', 'regular completion must not alter deep')
  const deepTask = task({ id: '00000000-0000-4000-8000-000000000053', routineId: routineDeepId, routineNameSnapshot: 'Deep scrub', cleanlinessChannel: 'deep', careLevel: 'deep' })
  const deepEffects = buildCompletionHealthEffects(d, deepTask, '2026-08-02T10:00:00.000Z', [item1], memberId)
  assert(deepEffects.some((effect) => effect.cleanlinessChannel === 'deep'), 'deep completion must refresh deep')
  assert(deepEffects.some((effect) => effect.cleanlinessChannel === 'regular'), 'documented deep completion carry-over must refresh regular')
}

// 15 + defensive multiple-routine rule: each item counts once; same-channel routines use the minimum.
{
  const r2 = routine({ id: '00000000-0000-4000-8000-000000000023', name: 'Second requirement' })
  const d = data({
    routines: [routine(), r2, routine({ id: '00000000-0000-4000-8000-000000000024', name: 'Hall', targetEntityIds: [item2] })],
    healthTrajectories: [
      trajectory({ healthAnchorPct: 80 }),
      trajectory({ routineId: r2.id, healthAnchorPct: 40 }),
      trajectory({ routineId: '00000000-0000-4000-8000-000000000024', itemId: item2, healthAnchorPct: 100 }),
    ],
  })
  close(itemChannelCleanliness(d, item1, 'regular', '2026-08-01T10:00:00.000Z').score, 40, 0.0001, 'item uses minimum active routine score')
  close(aggregateCleanliness(d, [item1, item2], 'regular', '2026-08-01T10:00:00.000Z').score, 70, 0.0001, 'home aggregate weights each item once')
  const withManyOccurrences = { ...d, tasks: [...d.tasks, ...Array.from({ length: 7 }, (_, i) => task({ id: `dupe-${i}` }))] }
  close(aggregateCleanliness(withManyOccurrences, [item1, item2], 'regular', '2026-08-01T10:00:00.000Z').score, 70, 0.0001, 'occurrence frequency cannot weight home aggregate')
}

// 16: paused routines are excluded from active score/aggregate.
{
  const d = data({ routines: [routine({ status: 'paused' })] })
  assert(itemChannelCleanliness(d, item1, 'regular', '2026-08-02T10:00:00.000Z').score === null, 'paused routine excluded from item health')
  assert(aggregateCleanliness(d, [item1], 'regular', '2026-08-02T10:00:00.000Z').score === null, 'paused routine excluded from aggregate')
}

// 17: calendar recurrence stays at the same local time across DST.
{
  const dst = routine({ recurrence: { kind: 'daily', interval: 1, anchorDate: '2026-03-28' }, timeOfDay: '10:00', routineTimezone: 'Europe/Rome' })
  const next = nextTheoreticalSlotAfter(dst, '2026-03-28T09:00:00.000Z', 'Europe/Rome')
  same(next, '2026-03-29T08:00:00.000Z', 'DST next slot must remain 10:00 Europe/Rome')
  same(followingTheoreticalSlot(dst, next!, 'Europe/Rome'), '2026-03-30T08:00:00.000Z', 'DST following slot remains local 10:00')
}

// 18: monthly recurrence uses actual month length, not a fixed 30-day interval.
{
  const monthly = routine({ recurrence: { kind: 'interval', unit: 'month', interval: 1, anchorDate: '2026-01-31' }, timeOfDay: '10:00' })
  same(nextTheoreticalSlotAfter(monthly, '2026-01-31T10:00:00.000Z', 'UTC'), '2026-02-28T10:00:00.000Z', 'January 31 -> February 28')
  same(nextTheoreticalSlotAfter(monthly, '2026-02-28T10:00:00.000Z', 'UTC'), '2026-03-31T10:00:00.000Z', 'February 28 -> March 31 from canonical anchor')
}

// Migration is deterministic/idempotent and never relies on materialized occurrence count.
{
  const legacy = data({ healthTrajectories: [], completionSnapshots: [], tasks: [task({ state: 'completed', completedAt: '2026-08-02T10:00:00.000Z', targets: [{ entityId: item1, entityName: 'Kitchen floor', entityTypeName: 'Surface', matchReasons: ['Selected'], completedAt: '2026-08-02T10:00:00.000Z' }] })] })
  const once = reconcileCleanlinessState(legacy)
  const twice = reconcileCleanlinessState(once)
  same(twice.healthTrajectories, once.healthTrajectories, 'cleanliness migration must be idempotent')
  same(twice.completionSnapshots, once.completionSnapshots, 'completion snapshot migration must be idempotent')
  assert(once.healthTrajectories.length === 1 && once.completionSnapshots.length === 1, 'legacy completion should seed one canonical trajectory/snapshot')
}

// Materialization remains idempotent for a slot; canonical IDs prevent duplicate rows.
{
  const d = data({ tasks: [], taskEvents: [], healthTrajectories: [], completionSnapshots: [] })
  const once = materializeTasks(d, 5)
  const twice = materializeTasks(once, 5)
  same(twice.tasks.map((row) => row.id), once.tasks.map((row) => row.id), 'task materialization must not recreate existing slots')
}


// Previous Today regressions stay protected at the occurrence service boundary.
{
  const base = data({ tasks: [task()], taskEvents: [] })
  const completedLocal = applyMutationLocally(base, {
    id: 'm3', workspaceId, kind: 'complete', taskId, expectedVersion: 1, eventId: 'e3',
    eventAt: '2026-08-02T10:00:00.000Z', actorMemberId: memberId,
    completionEffects: buildCompletionHealthEffects(base, base.tasks[0], '2026-08-02T10:00:00.000Z', [item1], memberId),
  })
  const completedMaterialized = materializeTasks(completedLocal, 5)
  const sameSlotAfterComplete = completedMaterialized.tasks.filter((row) => row.routineId === routineRegularId && row.scheduledSlotAt === '2026-08-03T10:00:00.000Z')
  assert(sameSlotAfterComplete.length === 1 && sameSlotAfterComplete[0].state === 'completed', 'completion must not recreate the same scheduled slot')

  const skippedLocal = applyMutationLocally(base, { id: 'm4', workspaceId, kind: 'skip', taskId, expectedVersion: 1, eventId: 'e4', eventAt: '2026-08-02T10:00:00.000Z', actorMemberId: memberId })
  const skippedMaterialized = materializeTasks(skippedLocal, 5)
  const sameSlotAfterSkip = skippedMaterialized.tasks.filter((row) => row.routineId === routineRegularId && row.scheduledSlotAt === '2026-08-03T10:00:00.000Z')
  assert(sameSlotAfterSkip.length === 1 && sameSlotAfterSkip[0].state === 'skipped', 'skip must not recreate the same scheduled slot')

  const moved = applyMutationLocally(base, { id: 'm5', workspaceId, kind: 'postpone', taskId, expectedVersion: 1, eventId: 'e5', eventAt: '2026-08-02T10:00:00.000Z', effectiveDueAt: '2026-08-04T10:00:00.000Z', actorMemberId: memberId })
  const movedMaterialized = materializeTasks(moved, 5)
  const originalSlotRows = movedMaterialized.tasks.filter((row) => row.routineId === routineRegularId && row.scheduledSlotAt === '2026-08-03T10:00:00.000Z')
  assert(originalSlotRows.length === 1 && originalSlotRows[0].effectiveDueAt === '2026-08-04T10:00:00.000Z', 'reschedule must remain one occurrence, not old + new rows')
}

// The routine's canonical timezone wins over a changed workspace/fallback timezone.
{
  const romeRoutine = routine({ recurrence: { kind: 'daily', interval: 1, anchorDate: '2026-03-28' }, timeOfDay: '10:00', routineTimezone: 'Europe/Rome' })
  same(nextTheoreticalSlotAfter(romeRoutine, '2026-03-28T09:00:00.000Z', 'America/New_York'), '2026-03-29T08:00:00.000Z', 'routine timezone must be canonical')
}


// Legacy v1.1 date/care fields normalize deterministically into the canonical model.
{
  const legacyRoutine = { ...routine() } as any
  delete legacyRoutine.cleanlinessChannel
  delete legacyRoutine.refreshLevelPct
  delete legacyRoutine.status
  delete legacyRoutine.routineTimezone
  const legacyTask = { ...task() } as any
  delete legacyTask.cleanlinessChannel
  delete legacyTask.scheduledSlotAt
  delete legacyTask.effectiveDueAt
  delete legacyTask.completedAt
  const legacyData = data({ routines: [legacyRoutine], tasks: [legacyTask], healthTrajectories: [], completionSnapshots: [] })
  const normalized = normalizeWorkspaceData(legacyData)
  same(normalized.routines[0].routineTimezone, 'UTC', 'legacy routine must capture the workspace timezone')
  same(normalized.routines[0].cleanlinessChannel, 'regular', 'legacy routine channel must normalize')
  close(normalized.routines[0].refreshLevelPct, 100, 0.0001, 'legacy refresh defaults to 100')
  same(normalized.tasks[0].scheduledSlotAt, legacyTask.originalDueAt, 'legacy original due becomes immutable scheduled slot')
  same(normalized.tasks[0].effectiveDueAt, legacyTask.dueAt, 'legacy due becomes effective execution time')
  const normalizedAgain = normalizeWorkspaceData(normalized)
  same(normalizedAgain.healthTrajectories, normalized.healthTrajectories, 'full data normalization must be idempotent')
}

console.log('v1.2.0 Phase 1 tests passed')
