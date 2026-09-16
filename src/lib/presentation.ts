import type { TaskOccurrence } from '../types/domain'
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
