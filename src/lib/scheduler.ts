import type { AssignmentPolicy, RecurrenceRule, Routine, TaskEvent, WorkspaceData, WorkspaceMember } from '../types/domain'
import {
  addDays,
  addMonthsClamped,
  daysBetween,
  localDateInZone,
  localDateTimeInZone,
  monthsBetween,
  nthWeekdayOfMonth,
  weekday,
  weeksBetween,
  zonedLocalToUtc,
} from './date'
import { newId, nowIso, stableId } from './id'
import { resolveAssignment } from './assignment'
import { resolvedRoutineTargets, selectorSummary } from './targeting'

export interface OccurrenceDate {
  date: string
  index: number
}

export interface OccurrenceSlot {
  date: string
  time: string
  dueAt: string
  index: number
  source: 'rule' | 'inclusion'
}

function ruleAnchorDate(rule: RecurrenceRule): string {
  return rule.kind === 'once' ? rule.date : rule.anchorDate
}

function recurrenceMatchesDate(rule: RecurrenceRule, date: string): boolean {
  if (rule.kind === 'once') return date === rule.date
  if (rule.kind === 'daily') {
    const distance = daysBetween(rule.anchorDate, date)
    return distance >= 0 && distance % Math.max(1, rule.interval) === 0
  }
  if (rule.kind === 'interval') {
    if (rule.unit === 'hour') return false
    if (rule.unit === 'day') {
      const distance = daysBetween(rule.anchorDate, date)
      return distance >= 0 && distance % Math.max(1, rule.interval) === 0
    }
    if (rule.unit === 'week') {
      const distance = daysBetween(rule.anchorDate, date)
      return distance >= 0 && distance % (7 * Math.max(1, rule.interval)) === 0
    }
    const monthDistance = monthsBetween(rule.anchorDate, date)
    if (monthDistance < 0 || monthDistance % Math.max(1, rule.interval) !== 0) return false
    return addMonthsClamped(rule.anchorDate, monthDistance) === date
  }
  if (rule.kind === 'weekdays') {
    const distance = daysBetween(rule.anchorDate, date)
    if (distance < 0 || !rule.weekdays.includes(weekday(date))) return false
    const weekDistance = weeksBetween(rule.anchorDate, date)
    return weekDistance >= 0 && weekDistance % Math.max(1, rule.intervalWeeks) === 0
  }

  const [year, month] = date.split('-').map(Number)
  const monthDistance = monthsBetween(rule.anchorDate, date)
  if (monthDistance < 0 || monthDistance % Math.max(1, rule.intervalMonths) !== 0) return false
  return nthWeekdayOfMonth(year, month, rule.weekday, rule.ordinal) === date
}

/** Compatibility helper used by Phase-1 UI/tests. Hourly rules are represented
 * by their local dates, while occurrenceSlots() is authoritative for tasks. */
export function occurrenceDates(routine: Routine, from: string, to: string): OccurrenceDate[] {
  if (routine.recurrence.kind === 'interval' && routine.recurrence.unit === 'hour') {
    const timezone = 'UTC'
    return occurrenceSlots({ ...routine, exceptions: routine.exceptions ?? { excludedDates: [], includedDateTimes: [] } }, from, to, timezone)
      .map((slot, index) => ({ date: slot.date, index }))
  }
  const anchor = ruleAnchorDate(routine.recurrence)
  const scanStart = anchor < from ? anchor : from
  const dates: OccurrenceDate[] = []
  let index = 0
  for (let cursor = anchor; cursor <= to; cursor = addDays(cursor, 1)) {
    if (!recurrenceMatchesDate(routine.recurrence, cursor)) continue
    if (cursor >= scanStart && cursor >= from) dates.push({ date: cursor, index })
    index += 1
  }
  return dates
}

