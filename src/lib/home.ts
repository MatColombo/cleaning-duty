import type { Entity, StockStatus, TaskOccurrence, WorkspaceData } from '../types/domain'

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

export interface CareEstimate {
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

export function careEstimateForEntity(data: WorkspaceData, entityId: string, now = new Date()): CareEstimate {
  const ids = entitySubtreeIds(data, entityId)
  const relevant = data.tasks.filter((task) => taskTouchesEntity(task, ids) && task.state !== 'cancelled')
  const pending = relevant.filter((task) => task.state === 'scheduled')
  const nowMs = now.getTime()
  const overdueCount = pending.filter((task) => new Date(task.dueAt).getTime() < nowMs).length

  let score: number | null = null
  if (pending.length) {
    const scores = pending.map((task) => scoreForDueAt(task.dueAt, nowMs, data.workspace.careSensitivity ?? 'balanced'))
    // The task needing the most attention dominates, while multiple due tasks
    // pull the aggregate down slightly without pretending to measure dirt.
    const minimum = Math.min(...scores)
    const average = scores.reduce((sum, value) => sum + value, 0) / scores.length
    score = Math.round(minimum * 0.7 + average * 0.3)
  } else if (relevant.some((task) => task.state === 'completed')) {
    score = 96
  }

  const status: CareStatus = score == null ? 'untracked'
    : score >= 90 ? 'fresh'
      : score >= 75 ? 'good'
        : score >= 55 ? 'due_soon'
          : score >= 30 ? 'needs_attention'
            : 'overdue'

  return { score, status, pendingCount: pending.length, overdueCount }
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
