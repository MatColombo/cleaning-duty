import type { WorkspaceData } from '../../types/domain'

/** Bridge /home?item=... to a real semantic entity, optionally revealing its layout placement. */
export function resolveHomeItemSelection(data: Pick<WorkspaceData, 'entities' | 'layoutElements'>, itemId: string | null) {
  if (!itemId || !data.entities.some((entity) => entity.id === itemId && !entity.archivedAt)) return null
  const placement = data.layoutElements.find((item) => item.entityId === itemId && !item.archivedAt)
  return { entityId: itemId, elementId: placement?.id ?? '', sceneId: placement?.sceneId ?? null }
}
