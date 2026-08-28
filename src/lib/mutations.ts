import type { WorkspaceData } from '../types/domain'
import type { OfflineMutation } from './offline'
import { newId } from './id'

export function applyMutationLocally(current: WorkspaceData, mutation: OfflineMutation): WorkspaceData {
  if (mutation.kind === 'supply_status') {
    const supply = current.supplies.find((item) => item.id === mutation.supplyId)
    if (!supply || supply.version !== mutation.expectedVersion) return current
    return {
      ...current,
      supplies: current.supplies.map((item) => item.id === mutation.supplyId
        ? { ...item, status: mutation.status, version: item.version + 1 }
        : item),
      supplyEvents: [...current.supplyEvents, {
        id: mutation.eventId,
        workspaceId: current.workspace.id,
        supplyId: mutation.supplyId,
        type: 'STOCK_CHANGED',
        at: mutation.eventAt,
        actorMemberId: mutation.actorMemberId,
        metadata: { from: supply.status, to: mutation.status, sourceTaskId: mutation.sourceTaskId },
      }],
    }
  }

  const task = current.tasks.find((item) => item.id === mutation.taskId)
  if (!task || task.state !== 'scheduled' || task.version !== mutation.expectedVersion) return current
  const baseEvent = {
    id: mutation.eventId,
    workspaceId: current.workspace.id,
    taskId: mutation.taskId,
    at: mutation.eventAt,
    actorMemberId: mutation.actorMemberId,
  }
  if (mutation.kind === 'complete') return {
    ...current,
    tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, state: 'completed', targets: item.targets.map((target) => ({ ...target, completedAt: target.completedAt ?? mutation.eventAt, completedByMemberId: target.completedByMemberId ?? mutation.actorMemberId })), version: item.version + 1 } : item),
    taskEvents: [...current.taskEvents, { ...baseEvent, type: 'COMPLETED', metadata: {} }],
  }
  if (mutation.kind === 'complete_target' && mutation.targetEntityId) {
    const target = task.targets.find((item) => item.entityId === mutation.targetEntityId)
    if (!target || target.completedAt) return current
    const nextTargets = task.targets.map((item) => item.entityId === mutation.targetEntityId ? { ...item, completedAt: mutation.eventAt, completedByMemberId: mutation.actorMemberId } : item)
    const allCompleted = nextTargets.every((item) => Boolean(item.completedAt))
    return {
      ...current,
      tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, targets: nextTargets, state: allCompleted ? 'completed' : item.state, version: item.version + 1 } : item),
      taskEvents: [...current.taskEvents,
        { ...baseEvent, type: 'TARGET_COMPLETED', metadata: { entityId: mutation.targetEntityId, entityName: target.entityName } },
        ...(allCompleted ? [{ ...baseEvent, id: newId(), type: 'COMPLETED' as const, metadata: { completedByTargets: true } }] : []),
      ],
    }
  }
  if (mutation.kind === 'skip') return {
    ...current,
    tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, state: 'skipped', version: item.version + 1 } : item),
    taskEvents: [...current.taskEvents, { ...baseEvent, type: 'SKIPPED', metadata: {} }],
  }
  if (mutation.kind === 'postpone' && mutation.dueAt) return {
    ...current,
    tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, dueAt: mutation.dueAt!, version: item.version + 1 } : item),
    taskEvents: [...current.taskEvents, { ...baseEvent, type: 'POSTPONED', metadata: { from: task.dueAt, to: mutation.dueAt } }],
  }
  if (mutation.kind === 'reassign') {
    const nextAssignee = mutation.clearAssignee ? undefined : mutation.assigneeMemberId
    return {
      ...current,
      tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, assigneeMemberId: nextAssignee, version: item.version + 1 } : item),
      taskEvents: [...current.taskEvents, { ...baseEvent, type: 'REASSIGNED', metadata: { from: task.assigneeMemberId ?? null, to: nextAssignee ?? null } }],
    }
  }
  return current
}
