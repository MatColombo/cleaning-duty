import type { TaskOccurrence } from '../../types/domain'

/** Session-only order overlay; canonical room workflow/tasks remain unchanged. */
export function orderedRoomSessionQueue(tasks: readonly TaskOccurrence[], deferredIds: readonly string[]): TaskOccurrence[] {
  const deferredRank = new Map(deferredIds.map((id, index) => [id, index]))
  return [...tasks].sort((a, b) => {
    const aRank = deferredRank.get(a.id)
    const bRank = deferredRank.get(b.id)
    if (aRank == null && bRank == null) return 0
    if (aRank == null) return -1
    if (bRank == null) return 1
    return aRank - bRank
  })
}

export function deferRoomSessionTask(ids: readonly string[], taskId: string): string[] {
  return [...ids.filter((id) => id !== taskId), taskId]
}
