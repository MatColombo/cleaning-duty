import type {
  CleanlinessChannel,
  CompletionHealthEffect,
  CompletionSnapshot,
  HealthTrajectory,
  Routine,
  TaskOccurrence,
  WorkspaceData,
} from '../types/domain'
import { stableId } from './id'
import {
  followingTheoreticalSlot,
  isCleanlinessTrackableRoutine,
  isRoutineActive,
  nextTheoreticalSlotAfter,
  routineCleanlinessChannel,
} from './scheduler'
import { resolvedRoutineTargets } from './targeting'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function trajectoryKey(routineId: string, itemId: string, channel: CleanlinessChannel): string {
  return `${routineId}:${itemId}:${channel}`
}

export function normalizeRefreshLevel(value: number | undefined): number {
  return clamp(Number.isFinite(value) ? Number(value) : 100, 10, 100)
}

/** v1.2 canonical score. Before due, raw linear decay is floored at 10%; after
 * due it falls linearly from 10 to 0 over the following cadence interval. */
export function cleanlinessForTrajectory(trajectory: HealthTrajectory, now: string | Date = new Date()): number {
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const ta = new Date(trajectory.healthAnchorAt).getTime()
  const td = new Date(trajectory.healthDueAt).getTime()
  const to = new Date(trajectory.healthOverdueEndAt).getTime()
  const anchor = clamp(trajectory.healthAnchorPct, 0, 100)
  if (![t, ta, td, to].every(Number.isFinite)) return clamp(anchor, 0, 100)
  if (t <= ta) return anchor
  if (td <= ta) return t <= td ? Math.max(10, anchor) : 0
  if (t <= td) {
    const progress = clamp((t - ta) / (td - ta), 0, 1)
    return clamp(Math.max(10, anchor * (1 - progress)), 0, 100)
  }
  if (to <= td) return 0
  const overdueProgress = clamp((t - td) / (to - td), 0, 1)
  return clamp(10 * (1 - overdueProgress), 0, 100)
}

function completionEventAt(data: WorkspaceData, taskId: string): string | undefined {
  return data.taskEvents
    .filter((event) => event.taskId === taskId && event.type === 'COMPLETED')
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]?.at
}

function completionAtForTarget(data: WorkspaceData, task: TaskOccurrence, itemId: string): string | undefined {
  const target = task.targets.find((item) => item.entityId === itemId)
  // A stale completed_at column on a skipped/reopened occurrence is not physical
  // cleaning evidence. Target timestamps count only when backed by the explicit
  // TARGET_COMPLETED audit event (or when the whole occurrence is completed).
  if (target?.completedAt) {
    const targetEvent = data.taskEvents.some((event) => event.taskId === task.id
      && event.type === 'TARGET_COMPLETED'
      && event.metadata.entityId === itemId
      && event.at === target.completedAt)
    if (task.state === 'completed' || targetEvent) return target.completedAt
  }
  if (task.state !== 'completed') return undefined
  return task.completedAt ?? completionEventAt(data, task.id)
}

function activeTrackableRoutines(data: WorkspaceData): Routine[] {
  return data.routines.filter((routine) => isCleanlinessTrackableRoutine(routine) && (!routine.parentRoutineId || data.routines.some((parent) => parent.id === routine.parentRoutineId && isRoutineActive(parent))))
}

function routineTargetsItem(data: WorkspaceData, routine: Routine, itemId: string): boolean {
  return resolvedRoutineTargets(data, routine).some(({ entity }) => entity.id === itemId)
}

