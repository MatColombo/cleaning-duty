import type { StockStatus, WorkspaceData } from '../types/domain'
import { normalizeWorkspaceData } from './dataMigrations'

const CACHE_PREFIX = 'house-care-cloud-cache-v1:'
const QUEUE_PREFIX = 'house-care-offline-queue-v1:'
const CONFLICT_PREFIX = 'house-care-sync-conflicts-v1:'

export type OfflineMutation =
  | {
      id: string
      workspaceId: string
      kind: 'complete' | 'skip' | 'postpone' | 'reassign' | 'complete_target'
      taskId: string
      expectedVersion: number
      eventId: string
      eventAt: string
      actorMemberId?: string
      dueAt?: string
      assigneeMemberId?: string
      clearAssignee?: boolean
      targetEntityId?: string
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
  kind: OfflineMutation['kind']
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
  localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify({ cachedAt: new Date().toISOString(), data }))
}

export function loadCloudCache(userId: string): WorkspaceData | null {
  const value = safeRead<{ cachedAt: string; data: WorkspaceData } | null>(`${CACHE_PREFIX}${userId}`, null)
  return value?.data ? normalizeWorkspaceData(value.data) : null
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
