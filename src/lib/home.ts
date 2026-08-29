import type { CareLevel, Entity, StockStatus, TaskOccurrence, WorkspaceData } from '../types/domain'
import { resolvedRoutineTargets } from './targeting'

export function descendantEntityIds(data: WorkspaceData, parentId: string): string[] {
  const active = data.entities.filter((item) => !item.archivedAt)
  const walk = (id: string): string[] => active
    .filter((item) => item.parentId === id)
    .flatMap((item) => [item.id, ...walk(item.id)])
  return walk(parentId)
}

export function entitySubtreeIds(data: WorkspaceData, entityId: string): Set<string> {
  return new Set([entityId, ...descendantEntityIds(data, entityId)])
}

export function ancestorEntityIds(data: WorkspaceData, entityId: string): string[] {
  const byId = new Map(data.entities.map((item) => [item.id, item]))
  const result: string[] = []
  let cursor: Entity | undefined = byId.get(entityId)
  const seen = new Set<string>()
  while (cursor?.parentId && !seen.has(cursor.parentId)) {
    seen.add(cursor.parentId)
    result.push(cursor.parentId)
    cursor = byId.get(cursor.parentId)
  }
  return result
}

export function taskTouchesEntity(task: TaskOccurrence, entityIds: Set<string>): boolean {
  return task.targets.some((target) => entityIds.has(target.entityId))
}

export function scheduledTasksForEntity(data: WorkspaceData, entityId: string): TaskOccurrence[] {
  const ids = entitySubtreeIds(data, entityId)
  return data.tasks
    .filter((task) => task.state === 'scheduled' && taskTouchesEntity(task, ids))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
}

export type CareStatus = 'fresh' | 'good' | 'due_soon' | 'needs_attention' | 'overdue' | 'untracked'

export interface CareDimensionEstimate {
  tracked: boolean
  score: number | null
  status: CareStatus
  pendingCount: number
  overdueCount: number
}

export interface CareEstimate {
  /** Short-term care from routine cleaning. */
  routine: CareDimensionEstimate
  /** Long-term care. Undefined when no active deep-clean routine targets this entity/subtree. */
  deep?: CareDimensionEstimate
  /** Derived condition: routine care reduced by accumulated deep-care deterioration. */
  overallScore: number | null
  /** Compatibility/summary fields represent effective overall care. */
  score: number | null
  status: CareStatus
  pendingCount: number
  overdueCount: number
}

function scoreForDueAt(dueAt: string, nowMs: number, sensitivity: WorkspaceData['workspace']['careSensitivity']): number {
  const deltaHours = (new Date(dueAt).getTime() - nowMs) / 3_600_000
  const base = deltaHours < 0 ? Math.max(8, 28 + deltaHours / 24 * 4)
    : deltaHours <= 12 ? 52
      : deltaHours <= 24 ? 58
        : deltaHours <= 72 ? 70
          : deltaHours <= 7 * 24 ? 82
            : 92
  const adjustment = sensitivity === 'strict' ? -8 : sensitivity === 'relaxed' ? 8 : 0
  return Math.max(5, Math.min(98, base + adjustment))
}

function statusForScore(score: number | null): CareStatus {
  return score == null ? 'untracked'
    : score >= 90 ? 'fresh'
      : score >= 75 ? 'good'
        : score >= 55 ? 'due_soon'
          : score >= 30 ? 'needs_attention'
            : 'overdue'
}

function activeCareLevelTargets(data: WorkspaceData, level: CareLevel, entityIds: Set<string>): boolean {
  return data.routines.some((routine) => {
    if (routine.archivedAt || (routine.careLevel ?? 'routine') !== level) return false
    return resolvedRoutineTargets(data, routine).some(({ entity }) => entityIds.has(entity.id))
  })
}

function completionTime(data: WorkspaceData, taskId: string): number | null {
  const completed = data.taskEvents
    .filter((event) => event.taskId === taskId && event.type === 'COMPLETED')
    .map((event) => new Date(event.at).getTime())
    .filter(Number.isFinite)
  return completed.length ? Math.max(...completed) : null
}

function scopeCompletionTime(data: WorkspaceData, task: TaskOccurrence, entityIds: Set<string>): number | null {
  const scopedTargets = task.targets.filter((target) => entityIds.has(target.entityId))
  if (scopedTargets.length && scopedTargets.every((target) => Boolean(target.completedAt))) {
    const times = scopedTargets.map((target) => new Date(target.completedAt!).getTime()).filter(Number.isFinite)
    if (times.length) return Math.max(...times)
  }
  return task.state === 'completed' ? completionTime(data, task.id) : null
}

