import type { Locale, TaskOccurrence } from '../../types/domain'
import { addDays, formatTaskDateTime, formatTaskTime, localDateInZone } from '../../lib/date'

export function homeTaskDue(task: TaskOccurrence): string { return task.effectiveDueAt ?? task.dueAt }

/** Same household-timezone formatting as the original Home inspector. */
export function homeTaskWhen(task: TaskOccurrence, locale: Locale, timezone: string, now: Date, compactUpcoming = false): string {
  const due = new Date(homeTaskDue(task))
  const day = localDateInZone(timezone, due)
  const today = localDateInZone(timezone, now)
  const tomorrow = addDays(today, 1)
  if (compactUpcoming && day === tomorrow) return `${locale === 'it' ? 'Domani' : 'Tomorrow'} · ${formatTaskTime(homeTaskDue(task), locale, timezone)}`
  if (compactUpcoming) {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: timezone }).format(due)
    return `${weekday} · ${formatTaskTime(homeTaskDue(task), locale, timezone)}`
  }
  return formatTaskDateTime(homeTaskDue(task), locale, timezone)
}