function nextBoundaries(
  data: WorkspaceData,
  routine: Routine,
  anchorAt: string,
  associatedScheduledSlotAt?: string,
): { dueAt: string; overdueEndAt: string } | null {
  // Fixed-calendar completions belong to an immutable cadence slot. If a task is
  // completed early, advance from that slot (not from the early execution time),
  // so the current slot cannot become the new health due boundary. If it is
  // completed very late, advance from the completion time so the new trajectory
  // never starts with a due boundary already behind its anchor. Completion-relative
  // routines intentionally re-anchor from the actual completion timestamp.
  let boundaryBase = anchorAt
  if (routine.scheduleMode !== 'after_completion' && associatedScheduledSlotAt) {
    const slotMs = new Date(associatedScheduledSlotAt).getTime()
    const anchorMs = new Date(anchorAt).getTime()
    if (Number.isFinite(slotMs) && Number.isFinite(anchorMs) && slotMs > anchorMs) boundaryBase = associatedScheduledSlotAt
  }
  const dueAt = nextTheoreticalSlotAfter(routine, boundaryBase, data.workspace.timezone)
  if (!dueAt) return null
  const overdueEndAt = followingTheoreticalSlot(routine, dueAt, data.workspace.timezone)
  if (!overdueEndAt) return null
  return { dueAt, overdueEndAt }
}

function latestLegacyCompletion(
  data: WorkspaceData,
  routine: Routine,
  itemId: string,
): { task: TaskOccurrence; completedAt: string } | null {
  const channel = routineCleanlinessChannel(routine)
  const candidates = data.tasks.flatMap((task) => {
    if (!task.targets.some((target) => target.entityId === itemId)) return []
    const taskChannel = task.cleanlinessChannel ?? (task.careLevel === 'deep' ? 'deep' : 'regular')
    const sameRoutine = task.routineId === routine.id
    // v1.1 intentionally linked deep completion to regular care. Preserve that
    // supported behavior when constructing the initial canonical trajectories.
    const deepCarriesToRegular = channel === 'regular' && taskChannel === 'deep'
    if (!sameRoutine && !deepCarriesToRegular) return []
    if (sameRoutine && taskChannel !== channel) return []
    // Modern completion events already contain their exact health effects. An
    // empty list is deliberate (including opt-out); never migrate it to a refresh.
    const modern = data.taskEvents.some((event) => event.taskId === task.id && (event.type === 'COMPLETED' || event.type === 'TARGET_COMPLETED') && Array.isArray(event.metadata.cleanlinessSnapshots))
    if (modern) return []
    const completedAt = completionAtForTarget(data, task, itemId)
    return completedAt ? [{ task, completedAt }] : []
  })
  return candidates.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0] ?? null
}

function initialTrajectory(data: WorkspaceData, routine: Routine, itemId: string): { trajectory: HealthTrajectory; snapshot?: CompletionSnapshot } | null {
  const channel = routineCleanlinessChannel(routine)
  const completion = latestLegacyCompletion(data, routine, itemId)
  const anchorAt = completion?.completedAt ?? routine.createdAt
  const associatedSlot = completion?.task.routineId === routine.id
    ? (completion.task.scheduledSlotAt ?? completion.task.originalDueAt)
    : undefined
  const boundaries = nextBoundaries(data, routine, anchorAt, associatedSlot)
  if (!boundaries) return null
  const snapshotId = completion
    ? stableId(`v12-legacy-completion:${completion.task.id}:${routine.id}:${itemId}:${channel}`)
    : undefined
  const trajectory: HealthTrajectory = {
    workspaceId: data.workspace.id,
    itemId,
    routineId: routine.id,
    cleanlinessChannel: channel,
    healthAnchorAt: anchorAt,
    healthAnchorPct: 100,
    healthDueAt: boundaries.dueAt,
    healthOverdueEndAt: boundaries.overdueEndAt,
    lastRefreshCompletionId: snapshotId,
    updatedAt: anchorAt,
  }
  const snapshot = completion && snapshotId ? {
    id: snapshotId,
    workspaceId: data.workspace.id,
    occurrenceId: completion.task.id,
    sourceRoutineId: completion.task.routineId,
    trajectoryRoutineId: routine.id,
    itemId,
    cleanlinessChannel: channel,
    completedAt: completion.completedAt,
    refreshLevelPctSnapshot: 100,
    cleanlinessBeforePct: 0,
    cleanlinessAfterPct: 100,
    healthRefreshApplied: true,
    scheduledSlotAt: completion.task.scheduledSlotAt ?? completion.task.originalDueAt,
    actorMemberId: data.taskEvents.find((event) => event.taskId === completion.task.id && event.type === 'COMPLETED')?.actorMemberId,
  } satisfies CompletionSnapshot : undefined
  return { trajectory, snapshot }
}

