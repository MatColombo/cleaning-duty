declare const require: (name: string) => any
import { buildOverviewGroups, canonicalTaskState } from '../src/lib/overview'
import { timelineDays, resolveTimelineDay, taskDeepLinkDestination } from '../src/lib/timelineNavigation'
import { groupLinkedTaskOccurrences } from '../src/lib/presentation'
import { applyMutationLocally } from '../src/lib/mutations'
import { translate } from '../src/lib/translations'
import type { TaskEvent, TaskOccurrence, WorkspaceData } from '../src/types/domain'

const { readFileSync } = require('node:fs')
const assert = require('node:assert/strict')
const data: WorkspaceData = JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json', 'utf8')).data
const now = new Date('2026-09-16T12:00:00.000Z') // Europe/Rome: 14:00, not the UTC date boundary.
const tid = (end: string) => `50000000-0000-4000-8000-00000000${end.padStart(4, '0')}`
const base = data.tasks[0]
assert.ok(base && data.routines.some((routine) => routine.id === base.routineId))
function task(id: string, slot: string, due = slot, state: TaskOccurrence['state'] = 'scheduled'): TaskOccurrence {
  return { ...base, id: tid(id), scheduledSlotAt: slot, originalDueAt: slot, dueAt: slot, effectiveDueAt: due,
    state, completedAt: state === 'completed' ? '2026-09-16T08:10:00.000Z' : undefined,
    targets: base.targets.map((target) => ({ ...target, completedAt: undefined })), parentOccurrenceId: undefined, version: 1 }
}
const overdue = task('1', '2026-09-15T06:00:00.000Z')
const dueNow = task('2', '2026-09-16T08:00:00.000Z')
const later = task('3', '2026-09-16T20:00:00.000Z')
const completed = task('4', '2026-09-16T05:00:00.000Z', undefined, 'completed')
const skipped = task('5', '2026-09-16T06:00:00.000Z', undefined, 'skipped')
const postponed = task('6', '2026-09-16T07:00:00.000Z', '2026-09-17T08:00:00.000Z')
const future = task('7', '2026-09-17T10:00:00.000Z')
const farFuture = task('8', '2026-10-10T10:00:00.000Z')
const reopened = task('9', '2026-09-16T09:00:00.000Z')
const staleCompleted = task('10', '2026-09-16T09:15:00.000Z')
const cancelled = task('11', '2026-09-17T09:00:00.000Z', undefined, 'cancelled')
const olderCompleted = task('12', '2026-09-14T09:00:00.000Z', undefined, 'completed')
olderCompleted.completedAt = '2026-09-14T12:00:00.000Z'
const child = { ...task('13', '2026-09-17T11:00:00.000Z'), parentOccurrenceId: future.id }
const event = (forTask: TaskOccurrence, type: TaskEvent['type'], at: string): TaskEvent => ({
  id: `${type}-${forTask.id}`, workspaceId: data.workspace.id, taskId: forTask.id, type, at, metadata: {},
})
const events = [
  event(completed, 'COMPLETED', '2026-09-16T08:10:00.000Z'),
  event(skipped, 'SKIPPED', '2026-09-16T09:00:00.000Z'),
  event(postponed, 'POSTPONED', '2026-09-16T09:30:00.000Z'),
  event(reopened, 'SKIPPED', '2026-09-16T08:50:00.000Z'),
  event(reopened, 'REOPENED', '2026-09-16T10:15:00.000Z'),
  event(staleCompleted, 'COMPLETED', '2026-09-16T11:00:00.000Z'),
  event(olderCompleted, 'COMPLETED', '2026-09-14T12:00:00.000Z'),
]
const household: WorkspaceData = { ...data,
  tasks: [overdue, dueNow, later, completed, skipped, postponed, future, farFuture, reopened, staleCompleted, cancelled, olderCompleted, child],
  taskEvents: events,
}
// One canonical projection continues to feed both Overview and Timeline.
const groups = buildOverviewGroups(household, { now, scope: 'household', criticalCount: 3, criticalThreshold: 20 })
assert.deepEqual(groups.overdue.map((t) => t.id), [overdue.id])
assert.deepEqual(groups.dueNow.map((t) => t.id), [dueNow.id, reopened.id])
assert.deepEqual(groups.laterToday.map((t) => t.id), [later.id])
assert.deepEqual(new Set(groups.finished.map((t) => t.id)), new Set([completed.id, skipped.id, postponed.id, staleCompleted.id]))
assert.deepEqual(new Set(groups.upcoming.map((t) => t.id)), new Set([future.id, child.id]))
assert.ok(!groups.upcoming.some((t) => t.id === postponed.id), 'Postponed today must not duplicate in Upcoming')
assert.ok(!groups.finished.some((t) => t.id === reopened.id), 'Reopened must no longer be handled')
assert.ok(!groups.finished.some((t) => t.id === olderCompleted.id), 'Finished must mean handled today')
// Europe/Rome: 22:30Z on September 15 is 00:30 on September 16 locally.
const midnightCompletion = task('14', '2026-09-15T20:30:00.000Z', undefined, 'completed')
midnightCompletion.completedAt = '2026-09-15T22:30:00.000Z'
const midnightGroups = buildOverviewGroups({ ...household, tasks: [midnightCompletion], taskEvents: [event(midnightCompletion, 'COMPLETED', midnightCompletion.completedAt)] }, { now, scope: 'household' })
assert.ok(midnightGroups.finished.some((t) => t.id === midnightCompletion.id), 'Today grouping must honor the household timezone over UTC day')
assert.equal(canonicalTaskState(household, staleCompleted).state, 'completed', 'Lifecycle event supersedes stale row')
assert.ok(groupLinkedTaskOccurrences(groups.upcoming).some(({ task, linkedActivities }) => task.id === future.id && linkedActivities.some((childTask) => childTask.id === child.id)), 'Linked child groups under parent when both are visible')

