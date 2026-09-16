import type { AssignmentPolicy, CleanlinessChannel, RecurrenceRule, Routine, TaskEvent, TaskOccurrence, WorkspaceData, WorkspaceMember } from '../types/domain'
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
  /** 1-based ordinal from the recurrence anchor, never reset by a query window. */
  ordinal?: number
}

export function routineCleanlinessChannel(routine: Pick<Routine, 'cleanlinessChannel' | 'careLevel'>): CleanlinessChannel {
  return routine.cleanlinessChannel ?? (routine.careLevel === 'deep' ? 'deep' : 'regular')
}

export function routineTimezone(routine: Pick<Routine, 'routineTimezone'>, fallback: string): string {
  return routine.routineTimezone || fallback
}

export function isRoutineActive(routine: Pick<Routine, 'archivedAt' | 'status'>): boolean {
  return !routine.archivedAt && (routine.status ?? 'active') === 'active'
}

export function isCleanlinessTrackableRoutine(routine: Pick<Routine, 'recurrence' | 'status' | 'archivedAt' | 'affectsCleanliness'>): boolean {
  return isRoutineActive(routine) && routine.affectsCleanliness !== false && routine.recurrence.kind !== 'once'
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
      slots.push({ date, time, dueAt: new Date(dueMs).toISOString(), index, ordinal: index + 1, source: 'rule' })
    }
  } else {
    const anchor = ruleAnchorDate(rule)
    let index = 0
    for (let cursor = anchor; cursor <= to && slots.length < max; cursor = addDays(cursor, 1)) {
      if (!recurrenceMatchesDate(rule, cursor)) continue
      if (cursor >= from && !excluded.has(cursor)) {
        slots.push({ date: cursor, time: routine.timeOfDay, dueAt: zonedLocalToUtc(cursor, routine.timeOfDay, timezone), index, ordinal: index + 1, source: 'rule' })
      }
      index += 1
    }
  }

  const inclusionSlots: OccurrenceSlot[] = (routine.exceptions?.includedDateTimes ?? []).flatMap((value) => {
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
    if (routine.parentRoutineId && (slot.ordinal == null || slot.ordinal % Math.max(1, routine.triggerEvery ?? 1) !== 0)) continue
    deduped.push({ ...slot, index: deduped.length })
  }
  return deduped
}

export function occurrenceSlots(routine: Routine, from: string, to: string, timezone: string, max = 600): OccurrenceSlot[] {
  return fixedRuleSlots(routine, from, to, routineTimezone(routine, timezone), max)
}

/** Canonical routine cadence for cleanliness. One-off occurrence exceptions are
 * intentionally ignored: moving/skipping a workflow occurrence must not make
 * the physical item cleaner or change its maintenance cadence. */
export function theoreticalOccurrenceSlots(routine: Routine, from: string, to: string, timezone: string, max = 600): OccurrenceSlot[] {
  const zone = routineTimezone(routine, timezone)
  return fixedRuleSlots({ ...routine, exceptions: { excludedDates: [], includedDateTimes: [] } }, from, to, zone, max)
    .filter((slot) => slot.source === 'rule')
}

function intervalRuleForRoutine(routine: Routine): { unit: 'hour' | 'day' | 'week' | 'month'; interval: number } | null {
  const rule = routine.recurrence
  if (rule.kind === 'daily') return { unit: 'day', interval: Math.max(1, rule.interval) }
  if (rule.kind === 'interval') return { unit: rule.unit, interval: Math.max(1, rule.interval) }
  return null
}

function addIntervalFromInstant(routine: Routine, instant: string, timezone: string): string | null {
  const intervalRule = intervalRuleForRoutine(routine)
  if (!intervalRule) return null
  if (intervalRule.unit === 'hour') return new Date(new Date(instant).getTime() + intervalRule.interval * 3_600_000).toISOString()
  const local = localDateTimeInZone(timezone, instant)
  const localDate = local.slice(0, 10)
  const nextDate = intervalRule.unit === 'day'
    ? addDays(localDate, intervalRule.interval)
    : intervalRule.unit === 'week'
      ? addDays(localDate, intervalRule.interval * 7)
      : addMonthsClamped(localDate, intervalRule.interval)
  return zonedLocalToUtc(nextDate, routine.timeOfDay, timezone)
}

