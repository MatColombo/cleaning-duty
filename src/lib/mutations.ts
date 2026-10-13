import type { WorkspaceData } from '../types/domain'
import type { OfflineMutation } from './offline'
import { stableId } from './id'
import { activeExtraEvents, dueExtraCare, integratedEvent, integratedExtraCare, isLegacyLinkedTask, restoreTrajectories } from './extraCare'
import { applyCompletionHealthEffects } from './cleanliness'
import { materializeAfterTerminalEvent, nextTheoreticalSlotAfter } from './scheduler'



/** Legacy backup successors may predate 16C provenance. They can be undone
 * only when their immutable slot is the exact expected cadence, created after
 * the source action, and have no later events or modified version. */
function safeSuccessor(current: WorkspaceData, row: WorkspaceData['tasks'][number], source: WorkspaceData['taskEvents'][number], predecessor: WorkspaceData['tasks'][number]): boolean {
  if (row.state !== 'scheduled' || row.version !== 1 || current.taskEvents.some(event => event.taskId === row.id
    && !['TASK_CREATED','ASSIGNED'].includes(event.type))) return false
  if (row.successorOfEventId) return row.successorOfEventId === source.id
  const routine = current.routines.find(item => item.id === predecessor.routineId)
  if (!routine || new Date(row.createdAt).getTime() < new Date(source.at).getTime()) return false
  const base = source.type === 'COMPLETED' ? source.at : (predecessor.scheduledSlotAt ?? predecessor.originalDueAt)
  return nextTheoreticalSlotAfter(routine, base, current.workspace.timezone) === row.scheduledSlotAt
}

function undoTaskMutation(current: WorkspaceData, mutation: OfflineMutation & { kind: 'undo' }): WorkspaceData {
  const task = current.tasks.find((item) => item.id === mutation.taskId)
  const source = current.taskEvents.find((event) => event.id === mutation.sourceEventId && event.taskId === mutation.taskId)
  if (!task || task.version !== mutation.expectedVersion) return current
  const extraSource = activeExtraEvents(current).find(event => event.id === mutation.sourceEventId && event.parentOccurrenceId === task.id && event.type === 'POSTPONED')
  if (extraSource && integratedExtraCare(current)) return {
    ...current,
    tasks: current.tasks.map(row => row.id === task.id ? { ...row, version: row.version + 1 } : row),
    extraCareEvents: [...(current.extraCareEvents ?? []), integratedEvent(current.workspace.id, task.id, extraSource.routineId, mutation.eventId, 'REOPENED', mutation.eventAt, mutation.actorMemberId, extraSource.id)],
  }
  if (!source) return current
  let tasks = current.tasks
  let targets = task.targets
  let healthTrajectories = current.healthTrajectories
  const completionSnapshots = current.completionSnapshots

  if (source.type === 'COMPLETED') {
    const snapshotIds = new Set((source.metadata.cleanlinessSnapshots as string[] | undefined) ?? [])
    const completedAt = source.at
    targets = task.targets.map((target) => target.completedAt === completedAt ? { ...target, completedAt: undefined, completedByMemberId: undefined } : target)
    healthTrajectories = Array.isArray(source.metadata.integratedExtraIds) ? current.healthTrajectories : current.healthTrajectories.filter((trajectory) => !trajectory.lastRefreshCompletionId || !snapshotIds.has(trajectory.lastRefreshCompletionId))
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
    const priorScope = source.metadata.fromScope === 'everyone' || source.metadata.fromScope === 'unassigned' || source.metadata.fromScope === 'member'
      ? source.metadata.fromScope
      : prior ? 'member' : 'unassigned'
    tasks = current.tasks.map((item) => item.id === task.id ? { ...item, assigneeMemberId: prior, assignmentScope: priorScope, version: item.version + 1 } : item)
  } else return current

  const routine = current.routines.find((item) => item.id === task.routineId)
  const successors = (source.type === 'COMPLETED' || source.type === 'SKIPPED') && routine?.scheduleMode === 'after_completion'
    ? current.tasks.filter(row => row.routineId === task.routineId && row.routineRevision === task.routineRevision
      && row.id !== task.id && row.state === 'scheduled') : []
  // The predecessor event is the ONLY safe reason to invalidate a successor.
  // Existing legacy rows with no provenance and edited/notified successors
  // require a recoverable conflict, not an arbitrary future-row cancellation.
  if (successors.some(row => !safeSuccessor(current, row, source, task))) return current
  const successorIds = new Set(successors.map(row => row.id))
  if (successorIds.size) tasks = tasks.map(row => successorIds.has(row.id)
    ? { ...row, state: 'cancelled' as const, version: row.version + 1 } : row)

  const integrated = source.type === 'COMPLETED' && Array.isArray(source.metadata.integratedExtraIds)
  const allSnapshots = integrated ? source.metadata.integratedSnapshotIds as string[] ?? [] : []
  if (integrated) {
    healthTrajectories = restoreTrajectories((source.metadata.trajectoryBefore as WorkspaceData['healthTrajectories'] | undefined) ?? [],
      healthTrajectories, allSnapshots)
  }
  const related = integrated ? activeExtraEvents(current).filter(event => event.type === 'COMPLETED' && event.parentEventId === source.id) : []
  return {
    ...current,
    tasks,
    healthTrajectories,
    completionSnapshots,
    extraCareEvents: integrated ? [...(current.extraCareEvents ?? []), ...related.map(event => integratedEvent(current.workspace.id, task.id, event.routineId,
      stableId(`extra-undo:${mutation.eventId}:${event.id}`), 'REOPENED', mutation.eventAt, mutation.actorMemberId, event.id))] : current.extraCareEvents,
    taskEvents: [...current.taskEvents, ...[...successorIds].map((taskId) => ({
      id: stableId(`undo-cancel:${mutation.eventId}:${taskId}`), workspaceId: current.workspace.id, taskId, type: 'CANCELLED' as const, at: mutation.eventAt,
      actorMemberId: mutation.actorMemberId, metadata: { reason: 'undo_after_completion_successor', undoOf: source.id },
    })), {
      id: mutation.eventId, workspaceId: current.workspace.id, taskId: task.id, type: 'REOPENED', at: mutation.eventAt,
      actorMemberId: mutation.actorMemberId, metadata: { undoOf: source.id, undoType: source.type },
    }],
  }
}


