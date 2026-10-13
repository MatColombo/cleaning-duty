import type { TaskOccurrence, WorkspaceData } from '../types/domain'
import type { OverviewGroups } from './overview'
import { itemChannelCleanliness } from './cleanliness'
import { localDateInZone } from './date'
import { additionalActivityAppendix } from './presentation'
import { requiredCardSupplies, type CardSupply } from './cardSupplies'

/** Presentation-only deck. Preserve the canonical bucket order and *every* actionable occurrence.
 * Integrated V2 Extra Care is rendered inside its primary card; legacy history remains readable. */
export type DeckPriority = 'overdue' | 'dueNow' | 'laterToday'
export interface ActiveDeckEntry {
  task: TaskOccurrence
  priority: DeckPriority
}

export function buildActiveDeck(groups: Pick<OverviewGroups, 'overdue' | 'dueNow' | 'laterToday'>): ActiveDeckEntry[] {
  return [
    ...groups.overdue.map((task) => ({ task, priority: 'overdue' as const })),
    ...groups.dueNow.map((task) => ({ task, priority: 'dueNow' as const })),
    ...groups.laterToday.map((task) => ({ task, priority: 'laterToday' as const })),
  ]
}

export function nextDeckIndex(length: number, current: number, delta: -1 | 1): number {
  if (length <= 0) return 0
  return ((current + delta) % length + length) % length
}

/** Days late in the *household's local calendar*, not elapsed 24-hour intervals (DST safe). */
export function overdueCalendarDays(dueAt: string, now: Date, timezone: string): number {
  const date = localDateInZone(timezone, new Date(dueAt))
  const today = localDateInZone(timezone, now)
  const ms = Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)
  return Math.max(0, Math.round(ms / 86_400_000))
}

export interface CareCardContext {
  assignmentScope: TaskOccurrence['assignmentScope']
  assigneeName?: string
  cleanlinessScore: number | null
  cleanlinessExcluded: boolean
  supplyAlerts: { supplyId: string; name: string; status: 'low' | 'reserve_only' | 'out_of_stock' }[]
  supplies: CardSupply[]
  linkedChildren: ReturnType<typeof additionalActivityAppendix>
}

/** This is informational only: it does not change cleanliness, supply or task state. */
export function careCardContext(data: WorkspaceData, task: TaskOccurrence, now: Date): CareCardContext {
  const assignee = data.members.find((member) => member.id === task.assigneeMemberId)
  const cleanlinessExcluded = data.routines.find((routine) => routine.id === task.routineId)?.affectsCleanliness === false
  const scores = cleanlinessExcluded ? [] : task.targets.flatMap((target) => {
    const value = itemChannelCleanliness(data, target.entityId, task.cleanlinessChannel, now).score
    return value == null || !Number.isFinite(value) ? [] : [value]
  })
  const linkedChildren = additionalActivityAppendix(data, task)
  const supplies = requiredCardSupplies(data, task, linkedChildren)
  const supplyAlerts = supplies.flatMap(supply => supply.status && supply.status !== 'available'
    ? [{ supplyId: supply.supplyId, name: supply.name, status: supply.status }] : [])
  return {
    assignmentScope: task.assignmentScope,
    assigneeName: assignee?.displayName,
    cleanlinessScore: scores.length ? Math.min(...scores) : null,
    cleanlinessExcluded,
    supplyAlerts,
    supplies,
    linkedChildren,
  }
}
