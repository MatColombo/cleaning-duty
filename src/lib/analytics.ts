import { addDays, localDateInZone, zonedLocalToUtc } from './date'
import { cleanlinessForTrajectory } from './cleanliness'
import { dedupeOccurrences } from './overview'
import { followingTheoreticalSlot, nextTheoreticalSlotAfter, resolvedRoutineTargetIds, routineCleanlinessChannel } from './scheduler'
import type { CleanlinessChannel, HealthTrajectory, Routine, StockStatus, SupplyEvent, TaskEvent, TaskOccurrence, WorkspaceData } from '../types/domain'

export interface CompletionSummary {
  due: number
  completed: number
  skipped: number
  stillOpen: number
  completionRate: number
  onTimeRate: number
}

export interface MemberWorkload {
  memberId?: string
  name: string
  completed: number
  assignedDue: number
}

export interface DailyCompletion {
  date: string
  completed: number
  skipped: number
}

export interface SupplyForecast {
  supplyId: string
  name: string
  status: StockStatus
  recentDrops: number
  estimatedLowAt?: string
  confidence: 'none' | 'low' | 'medium'
}

export interface AuditEntry {
  id: string
  source: 'task' | 'supply'
  eventType: TaskEvent['type'] | SupplyEvent['type']
  at: string
  actorMemberId?: string
  title: string
  detail: string
  taskId?: string
  supplyId?: string
}

const stockRank: Record<StockStatus, number> = { available: 0, low: 1, reserve_only: 2, out_of_stock: 3 }

function eventCompletionForTask(data: WorkspaceData, taskId: string) {
  return data.taskEvents.find((event) => event.taskId === taskId && event.type === 'COMPLETED')
}

export function completionSummary(data: WorkspaceData, days = 30, now = new Date()): CompletionSummary {
  const end = now.getTime()
  const start = end - days * 86_400_000
  const due = data.tasks.filter((task) => task.state !== 'cancelled' && new Date(task.dueAt).getTime() >= start && new Date(task.dueAt).getTime() <= end)
  const completed = due.filter((task) => task.state === 'completed').length
  const skipped = due.filter((task) => task.state === 'skipped').length
  const stillOpen = due.filter((task) => task.state === 'scheduled').length
  const completedWithEvent = due.filter((task) => task.state === 'completed').map((task) => ({ task, event: eventCompletionForTask(data, task.id) })).filter((item) => item.event)
  const onTime = completedWithEvent.filter(({ task, event }) => new Date(event!.at).getTime() <= new Date(task.dueAt).getTime()).length
  return {
    due: due.length,
    completed,
    skipped,
    stillOpen,
    completionRate: due.length ? Math.round((completed / due.length) * 100) : 100,
    onTimeRate: completedWithEvent.length ? Math.round((onTime / completedWithEvent.length) * 100) : 100,
  }
}

export function memberWorkload(data: WorkspaceData, days = 30, now = new Date()): MemberWorkload[] {
  const end = now.getTime()
  const start = end - days * 86_400_000
  const activeMembers = data.members.filter((member) => member.status === 'active')
  const taskById = new Map(data.tasks.map((task) => [task.id, task]))
  const completedBy = new Map<string | undefined, number>()
  for (const event of data.taskEvents) {
    if (event.type !== 'COMPLETED') continue
    const at = new Date(event.at).getTime()
    if (at < start || at > end) continue
    const task = taskById.get(event.taskId)
    const memberId = event.actorMemberId ?? task?.assigneeMemberId
    completedBy.set(memberId, (completedBy.get(memberId) ?? 0) + 1)
  }
  return activeMembers.map((member) => ({
    memberId: member.id,
    name: member.displayName,
    completed: completedBy.get(member.id) ?? 0,
    assignedDue: data.tasks.filter((task) => (task.assigneeMemberId === member.id || task.assignmentScope === 'everyone') && task.state !== 'cancelled' && new Date(task.dueAt).getTime() >= start && new Date(task.dueAt).getTime() <= end).length,
  })).sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name))
}