function reopenTaskToToday(current: WorkspaceData, mutation: OfflineMutation & { kind: 'reopen_today' }): WorkspaceData {
  const task = current.tasks.find((item) => item.id === mutation.taskId)
  if (!task) return current

  // Restore-to-today is a durable recovery action, not a short-lived Undo.
  // Derive the action to reverse from the current canonical task state/history
  // instead of requiring the client to name the exact latest event id. This
  // keeps offline/cloud behavior stable when equally-timed lifecycle events or
  // a refreshed cache reorder the event list.
  const workflow = current.taskEvents
    .filter((event) => event.taskId === task.id && ['COMPLETED', 'SKIPPED', 'POSTPONED', 'REOPENED'].includes(event.type))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || b.id.localeCompare(a.id))

  let source = undefined as typeof workflow[number] | undefined
  let sourceType: 'COMPLETED' | 'SKIPPED' | 'POSTPONED'
  const latestWorkflow = workflow[0]
  if (latestWorkflow?.type === 'COMPLETED' || latestWorkflow?.type === 'SKIPPED' || latestWorkflow?.type === 'POSTPONED') {
    // Lifecycle history is authoritative. This also repairs the common stale-row
    // case where the occurrence row still says scheduled after Skip/Complete.
    source = latestWorkflow
    sourceType = latestWorkflow.type
  } else if (latestWorkflow?.type === 'REOPENED') {
    return current
  } else if (task.state === 'completed' || task.state === 'skipped') {
    // Legacy terminal rows can exist without a lifecycle event.
    sourceType = task.state === 'completed' ? 'COMPLETED' : 'SKIPPED'
  } else {
    return current
  }

  const occurrenceSnapshotIds = new Set(current.completionSnapshots.filter((snapshot) => snapshot.occurrenceId === task.id).map((snapshot) => snapshot.id))
  let healthTrajectories = current.healthTrajectories
  let targets = task.targets
  if (sourceType === 'COMPLETED') {
    targets = task.targets.map((target) => ({ ...target, completedAt: undefined, completedByMemberId: undefined }))
    healthTrajectories = source?.type === 'COMPLETED' && Array.isArray(source.metadata.integratedExtraIds) ? current.healthTrajectories : current.healthTrajectories.filter((trajectory) => !trajectory.lastRefreshCompletionId || !occurrenceSnapshotIds.has(trajectory.lastRefreshCompletionId))
  }

  let tasks = current.tasks.map((item) => item.id === task.id ? {
    ...item, state: 'scheduled' as const, completedAt: undefined, targets, effectiveDueAt: mutation.eventAt, dueAt: mutation.eventAt, version: item.version + 1,
  } : item)

  const routine = current.routines.find((item) => item.id === task.routineId)
  const successors = (sourceType === 'COMPLETED' || sourceType === 'SKIPPED') && routine?.scheduleMode === 'after_completion'
    ? current.tasks.filter(row => row.id !== task.id && row.routineId === task.routineId
      && row.routineRevision === task.routineRevision && row.state === 'scheduled') : []
  if (successors.some(row => !source || !safeSuccessor(current, row, source, task))) return current
  const successorIds = new Set(successors.map(row => row.id))
  if (successorIds.size) tasks = tasks.map(row => successorIds.has(row.id)
    ? { ...row, state: 'cancelled' as const, version: row.version + 1 } : row)

  const completed = source?.type === 'COMPLETED' && Array.isArray(source.metadata.integratedExtraIds)
  const related = completed ? activeExtraEvents(current).filter(event => event.type === 'COMPLETED' && event.parentEventId === source?.id) : []
  if (completed) healthTrajectories = restoreTrajectories((source?.metadata.trajectoryBefore as WorkspaceData['healthTrajectories'] | undefined) ?? [],
    healthTrajectories, (source?.metadata.integratedSnapshotIds as string[] | undefined) ?? [])
  return {
    ...current,
    tasks,
    healthTrajectories,
    extraCareEvents: completed ? [...(current.extraCareEvents ?? []), ...related.map(event => integratedEvent(current.workspace.id, task.id, event.routineId,
      stableId(`extra-restore:${mutation.eventId}:${event.id}`), 'REOPENED', mutation.eventAt, mutation.actorMemberId, event.id))] : current.extraCareEvents,
    taskEvents: [...current.taskEvents, ...[...successorIds].map((taskId) => ({
      id: stableId(`restore-cancel:${mutation.eventId}:${taskId}`), workspaceId: current.workspace.id, taskId, type: 'CANCELLED' as const, at: mutation.eventAt,
      actorMemberId: mutation.actorMemberId, metadata: { reason: 'restore_to_today_successor', restoreOf: source?.id ?? null },
    })), {
      id: mutation.eventId, workspaceId: current.workspace.id, taskId: task.id, type: 'REOPENED', at: mutation.eventAt,
      actorMemberId: mutation.actorMemberId, metadata: { restoreOf: source?.id ?? null, requestedRestoreOf: mutation.sourceEventId ?? null, restoreType: sourceType, reason: 'restore_to_today' },
    }],
  }
}