function completionSnapshotStillValid(data: WorkspaceData, snapshot: CompletionSnapshot): boolean {
  const task = data.tasks.find((item) => item.id === snapshot.occurrenceId)
  if (!task) return false
  const completionWasReopened = data.taskEvents.some((event) => event.taskId === task.id
    && event.type === 'REOPENED'
    && new Date(event.at).getTime() >= new Date(snapshot.completedAt).getTime()
    && (event.metadata.undoType === 'COMPLETED' || event.metadata.restoreType === 'COMPLETED'))
  if (completionWasReopened) return false
  const explicitTargetCompletion = data.taskEvents.some((event) => event.taskId === task.id
    && event.type === 'TARGET_COMPLETED'
    && event.metadata.entityId === snapshot.itemId
    && event.at === snapshot.completedAt)
  const explicitCompletion = data.taskEvents.some((event) => event.taskId === task.id
    && event.type === 'COMPLETED'
    && event.at === snapshot.completedAt)
  const legacyCompletedRow = task.state === 'completed' && task.completedAt === snapshot.completedAt
  return explicitTargetCompletion || explicitCompletion || legacyCompletedRow
}

/** Deterministic/idempotent upgrade and reconciliation. Stored trajectories are
 * retained only when their latest refresh is backed by real completion evidence;
 * missing/invalid ones are rebuilt from canonical completion history. */
export function reconcileCleanlinessState(input: WorkspaceData): WorkspaceData {
  const snapshots = new Map((input.completionSnapshots ?? []).map((row) => [row.id, row]))
  const existing = new Map((input.healthTrajectories ?? []).flatMap((row) => {
    if (!row.lastRefreshCompletionId) return [[trajectoryKey(row.routineId, row.itemId, row.cleanlinessChannel), row] as const]
    const snapshot = snapshots.get(row.lastRefreshCompletionId)
    return snapshot && completionSnapshotStillValid(input, snapshot)
      ? [[trajectoryKey(row.routineId, row.itemId, row.cleanlinessChannel), row] as const]
      : []
  }))
  const nextTrajectories = [...existing.values()]

  for (const routine of activeTrackableRoutines(input)) {
    const channel = routineCleanlinessChannel(routine)
    for (const { entity } of resolvedRoutineTargets(input, routine)) {
      const key = trajectoryKey(routine.id, entity.id, channel)
      const prior = existing.get(key)
      if (!prior) {
        const initial = initialTrajectory(input, routine, entity.id)
        if (!initial) continue
        existing.set(key, initial.trajectory)
        nextTrajectories.push(initial.trajectory)
        if (initial.snapshot && !snapshots.has(initial.snapshot.id)) snapshots.set(initial.snapshot.id, initial.snapshot)
        continue
      }
      const refreshSnapshot = prior.lastRefreshCompletionId ? snapshots.get(prior.lastRefreshCompletionId) : undefined
      const associatedSlot = refreshSnapshot?.trajectoryRoutineId === routine.id && refreshSnapshot.sourceRoutineId === routine.id
        ? refreshSnapshot.scheduledSlotAt
        : undefined
      const boundaries = nextBoundaries(input, routine, prior.healthAnchorAt, associatedSlot)
      if (!boundaries) continue
      const updated = { ...prior, healthDueAt: boundaries.dueAt, healthOverdueEndAt: boundaries.overdueEndAt }
      const index = nextTrajectories.findIndex((row) => trajectoryKey(row.routineId, row.itemId, row.cleanlinessChannel) === key)
      if (index >= 0) nextTrajectories[index] = updated
      existing.set(key, updated)
    }
  }

  return { ...input, healthTrajectories: nextTrajectories, completionSnapshots: [...snapshots.values()] }
}