export function dailyCompletionTrend(data: WorkspaceData, days = 14, now = new Date()): DailyCompletion[] {
  const timezone = data.workspace.timezone
  const result: DailyCompletion[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * 86_400_000)
    result.push({ date: localDateInZone(timezone, date), completed: 0, skipped: 0 })
  }
  const byDate = new Map(result.map((row) => [row.date, row]))
  for (const event of data.taskEvents) {
    if (event.type !== 'COMPLETED' && event.type !== 'SKIPPED') continue
    const row = byDate.get(localDateInZone(timezone, new Date(event.at)))
    if (!row) continue
    if (event.type === 'COMPLETED') row.completed += 1
    else row.skipped += 1
  }
  return result
}

function statusFromMetadata(value: unknown): StockStatus | undefined {
  return value === 'available' || value === 'low' || value === 'reserve_only' || value === 'out_of_stock' ? value : undefined
}

export function supplyForecasts(data: WorkspaceData, now = new Date()): SupplyForecast[] {
  const nowMs = now.getTime()
  return data.supplies.filter((supply) => !supply.archivedAt).map((supply) => {
    const events = data.supplyEvents
      .filter((event) => event.supplyId === supply.id && event.type === 'STOCK_CHANGED')
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    const recentDrops = events.filter((event) => {
      const from = statusFromMetadata(event.metadata.from)
      const to = statusFromMetadata(event.metadata.to)
      return from && to && stockRank[to] > stockRank[from] && nowMs - new Date(event.at).getTime() <= 60 * 86_400_000
    }).length

    const restocks = events.filter((event) => statusFromMetadata(event.metadata.to) === 'available')
    const cycleDays: number[] = []
    for (const restock of restocks) {
      const restockAt = new Date(restock.at).getTime()
      const nextDrop = events.find((event) => new Date(event.at).getTime() > restockAt && statusFromMetadata(event.metadata.from) === 'available' && statusFromMetadata(event.metadata.to) !== 'available')
      if (!nextDrop) continue
      const delta = (new Date(nextDrop.at).getTime() - restockAt) / 86_400_000
      if (delta > 0 && delta < 365) cycleDays.push(delta)
    }
    const latestRestock = [...restocks].reverse()[0]
    let estimatedLowAt: string | undefined
    let confidence: SupplyForecast['confidence'] = 'none'
    if (supply.status === 'available' && latestRestock && cycleDays.length) {
      const averageDays = cycleDays.reduce((sum, value) => sum + value, 0) / cycleDays.length
      estimatedLowAt = new Date(new Date(latestRestock.at).getTime() + averageDays * 86_400_000).toISOString()
      confidence = cycleDays.length >= 3 ? 'medium' : 'low'
    }
    return { supplyId: supply.id, name: supply.name, status: supply.status, recentDrops, estimatedLowAt, confidence }
  }).sort((a, b) => stockRank[b.status] - stockRank[a.status] || b.recentDrops - a.recentDrops || a.name.localeCompare(b.name))
}