/** Return the next theoretical cadence point strictly after an instant. */
export function nextTheoreticalSlotAfter(routine: Routine, afterAt: string, timezone: string): string | null {
  const zone = routineTimezone(routine, timezone)
  if (routine.recurrence.kind === 'once') {
    const due = zonedLocalToUtc(routine.recurrence.date, routine.timeOfDay, zone)
    return new Date(due).getTime() > new Date(afterAt).getTime() ? due : null
  }
  if (routine.scheduleMode === 'after_completion') {
    let cursor: string | null = afterAt
    const count = routine.parentRoutineId ? Math.max(1, routine.triggerEvery ?? 1) : 1
    // Future completion times are unknown: use N nominal parent intervals for
    // the physical-state estimate, not the child task's execution date.
    for (let i = 0; i < count && cursor; i += 1) cursor = addIntervalFromInstant(routine, cursor, zone)
    return cursor
  }

  const afterMs = new Date(afterAt).getTime()
  const localDate = localDateInZone(zone, new Date(afterMs))
  for (const horizon of [31, 180, 730, 3660, 36600]) {
    const slots = theoreticalOccurrenceSlots(routine, addDays(localDate, -1), addDays(localDate, horizon), zone, 5000)
    const next = slots.find((slot) => new Date(slot.dueAt).getTime() > afterMs)
    if (next) return next.dueAt
  }
  return null
}

export function followingTheoreticalSlot(routine: Routine, slotAt: string, timezone: string): string | null {
  return nextTheoreticalSlotAfter(routine, slotAt, timezone)
}

export function resolveAssignee(policy: AssignmentPolicy, members: WorkspaceMember[], index: number): string | undefined {
  if (policy.mode === 'unassigned' || policy.mode === 'everyone') return undefined
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

function appendTask(data: WorkspaceData, routine: Routine, dueAt: string, occurrenceIndex: number, triggerOrdinal?: number, parentTask?: TaskOccurrence): WorkspaceData {
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
  const assigneeMemberId = parentTask ? parentTask.assigneeMemberId : assignmentResolution.memberId
  const createdAt = nowIso()
  const task: TaskOccurrence = {
    id: taskId,
    workspaceId: data.workspace.id,
    routineId: routine.id,
    routineRevision: routine.revision,
    triggerOrdinal,
    parentOccurrenceId: parentTask?.id,
    routineNameSnapshot: routine.name,
    actionNameSnapshot: action.name,
    cleanlinessChannel: routineCleanlinessChannel(routine),
    careLevel: routineCleanlinessChannel(routine) === 'deep' ? 'deep' : 'routine',
    scheduledSlotAt: dueAt,
    effectiveDueAt: parentTask?.effectiveDueAt ?? dueAt,
    originalDueAt: dueAt,
    dueAt: parentTask?.effectiveDueAt ?? dueAt,
    state: 'scheduled' as const,
    assignmentScope: parentTask?.assignmentScope ?? assignmentResolution.scope,
    assigneeMemberId,
    targets,
    supplies: taskSupplies(data, routine),
    explanation: {
      schedule: routine.parentRoutineId ? `Every ${routine.triggerEvery} scheduled occurrences of the parent routine. Occurrence ${triggerOrdinal}.` : scheduleExplanation(routine),
      assignment: assignmentResolution.explanation,
      targetSummary: routine.advancedTargetSelector?.conditions.length ? selectorSummary(data, routine.advancedTargetSelector) : 'Explicitly selected targets.',
    },
    version: 1,
    createdAt,
  }
  const events: TaskEvent[] = [{
    id: newId(), workspaceId: data.workspace.id, taskId, type: 'TASK_CREATED' as const,
    at: createdAt, metadata: { routineRevision: routine.revision, scheduleMode: routine.scheduleMode, cleanlinessChannel: routineCleanlinessChannel(routine), careLevel: routine.careLevel ?? 'routine', scheduledSlotAt: dueAt },
  }]
  if (assignmentResolution.scope !== 'unassigned') {
    events.push({
      id: newId(), workspaceId: data.workspace.id, taskId, type: 'ASSIGNED' as const,
      at: createdAt, metadata: { assigneeMemberId: assigneeMemberId ?? null, assignmentScope: assignmentResolution.scope, assignmentMode: routine.assignment.mode, explanation: assignmentResolution.explanation },
    })
  }
  return { ...data, tasks: [...data.tasks, task], taskEvents: [...data.taskEvents, ...events] }
}


/** Materialize one canonical scheduled slot without creating a duplicate. Used by
 * lifecycle flows such as Resume that need an explicit future slot. */
export function materializeRoutineSlot(data: WorkspaceData, routine: Routine, dueAt: string): WorkspaceData {
  const duplicate = data.tasks.some((task) => task.routineId === routine.id && task.routineRevision === routine.revision && (task.scheduledSlotAt ?? task.originalDueAt) === dueAt)
  if (duplicate) return data
  const occurrenceIndex = data.tasks.filter((task) => task.routineId === routine.id && task.state !== 'cancelled').length
  const sameSlot = data.tasks.find((task) => task.routineId === routine.id && (task.scheduledSlotAt ?? task.originalDueAt) === dueAt)
  let ordinal = sameSlot?.triggerOrdinal
  if (ordinal == null && routine.scheduleMode === 'fixed') ordinal = ordinalForSlot(routine, dueAt, data.workspace.timezone)
  if (ordinal == null && routine.scheduleMode === 'after_completion') {
    const slots = [...new Set(data.tasks.filter((task) => task.routineId === routine.id).map((task) => task.scheduledSlotAt ?? task.originalDueAt))].sort()
    ordinal = sameSlot ? slots.indexOf(dueAt) + 1 : Math.max(slots.length, ...data.tasks.filter((task) => task.routineId === routine.id).map((task) => task.triggerOrdinal ?? 0)) + 1
  }
  return appendTask(data, routine, dueAt, occurrenceIndex, ordinal)
}

function terminalEventTime(data: WorkspaceData, taskId: string): string | undefined {
  return data.taskEvents
    .filter((event) => event.taskId === taskId && (event.type === 'COMPLETED' || event.type === 'SKIPPED'))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]?.at
}

