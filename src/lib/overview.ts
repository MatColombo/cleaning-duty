import type { CleanlinessChannel, TaskEvent, TaskOccurrence, WorkspaceData } from '../types/domain'
import { itemChannelCleanliness } from './cleanliness'
import { addDays, localDateInZone } from './date'
import { isRoutineActive } from './scheduler'

export type OverviewScope = 'mine' | 'household'

export interface CriticalCleanlinessItem {
  itemId: string
  name: string
  roomName?: string
  score: number
  theoreticalDueAt?: string
  overdue: boolean
  channel: CleanlinessChannel
}

export interface CriticalCleanlinessSummary {
  itemId: string
  name: string
  roomName?: string
  channels: CriticalCleanlinessItem[]
}

export interface OverviewGroups {
  overdue: TaskOccurrence[]
  dueNow: TaskOccurrence[]
  laterToday: TaskOccurrence[]
  finished: TaskOccurrence[]
  upcoming: TaskOccurrence[]
  criticalItems: CriticalCleanlinessItem[]
}

function taskRank(task: TaskOccurrence): number {
  if (task.state === 'completed') return 4
  if (task.state === 'skipped') return 3
  if (task.state === 'scheduled') return 2
  return 1
}

export function canonicalTaskState(data: WorkspaceData, task: TaskOccurrence): TaskOccurrence {
  // Lifecycle history is authoritative when a stale cached task row disagrees with
  // a later terminal/undo event. REOPENED is especially important for Overview
  // Undo: an older COMPLETED/SKIPPED event must not keep the occurrence terminal.
  const lifecycle = data.taskEvents
    .filter((event) => event.taskId === task.id && ['COMPLETED', 'SKIPPED', 'CANCELLED', 'REOPENED'].includes(event.type))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || b.id.localeCompare(a.id))[0]
  if (lifecycle?.type === 'COMPLETED') return { ...task, state: 'completed' }
  if (lifecycle?.type === 'SKIPPED') return { ...task, state: 'skipped' }
  if (lifecycle?.type === 'CANCELLED') return { ...task, state: 'cancelled' }
  if (lifecycle?.type === 'REOPENED') return { ...task, state: 'scheduled', completedAt: undefined }
  if (task.state === 'scheduled' && task.targets.length > 0 && task.targets.every((target) => Boolean(target.completedAt))) return { ...task, state: 'completed' }
  return task
}

export function dedupeOccurrences(data: WorkspaceData): TaskOccurrence[] {
  const byId = new Map<string, TaskOccurrence>()
  for (const raw of data.tasks) {
    const task = canonicalTaskState(data, raw)
    const prior = byId.get(task.id)
    if (!prior || task.version > prior.version || (task.version === prior.version && taskRank(task) > taskRank(prior))) byId.set(task.id, task)
  }
  const bySlot = new Map<string, TaskOccurrence>()
  for (const task of byId.values()) {
    const slot = task.scheduledSlotAt ?? task.originalDueAt
    const key = `${task.routineId}:${task.routineRevision}:${slot}`
    const prior = bySlot.get(key)
    if (!prior || task.version > prior.version || (task.version === prior.version && taskRank(task) > taskRank(prior))) bySlot.set(key, task)
  }
  return [...bySlot.values()]
}


function latestWorkflowEvent(events: TaskEvent[], taskId: string): TaskEvent | undefined {
  return events
    .filter((event) => event.taskId === taskId && (event.type === 'COMPLETED' || event.type === 'SKIPPED' || event.type === 'POSTPONED' || event.type === 'REOPENED'))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || b.id.localeCompare(a.id))[0]
}

function latestTerminalAt(events: TaskEvent[], taskId: string): string | undefined {
  return events
    .filter((event) => event.taskId === taskId && (event.type === 'COMPLETED' || event.type === 'SKIPPED'))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || b.id.localeCompare(a.id))[0]?.at
}

function roomNameForItem(data: WorkspaceData, itemId: string): string | undefined {
  let item = data.entities.find((entity) => entity.id === itemId)
  const visited = new Set<string>()
  while (item?.parentId && !visited.has(item.parentId)) {
    visited.add(item.parentId)
    const parent = data.entities.find((entity) => entity.id === item!.parentId)
    if (!parent) break
    if (data.layoutElements.some((element) => !element.archivedAt && element.entityId === parent.id && element.role === 'area')) return parent.name
    item = parent
  }
  return itemId === item?.id ? undefined : item?.name
}

