import type { TaskOccurrence, WorkspaceData } from '../types/domain'
import { addDays, localDateInZone } from './date'
import { dedupeOccurrences } from './overview'
import { entitySubtreeIds, taskTouchesEntity } from './home'
import { isRoutineActive } from './scheduler'

export type RoomStatus = 'none' | 'due_today' | 'overdue' | 'both'

export interface RoomWorkflow {
  overdue: TaskOccurrence[]
  dueToday: TaskOccurrence[]
  upcoming: TaskOccurrence[]
  queue: TaskOccurrence[]
  status: RoomStatus
}

function effectiveDue(task: TaskOccurrence) {
  return task.effectiveDueAt ?? task.dueAt
}

function taskSort(a: TaskOccurrence, b: TaskOccurrence) {
  return new Date(effectiveDue(a)).getTime() - new Date(effectiveDue(b)).getTime()
}

/**
 * Canonical actionable work touching a room/entity subtree.
 *
 * This intentionally reuses Overview's occurrence de-duplication and the
 * routine lifecycle state. Room mode is another projection of the same task
 * records, never a room-specific shadow task list.
 */
export function actionableTasksForRoom(data: WorkspaceData, roomEntityId: string): TaskOccurrence[] {
  const ids = entitySubtreeIds(data, roomEntityId)
  const routineById = new Map(data.routines.map((routine) => [routine.id, routine]))
  return dedupeOccurrences(data)
    .filter((task) => task.state === 'scheduled')
    .filter((task) => {
      const routine = routineById.get(task.routineId)
      return routine ? isRoutineActive(routine) : true
    })
    .filter((task) => taskTouchesEntity(task, ids))
    .sort(taskSort)
}

export function buildRoomWorkflow(data: WorkspaceData, roomEntityId: string, now = new Date()): RoomWorkflow {
  const timezone = data.workspace.timezone
  const today = localDateInZone(timezone, now)
  const tomorrow = addDays(today, 1)
  const upcomingEnd = addDays(today, 7)
  const tasks = actionableTasksForRoom(data, roomEntityId)

  const overdue = tasks.filter((task) => localDateInZone(timezone, new Date(effectiveDue(task))) < today)
  const dueToday = tasks.filter((task) => localDateInZone(timezone, new Date(effectiveDue(task))) === today)
  const upcoming = tasks.filter((task) => {
    const day = localDateInZone(timezone, new Date(effectiveDue(task)))
    return day >= tomorrow && day <= upcomingEnd
  })

  const hasOverdue = overdue.length > 0
  const hasDueToday = dueToday.length > 0
  const status: RoomStatus = hasOverdue && hasDueToday ? 'both' : hasOverdue ? 'overdue' : hasDueToday ? 'due_today' : 'none'

  // Oldest overdue first, then today's work in chronological order. Past-time
  // work from today remains in the due-today group, matching Overview's
  // overdue-vs-today semantics.
  return {
    overdue: [...overdue].sort(taskSort),
    dueToday: [...dueToday].sort(taskSort),
    upcoming: [...upcoming].sort(taskSort),
    queue: [...overdue].sort(taskSort).concat([...dueToday].sort(taskSort)),
    status,
  }
}

export function roomStatusMap(data: WorkspaceData, roomEntityIds: Iterable<string>, now = new Date()): Map<string, RoomStatus> {
  return new Map([...new Set(roomEntityIds)].map((entityId) => [entityId, buildRoomWorkflow(data, entityId, now).status]))
}
