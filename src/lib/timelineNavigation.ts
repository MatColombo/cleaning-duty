/** Route-only projections. Never create, mutate, or reclassify domain occurrences here. */
import type { WorkspaceData } from '../types/domain'
import { addDays, localDateInZone } from './date'
import { dedupeOccurrences } from './overview'

export type TaskDestination = { path: string; destination: 'overview' | 'timeline' } | null

/**
 * Preserve the exact occurrence ID from push/bookmarks. Use the canonical
 * lifecycle reconciliation used by Overview; neither a routine nor a newly
 * generated occurrence may substitute for that ID.
 */
export function taskDeepLinkDestination(data: WorkspaceData, taskId: string, now: Date = new Date()): TaskDestination {
  if (!taskId) return null
  // A superseded duplicate slot is not a canonical actionable occurrence.
  // Never reopen an obsolete physical row just because an old link holds its ID.
  const task = dedupeOccurrences(data).find((row) => row.id === taskId)
  if (!task || task.state === 'cancelled') return null

  const today = localDateInZone(data.workspace.timezone, now)
  const dueDay = localDateInZone(data.workspace.timezone, new Date(task.effectiveDueAt ?? task.dueAt))
  const activeToday = task.state === 'scheduled' && dueDay <= today
  const destination = activeToday ? 'overview' : 'timeline'
  const params = new URLSearchParams({ task: taskId })
  if (destination === 'timeline' && task.state === 'scheduled' && dueDay > today && dueDay <= addDays(today, 7)) {
    params.set('day', dueDay)
  }
  return { destination, path: `${destination === 'overview' ? '/' : '/timeline'}?${params.toString()}` }
}

/** The day rail is a seven-day household-local calendar window, never UTC + 24h. */
export function timelineDays(timezone: string, now: Date): string[] {
  const today = localDateInZone(timezone, now)
  return Array.from({ length: 7 }, (_, index) => addDays(today, index + 1))
}

export function resolveTimelineDay(days: string[], requestedDay: string | null, upcomingDueDays: string[]): string {
  if (requestedDay && days.includes(requestedDay)) return requestedDay
  return days.find((day) => upcomingDueDays.includes(day)) ?? days[0] ?? ''
}
