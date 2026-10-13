import type { CompletionHealthEffect, HealthTrajectory, StockStatus, TaskAssignmentScope, TaskEvent, TaskOccurrence, WorkspaceData } from '../types/domain'
import { normalizeWorkspaceData } from './dataMigrations'
import { APP_VERSION } from '../app/version'

const CACHE_PREFIX = 'house-care-cloud-cache-v1:'
const CACHE_SCHEMA = 2
const QUEUE_PREFIX = 'house-care-offline-queue-v1:'
const CONFLICT_PREFIX = 'house-care-sync-conflicts-v1:'

export type OfflineMutation =
  | {
      id: string
      workspaceId: string
      kind: 'complete' | 'extra_postpone' | 'skip' | 'postpone' | 'reassign' | 'complete_target' | 'undo' | 'reopen_today'
      taskId: string
      expectedVersion: number
      eventId: string
      eventAt: string
      actorMemberId?: string
      dueAt?: string
      effectiveDueAt?: string
      completionEffects?: CompletionHealthEffect[]
      /** Only for an integrated primary Complete, persist exactly once with the parent. */
      extraCompletions?: { routineId: string; eventId: string; effects: CompletionHealthEffect[] }[]
      trajectoryBefore?: HealthTrajectory[]
      /** Immutable optimistic successor snapshot, sent atomically with terminal RPC. */
      afterCompletionSuccessor?: TaskOccurrence
      /** Deterministic creation/assignment audit events committed with successor. */
      afterCompletionEvents?: TaskEvent[]
      /** Durable marker for Undo/Restore, even when no successor is safe to cancel. */
      afterCompletion?: boolean
      extraRoutineId?: string
      /** Choose V2 atomic RPC only after cloud capability activation. */
      integrated?: boolean
      assigneeMemberId?: string
      clearAssignee?: boolean
      assignmentScope?: TaskAssignmentScope
      targetEntityId?: string
      sourceEventId?: string
    }
  | {
      id: string
      workspaceId: string
      kind: 'supply_status'
      supplyId: string
      expectedVersion: number
      eventId: string
      eventAt: string
      actorMemberId?: string
      status: StockStatus
      sourceTaskId?: string
    }

export interface SyncConflict {
  id: string
  mutationId: string
  kind: OfflineMutation['kind'] | 'configuration' | 'visual' | 'scene'
  state?: 'conflict' | 'failed'
  itemId: string
  at: string
  message: string
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

export function saveCloudCache(userId: string, data: WorkspaceData): void {
  localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify({ cachedAt: new Date().toISOString(),
    schema: CACHE_SCHEMA, appVersion: APP_VERSION, scope: userId, data }))
}

export function loadCloudCache(userId: string, requirements?: { version?: string; schema?: number; maxAgeMs?: number }): WorkspaceData | null {
  const value = safeRead<{ cachedAt: string; data: WorkspaceData; schema?: number; appVersion?: string; scope?: string } | null>(`${CACHE_PREFIX}${userId}`, null)
  if (!value?.data || value.scope && value.scope !== userId) return null
  if (requirements) {
    if (requirements.schema !== undefined && value.schema !== requirements.schema) return null
    if (requirements.version !== undefined && value.appVersion !== requirements.version) return null
    const when = Date.parse(value.cachedAt)
    if (!Number.isFinite(when) || when > Date.now() + 60000 || (requirements.maxAgeMs !== undefined && Date.now() - when > requirements.maxAgeMs)) return null
  }
  // Old unversioned snapshots may still be read only by the guarded offline
  // recovery path; never use them for accelerated warm-start hydration.
  return normalizeWorkspaceData(value.data)
}

export function clearUserCloudCaches(userId: string): void {
  if (!userId) return
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index)
    if (key && key.startsWith(`${CACHE_PREFIX}${userId}:`)) localStorage.removeItem(key)
  }
  localStorage.removeItem(`${CACHE_PREFIX}${userId}`)
}

export function clearCloudCache(userId: string): void {
  localStorage.removeItem(`${CACHE_PREFIX}${userId}`)
}

export function loadOfflineQueue(userId: string): OfflineMutation[] {
  return safeRead<OfflineMutation[]>(`${QUEUE_PREFIX}${userId}`, [])
}

export function saveOfflineQueue(userId: string, mutations: OfflineMutation[]): void {
  localStorage.setItem(`${QUEUE_PREFIX}${userId}`, JSON.stringify(mutations))
}

export function enqueueOfflineMutation(userId: string, mutation: OfflineMutation): OfflineMutation[] {
  const next = [...loadOfflineQueue(userId), mutation]
  saveOfflineQueue(userId, next)
  return next
}

export function loadSyncConflicts(userId: string): SyncConflict[] {
  return safeRead<SyncConflict[]>(`${CONFLICT_PREFIX}${userId}`, [])
}

export function saveSyncConflicts(userId: string, conflicts: SyncConflict[]): void {
  localStorage.setItem(`${CONFLICT_PREFIX}${userId}`, JSON.stringify(conflicts.slice(-30)))
}

export function clearSyncConflicts(userId: string): void {
  localStorage.removeItem(`${CONFLICT_PREFIX}${userId}`)
}

/**
 * v1.0 stored cloud runtime state per user. v1.0.1 scopes it per user+workspace.
 * Migrate the old single-workspace keys once so an upgrade cannot strand
 * pending offline actions from the household that was open before updating.
 */
export function migrateLegacyOfflineStorage(userId: string, workspaceId: string): void {
  const scope = `${userId}:${workspaceId}`
  try {
    const oldCacheKey = `${CACHE_PREFIX}${userId}`
    const newCacheKey = `${CACHE_PREFIX}${scope}`
    if (!localStorage.getItem(newCacheKey)) {
      const raw = localStorage.getItem(oldCacheKey)
      if (raw) {
        const parsed = JSON.parse(raw) as { data?: WorkspaceData }
        if (parsed.data?.workspace?.id === workspaceId) localStorage.setItem(newCacheKey, raw)
      }
    }

    const oldQueueKey = `${QUEUE_PREFIX}${userId}`
    const newQueueKey = `${QUEUE_PREFIX}${scope}`
    if (!localStorage.getItem(newQueueKey)) {
      const legacyQueue = safeRead<OfflineMutation[]>(oldQueueKey, []).filter((item) => item.workspaceId === workspaceId)
      if (legacyQueue.length) localStorage.setItem(newQueueKey, JSON.stringify(legacyQueue))
    }

    const oldConflictKey = `${CONFLICT_PREFIX}${userId}`
    const newConflictKey = `${CONFLICT_PREFIX}${scope}`
    if (!localStorage.getItem(newConflictKey)) {
      const legacyConflicts = safeRead<SyncConflict[]>(oldConflictKey, [])
      if (legacyConflicts.length) localStorage.setItem(newConflictKey, JSON.stringify(legacyConflicts.slice(-30)))
    }

    localStorage.removeItem(oldCacheKey)
    localStorage.removeItem(oldQueueKey)
    localStorage.removeItem(oldConflictKey)
  } catch {
    // Storage migration is best-effort; online cloud state remains canonical.
  }
}
