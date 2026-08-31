import type { HealthTrajectory, TaskOccurrence, WorkspaceData } from '../types/domain'
import { reconcileCleanlinessState, trajectoryKey } from './cleanliness'

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>()
  for (const row of rows) byId.set(row.id, row)
  return [...byId.values()]
}

function dedupeTrajectories(rows: HealthTrajectory[]): HealthTrajectory[] {
  const byKey = new Map<string, HealthTrajectory>()
  for (const row of rows) byKey.set(trajectoryKey(row.routineId, row.itemId, row.cleanlinessChannel), row)
  return [...byKey.values()]
}

function compareTasks(a: TaskOccurrence, b: TaskOccurrence): number {
  const stateRank = (task: TaskOccurrence) => task.state === 'completed' ? 4 : task.state === 'skipped' ? 3 : task.state === 'scheduled' ? 2 : 1
  const byState = stateRank(a) - stateRank(b)
  if (byState) return byState
  const byVersion = (a.version ?? 1) - (b.version ?? 1)
  if (byVersion) return byVersion
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

function dedupeTasks(tasks: TaskOccurrence[]): { tasks: TaskOccurrence[]; taskIdMap: Map<string, string> } {
  const byNaturalKey = new Map<string, TaskOccurrence>()
  const taskIdMap = new Map<string, string>()
  for (const task of tasks) {
    const key = `${task.routineId}:${task.routineRevision}:${task.scheduledSlotAt ?? task.originalDueAt}`
    const previous = byNaturalKey.get(key)
    if (!previous) {
      byNaturalKey.set(key, task)
      taskIdMap.set(task.id, task.id)
      continue
    }
    const keep = compareTasks(task, previous) > 0 ? task : previous
    const drop = keep.id === task.id ? previous : task
    byNaturalKey.set(key, keep)
    taskIdMap.set(keep.id, keep.id)
    taskIdMap.set(drop.id, keep.id)
  }
  return { tasks: [...byNaturalKey.values()], taskIdMap }
}

export function normalizeWorkspaceData(input: WorkspaceData): WorkspaceData {
  const raw = input as WorkspaceData & Record<string, unknown>
  const normalizedTasks = (input.tasks ?? []).map((task) => {
    const scheduledSlotAt = task.scheduledSlotAt ?? task.originalDueAt ?? task.dueAt
    const effectiveDueAt = task.effectiveDueAt ?? task.dueAt ?? task.originalDueAt
    const cleanlinessChannel = task.cleanlinessChannel ?? (task.careLevel === 'deep' ? 'deep' : 'regular')
    return {
      ...task,
      targets: (task.targets ?? []).map((target) => ({ ...target, matchReasons: target.matchReasons ?? ['Legacy explicit target'] })),
      supplies: task.supplies ?? [],
      cleanlinessChannel,
      careLevel: task.careLevel ?? (cleanlinessChannel === 'deep' ? 'deep' : 'routine'),
      scheduledSlotAt,
      effectiveDueAt,
      originalDueAt: scheduledSlotAt,
      dueAt: effectiveDueAt,
      completedAt: task.state === 'completed' ? (task.completedAt ?? undefined) : undefined,
      explanation: task.explanation ?? {
        schedule: 'Created by the saved routine schedule.',
        assignment: task.assigneeMemberId ? 'Assigned by the saved routine policy.' : 'No automatic assignee.',
        targetSummary: 'Targets were captured when this task was created.',
      },
    }
  })
  const deduped = dedupeTasks(normalizedTasks)
  const seenEvents = new Set<string>()
  const taskEvents = (input.taskEvents ?? []).flatMap((event) => {
    const taskId = deduped.taskIdMap.get(event.taskId) ?? event.taskId
    const key = `${event.id}:${taskId}`
    if (seenEvents.has(key)) return []
    seenEvents.add(key)
    return [{ ...event, taskId }]
  })

  // v1.1.2 lifecycle repair remains authoritative in v1.2.
  const latestLifecycle = new Map<string, (typeof taskEvents)[number]>()
  for (const event of taskEvents) {
    if (!['COMPLETED', 'SKIPPED', 'CANCELLED', 'REOPENED'].includes(event.type)) continue
    const previous = latestLifecycle.get(event.taskId)
    if (!previous || new Date(event.at).getTime() > new Date(previous.at).getTime()) latestLifecycle.set(event.taskId, event)
  }
  const reconciledTasks = deduped.tasks.map((task) => {
    if (task.state !== 'scheduled') return task
    const lifecycle = latestLifecycle.get(task.id)
    if (lifecycle?.type === 'COMPLETED') return { ...task, state: 'completed' as const, completedAt: task.completedAt ?? lifecycle.at }
    if (lifecycle?.type === 'SKIPPED') return { ...task, state: 'skipped' as const }
    if (lifecycle?.type === 'CANCELLED') return { ...task, state: 'cancelled' as const }
    if (task.targets.length > 0 && task.targets.every((target) => Boolean(target.completedAt))) {
      const completedAt = task.targets.map((target) => target.completedAt!).sort().at(-1)
      return { ...task, state: 'completed' as const, completedAt: task.completedAt ?? completedAt }
    }
    return task
  })

  const normalized: WorkspaceData = {
    ...input,
    workspace: { ...input.workspace, careSensitivity: input.workspace?.careSensitivity ?? 'balanced' },
    members: dedupeById((input.members ?? []).map((member) => ({ ...member, labels: member.labels ?? [], unavailableUntil: member.unavailableUntil ?? undefined }))),
    fieldDefinitions: Array.isArray(raw.fieldDefinitions) ? dedupeById(raw.fieldDefinitions as WorkspaceData['fieldDefinitions']) : [],
    entityTypes: dedupeById(input.entityTypes ?? []),
    entities: dedupeById((input.entities ?? []).map((entity) => ({ ...entity, metadata: entity.metadata ?? {} }))),
    layoutScenes: Array.isArray(raw.layoutScenes) ? dedupeById((raw.layoutScenes as WorkspaceData['layoutScenes']).map((scene) => ({ ...scene, backgroundColor: scene.backgroundColor }))) : [],
    layoutElements: Array.isArray(raw.layoutElements) ? dedupeById((raw.layoutElements as WorkspaceData['layoutElements']).map((element) => ({
      ...element,
      labelFontSize: element.labelFontSize ?? 19,
      labelWrap: element.labelWrap ?? false,
      labelWidth: element.labelWidth,
      labelRotation: element.labelRotation ?? 0,
      fillColor: element.fillColor,
      textColor: element.textColor,
      textBackgroundColor: element.textBackgroundColor,
    }))) : [],
    entityRelations: Array.isArray(raw.entityRelations) ? dedupeById(raw.entityRelations as WorkspaceData['entityRelations']) : [],
    actions: dedupeById((input.actions ?? []).map((action) => ({
      ...action,
      defaultSupplyIds: action.defaultSupplyIds ?? [],
      metadata: action.metadata ?? {},
    }))),
    routines: dedupeById((input.routines ?? []).map((routine) => {
      const cleanlinessChannel = routine.cleanlinessChannel ?? (routine.careLevel === 'deep' ? 'deep' : 'regular')
      return {
        ...routine,
        includeDescendantTargetIds: routine.includeDescendantTargetIds ?? [],
        advancedTargetSelector: routine.advancedTargetSelector?.conditions?.length ? routine.advancedTargetSelector : undefined,
        routineTimezone: routine.routineTimezone ?? input.workspace.timezone,
        scheduleMode: routine.scheduleMode ?? 'fixed',
        exceptions: routine.exceptions ?? { excludedDates: [], includedDateTimes: [] },
        assignment: routine.assignment?.mode === 'advanced'
          ? { mode: 'advanced' as const, strategy: routine.assignment.strategy ?? 'round_robin', memberIds: routine.assignment.memberIds ?? [], requiredMemberLabels: routine.assignment.requiredMemberLabels ?? [], excludeUnavailable: routine.assignment.excludeUnavailable ?? true, weights: routine.assignment.weights ?? {} }
          : routine.assignment,
        reminder: routine.reminder ?? { mode: 'none' as const },
        cleanlinessChannel,
        careLevel: routine.careLevel ?? (cleanlinessChannel === 'deep' ? 'deep' : 'routine'),
        refreshLevelPct: Math.max(10, Math.min(100, Number(routine.refreshLevelPct ?? 100))),
        status: routine.status ?? 'active',
      }
    })),
    tasks: reconciledTasks,
    taskEvents: dedupeById(taskEvents),
    healthTrajectories: Array.isArray(raw.healthTrajectories) ? dedupeTrajectories(raw.healthTrajectories as WorkspaceData['healthTrajectories']) : [],
    completionSnapshots: Array.isArray(raw.completionSnapshots) ? dedupeById(raw.completionSnapshots as WorkspaceData['completionSnapshots']) : [],
    supplies: Array.isArray(raw.supplies) ? dedupeById((raw.supplies as WorkspaceData['supplies']).map((supply) => ({ ...supply, version: supply.version ?? 1 }))) : [],
    supplyEvents: Array.isArray(raw.supplyEvents) ? dedupeById(raw.supplyEvents as WorkspaceData['supplyEvents']) : [],
  }

  return reconcileCleanlinessState(normalized)
}