function nextAfterCompletionDueAt(data: WorkspaceData, routine: Routine): string | null {
  const intervalRule = intervalRuleForRoutine(routine)
  if (!intervalRule) return null

  const terminalTasks = data.tasks
    .filter((task) => task.routineId === routine.id && (task.state === 'completed' || task.state === 'skipped'))
    .map((task) => ({ task, at: terminalEventTime(data, task.id) }))
    .sort((a, b) => new Date(b.task.scheduledSlotAt ?? b.task.originalDueAt).getTime() - new Date(a.task.scheduledSlotAt ?? a.task.originalDueAt).getTime())

  if (!terminalTasks.length) return zonedLocalToUtc(ruleAnchorDate(routine.recurrence), routine.timeOfDay, data.workspace.timezone)

  const latest = terminalTasks[0]
  // Completion-relative schedules re-anchor only on a real completion. Skip-once
  // advances from the immutable slot instead of from the time the user tapped Skip.
  const base = latest.task.state === 'completed' && latest.at
    ? latest.at
    : (latest.task.scheduledSlotAt ?? latest.task.originalDueAt)
  return addIntervalFromInstant(routine, base, data.workspace.timezone)
}

function retireSupersededScheduledTasks(input: WorkspaceData): WorkspaceData {
  const routineById = new Map(input.routines.map((routine) => [routine.id, routine]))
  const alreadyCancelled = new Set(input.taskEvents
    .filter((event) => event.type === 'CANCELLED')
    .map((event) => event.taskId))
  const cancelledIds: string[] = []
  const tasks = input.tasks.map((task) => {
    if (task.state !== 'scheduled') return task
    const routine = routineById.get(task.routineId)
    if (routine && isRoutineActive(routine) && task.routineRevision === routine.revision) return task
    cancelledIds.push(task.id)
    return { ...task, state: 'cancelled' as const, version: task.version + 1 }
  })
  if (!cancelledIds.length) return input
  const at = nowIso()
  const events: TaskEvent[] = cancelledIds
    .filter((taskId) => !alreadyCancelled.has(taskId))
    .map((taskId) => ({
      id: newId(), workspaceId: input.workspace.id, taskId, type: 'CANCELLED' as const, at,
      metadata: { reason: 'routine_superseded' },
    }))
  return { ...input, tasks, taskEvents: [...input.taskEvents, ...events] }
}

function materializeAfterCompletion(data: WorkspaceData, routine: Routine): WorkspaceData {
  const existingScheduled = data.tasks.some((task) => task.routineId === routine.id && task.routineRevision === routine.revision && task.state === 'scheduled')
  if (existingScheduled) return data
  const dueAt = nextAfterCompletionDueAt(data, routine)
  if (!dueAt) return data
  return materializeRoutineSlot(data, routine, dueAt)
}