export function auditEntries(data: WorkspaceData): AuditEntry[] {
  const tasks = new Map(data.tasks.map((task) => [task.id, task]))
  const supplies = new Map(data.supplies.map((supply) => [supply.id, supply]))
  const taskRows: AuditEntry[] = data.taskEvents.map((event) => {
    const task = tasks.get(event.taskId)
    return {
      id: event.id,
      source: 'task',
      eventType: event.type,
      at: event.at,
      actorMemberId: event.actorMemberId,
      title: task ? `${task.actionNameSnapshot} · ${task.targets.map((target) => target.entityName).join(', ')}` : 'Task',
      detail: task?.routineNameSnapshot ?? '',
      taskId: event.taskId,
    }
  })
  const supplyRows: AuditEntry[] = data.supplyEvents.map((event) => ({
    id: event.id,
    source: 'supply',
    eventType: event.type,
    at: event.at,
    actorMemberId: event.actorMemberId,
    title: supplies.get(event.supplyId)?.name ?? 'Supply',
    detail: event.type === 'STOCK_CHANGED' ? `${String(event.metadata.from ?? '')} → ${String(event.metadata.to ?? '')}` : '',
    supplyId: event.supplyId,
  }))
  return [...taskRows, ...supplyRows].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

// v1.2 Analysis -------------------------------------------------------------

export interface TodayActivitySummary {
  completed: number
  skipped: number
  rescheduled: number
  roomsMaintained: number
  everythingHandled: boolean
  plannedCount: number
}

export interface CleanlinessTrendPoint {
  date: string
  regular: number | null
  deep: number | null
}

export interface ActivityOutcomeSummary {
  completed: number
  skipped: number
  rescheduled: number
}

export interface HistoryHealthDetail {
  itemName: string
  channel: CleanlinessChannel
  refreshLevelPctSnapshot: number
  cleanlinessBeforePct: number
  cleanlinessAfterPct: number
  healthRefreshApplied: boolean
}

export interface HistoryEntryV12 {
  id: string
  at: string
  taskId: string
  type: 'completed' | 'skipped' | 'rescheduled' | 'reopened'
  activity: string
  room?: string
  routine: string
  actor?: string
  previousDueAt?: string
  newDueAt?: string
  health: HistoryHealthDetail[]
}

function ancestorRoomName(data: WorkspaceData, itemId: string): string | undefined {
  let entity = data.entities.find((item) => item.id === itemId)
  const areaIds = new Set(data.layoutElements.filter((item) => !item.archivedAt && item.role === 'area').map((item) => item.entityId))
  const visited = new Set<string>()
  while (entity) {
    if (areaIds.has(entity.id)) return entity.name
    if (!entity.parentId || visited.has(entity.parentId)) return undefined
    visited.add(entity.parentId)
    entity = data.entities.find((item) => item.id === entity!.parentId)
  }
  return undefined
}

function taskRoomName(data: WorkspaceData, task: TaskOccurrence): string | undefined {
  const rooms = [...new Set(task.targets.flatMap((target) => ancestorRoomName(data, target.entityId) ?? []))]
  if (rooms.length === 1) return rooms[0]
  if (rooms.length > 1) return `${rooms[0]} +${rooms.length - 1}`
  return undefined
}

export function todayActivitySummary(data: WorkspaceData, now = new Date()): TodayActivitySummary {
  const timezone = data.workspace.timezone
  const today = localDateInZone(timezone, now)
  const eventsToday = data.taskEvents.filter((event) => localDateInZone(timezone, new Date(event.at)) === today)
  const completedEvents = eventsToday.filter((event) => event.type === 'COMPLETED')
  const completed = completedEvents.length
  const skipped = eventsToday.filter((event) => event.type === 'SKIPPED').length
  const rescheduled = eventsToday.filter((event) => event.type === 'POSTPONED').length
  const taskById = new Map(data.tasks.map((task) => [task.id, task]))
  const rooms = new Set<string>()
  for (const event of completedEvents) {
    const task = taskById.get(event.taskId)
    if (!task) continue
    for (const target of task.targets) {
      const room = ancestorRoomName(data, target.entityId)
      if (room) rooms.add(room)
    }
  }
  const planned = dedupeOccurrences(data).filter((task) => task.state !== 'cancelled' && localDateInZone(timezone, new Date(task.effectiveDueAt ?? task.dueAt)) === today)
  const everythingHandled = planned.length > 0 && planned.every((task) => task.state === 'completed' || task.state === 'skipped')
  return { completed, skipped, rescheduled, roomsMaintained: rooms.size, everythingHandled, plannedCount: planned.length }
}

export function activityOutcomeSummary(data: WorkspaceData, days = 30, now = new Date()): ActivityOutcomeSummary {
  const cutoff = now.getTime() - days * 86_400_000
  const events = data.taskEvents.filter((event) => new Date(event.at).getTime() >= cutoff && new Date(event.at).getTime() <= now.getTime())
  return {
    completed: events.filter((event) => event.type === 'COMPLETED').length,
    skipped: events.filter((event) => event.type === 'SKIPPED').length,
    rescheduled: events.filter((event) => event.type === 'POSTPONED').length,
  }
}

function historicalTrajectory(data: WorkspaceData, routine: Routine, itemId: string, channel: CleanlinessChannel, at: string): HealthTrajectory | null {
  if (new Date(at).getTime() < new Date(routine.createdAt).getTime()) return null
  const snapshot = data.completionSnapshots
    .filter((row) => row.trajectoryRoutineId === routine.id && row.itemId === itemId && row.cleanlinessChannel === channel && row.healthRefreshApplied && new Date(row.completedAt).getTime() <= new Date(at).getTime())
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
  const anchorAt = snapshot?.completedAt ?? routine.createdAt
  const anchorPct = snapshot?.cleanlinessAfterPct ?? 100
  let boundaryBase = anchorAt
  if (snapshot && routine.scheduleMode !== 'after_completion' && snapshot.sourceRoutineId === routine.id) {
    const slotMs = new Date(snapshot.scheduledSlotAt).getTime()
    const anchorMs = new Date(anchorAt).getTime()
    if (Number.isFinite(slotMs) && Number.isFinite(anchorMs) && slotMs > anchorMs) boundaryBase = snapshot.scheduledSlotAt
  }
  const healthDueAt = nextTheoreticalSlotAfter(routine, boundaryBase, data.workspace.timezone)
  if (!healthDueAt) return null
  const healthOverdueEndAt = followingTheoreticalSlot(routine, healthDueAt, data.workspace.timezone)
  if (!healthOverdueEndAt) return null
  return {
    workspaceId: data.workspace.id,
    itemId,
    routineId: routine.id,
    cleanlinessChannel: channel,
    healthAnchorAt: anchorAt,
    healthAnchorPct: anchorPct,
    healthDueAt,
    healthOverdueEndAt,
    lastRefreshCompletionId: snapshot?.id,
    updatedAt: anchorAt,
  }
}

function routineActiveAt(data: WorkspaceData, routine: Routine, at: string, evaluationNow: string): boolean {
  const atMs = new Date(at).getTime()
  if (atMs < new Date(routine.createdAt).getTime()) return false
  if (routine.archivedAt && atMs >= new Date(routine.archivedAt).getTime()) return false

  const taskIds = new Set(data.tasks.filter((task) => task.routineId === routine.id).map((task) => task.id))
  const transitions: Array<{ at: string; status: 'active' | 'paused' | 'ended' }> = []
  for (const event of data.taskEvents) {
    if (!taskIds.has(event.taskId)) continue
    if (event.type === 'CANCELLED' && event.metadata.reason === 'routine_paused') transitions.push({ at: event.at, status: 'paused' })
    else if (event.type === 'CANCELLED' && event.metadata.reason === 'routine_ended') transitions.push({ at: event.at, status: 'ended' })
    else if (event.type === 'REOPENED' && event.metadata.reason === 'routine_resumed') transitions.push({ at: event.at, status: 'active' })
  }
  transitions.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  let status: 'active' | 'paused' | 'ended' = 'active'
  for (const transition of transitions) {
    if (new Date(transition.at).getTime() > atMs) break
    status = transition.status
  }

  // A pause/end can occur when there are no future task rows to annotate. In that
  // edge case there is no historical transition timestamp to reconstruct, so only
  // the live endpoint falls back to the routine's canonical current status.
  if (Math.abs(atMs - new Date(evaluationNow).getTime()) < 60_000) status = routine.status ?? 'active'
  return status === 'active'
}

function historicalAggregate(data: WorkspaceData, channel: CleanlinessChannel, at: string, evaluationNow: string): number | null {
  const scoresByItem = new Map<string, number[]>()
  for (const routine of data.routines) {
    if (!routineActiveAt(data, routine, at, evaluationNow)) continue
    if (routine.recurrence.kind === 'once' || routineCleanlinessChannel(routine) !== channel) continue
    for (const itemId of resolvedRoutineTargetIds(data, routine)) {
      const trajectory = historicalTrajectory(data, routine, itemId, channel, at)
      if (!trajectory) continue
      const score = cleanlinessForTrajectory(trajectory, at)
      const list = scoresByItem.get(itemId) ?? []
      list.push(score)
      scoresByItem.set(itemId, list)
    }
  }
  const itemScores = [...scoresByItem.values()].map((scores) => Math.min(...scores))
  return itemScores.length ? itemScores.reduce((sum, score) => sum + score, 0) / itemScores.length : null
}

export function cleanlinessTrend(data: WorkspaceData, days = 30, now = new Date()): CleanlinessTrendPoint[] {
  const timezone = data.workspace.timezone
  const today = localDateInZone(timezone, now)
  const result: CleanlinessTrendPoint[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset)
    const at = date === today ? now.toISOString() : zonedLocalToUtc(date, '23:59', timezone)
    result.push({ date, regular: historicalAggregate(data, 'regular', at, now.toISOString()), deep: historicalAggregate(data, 'deep', at, now.toISOString()) })
  }
  return result
}

