import type { Entity, StockStatus, TaskOccurrence, WorkspaceData } from '../types/domain'
import { aggregateCleanliness } from './cleanliness'

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
    .sort((a, b) => new Date(a.effectiveDueAt ?? a.dueAt).getTime() - new Date(b.effectiveDueAt ?? b.dueAt).getTime())
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
  /** v1.2 regular-cleanliness channel. Kept under `routine` until Phase 2 renames UI copy. */
  routine: CareDimensionEstimate
  deep?: CareDimensionEstimate
  /** Deprecated compatibility summary. v1.2 does not invent a combined health metric. */
  overallScore: number | null
  score: number | null
  status: CareStatus
  pendingCount: number
  overdueCount: number
}

function statusForScore(score: number | null): CareStatus {
  return score == null ? 'untracked'
    : score >= 90 ? 'fresh'
      : score >= 60 ? 'good'
        : score >= 20 ? 'due_soon'
          : score >= 10 ? 'needs_attention'
            : 'overdue'
}

function workflowCounts(data: WorkspaceData, entityIds: Set<string>, channel: 'regular' | 'deep', nowMs: number) {
  const relevant = data.tasks.filter((task) => {
    const taskChannel = task.cleanlinessChannel ?? (task.careLevel === 'deep' ? 'deep' : 'regular')
    return taskChannel === channel && task.state === 'scheduled' && taskTouchesEntity(task, entityIds)
  })
  return {
    pendingCount: relevant.length,
    overdueCount: relevant.filter((task) => new Date(task.effectiveDueAt ?? task.dueAt).getTime() < nowMs).length,
  }
}

function dimensionEstimate(data: WorkspaceData, ids: Set<string>, channel: 'regular' | 'deep', now: Date): CareDimensionEstimate {
  const aggregate = aggregateCleanliness(data, ids, channel, now)
  if (aggregate.score == null) return { tracked: false, score: null, status: 'untracked', pendingCount: 0, overdueCount: 0 }
  const counts = workflowCounts(data, ids, channel, now.getTime())
  return { tracked: true, score: aggregate.score, status: statusForScore(aggregate.score), ...counts }
}

export function careEstimateForEntity(data: WorkspaceData, entityId: string, now = new Date()): CareEstimate {
  const ids = entitySubtreeIds(data, entityId)
  const regular = dimensionEstimate(data, ids, 'regular', now)
  const deepDimension = dimensionEstimate(data, ids, 'deep', now)
  const deep = deepDimension.tracked ? deepDimension : undefined
  // v1.2 explicitly exposes channel aggregates rather than an arbitrary blended
  // home score. Compatibility fields follow regular when tracked, else deep.
  const summaryScore = regular.score ?? deep?.score ?? null
  return {
    routine: regular,
    deep,
    overallScore: summaryScore,
    score: summaryScore,
    status: statusForScore(summaryScore),
    pendingCount: regular.pendingCount + (deep?.pendingCount ?? 0),
    overdueCount: regular.overdueCount + (deep?.overdueCount ?? 0),
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

export interface HomeCleanlinessSummary {
  regular: number | null
  deep: number | null
}

/** Equal-per-item home aggregates from Cleanliness Engine v2. */
export function homeCleanlinessSummary(data: WorkspaceData, now = new Date()): HomeCleanlinessSummary {
  const activeEntityIds = data.entities.filter((entity) => !entity.archivedAt).map((entity) => entity.id)
  return {
    regular: aggregateCleanliness(data, activeEntityIds, 'regular', now).score,
    deep: aggregateCleanliness(data, activeEntityIds, 'deep', now).score,
  }
}
