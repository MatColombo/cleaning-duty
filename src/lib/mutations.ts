import type { WorkspaceData } from '../types/domain'
import type { OfflineMutation } from './offline'
import { newId } from './id'
import { applyCompletionHealthEffects } from './cleanliness'


function undoTaskMutation(current: WorkspaceData, mutation: OfflineMutation & { kind: 'undo' }): WorkspaceData {
  const task = current.tasks.find((item) => item.id === mutation.taskId)
  const source = current.taskEvents.find((event) => event.id === mutation.sourceEventId && event.taskId === mutation.taskId)
  if (!task || !source || task.version !== mutation.expectedVersion) return current
  let tasks = current.tasks
  let targets = task.targets
  let healthTrajectories = current.healthTrajectories
  let completionSnapshots = current.completionSnapshots

  if (source.type === 'COMPLETED') {
    const snapshotIds = new Set((source.metadata.cleanlinessSnapshots as string[] | undefined) ?? [])
    const completedAt = source.at
    targets = task.targets.map((target) => target.completedAt === completedAt ? { ...target, completedAt: undefined, completedByMemberId: undefined } : target)
    healthTrajectories = current.healthTrajectories.filter((trajectory) => !trajectory.lastRefreshCompletionId || !snapshotIds.has(trajectory.lastRefreshCompletionId))
    // Completion snapshots are immutable audit records. Undo removes the live
    // trajectory effect but keeps the snapshot; REOPENED records the reversal.
    tasks = current.tasks.map((item) => item.id === task.id ? { ...item, state: 'scheduled', completedAt: undefined, targets, version: item.version + 1 } : item)
  } else if (source.type === 'SKIPPED') {
    tasks = current.tasks.map((item) => item.id === task.id ? { ...item, state: 'scheduled', version: item.version + 1 } : item)
  } else if (source.type === 'POSTPONED') {
    const prior = typeof source.metadata.from === 'string' ? source.metadata.from : task.scheduledSlotAt
    tasks = current.tasks.map((item) => item.id === task.id ? { ...item, effectiveDueAt: prior, dueAt: prior, version: item.version + 1 } : item)
  } else if (source.type === 'REASSIGNED') {
    const prior = typeof source.metadata.from === 'string' ? source.metadata.from : undefined
    tasks = current.tasks.map((item) => item.id === task.id ? { ...item, assigneeMemberId: prior, version: item.version + 1 } : item)
  } else return current

  const routine = current.routines.find((item) => item.id === task.routineId)
  const successorIds = new Set<string>()
  if ((source.type === 'COMPLETED' || source.type === 'SKIPPED') && routine?.scheduleMode === 'after_completion') {
    const sourceAt = new Date(source.at).getTime()
    for (const item of tasks) {
      if (item.id === task.id || item.routineId !== task.routineId || item.state !== 'scheduled') continue
      if (new Date(item.createdAt).getTime() >= sourceAt) successorIds.add(item.id)
    }
    if (successorIds.size) {
      tasks = tasks.map((item) => successorIds.has(item.id) ? { ...item, state: 'cancelled' as const, version: item.version + 1 } : item)
    }
  }

  return {
    ...current,
    tasks,
    healthTrajectories,
    completionSnapshots,
    taskEvents: [...current.taskEvents, ...[...successorIds].map((taskId) => ({
      id: newId(), workspaceId: current.workspace.id, taskId, type: 'CANCELLED' as const, at: mutation.eventAt,
      actorMemberId: mutation.actorMemberId, metadata: { reason: 'undo_after_completion_successor', undoOf: source.id },
    })), {
      id: mutation.eventId, workspaceId: current.workspace.id, taskId: task.id, type: 'REOPENED', at: mutation.eventAt,
      actorMemberId: mutation.actorMemberId, metadata: { undoOf: source.id, undoType: source.type },
    }],
  }
}

export function applyMutationLocally(current: WorkspaceData, mutation: OfflineMutation): WorkspaceData {
  if (mutation.kind === 'undo') return undoTaskMutation(current, mutation as OfflineMutation & { kind: 'undo' })
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
  if (mutation.kind === 'complete') {
    const changed: WorkspaceData = {
      ...current,
      tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, state: 'completed', completedAt: mutation.eventAt, targets: item.targets.map((target) => ({ ...target, completedAt: target.completedAt ?? mutation.eventAt, completedByMemberId: target.completedByMemberId ?? mutation.actorMemberId })), version: item.version + 1 } : item),
      taskEvents: [...current.taskEvents, { ...baseEvent, type: 'COMPLETED', metadata: { cleanlinessSnapshots: mutation.completionEffects?.map((effect) => effect.snapshotId) ?? [] } }],
    }
    return applyCompletionHealthEffects(changed, mutation.taskId, mutation.eventAt, mutation.completionEffects ?? [], mutation.actorMemberId)
  }
  if (mutation.kind === 'complete_target' && mutation.targetEntityId) {
    const target = task.targets.find((item) => item.entityId === mutation.targetEntityId)
    if (!target || target.completedAt) return current
    const nextTargets = task.targets.map((item) => item.entityId === mutation.targetEntityId ? { ...item, completedAt: mutation.eventAt, completedByMemberId: mutation.actorMemberId } : item)
    const allCompleted = nextTargets.every((item) => Boolean(item.completedAt))
    const changed: WorkspaceData = {
      ...current,
      tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, targets: nextTargets, state: allCompleted ? 'completed' : item.state, completedAt: allCompleted ? mutation.eventAt : item.completedAt, version: item.version + 1 } : item),
      taskEvents: [...current.taskEvents,
        { ...baseEvent, type: 'TARGET_COMPLETED', metadata: { entityId: mutation.targetEntityId, entityName: target.entityName, cleanlinessSnapshots: mutation.completionEffects?.map((effect) => effect.snapshotId) ?? [] } },
        ...(allCompleted ? [{ ...baseEvent, id: newId(), type: 'COMPLETED' as const, metadata: { completedByTargets: true } }] : []),
      ],
    }
    return applyCompletionHealthEffects(changed, mutation.taskId, mutation.eventAt, mutation.completionEffects ?? [], mutation.actorMemberId)
  }
  if (mutation.kind === 'skip') return {
    ...current,
    tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, state: 'skipped', version: item.version + 1 } : item),
    taskEvents: [...current.taskEvents, { ...baseEvent, type: 'SKIPPED', metadata: {} }],
  }
  if (mutation.kind === 'postpone' && (mutation.effectiveDueAt ?? mutation.dueAt)) {
    const nextDue = mutation.effectiveDueAt ?? mutation.dueAt!
    return {
      ...current,
      tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, effectiveDueAt: nextDue, dueAt: nextDue, version: item.version + 1 } : item),
      taskEvents: [...current.taskEvents, { ...baseEvent, type: 'POSTPONED', metadata: { from: task.effectiveDueAt ?? task.dueAt, to: nextDue, scheduledSlotAt: task.scheduledSlotAt ?? task.originalDueAt } }],
    }
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
