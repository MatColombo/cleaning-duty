import type { Routine, TaskOccurrence, TaskSupplySnapshot, WorkspaceData } from '../types/domain'
import type { TranslationKey } from './translations'

/** The routine's explicit title is the activity title; the Action is secondary. */
export function activityTitle(task: TaskOccurrence): string {
  return task.routineNameSnapshot.trim() || task.actionNameSnapshot
}
export function activityItems(task: TaskOccurrence): string {
  return task.targets.map((target) => target.entityName).join(', ')
}
export function activitySubtitle(task: TaskOccurrence): string {
  return [activityItems(task), task.actionNameSnapshot].filter(Boolean).join(' - ')
}


export interface AdditionalActivityAppendixEntry {
  routine: Routine
  occurrence?: TaskOccurrence
  supplies: TaskSupplySnapshot[]
  targetNames: string[]
  actionName: string
}

function configuredSupplySnapshots(data: WorkspaceData, routine: Routine): TaskSupplySnapshot[] {
  const action = data.actions.find((item) => item.id === routine.actionId && !item.archivedAt)
  const ids = routine.supplyIdsOverride ?? action?.defaultSupplyIds ?? []
  return ids.flatMap((supplyId) => {
    const supply = data.supplies.find((item) => item.id === supplyId && !item.archivedAt)
    return supply ? [{ supplyId, supplyName: supply.name }] : []
  })
}

/** Project triggered additional activities as an appendix to a parent activity.
 * Operational views (Overview/Home) show the appendix only when the current
 * parent occurrence actually triggered a child occurrence. Routine configuration
 * remains visible in the Routine editor/details instead of leaking into daily work. */
export function additionalActivityAppendix(data: WorkspaceData, parentTask: TaskOccurrence): AdditionalActivityAppendixEntry[] {
  if (parentTask.parentOccurrenceId) return []
  const children = data.routines.filter((routine) => !routine.archivedAt && routine.status === 'active' && routine.parentRoutineId === parentTask.routineId)
  return children.flatMap((routine) => {
    const occurrence = data.tasks
      .filter((task) => task.parentOccurrenceId === parentTask.id && task.routineId === routine.id && task.state !== 'cancelled')
      .sort((a, b) => b.version - a.version || b.id.localeCompare(a.id))[0]
    if (!occurrence) return []
    const action = data.actions.find((item) => item.id === routine.actionId)
    return [{
      routine, occurrence,
      supplies: occurrence.supplies.length ? occurrence.supplies : configuredSupplySnapshots(data, routine),
      targetNames: routine.targetEntityIds.map((id) => data.entities.find((entity) => entity.id === id)?.name).filter((name): name is string => Boolean(name)),
      actionName: action?.name ?? occurrence.actionNameSnapshot ?? '',
    }]
  })
}

export interface LinkedTaskProjection {
  task: TaskOccurrence
  linkedActivities: TaskOccurrence[]
}

/** Group linked/additional activities under their triggering occurrence when
 * both records are present in the same UI projection. If the parent is not
 * present (for example because it was rescheduled or already finished), the
 * linked activity remains a standalone task so it can never disappear. */
export function groupLinkedTaskOccurrences(tasks: TaskOccurrence[]): LinkedTaskProjection[] {
  const ids = new Set(tasks.map((task) => task.id))
  const linkedByParent = new Map<string, TaskOccurrence[]>()
  const roots: TaskOccurrence[] = []
  for (const task of tasks) {
    if (task.parentOccurrenceId && ids.has(task.parentOccurrenceId)) {
      linkedByParent.set(task.parentOccurrenceId, [...(linkedByParent.get(task.parentOccurrenceId) ?? []), task])
    } else roots.push(task)
  }
  return roots.map((task) => ({ task, linkedActivities: linkedByParent.get(task.id) ?? [] }))
}

export function cleanlinessMood(score: number | null | undefined): { emoji: string; label: TranslationKey } | null {
  if (score == null || !Number.isFinite(score)) return null
  if (score >= 90) return { emoji: '\u{1F929}', label: 'moodExcellent' }
  if (score >= 70) return { emoji: '\u{1F642}', label: 'moodGood' }
  if (score >= 40) return { emoji: '\u{1F610}', label: 'moodFair' }
  if (score >= 20) return { emoji: '\u{1F61F}', label: 'moodAttention' }
  if (score >= 10) return { emoji: '\u{1F620}', label: 'moodUrgent' }
  return { emoji: '\u{1F621}', label: 'moodCritical' }
}