function fixedRuleSlots(routine: Routine, from: string, to: string, timezone: string, max = 600): OccurrenceSlot[] {
  const rule = routine.recurrence
  const excluded = new Set(routine.exceptions?.excludedDates ?? [])
  const slots: OccurrenceSlot[] = []

  if (rule.kind === 'interval' && rule.unit === 'hour') {
    const anchorIso = zonedLocalToUtc(rule.anchorDate, routine.timeOfDay, timezone)
    const fromIso = zonedLocalToUtc(from, '00:00', timezone)
    const toExclusiveIso = zonedLocalToUtc(addDays(to, 1), '00:00', timezone)
    const intervalMs = Math.max(1, rule.interval) * 3_600_000
    const anchorMs = new Date(anchorIso).getTime()
    const fromMs = new Date(fromIso).getTime()
    const toMs = new Date(toExclusiveIso).getTime()
    const firstIndex = Math.max(0, Math.ceil((fromMs - anchorMs) / intervalMs))
    for (let index = firstIndex; slots.length < max; index += 1) {
      const dueMs = anchorMs + index * intervalMs
      if (dueMs >= toMs) break
      const local = localDateTimeInZone(timezone, new Date(dueMs))
      const [date, time] = local.split('T')
      if (excluded.has(date)) continue
      slots.push({ date, time, dueAt: new Date(dueMs).toISOString(), index, source: 'rule' })
    }
  } else {
    const anchor = ruleAnchorDate(rule)
    let index = 0
    for (let cursor = anchor; cursor <= to && slots.length < max; cursor = addDays(cursor, 1)) {
      if (!recurrenceMatchesDate(rule, cursor)) continue
      if (cursor >= from && !excluded.has(cursor)) {
        slots.push({ date: cursor, time: routine.timeOfDay, dueAt: zonedLocalToUtc(cursor, routine.timeOfDay, timezone), index, source: 'rule' })
      }
      index += 1
    }
  }

  const inclusionSlots = (routine.exceptions?.includedDateTimes ?? []).flatMap((value) => {
    const [date, time] = value.split('T')
    if (!date || !time || date < from || date > to) return []
    return [{ date, time, dueAt: zonedLocalToUtc(date, time, timezone), index: Number.MAX_SAFE_INTEGER, source: 'inclusion' as const }]
  })

  const merged = [...slots, ...inclusionSlots]
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())

  const deduped: OccurrenceSlot[] = []
  const seen = new Set<string>()
  for (const slot of merged) {
    if (seen.has(slot.dueAt)) continue
    seen.add(slot.dueAt)
    deduped.push({ ...slot, index: deduped.length })
  }
  return deduped
}

export function occurrenceSlots(routine: Routine, from: string, to: string, timezone: string, max = 600): OccurrenceSlot[] {
  return fixedRuleSlots(routine, from, to, timezone, max)
}

export function resolveAssignee(policy: AssignmentPolicy, members: WorkspaceMember[], index: number): string | undefined {
  if (policy.mode === 'unassigned') return undefined
  if (policy.mode === 'me' || policy.mode === 'member') return policy.memberId
  const eligible = policy.memberIds.filter((id) => members.some((member) => member.id === id && member.status === 'active'))
  if (!eligible.length) return undefined
  return eligible[index % eligible.length]
}

function taskSupplies(data: WorkspaceData, routine: Routine) {
  const action = data.actions.find((item) => item.id === routine.actionId)
  const ids = routine.supplyIdsOverride ?? action?.defaultSupplyIds ?? []
  return ids.flatMap((supplyId) => {
    const supply = data.supplies.find((item) => item.id === supplyId && !item.archivedAt)
    return supply ? [{ supplyId, supplyName: supply.name }] : []
  })
}

export function resolvedRoutineTargetIds(data: WorkspaceData, routine: Routine): string[] {
  return resolvedRoutineTargets(data, routine).map((item) => item.entity.id)
}

function scheduleExplanation(routine: Routine): string {
  const rule = routine.recurrence
  if (routine.scheduleMode === 'after_completion') return `Scheduled after completion using a ${rule.kind === 'interval' ? `${rule.interval} ${rule.unit}` : 'configured'} interval.`
  if (rule.kind === 'once') return `One-time occurrence on ${rule.date} at ${routine.timeOfDay}.`
  if (rule.kind === 'weekdays') return `Fixed calendar on weekdays ${rule.weekdays.join(', ')} at ${routine.timeOfDay}.`
  if (rule.kind === 'monthlyNth') return `Fixed monthly pattern at ${routine.timeOfDay}.`
  const interval = rule.kind === 'daily' ? `${rule.interval} day(s)` : `${rule.interval} ${rule.unit}(s)`
  return `Fixed calendar every ${interval} at ${routine.timeOfDay}.`
}