function affectedTrajectories(data: WorkspaceData, sourceRoutine: Routine, itemId: string): Routine[] {
  const sourceChannel = routineCleanlinessChannel(sourceRoutine)
  const routines = activeTrackableRoutines(data).filter((routine) => routineTargetsItem(data, routine, itemId))
  if (sourceChannel === 'deep') {
    // Existing documented product behavior: a deep clean also refreshes regular
    // upkeep for the same physical item. Deep and regular remain separate curves.
    return routines.filter((routine) => routine.id === sourceRoutine.id || routineCleanlinessChannel(routine) === 'regular')
  }
  return routines.filter((routine) => routine.id === sourceRoutine.id)
}

export function buildCompletionHealthEffects(
  data: WorkspaceData,
  task: TaskOccurrence,
  completedAt: string,
  itemIds: string[],
  actorMemberId?: string,
): CompletionHealthEffect[] {
  const sourceRoutine = data.routines.find((routine) => routine.id === task.routineId)
  if (!sourceRoutine || !isRoutineActive(sourceRoutine) || sourceRoutine.affectsCleanliness === false) return []
  const refresh = normalizeRefreshLevel(sourceRoutine.refreshLevelPct)
  const effects: CompletionHealthEffect[] = []

  for (const itemId of [...new Set(itemIds)]) {
    for (const trajectoryRoutine of affectedTrajectories(data, sourceRoutine, itemId)) {
      const channel = routineCleanlinessChannel(trajectoryRoutine)
      const key = trajectoryKey(trajectoryRoutine.id, itemId, channel)
      const trajectory = data.healthTrajectories.find((row) => trajectoryKey(row.routineId, row.itemId, row.cleanlinessChannel) === key)
      if (!trajectory) continue
      const before = cleanlinessForTrajectory(trajectory, completedAt)
      const after = Math.max(before, refresh)
      const applied = refresh > before
      const snapshotId = stableId(`v12-completion:${task.id}:${trajectoryRoutine.id}:${itemId}:${channel}:${completedAt}`)
      const effect: CompletionHealthEffect = {
        snapshotId,
        sourceRoutineId: sourceRoutine.id,
        trajectoryRoutineId: trajectoryRoutine.id,
        itemId,
        cleanlinessChannel: channel,
        refreshLevelPctSnapshot: refresh,
        cleanlinessBeforePct: before,
        cleanlinessAfterPct: after,
        healthRefreshApplied: applied,
        scheduledSlotAt: task.scheduledSlotAt ?? task.originalDueAt,
      }
      if (applied) {
        const associatedSlot = trajectoryRoutine.id === sourceRoutine.id
          ? (task.scheduledSlotAt ?? task.originalDueAt)
          : undefined
        const boundaries = nextBoundaries(data, trajectoryRoutine, completedAt, associatedSlot)
        if (boundaries) {
          effect.healthAnchorAt = completedAt
          effect.healthAnchorPct = refresh
          effect.healthDueAt = boundaries.dueAt
          effect.healthOverdueEndAt = boundaries.overdueEndAt
        } else {
          effect.healthRefreshApplied = false
        }
      }
      effects.push(effect)
    }
  }
  void actorMemberId // actor is stored when the effect is committed to a snapshot.
  return effects
}