// Seven household-local days, including DST boundaries, with requested day priority.
const days = timelineDays(household.workspace.timezone, now)
assert.deepEqual(days, ['2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'])
assert.equal(resolveTimelineDay(days, '2026-09-20', ['2026-09-17']), '2026-09-20')
assert.equal(resolveTimelineDay(days, '2026-10-10', ['2026-09-17']), '2026-09-17')
assert.equal(resolveTimelineDay(days, null, []), '2026-09-17')
assert.deepEqual(timelineDays('Europe/Rome', new Date('2026-10-24T12:00:00.000Z')).slice(0, 3), ['2026-10-25', '2026-10-26', '2026-10-27'])

// A notification can resolve exact identities, even when not in the seven-day rail.
const href = (id: string) => taskDeepLinkDestination(household, id, now)
for (const item of [overdue, dueNow, later, reopened]) {
  assert.deepEqual(href(item.id), { destination: 'overview', path: `/?task=${item.id}` })
}
for (const item of [completed, skipped, staleCompleted, olderCompleted]) {
  assert.deepEqual(href(item.id), { destination: 'timeline', path: `/timeline?task=${item.id}` })
}
assert.deepEqual(href(postponed.id), { destination: 'timeline', path: `/timeline?task=${postponed.id}&day=2026-09-17` })
assert.deepEqual(href(future.id), { destination: 'timeline', path: `/timeline?task=${future.id}&day=2026-09-17` })
assert.deepEqual(href(child.id), { destination: 'timeline', path: `/timeline?task=${child.id}&day=2026-09-17` })
assert.deepEqual(href(farFuture.id), { destination: 'timeline', path: `/timeline?task=${farFuture.id}` })
assert.equal(href(cancelled.id), null)
assert.equal(href('missing-occurrence'), null)
const supersedingDuplicate = { ...dueNow, id: tid('30'), version: dueNow.version + 3 }
assert.equal(taskDeepLinkDestination({ ...household, tasks: [...household.tasks, supersedingDuplicate] }, dueNow.id, now), null,
  'A superseded duplicate slot must not be revived through an obsolete deep link')

// Restore to today calls the existing mutation, preserving the occurrence identity.
const restored = applyMutationLocally(household, {
  id: 'restore-timeline-test', workspaceId: household.workspace.id, kind: 'reopen_today',
  taskId: skipped.id, expectedVersion: skipped.version, sourceEventId: events[1].id,
  eventId: 'restore-event-1', eventAt: '2026-09-16T12:20:00.000Z',
})
assert.equal(restored.tasks.length, household.tasks.length, 'Restore must not create another task')
assert.equal(restored.tasks.find((t) => t.id === skipped.id)?.state, 'scheduled')
assert.equal(restored.tasks.find((t) => t.id === skipped.id)?.scheduledSlotAt, skipped.scheduledSlotAt)
const after = buildOverviewGroups(restored, { now: new Date('2026-09-16T12:21:00.000Z'), scope: 'household' })
assert.ok(after.dueNow.some((t) => t.id === skipped.id), 'Restored task must return to Overview')
assert.ok(!after.finished.some((t) => t.id === skipped.id), 'Restored task must leave Timeline finished')

for (const locale of ['en', 'it'] as const) {
  for (const key of ['timeline','timelineHint','taskUnavailable','taskUnavailableHint'] as const) {
    assert.ok(translate(locale, key).length > 0, `${locale}:${key} missing`)
  }
}

// Wiring checks while the Phase 0 dependency blocker prevents full React E2E.
const app = readFileSync('src/App.tsx', 'utf8')
const overviewPage = readFileSync('src/pages/OverviewPage.tsx', 'utf8')
const timelinePage = readFileSync('src/pages/TimelinePage.tsx', 'utf8')
const operational = readFileSync('src/pages/OperationalTasksPage.tsx', 'utf8')
const resolver = readFileSync('src/pages/TaskRouteResolver.tsx', 'utf8')
assert.ok(app.includes('path="timeline" element={<TimelinePage />}') && app.includes('path="task/:taskId" element={<TaskRouteResolver />}'))
assert.ok(overviewPage.includes('view="overview"') && timelinePage.includes('view="timeline"'))
assert.ok(operational.includes("view === 'timeline' && <>") && operational.includes("view === 'overview' && <>"))
assert.ok(operational.includes('buildOverviewGroups(') && !timelinePage.includes('data.tasks'))
assert.ok(operational.includes('restoreTaskToToday(') && operational.includes('undoTaskAction('))
assert.ok(operational.includes('onClick={() => chooseUpcomingDay(day)}') && operational.includes('aria-pressed={selectedDay === day}'))
assert.ok(operational.includes("params.get('task')") && operational.includes('TaskSheet task={selected}'))
assert.ok(resolver.includes('taskDeepLinkDestination(data, taskId') && resolver.includes('<Navigate to={destination.path} replace />'))
console.log('V2 Phase 7 Timeline projection, day browsing, restore, route/detail and wiring tests passed')