export function materializeTasks(input: WorkspaceData, horizonDays = 45): WorkspaceData {
  let data = retireSupersededScheduledTasks(input)
  const today = localDateInZone(data.workspace.timezone)
  const from = addDays(today, -1)
  const activeRoutines = data.routines.filter((routine) => isRoutineActive(routine) && !routine.parentRoutineId)

  for (const routine of activeRoutines) {
    if (routine.scheduleMode === 'after_completion') {
      data = materializeAfterCompletion(data, routine)
      continue
    }

    const isHourly = routine.recurrence.kind === 'interval' && routine.recurrence.unit === 'hour'
    const to = addDays(today, isHourly ? Math.min(horizonDays, 14) : horizonDays)
    const existing = new Set(data.tasks.map((task) => `${task.routineId}:${task.routineRevision}:${task.scheduledSlotAt ?? task.originalDueAt}`))
    for (const occurrence of occurrenceSlots(routine, from, to, data.workspace.timezone)) {
      const key = `${routine.id}:${routine.revision}:${occurrence.dueAt}`
      if (existing.has(key)) continue
      data = appendTask(data, routine, occurrence.dueAt, occurrence.index, occurrence.ordinal)
      existing.add(key)
    }
  }

  return materializeAdditionalActivities(data)
}

/** Recover a canonical fixed-calendar ordinal for existing pre-v1.2.1 rows. */
export function ordinalForSlot(routine: Routine, slotAt: string, timezone: string): number | undefined {
  const day = localDateInZone(routineTimezone(routine, timezone), new Date(slotAt))
  return theoreticalOccurrenceSlots({ ...routine, parentRoutineId: undefined }, day, day, timezone, 10000)
    .find((slot) => new Date(slot.dueAt).getTime() === new Date(slotAt).getTime())?.ordinal
}

/** Independent task records, shared parent trigger. Completion/skip never cascade. */
export function materializeAdditionalActivities(input: WorkspaceData): WorkspaceData {
  let data = input
  const existing = new Set(data.tasks.map((task) => `${task.routineId}:${task.routineRevision}:${task.scheduledSlotAt ?? task.originalDueAt}`))
  for (const child of data.routines.filter((routine) => routine.parentRoutineId && isRoutineActive(routine))) {
    const parent = data.routines.find((routine) => routine.id === child.parentRoutineId)
    if (!parent || !isRoutineActive(parent) || parent.parentRoutineId) continue
    const every = Math.max(1, child.triggerEvery ?? 1)
    const parentSlots = [...new Set(data.tasks.filter((task) => task.routineId === parent.id).map((task) => task.scheduledSlotAt ?? task.originalDueAt))].sort()
    for (const task of data.tasks.filter((task) => task.routineId === parent.id && task.routineRevision === parent.revision && task.state !== 'cancelled')) {
      const slotAt = task.scheduledSlotAt ?? task.originalDueAt
      // Do not invent work for a parent trigger that happened before the linked
      // activity existed. Terminal parent rows are still eligible here: if the
      // parent was completed/skipped before a refresh materialized its linked
      // activity, the child must remain actionable rather than vanish.
      if (new Date(slotAt).getTime() < new Date(child.createdAt).getTime()) continue
      const ordinal = task.triggerOrdinal ?? (parent.scheduleMode === 'fixed' ? ordinalForSlot(parent, slotAt, data.workspace.timezone) : parentSlots.indexOf(slotAt) + 1)
      if (!ordinal || ordinal % every !== 0) continue
      const key = `${child.id}:${child.revision}:${slotAt}`
      if (existing.has(key)) continue
      data = appendTask(data, child, slotAt, ordinal - 1, ordinal, task)
      existing.add(key)
    }
  }
  return data
}

export function previewDueAts(data: WorkspaceData, routine: Routine, count = 5): string[] {
  if (routine.parentRoutineId && routine.scheduleMode === 'after_completion') {
    const previewData = materializeAdditionalActivities({ ...data, routines: [...data.routines.filter((item) => item.id !== routine.id), routine] })
    return previewData.tasks.filter((task) => task.routineId === routine.id && task.state === 'scheduled').map((task) => task.effectiveDueAt).slice(0, count)
  }
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