function dimensionEstimate(
  data: WorkspaceData,
  entityIds: Set<string>,
  level: CareLevel,
  tracked: boolean,
  nowMs: number,
  deepCompletionMayReset = false,
): CareDimensionEstimate {
  if (!tracked) return { tracked: false, score: null, status: 'untracked', pendingCount: 0, overdueCount: 0 }

  const relevant = data.tasks.filter((task) => (task.careLevel ?? 'routine') === level && taskTouchesEntity(task, entityIds) && task.state !== 'cancelled')
  let pending = relevant.filter((task) => task.state === 'scheduled' && scopeCompletionTime(data, task, entityIds) == null)
  const completions = relevant.map((task) => scopeCompletionTime(data, task, entityIds)).filter((value): value is number => value != null)

  // A deep clean also refreshes routine care. It does not mutate/complete the
  // historical routine tasks; it simply means older routine due dates no
  // longer describe the physical cleanliness after that deeper work.
  if (level === 'routine' && deepCompletionMayReset) {
    const deepCompletionTimes = data.tasks
      .filter((task) => (task.careLevel ?? 'routine') === 'deep' && taskTouchesEntity(task, entityIds) && task.state !== 'cancelled')
      .map((task) => scopeCompletionTime(data, task, entityIds))
      .filter((value): value is number => value != null)
    const latestDeep = deepCompletionTimes.length ? Math.max(...deepCompletionTimes) : null
    if (latestDeep != null) {
      pending = pending.filter((task) => new Date(task.dueAt).getTime() > latestDeep)
      completions.push(latestDeep)
    }
  }

  const overdueCount = pending.filter((task) => new Date(task.dueAt).getTime() < nowMs).length
  let score: number | null
  if (pending.length) {
    const scores = pending.map((task) => scoreForDueAt(task.dueAt, nowMs, data.workspace.careSensitivity ?? 'balanced'))
    const minimum = Math.min(...scores)
    const average = scores.reduce((sum, value) => sum + value, 0) / scores.length
    score = Math.round(minimum * 0.7 + average * 0.3)
  } else if (completions.length) {
    score = 96
  } else {
    // An active configured routine is tracked even before its first concrete
    // occurrence reaches the local materialization window.
    score = 92
  }

  return { tracked: true, score, status: statusForScore(score), pendingCount: pending.length, overdueCount }
}

export function careEstimateForEntity(data: WorkspaceData, entityId: string, now = new Date()): CareEstimate {
  const ids = entitySubtreeIds(data, entityId)
  const routineTracked = activeCareLevelTargets(data, 'routine', ids)
  const deepTracked = activeCareLevelTargets(data, 'deep', ids)
  const nowMs = now.getTime()
  const routine = dimensionEstimate(data, ids, 'routine', routineTracked, nowMs, deepTracked)
  const deep = deepTracked ? dimensionEstimate(data, ids, 'deep', true, nowMs) : undefined

  let overallScore: number | null = routine.score
  if (deep?.score != null && routine.score != null) {
    overallScore = Math.round(routine.score * (0.5 + 0.5 * (deep.score / 100)))
  } else if (deep?.score != null && routine.score == null) {
    overallScore = deep.score
  }

  return {
    routine,
    deep,
    overallScore,
    score: overallScore,
    status: statusForScore(overallScore),
    pendingCount: routine.pendingCount + (deep?.pendingCount ?? 0),
    overdueCount: routine.overdueCount + (deep?.overdueCount ?? 0),
  }
}

const stockSeverity: Record<StockStatus, number> = {
  available: 0,
  low: 1,
  reserve_only: 2,
  out_of_stock: 3,
}

export function supplyAlertsForEntity(data: WorkspaceData, entityId: string) {
  const tasks = scheduledTasksForEntity(data, entityId)
  const ids = new Set(tasks.flatMap((task) => task.supplies.map((supply) => supply.supplyId)))
  return data.supplies
    .filter((supply) => !supply.archivedAt && ids.has(supply.id) && supply.status !== 'available')
    .sort((a, b) => stockSeverity[b.status] - stockSeverity[a.status] || a.name.localeCompare(b.name))
}

export function activeLayoutEntityIds(data: WorkspaceData, sceneId: string) {
  return new Set(data.layoutElements.filter((item) => item.sceneId === sceneId && !item.archivedAt).map((item) => item.entityId))
}
