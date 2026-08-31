import type { SessionUser, WorkspaceData } from '../types/domain'
import { normalizeWorkspaceData } from './dataMigrations'
import { newId, nowIso } from './id'

const DATA_KEY = 'house-care-workspace-v1'
const USER_ID = 'local-user'

export const localUser: SessionUser = { id: USER_ID, displayName: 'Local user' }

export function loadLocalData(): WorkspaceData | null {
  const raw = localStorage.getItem(DATA_KEY)
  if (!raw) return null
  try { return normalizeWorkspaceData(JSON.parse(raw) as WorkspaceData) } catch { return null }
}

export function saveLocalData(data: WorkspaceData): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
}

export function clearLocalData(): void {
  localStorage.removeItem(DATA_KEY)
}

export function createLocalWorkspace(name: string, ownerName: string, timezone: string): WorkspaceData {
  const workspaceId = newId()
  const memberId = newId()
  const createdAt = nowIso()
  return {
    workspace: { id: workspaceId, name, timezone, careSensitivity: 'balanced', ownerUserId: USER_ID, createdAt },
    members: [{ id: memberId, workspaceId, userId: USER_ID, displayName: ownerName, role: 'owner', status: 'active', labels: [], createdAt }],
    fieldDefinitions: [], entityTypes: [], entities: [], layoutScenes: [], layoutElements: [], entityRelations: [], actions: [], routines: [], tasks: [], taskEvents: [], healthTrajectories: [], completionSnapshots: [], supplies: [], supplyEvents: [],
  }
}