export function applyMutationLocally(current: WorkspaceData, mutation: OfflineMutation): WorkspaceData {
  // Outbox replay may repeat an acknowledged mutation before verification READ.
  // Every runtime event is a durable idempotency key, including Extra Care.
  if (current.taskEvents.some(event => event.id === mutation.eventId)
    || current.extraCareEvents?.some(event => event.id === mutation.eventId)) return current

  if (mutation.kind === 'undo') return undoTaskMutation(current, mutation as OfflineMutation & { kind: 'undo' })
  if (mutation.kind === 'reopen_today') return reopenTaskToToday(current, mutation as OfflineMutation & { kind: 'reopen_today' })
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
  if (!task || task.version !== mutation.expectedVersion) return current
  if (isLegacyLinkedTask(current, task)) return current
  if (mutation.kind === 'extra_postpone') {
    if (task.state !== 'scheduled' || !mutation.extraRoutineId || !dueExtraCare(current, task).some(r => r.id === mutation.extraRoutineId)) return current
    return { ...current,
      tasks: current.tasks.map(row => row.id === task.id ? { ...row, version: row.version + 1 } : row),
      extraCareEvents: [...(current.extraCareEvents ?? []), integratedEvent(current.workspace.id, task.id, mutation.extraRoutineId,
        mutation.eventId, 'POSTPONED', mutation.eventAt, mutation.actorMemberId)],
    }
  }
  if (task.state !== 'scheduled') return current
  const baseEvent = {
    id: mutation.eventId,
    workspaceId: current.workspace.id,
    taskId: mutation.taskId,
    at: mutation.eventAt,
    actorMemberId: mutation.actorMemberId,
  }
  if (mutation.kind === 'complete') {
    const extras = integratedExtraCare(current) ? mutation.extraCompletions ?? [] : []
    const allEffects = [...(mutation.completionEffects ?? []), ...extras.flatMap(extra => extra.effects)]
    const expected = dueExtraCare(current, task).map(row => row.id).sort()
    if (integratedExtraCare(current) && (expected.length !== extras.length || expected.some((id, index) => id !== extras.map(extra => extra.routineId).sort()[index]))) return current
    const keys = new Set(allEffects.map(effect => `${effect.trajectoryRoutineId}:${effect.itemId}:${effect.cleanlinessChannel}`))
    const before = (mutation.trajectoryBefore ?? []).filter(row => keys.has(`${row.routineId}:${row.itemId}:${row.cleanlinessChannel}`))
    const changed: WorkspaceData = {
      ...current,
      tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, state: 'completed', completedAt: mutation.eventAt, targets: item.targets.map((target) => ({ ...target, completedAt: target.completedAt ?? mutation.eventAt, completedByMemberId: target.completedByMemberId ?? mutation.actorMemberId })), version: item.version + 1 } : item),
      taskEvents: [...current.taskEvents, { ...baseEvent, type: 'COMPLETED', metadata: {
        cleanlinessSnapshots: mutation.completionEffects?.map(effect => effect.snapshotId) ?? [],
        ...(integratedExtraCare(current) ? { integratedExtraIds: extras.map(extra => extra.routineId), integratedSnapshotIds: allEffects.map(effect => effect.snapshotId), trajectoryBefore: before } : {}),
      } }],
      extraCareEvents: [...(current.extraCareEvents ?? []), ...extras.map(extra => integratedEvent(current.workspace.id, task.id, extra.routineId,
        extra.eventId, 'COMPLETED', mutation.eventAt, mutation.actorMemberId, undefined, mutation.eventId))],
    }
    // Parent and extras execute in one optimistic transaction and one cloud RPC.
    let projected = applyCompletionHealthEffects(changed, mutation.taskId, mutation.eventAt, mutation.completionEffects ?? [], mutation.actorMemberId)
    for (const extra of extras) projected = applyCompletionHealthEffects(projected, mutation.taskId, mutation.eventAt, extra.effects, mutation.actorMemberId)
    return materializeAfterTerminalEvent(projected, task, mutation.eventId)
  }
  if (mutation.kind === 'complete_target' && mutation.targetEntityId) {
    if (integratedExtraCare(current) && current.routines.some(r => r.parentRoutineId === task.routineId && !r.archivedAt)) return current
    const target = task.targets.find((item) => item.entityId === mutation.targetEntityId)
    if (!target || target.completedAt) return current
    const nextTargets = task.targets.map((item) => item.entityId === mutation.targetEntityId ? { ...item, completedAt: mutation.eventAt, completedByMemberId: mutation.actorMemberId } : item)
    const allCompleted = nextTargets.every((item) => Boolean(item.completedAt))
    const changed: WorkspaceData = {
      ...current,
      tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, targets: nextTargets, state: allCompleted ? 'completed' : item.state, completedAt: allCompleted ? mutation.eventAt : item.completedAt, version: item.version + 1 } : item),
      taskEvents: [...current.taskEvents,
        { ...baseEvent, type: 'TARGET_COMPLETED', metadata: { entityId: mutation.targetEntityId, entityName: target.entityName, cleanlinessSnapshots: mutation.completionEffects?.map((effect) => effect.snapshotId) ?? [] } },
        ...(allCompleted ? [{ ...baseEvent, id: stableId(`target-completed:${mutation.eventId}`), type: 'COMPLETED' as const, metadata: { completedByTargets: true } }] : []),
      ],
    }
    const completed = applyCompletionHealthEffects(changed, mutation.taskId, mutation.eventAt, mutation.completionEffects ?? [], mutation.actorMemberId)
    return allCompleted ? materializeAfterTerminalEvent(completed, task, stableId(`target-completed:${mutation.eventId}`)) : completed
  }
  if (mutation.kind === 'skip') return materializeAfterTerminalEvent({
    ...current,
    tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, state: 'skipped', completedAt: undefined, version: item.version + 1 } : item),
    taskEvents: [...current.taskEvents, { ...baseEvent, type: 'SKIPPED', metadata: {} }],
  }, task, mutation.eventId)
  if (mutation.kind === 'postpone' && (mutation.effectiveDueAt ?? mutation.dueAt)) {
    const nextDue = mutation.effectiveDueAt ?? mutation.dueAt!
    return {
      ...current,
      tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, effectiveDueAt: nextDue, dueAt: nextDue, version: item.version + 1 } : item),
      taskEvents: [...current.taskEvents, { ...baseEvent, type: 'POSTPONED', metadata: { from: task.effectiveDueAt ?? task.dueAt, to: nextDue, scheduledSlotAt: task.scheduledSlotAt ?? task.originalDueAt } }],
    }
  }
  if (mutation.kind === 'reassign') {
    const nextScope = mutation.assignmentScope ?? (mutation.clearAssignee ? 'unassigned' : mutation.assigneeMemberId ? 'member' : 'unassigned')
    const nextAssignee = nextScope === 'member' ? mutation.assigneeMemberId : undefined
    return {
      ...current,
      tasks: current.tasks.map((item) => item.id === mutation.taskId ? { ...item, assigneeMemberId: nextAssignee, assignmentScope: nextScope, version: item.version + 1 } : item),
      taskEvents: [...current.taskEvents, { ...baseEvent, type: 'REASSIGNED', metadata: { from: task.assigneeMemberId ?? null, to: nextAssignee ?? null, fromScope: task.assignmentScope ?? (task.assigneeMemberId ? 'member' : 'unassigned'), toScope: nextScope } }],
    }
  }
  return current
}