export function historyEntriesV12(data: WorkspaceData, days = 90, now = new Date()): HistoryEntryV12[] {
  const cutoff = now.getTime() - days * 86_400_000
  const tasks = new Map(data.tasks.map((task) => [task.id, task]))
  const members = new Map(data.members.map((member) => [member.id, member.displayName]))
  const entities = new Map(data.entities.map((entity) => [entity.id, entity.name]))
  const supported = new Set(['COMPLETED', 'SKIPPED', 'POSTPONED', 'REOPENED'])
  const eventRows = data.taskEvents
    .filter((event) => supported.has(event.type) && new Date(event.at).getTime() >= cutoff && new Date(event.at).getTime() <= now.getTime())
    .flatMap((event) => {
      const task = tasks.get(event.taskId)
      if (!task) return []
      const type: HistoryEntryV12['type'] = event.type === 'COMPLETED' ? 'completed' : event.type === 'SKIPPED' ? 'skipped' : event.type === 'POSTPONED' ? 'rescheduled' : 'reopened'
      const health = event.type === 'COMPLETED' ? data.completionSnapshots
        .filter((row) => row.occurrenceId === task.id && Math.abs(new Date(row.completedAt).getTime() - new Date(event.at).getTime()) < 1000)
        .map((row) => ({ itemName: entities.get(row.itemId) ?? 'Item', channel: row.cleanlinessChannel, refreshLevelPctSnapshot: row.refreshLevelPctSnapshot, cleanlinessBeforePct: row.cleanlinessBeforePct, cleanlinessAfterPct: row.cleanlinessAfterPct, healthRefreshApplied: row.healthRefreshApplied })) : []
      return [{ id: event.id, at: event.at, taskId: task.id, type, activity: task.actionNameSnapshot, room: taskRoomName(data, task), routine: task.routineNameSnapshot, actor: event.actorMemberId ? members.get(event.actorMemberId) : undefined, previousDueAt: event.type === 'POSTPONED' && typeof event.metadata.from === 'string' ? event.metadata.from : undefined, newDueAt: event.type === 'POSTPONED' && typeof event.metadata.to === 'string' ? event.metadata.to : undefined, health }]
    })
  const completedTaskIds = new Set(eventRows.filter((row) => row.type === 'completed').map((row) => row.taskId))
  const fallbackRows: HistoryEntryV12[] = data.tasks.flatMap((task) => {
    if (task.state !== 'completed' || !task.completedAt || completedTaskIds.has(task.id)) return []
    const atMs = new Date(task.completedAt).getTime()
    if (atMs < cutoff || atMs > now.getTime()) return []
    const health = data.completionSnapshots.filter((row) => row.occurrenceId === task.id && Math.abs(new Date(row.completedAt).getTime() - atMs) < 1000).map((row) => ({ itemName: entities.get(row.itemId) ?? 'Item', channel: row.cleanlinessChannel, refreshLevelPctSnapshot: row.refreshLevelPctSnapshot, cleanlinessBeforePct: row.cleanlinessBeforePct, cleanlinessAfterPct: row.cleanlinessAfterPct, healthRefreshApplied: row.healthRefreshApplied }))
    return [{ id: `completed-fallback:${task.id}:${task.completedAt}`, at: task.completedAt, taskId: task.id, type: 'completed' as const, activity: task.actionNameSnapshot, room: taskRoomName(data, task), routine: task.routineNameSnapshot, health }]
  })
  return [...eventRows, ...fallbackRows].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
