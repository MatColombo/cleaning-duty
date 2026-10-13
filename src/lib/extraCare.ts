/** Phase 16B: derived, non-materialized Extra Care obligations.
 * Only explicit execution/deferral events are stored; the recurring definition
 * remains a linked Routine for V1 history and backup compatibility. */
import type { CompletionHealthEffect, ExtraCareEvent, HealthTrajectory, Routine, TaskOccurrence, WorkspaceData } from '../types/domain'
import { buildCompletionHealthEffects, applyCompletionHealthEffects, trajectoryKey } from './cleanliness'
import { resolvedRoutineTargets } from './targeting'
import { ordinalForSlot } from './scheduler'
import { stableId } from './id'

export function integratedExtraCare(data: WorkspaceData): boolean { return data.extraCareMode === 'integrated' }
export function isLegacyLinkedTask(data: WorkspaceData, task: TaskOccurrence): boolean {
  return integratedExtraCare(data) && Boolean(task.parentOccurrenceId || data.routines.find(r => r.id === task.routineId)?.parentRoutineId)
}
export function isIntegratedPrimary(data: WorkspaceData, task: TaskOccurrence): boolean {
  return integratedExtraCare(data) && !isLegacyLinkedTask(data, task)
}

export function parentOrdinal(data: WorkspaceData, task: TaskOccurrence): number {
  if (task.triggerOrdinal && Number.isInteger(task.triggerOrdinal)) return task.triggerOrdinal
  const routine = data.routines.find(row => row.id === task.routineId)
  if (!routine) return 0
  if (routine.scheduleMode === 'fixed') return ordinalForSlot(routine, task.scheduledSlotAt ?? task.originalDueAt, data.workspace.timezone) ?? 0
  const slots = [...new Set(data.tasks.filter(row => row.routineId === task.routineId).map(row => row.scheduledSlotAt ?? row.originalDueAt))].sort()
  return slots.indexOf(task.scheduledSlotAt ?? task.originalDueAt) + 1
}

/** Append-only Undo only negates the exact source event. Older events are never erased. */
export function activeExtraEvents(data: WorkspaceData): ExtraCareEvent[] {
  const events = data.extraCareEvents ?? []
  const undone = new Set(events.filter(event => event.type === 'REOPENED').map(event => event.sourceEventId))
  return events.filter(event => event.type !== 'REOPENED' && !undone.has(event.id))
}

function completedOrdinal(data: WorkspaceData, routine: Routine): number {
  let latest = 0
  const tasks = new Map(data.tasks.map(task => [task.id, task]))
  for (const event of activeExtraEvents(data)) {
    if (event.type !== 'COMPLETED' || event.routineId !== routine.id) continue
    const parent = tasks.get(event.parentOccurrenceId)
    if (parent) latest = Math.max(latest, parentOrdinal(data, parent))
  }
  // A completed V1 child is legitimate historical execution, not new V2 work.
  // A V1 child whose completion was subsequently reopened must not discharge it.
  for (const child of data.tasks) {
    if (child.routineId !== routine.id || child.state !== 'completed') continue
    const latestLifecycle = data.taskEvents.filter(e => e.taskId === child.id && (e.type === 'COMPLETED' || e.type === 'REOPENED'))
      .sort((a,b) => b.at.localeCompare(a.at))[0]
    if (latestLifecycle?.type === 'REOPENED') continue
    const parent = child.parentOccurrenceId ? tasks.get(child.parentOccurrenceId) : undefined
    latest = Math.max(latest, child.triggerOrdinal ?? (parent ? parentOrdinal(data, parent) : 0))
  }
  return latest
}

export function legacyCarryOrdinal(data: WorkspaceData, child: TaskOccurrence): number {
  const parent = data.tasks.find(task => task.id === child.parentOccurrenceId)
  const origin = child.triggerOrdinal ?? (parent ? parentOrdinal(data, parent) : 0)
  const next = data.tasks.filter(task => task.routineId === parent?.routineId && task.state !== 'cancelled'
    && parentOrdinal(data, task) >= origin && task.scheduledSlotAt >= child.effectiveDueAt)
    .sort((a, b) => parentOrdinal(data, a) - parentOrdinal(data, b))[0]
  return next ? parentOrdinal(data, next) : Math.max(1, origin)
}