function appendTask(data: WorkspaceData, routine: Routine, dueAt: string, occurrenceIndex: number): WorkspaceData {
  const action = data.actions.find((item) => item.id === routine.actionId)
  if (!action || action.archivedAt) return data

  const resolvedTargets = resolvedRoutineTargets(data, routine)
  const targets = resolvedTargets.map(({ entity, reasons }) => {
    const type = data.entityTypes.find((item) => item.id === entity.typeId)
    return { entityId: entity.id, entityName: entity.name, entityTypeName: type?.name ?? 'Item', matchReasons: reasons }
  })
  if (!targets.length) return data

  const taskId = stableId(`task:${data.workspace.id}:${routine.id}:${routine.revision}:${dueAt}`)
  const assignmentResolution = resolveAssignment(data, routine, occurrenceIndex, dueAt)
  const assigneeMemberId = assignmentResolution.memberId
  const createdAt = nowIso()
  const task = {
    id: taskId,
    workspaceId: data.workspace.id,
    routineId: routine.id,
    routineRevision: routine.revision,
    routineNameSnapshot: routine.name,
    actionNameSnapshot: action.name,
    careLevel: routine.careLevel ?? 'routine',
    originalDueAt: dueAt,
    dueAt,
    state: 'scheduled' as const,
    assigneeMemberId,
    targets,
    supplies: taskSupplies(data, routine),
    explanation: {
      schedule: scheduleExplanation(routine),
      assignment: assignmentResolution.explanation,
      targetSummary: routine.advancedTargetSelector?.conditions.length ? selectorSummary(data, routine.advancedTargetSelector) : 'Explicitly selected targets.',
    },
    version: 1,
    createdAt,
  }
  const events: TaskEvent[] = [{
    id: newId(), workspaceId: data.workspace.id, taskId, type: 'TASK_CREATED' as const,
    at: createdAt, metadata: { routineRevision: routine.revision, scheduleMode: routine.scheduleMode, careLevel: routine.careLevel ?? 'routine' },
  }]
  if (assigneeMemberId) {
    events.push({
      id: newId(), workspaceId: data.workspace.id, taskId, type: 'ASSIGNED' as const,
      at: createdAt, metadata: { assigneeMemberId, assignmentMode: routine.assignment.mode, explanation: assignmentResolution.explanation },
    })
  }
  return { ...data, tasks: [...data.tasks, task], taskEvents: [...data.taskEvents, ...events] }
}

function terminalEventTime(data: WorkspaceData, taskId: string): string | undefined {
  return data.taskEvents
    .filter((event) => event.taskId === taskId && (event.type === 'COMPLETED' || event.type === 'SKIPPED'))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]?.at
}

function nextAfterCompletionDueAt(data: WorkspaceData, routine: Routine): string | null {
  const rule = routine.recurrence
  const intervalRule = rule.kind === 'daily'
    ? { unit: 'day' as const, interval: rule.interval, anchorDate: rule.anchorDate }
    : rule.kind === 'interval'
      ? rule
      : null
  if (!intervalRule) return null

  const terminalTasks = data.tasks
    .filter((task) => task.routineId === routine.id && (task.state === 'completed' || task.state === 'skipped'))
    .map((task) => ({ task, at: terminalEventTime(data, task.id) }))
    .filter((item): item is { task: typeof item.task; at: string } => Boolean(item.at))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  if (!terminalTasks.length) return zonedLocalToUtc(intervalRule.anchorDate, routine.timeOfDay, data.workspace.timezone)

  const last = terminalTasks[0].at
  if (intervalRule.unit === 'hour') {
    return new Date(new Date(last).getTime() + Math.max(1, intervalRule.interval) * 3_600_000).toISOString()
  }

  const localCompletion = localDateTimeInZone(data.workspace.timezone, last)
  const completionDate = localCompletion.slice(0, 10)
  let nextDate = completionDate
  if (intervalRule.unit === 'day') nextDate = addDays(completionDate, Math.max(1, intervalRule.interval))
  else if (intervalRule.unit === 'week') nextDate = addDays(completionDate, Math.max(1, intervalRule.interval) * 7)
  else nextDate = addMonthsClamped(completionDate, Math.max(1, intervalRule.interval))
  return zonedLocalToUtc(nextDate, routine.timeOfDay, data.workspace.timezone)
}

