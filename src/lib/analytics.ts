import { localDateInZone } from './date'
import type { StockStatus, SupplyEvent, TaskEvent, WorkspaceData } from '../types/domain'

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
    assignedDue: data.tasks.filter((task) => task.assigneeMemberId === member.id && task.state !== 'cancelled' && new Date(task.dueAt).getTime() >= start && new Date(task.dueAt).getTime() <= end).length,
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