export function dueExtraCare(data: WorkspaceData, parentTask: TaskOccurrence): Routine[] {
  if (!integratedExtraCare(data) || isLegacyLinkedTask(data, parentTask) || parentTask.state !== 'scheduled') return []
  const ordinal = parentOrdinal(data, parentTask)
  if (!ordinal) return []
  const events = activeExtraEvents(data)
  return data.routines.filter(routine => {
    if (!routine.parentRoutineId || routine.parentRoutineId !== parentTask.routineId || routine.status !== 'active' || routine.archivedAt) return false
    if (events.some(event => event.parentOccurrenceId === parentTask.id && event.routineId === routine.id && event.type === 'POSTPONED')) return false
    const completed = completedOrdinal(data, routine)
    const every = Math.max(1, routine.triggerEvery ?? 1)
    // Trigger anchors are immutable parent ordinals. Skips/missed parent slots
    // leave an outstanding trigger for the next executable parent, not the next N.
    const eligibleOrdinals = data.tasks.filter(row => row.routineId === parentTask.routineId && !row.parentOccurrenceId
      && (row.scheduledSlotAt ?? row.originalDueAt) >= routine.createdAt)
      .map(row => parentOrdinal(data, row)).filter(value => value > 0)
    const firstEligible = eligibleOrdinals.length ? Math.min(...eligibleOrdinals) : ordinal
    const firstTrigger = Math.ceil(firstEligible / every) * every
    const postponedLegacyAtOrigin = (data.extraCareLegacyCarries ?? []).some(carry =>
      carry.routineId === routine.id && carry.originOccurrenceId === parentTask.id && carry.targetOrdinal > ordinal)
      || data.tasks.some(child => child.routineId === routine.id && child.state === 'scheduled'
        && child.parentOccurrenceId === parentTask.id && child.effectiveDueAt > parentTask.effectiveDueAt)
    const regularPending = !postponedLegacyAtOrigin && ordinal >= firstTrigger
      && Math.floor(ordinal / every) > Math.floor(Math.max(completed, firstTrigger - 1) / every)
    const carried = (data.extraCareLegacyCarries ?? []).some(carry => carry.routineId === routine.id && carry.targetOrdinal <= ordinal && carry.targetOrdinal > completed)
    // An old materialized V1 scheduled child is an outstanding obligation even
    // when imported locally without having run the activation SQL.
    const legacyPending = data.tasks.some(child => child.routineId === routine.id && child.parentOccurrenceId
      && child.state === 'scheduled' && legacyCarryOrdinal(data, child) <= ordinal && (child.triggerOrdinal ?? 0) > completed)
    return regularPending || carried || legacyPending
  })
}

/** Query for completed appendix while preserving the V1 child execution history. */
export function completedExtraCare(data: WorkspaceData, parentTask: TaskOccurrence): Routine[] {
  const active = activeExtraEvents(data)
  return data.routines.filter(routine => routine.parentRoutineId === parentTask.routineId
    && (active.some(event => event.type === 'COMPLETED' && event.routineId === routine.id && event.parentOccurrenceId === parentTask.id)
      || data.tasks.some(task => task.routineId === routine.id && task.parentOccurrenceId === parentTask.id && task.state === 'completed')))
}

export interface ExtraCareCompletion { routineId: string; eventId: string; effects: CompletionHealthEffect[] }
export interface IntegratedEffects { parentEffects: CompletionHealthEffect[]; extras: ExtraCareCompletion[]; beforeTrajectories: HealthTrajectory[] }

export function buildIntegratedEffects(data: WorkspaceData, parentTask: TaskOccurrence, eventAt: string, eventId: string, actorMemberId?: string): IntegratedEffects {
  const beforeTrajectories = structuredClone(data.healthTrajectories)
  const parentEffects = buildCompletionHealthEffects(data, parentTask, eventAt, parentTask.targets.filter(t => !t.completedAt).map(t => t.entityId), actorMemberId)
  let projection = applyCompletionHealthEffects(data, parentTask.id, eventAt, parentEffects, actorMemberId)
  const extras: ExtraCareCompletion[] = []
  for (const routine of dueExtraCare(data, parentTask)) {
    const targets = resolvedRoutineTargets(data, routine).map(({ entity, reasons }) => ({
      entityId: entity.id, entityName: entity.name, entityTypeName: '', matchReasons: reasons,
    }))
    const virtualTask: TaskOccurrence = { ...parentTask, id: stableId(`v2-extra-virtual:${parentTask.id}:${routine.id}`), routineId: routine.id, targets, cleanlinessChannel: routine.cleanlinessChannel,
      careLevel: routine.careLevel, routineNameSnapshot: routine.name }
    const effects = buildCompletionHealthEffects(projection, virtualTask, eventAt, targets.map(t => t.entityId), actorMemberId)
      .map(effect => ({ ...effect, snapshotId: stableId(`v2-extra-snapshot:${eventId}:${routine.id}:${effect.snapshotId}`) }))
    const extraEventId = stableId(`v2-extra-complete:${eventId}:${routine.id}`)
    extras.push({ routineId: routine.id, eventId: extraEventId, effects })
    projection = applyCompletionHealthEffects(projection, parentTask.id, eventAt, effects, actorMemberId)
  }
  return { parentEffects, extras, beforeTrajectories }
}

export function restoreTrajectories(before: HealthTrajectory[], current: HealthTrajectory[], affectedSnapshots: string[]): HealthTrajectory[] {
  const ids = new Set(affectedSnapshots)
  const previous = new Map(before.map(row => [trajectoryKey(row.routineId, row.itemId, row.cleanlinessChannel), row]))
  const affected = new Set(current.filter(row => row.lastRefreshCompletionId && ids.has(row.lastRefreshCompletionId))
    .map(row => trajectoryKey(row.routineId, row.itemId, row.cleanlinessChannel)))
  // Removal is safe only if no later unrelated completion displaced the source.
  const retained = current.filter(row => !affected.has(trajectoryKey(row.routineId, row.itemId, row.cleanlinessChannel)))
  return [...retained, ...[...affected].flatMap(key => previous.has(key) ? [previous.get(key)!] : [])]
}

export function integratedEvent(workspaceId: string, parentTaskId: string, routineId: string, id: string,
  type: ExtraCareEvent['type'], at: string, actorMemberId?: string, sourceEventId?: string, parentEventId?: string): ExtraCareEvent {
  return { id, workspaceId, parentOccurrenceId: parentTaskId, routineId, type, at, actorMemberId, sourceEventId, parentEventId }
}

export function validateExtraMutation(data: WorkspaceData, parent: TaskOccurrence, extraId: string): boolean {
  return dueExtraCare(data, parent).some(routine => routine.id === extraId)
}