export function applyCompletionHealthEffects(
  input: WorkspaceData,
  occurrenceId: string,
  completedAt: string,
  effects: CompletionHealthEffect[],
  actorMemberId?: string,
): WorkspaceData {
  if (!effects.length) return input
  const trajectories = new Map(input.healthTrajectories.map((row) => [trajectoryKey(row.routineId, row.itemId, row.cleanlinessChannel), row]))
  const snapshots = new Map(input.completionSnapshots.map((row) => [row.id, row]))

  for (const effect of effects) {
    if (!snapshots.has(effect.snapshotId)) {
      snapshots.set(effect.snapshotId, {
        id: effect.snapshotId,
        workspaceId: input.workspace.id,
        occurrenceId,
        sourceRoutineId: effect.sourceRoutineId,
        trajectoryRoutineId: effect.trajectoryRoutineId,
        itemId: effect.itemId,
        cleanlinessChannel: effect.cleanlinessChannel,
        completedAt,
        refreshLevelPctSnapshot: effect.refreshLevelPctSnapshot,
        cleanlinessBeforePct: effect.cleanlinessBeforePct,
        cleanlinessAfterPct: effect.cleanlinessAfterPct,
        healthRefreshApplied: effect.healthRefreshApplied,
        scheduledSlotAt: effect.scheduledSlotAt,
        actorMemberId,
      })
    }
    if (!effect.healthRefreshApplied || !effect.healthAnchorAt || effect.healthAnchorPct == null || !effect.healthDueAt || !effect.healthOverdueEndAt) continue
    const key = trajectoryKey(effect.trajectoryRoutineId, effect.itemId, effect.cleanlinessChannel)
    const prior = trajectories.get(key)
    if (prior && new Date(prior.healthAnchorAt).getTime() > new Date(effect.healthAnchorAt).getTime()) continue
    trajectories.set(key, {
      workspaceId: input.workspace.id,
      itemId: effect.itemId,
      routineId: effect.trajectoryRoutineId,
      cleanlinessChannel: effect.cleanlinessChannel,
      healthAnchorAt: effect.healthAnchorAt,
      healthAnchorPct: effect.healthAnchorPct,
      healthDueAt: effect.healthDueAt,
      healthOverdueEndAt: effect.healthOverdueEndAt,
      lastRefreshCompletionId: effect.snapshotId,
      updatedAt: completedAt,
    })
  }

  return { ...input, healthTrajectories: [...trajectories.values()], completionSnapshots: [...snapshots.values()] }
}

export interface ItemChannelCleanliness {
  itemId: string
  channel: CleanlinessChannel
  score: number | null
  routineScores: Array<{ routineId: string; score: number }>
}

export function itemChannelCleanliness(
  data: WorkspaceData,
  itemId: string,
  channel: CleanlinessChannel,
  now: string | Date = new Date(),
): ItemChannelCleanliness {
  const routineIds = activeTrackableRoutines(data)
    .filter((routine) => routineCleanlinessChannel(routine) === channel && routineTargetsItem(data, routine, itemId))
    .map((routine) => routine.id)
  const scores = data.healthTrajectories
    .filter((trajectory) => trajectory.itemId === itemId && trajectory.cleanlinessChannel === channel && routineIds.includes(trajectory.routineId))
    .map((trajectory) => ({ routineId: trajectory.routineId, score: cleanlinessForTrajectory(trajectory, now) }))
  return { itemId, channel, score: scores.length ? Math.min(...scores.map((row) => row.score)) : null, routineScores: scores }
}

export function aggregateCleanliness(
  data: WorkspaceData,
  itemIds: Iterable<string>,
  channel: CleanlinessChannel,
  now: string | Date = new Date(),
): { score: number | null; itemScores: Array<{ itemId: string; score: number }> } {
  const itemScores = [...new Set(itemIds)].flatMap((itemId) => {
    const result = itemChannelCleanliness(data, itemId, channel, now)
    return result.score == null ? [] : [{ itemId, score: result.score }]
  })
  if (!itemScores.length) return { score: null, itemScores: [] }
  return { score: itemScores.reduce((sum, row) => sum + row.score, 0) / itemScores.length, itemScores }
}