function materializeAfterCompletion(data: WorkspaceData, routine: Routine): WorkspaceData {
  const existingScheduled = data.tasks.some((task) => task.routineId === routine.id && task.routineRevision === routine.revision && task.state === 'scheduled')
  if (existingScheduled) return data
  const dueAt = nextAfterCompletionDueAt(data, routine)
  if (!dueAt) return data
  const duplicate = data.tasks.some((task) => task.routineId === routine.id && task.routineRevision === routine.revision && task.originalDueAt === dueAt)
  if (duplicate) return data
  const occurrenceIndex = data.tasks.filter((task) => task.routineId === routine.id && task.state !== 'cancelled').length
  return appendTask(data, routine, dueAt, occurrenceIndex)
}

export function materializeTasks(input: WorkspaceData, horizonDays = 45): WorkspaceData {
  const today = localDateInZone(input.workspace.timezone)
  const from = addDays(today, -1)
  const activeRoutines = input.routines.filter((routine) => !routine.archivedAt)
  let data = input

  for (const routine of activeRoutines) {
    if (routine.scheduleMode === 'after_completion') {
      data = materializeAfterCompletion(data, routine)
      continue
    }

    const isHourly = routine.recurrence.kind === 'interval' && routine.recurrence.unit === 'hour'
    const to = addDays(today, isHourly ? Math.min(horizonDays, 14) : horizonDays)
    const existing = new Set(data.tasks.map((task) => `${task.routineId}:${task.routineRevision}:${task.originalDueAt}`))
    for (const occurrence of occurrenceSlots(routine, from, to, data.workspace.timezone)) {
      const key = `${routine.id}:${routine.revision}:${occurrence.dueAt}`
      if (existing.has(key)) continue
      data = appendTask(data, routine, occurrence.dueAt, occurrence.index)
      existing.add(key)
    }
  }

  return data
}

export function previewDueAts(data: WorkspaceData, routine: Routine, count = 5): string[] {
  if (routine.scheduleMode === 'after_completion') {
    const first = nextAfterCompletionDueAt(data, routine)
    if (!first) return []
    const rule = routine.recurrence.kind === 'daily'
      ? { kind: 'interval' as const, unit: 'day' as const, interval: routine.recurrence.interval, anchorDate: routine.recurrence.anchorDate }
      : routine.recurrence
    if (rule.kind !== 'interval') return [first]
    const results = [first]
    let cursor = first
    for (let i = 1; i < count; i += 1) {
      if (rule.unit === 'hour') cursor = new Date(new Date(cursor).getTime() + Math.max(1, rule.interval) * 3_600_000).toISOString()
      else {
        const local = localDateTimeInZone(data.workspace.timezone, cursor)
        const localDate = local.slice(0, 10)
        const nextDate = rule.unit === 'day'
          ? addDays(localDate, Math.max(1, rule.interval))
          : rule.unit === 'week'
            ? addDays(localDate, Math.max(1, rule.interval) * 7)
            : addMonthsClamped(localDate, Math.max(1, rule.interval))
        cursor = zonedLocalToUtc(nextDate, routine.timeOfDay, data.workspace.timezone)
      }
      results.push(cursor)
    }
    return results
  }

  const today = localDateInZone(data.workspace.timezone)
  let horizon = 120
  while (horizon <= 730) {
    const slots = occurrenceSlots(routine, today, addDays(today, horizon), data.workspace.timezone, Math.max(100, count * 20))
    if (slots.length >= count || horizon === 730) return slots.slice(0, count).map((slot) => slot.dueAt)
    horizon *= 2
  }
  return []
}
