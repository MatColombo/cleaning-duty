import type { AdditionalActivityInput, Routine, TaskEvent, WorkspaceData } from '../types/domain'
import { newId, nowIso } from './id'
import { routineDefinitionFingerprint } from './routines'

export function additionalActivityFromRoutine(routine: Routine): AdditionalActivityInput {
  return {
    id: routine.id, name: routine.name, actionId: routine.actionId,
    targetEntityIds: [...routine.targetEntityIds], includeDescendantTargetIds: [...routine.includeDescendantTargetIds],
    every: routine.triggerEvery ?? 1, careLevel: routine.careLevel,
    affectsCleanliness: routine.affectsCleanliness !== false, refreshLevelPct: routine.refreshLevelPct ?? 100,
    supplyIdsOverride: routine.supplyIdsOverride ? [...routine.supplyIdsOverride] : undefined,
  }
}

/** Persist linked work as ordinary routines. There are no shadow task lists.
 * Policy-only changes never retire tasks; changing an extra does not regenerate
 * the parent's occurrences. Removed extras are archived, preserving history. */
export function saveAdditionalActivities(
  data: WorkspaceData, parent: Routine, inputs?: AdditionalActivityInput[], actorMemberId?: string,
): WorkspaceData {
  if (parent.parentRoutineId) throw new Error('Additional activities cannot contain nested additional activities.')
  const current = data.routines.filter((routine) => routine.parentRoutineId === parent.id && !routine.archivedAt)
  const requested = inputs ?? current.map(additionalActivityFromRoutine)
  if (parent.recurrence.kind === 'once' && requested.length) throw new Error('Additional activities require a recurring parent routine.')
  const at = nowIso()
  const cancelled = new Set<string>()
  const keep = new Set<string>()
  const replacements = new Map<string, Routine>()
  for (const input of requested) {
    if (!Number.isInteger(input.every) || input.every < 1 || input.every > 100) throw new Error('Choose a whole trigger interval from 1 to 100.')
    if (!input.name.trim()) throw new Error('Give each additional activity a title.')
    if (!data.actions.some((action) => action.id === input.actionId && !action.archivedAt)) throw new Error('Choose an active action for every additional activity.')
    if (!input.targetEntityIds.length || input.targetEntityIds.some((id) => !data.entities.some((entity) => entity.id === id && !entity.archivedAt))) throw new Error('Choose active targets for every additional activity.')
    if (input.supplyIdsOverride?.some((id) => !data.supplies.some((supply) => supply.id === id && !supply.archivedAt))) throw new Error('A selected product is no longer available in Stock.')
    const old = current.find((routine) => routine.id === input.id)
    if (input.id && data.routines.some((routine) => routine.id === input.id && routine.parentRoutineId !== parent.id)) throw new Error('Invalid linked routine identifier.')
    const id = old?.id ?? input.id ?? newId()
    if (keep.has(id)) throw new Error('An additional activity cannot be listed twice.')
    keep.add(id)
    let child: Routine = {
      id, workspaceId: parent.workspaceId, name: input.name.trim(), actionId: input.actionId,
      targetEntityIds: [...new Set(input.targetEntityIds)], includeDescendantTargetIds: [...new Set(input.includeDescendantTargetIds)].filter((id) => input.targetEntityIds.includes(id)),
      parentRoutineId: parent.id, triggerEvery: input.every,
      recurrence: structuredClone(parent.recurrence), timeOfDay: parent.timeOfDay, routineTimezone: parent.routineTimezone,
      scheduleMode: parent.scheduleMode, exceptions: structuredClone(parent.exceptions),
      assignment: structuredClone(parent.assignment), reminder: structuredClone(parent.reminder),
      careLevel: input.careLevel, cleanlinessChannel: input.careLevel === 'deep' ? 'deep' : 'regular',
      affectsCleanliness: input.affectsCleanliness !== false, refreshLevelPct: Math.max(10, Math.min(100, input.refreshLevelPct || 100)),
      supplyIdsOverride: input.supplyIdsOverride, status: parent.status, revision: old?.revision ?? 1,
      createdAt: old?.createdAt ?? at,
    }
    if (old) {
      // Refresh and participation affect future completions, not recurrence identity.
      const comparable = { ...old, refreshLevelPct: child.refreshLevelPct, affectsCleanliness: child.affectsCleanliness }
      if (routineDefinitionFingerprint(comparable) !== routineDefinitionFingerprint(child)) {
        child = { ...child, revision: old.revision + 1 }
        cancelled.add(id)
      }
    }
    replacements.set(id, child)
  }
  for (const old of current) {
    if (!keep.has(old.id)) {
      replacements.set(old.id, { ...old, archivedAt: at, status: 'ended', revision: old.revision + 1 })
      cancelled.add(old.id)
    }
  }
  const events: TaskEvent[] = []
  const tasks = data.tasks.map((task) => {
    if (task.state !== 'scheduled' || !cancelled.has(task.routineId)) return task
    events.push({ id: newId(), workspaceId: data.workspace.id, taskId: task.id, type: 'CANCELLED', at, actorMemberId, metadata: { reason: 'linked_routine_changed' } })
    return { ...task, state: 'cancelled' as const, version: task.version + 1 }
  })
  return {
    ...data, tasks, taskEvents: [...data.taskEvents, ...events],
    routines: [...data.routines.map((routine) => replacements.get(routine.id) ?? routine), ...[...replacements.values()].filter((routine) => !data.routines.some((old) => old.id === routine.id))],
  }
}
