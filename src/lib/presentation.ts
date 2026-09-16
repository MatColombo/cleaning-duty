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
export function cleanlinessMood(score: number | null | undefined): { emoji: string; label: TranslationKey } | null {
  if (score == null || !Number.isFinite(score)) return null
  if (score >= 90) return { emoji: '\u{1F929}', label: 'moodExcellent' }
  if (score >= 70) return { emoji: '\u{1F642}', label: 'moodGood' }
  if (score >= 40) return { emoji: '\u{1F610}', label: 'moodFair' }
  if (score >= 20) return { emoji: '\u{1F61F}', label: 'moodAttention' }
  if (score >= 10) return { emoji: '\u{1F620}', label: 'moodUrgent' }
  return { emoji: '\u{1F621}', label: 'moodCritical' }
}
