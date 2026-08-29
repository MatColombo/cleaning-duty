import type { WorkspaceSummary } from '../types/domain'

const SELECTED_PREFIX = 'house-care-selected-workspace-v1:'
const CATALOG_PREFIX = 'house-care-workspace-catalog-v1:'

export function workspaceScope(userId: string, workspaceId: string): string {
  return `${userId}:${workspaceId}`
}

export function loadSelectedWorkspaceId(userId: string): string | null {
  try { return localStorage.getItem(`${SELECTED_PREFIX}${userId}`) } catch { return null }
}

export function saveSelectedWorkspaceId(userId: string, workspaceId: string): void {
  try { localStorage.setItem(`${SELECTED_PREFIX}${userId}`, workspaceId) } catch { /* ignore storage failures */ }
}

export function clearSelectedWorkspaceId(userId: string): void {
  try { localStorage.removeItem(`${SELECTED_PREFIX}${userId}`) } catch { /* ignore storage failures */ }
}

export function loadWorkspaceCatalog(userId: string): WorkspaceSummary[] {
  try {
    const raw = localStorage.getItem(`${CATALOG_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) as WorkspaceSummary[] : []
  } catch { return [] }
}

export function saveWorkspaceCatalog(userId: string, workspaces: WorkspaceSummary[]): void {
  try { localStorage.setItem(`${CATALOG_PREFIX}${userId}`, JSON.stringify(workspaces)) } catch { /* ignore storage failures */ }
}