export function buildCriticalItems(data: WorkspaceData, now: Date, threshold: number, limit: number): CriticalCleanlinessItem[] {
  const perChannelLimit = Math.max(1, Math.min(15, limit))
  const candidates = (['regular', 'deep'] as CleanlinessChannel[]).flatMap((channel) => data.entities
    .filter((entity) => !entity.archivedAt)
    .flatMap((entity) => {
      const result = itemChannelCleanliness(data, entity.id, channel, now)
      if (result.score == null || result.score >= threshold) return []
      const dueAts = result.routineScores.flatMap(({ routineId }) => {
        const trajectory = data.healthTrajectories.find((row) => row.routineId === routineId && row.itemId === entity.id && row.cleanlinessChannel === channel)
        return trajectory ? [trajectory.healthDueAt] : []
      }).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      const theoreticalDueAt = dueAts[0]
      return [{ itemId: entity.id, name: entity.name, roomName: roomNameForItem(data, entity.id), score: result.score, theoreticalDueAt, overdue: Boolean(theoreticalDueAt && new Date(theoreticalDueAt).getTime() < now.getTime()), channel }]
    })
    .sort((a, b) => a.score - b.score || Number(b.overdue) - Number(a.overdue) || new Date(a.theoreticalDueAt ?? 8640000000000000).getTime() - new Date(b.theoreticalDueAt ?? 8640000000000000).getTime() || a.name.localeCompare(b.name))
    )
  // Choose the worst items in each channel, but show every below-threshold
  // channel for a chosen item. Otherwise a card can incorrectly hide its Deep
  // warning just because another item occupied that channel's display limit.
  const selected = new Set((['regular', 'deep'] as CleanlinessChannel[]).flatMap((channel) => candidates.filter((item) => item.channel === channel).slice(0, perChannelLimit).map((item) => item.itemId)))
  return candidates.filter((item) => selected.has(item.itemId))
    .sort((a, b) => a.score - b.score || Number(b.overdue) - Number(a.overdue) || a.name.localeCompare(b.name))
}

export function mergeCriticalItemsByEntity(items: CriticalCleanlinessItem[]): CriticalCleanlinessSummary[] {
  const byItem = new Map<string, CriticalCleanlinessSummary>()
  for (const item of items) {
    const existing = byItem.get(item.itemId)
    if (existing) existing.channels.push(item)
    else byItem.set(item.itemId, { itemId: item.itemId, name: item.name, roomName: item.roomName, channels: [item] })
  }
  return [...byItem.values()]
    .map((item) => ({ ...item, channels: [...item.channels].sort((a, b) => a.channel === b.channel ? 0 : a.channel === 'regular' ? -1 : 1) }))
    .sort((a, b) => Math.min(...a.channels.map((channel) => channel.score)) - Math.min(...b.channels.map((channel) => channel.score)) || a.name.localeCompare(b.name))
}

export function buildOverviewGroups(
  data: WorkspaceData,
  options: { now?: Date; currentMemberId?: string; scope?: OverviewScope; criticalThreshold?: number; criticalCount?: number } = {},
): OverviewGroups {
  const now = options.now ?? new Date()
  const timezone = data.workspace.timezone
  const today = localDateInZone(timezone, now)
  const upcomingEndDay = addDays(today, 7)
  const routineById = new Map(data.routines.map((routine) => [routine.id, routine]))
  const tasks = dedupeOccurrences(data)
    .filter((task) => task.state !== 'cancelled')
    .filter((task) => {
      const routine = routineById.get(task.routineId)
      return task.state !== 'scheduled' || (routine ? isRoutineActive(routine) : true)
    })
    .filter((task) => options.scope !== 'mine' || !options.currentMemberId || !task.assigneeMemberId || task.assigneeMemberId === options.currentMemberId)

  const scheduled = tasks.filter((task) => task.state === 'scheduled')
  const overdue = scheduled.filter((task) => localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) < today)
  const dueNow = scheduled.filter((task) => {
    const due = new Date(task.effectiveDueAt ?? task.dueAt)
    return localDateInZone(timezone, due) === today && due.getTime() <= now.getTime()
  })
  const laterToday = scheduled.filter((task) => {
    const due = new Date(task.effectiveDueAt ?? task.dueAt)
    return localDateInZone(timezone, due) === today && due.getTime() > now.getTime()
  })
  const finished = tasks.filter((task) => {
    const latest = latestWorkflowEvent(data.taskEvents, task.id)
    if (latest?.type === 'REOPENED') return false
    if (task.state === 'completed' || task.state === 'skipped') {
      const at = latestTerminalAt(data.taskEvents, task.id) ?? task.completedAt ?? task.effectiveDueAt ?? task.dueAt
      return localDateInZone(timezone, new Date(at)) === today
    }
    return task.state === 'scheduled' && latest?.type === 'POSTPONED' && localDateInZone(timezone, new Date(latest.at)) === today && localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) > today
  })
  const finishedIds = new Set(finished.map((task) => task.id))
  const upcoming = scheduled.filter((task) => {
    if (finishedIds.has(task.id)) return false
    const due = new Date(task.effectiveDueAt ?? task.dueAt)
    const localDay = localDateInZone(timezone, due)
    return localDay > today && localDay <= upcomingEndDay
  })

  const asc = (a: TaskOccurrence, b: TaskOccurrence) => new Date(a.effectiveDueAt ?? a.dueAt).getTime() - new Date(b.effectiveDueAt ?? b.dueAt).getTime()
  const descTerminal = (a: TaskOccurrence, b: TaskOccurrence) => new Date(latestTerminalAt(data.taskEvents, b.id) ?? b.dueAt).getTime() - new Date(latestTerminalAt(data.taskEvents, a.id) ?? a.dueAt).getTime()
  return {
    overdue: overdue.sort(asc),
    dueNow: dueNow.sort(asc),
    laterToday: laterToday.sort(asc),
    finished: finished.sort(descTerminal),
    upcoming: upcoming.sort(asc),
    criticalItems: buildCriticalItems(data, now, options.criticalThreshold ?? 20, options.criticalCount ?? 3),
  }
}
