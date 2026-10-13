/** Only a freshly authenticated, explicitly selected workspace may use this cache.
 * Caller must verify active membership (online catalog or unexpired offline
 * session plus an account-partitioned catalog) BEFORE calling this function.
 */
import type { WorkspaceData, WorkspaceSummary } from '../types/domain'
import { APP_VERSION } from '../app/version'
import { loadCloudCache } from './offline'
import { workspaceScope } from './workspaces'

export const SNAPSHOT_SCHEMA = 2
export const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export function readAuthorizedSnapshot(userId: string, workspaceId: string,
  catalog: WorkspaceSummary[], allowStaleOffline = false): WorkspaceData | null {
  if (!userId || !workspaceId || !catalog.some((x) => x.id === workspaceId && !x.archivedAt)) return null
  const scope = workspaceScope(userId, workspaceId)
  const cached = loadCloudCache(scope, { version: APP_VERSION, schema: SNAPSHOT_SCHEMA,
    maxAgeMs: SNAPSHOT_MAX_AGE_MS }) ?? (allowStaleOffline ? loadCloudCache(scope) : null)
  if (!cached || cached.workspace.id !== workspaceId) return null
  // Both the requested partition AND the payload must agree. Membership is
  // checked by the caller; never trust a cache entry as authorization evidence.
  return cached
}
