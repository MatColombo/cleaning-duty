import type { WorkspaceData } from '../types/domain'

export function normalizeWorkspaceData(input: WorkspaceData): WorkspaceData {
  const raw = input as WorkspaceData & Record<string, unknown>
  return {
    ...input,
    workspace: { ...input.workspace, careSensitivity: input.workspace?.careSensitivity ?? 'balanced' },
    members: (input.members ?? []).map((member) => ({ ...member, labels: member.labels ?? [], unavailableUntil: member.unavailableUntil ?? undefined })),
    fieldDefinitions: Array.isArray(raw.fieldDefinitions) ? raw.fieldDefinitions as WorkspaceData['fieldDefinitions'] : [],
    entityTypes: input.entityTypes ?? [],
    entities: (input.entities ?? []).map((entity) => ({ ...entity, metadata: entity.metadata ?? {} })),
    layoutScenes: Array.isArray(raw.layoutScenes) ? raw.layoutScenes as WorkspaceData['layoutScenes'] : [],
    layoutElements: Array.isArray(raw.layoutElements) ? raw.layoutElements as WorkspaceData['layoutElements'] : [],
    entityRelations: Array.isArray(raw.entityRelations) ? raw.entityRelations as WorkspaceData['entityRelations'] : [],
    actions: (input.actions ?? []).map((action) => ({
      ...action,
      defaultSupplyIds: action.defaultSupplyIds ?? [],
      metadata: action.metadata ?? {},
    })),
    routines: (input.routines ?? []).map((routine) => ({
      ...routine,
      includeDescendantTargetIds: routine.includeDescendantTargetIds ?? [],
      advancedTargetSelector: routine.advancedTargetSelector?.conditions?.length ? routine.advancedTargetSelector : undefined,
      scheduleMode: routine.scheduleMode ?? 'fixed',
      exceptions: routine.exceptions ?? { excludedDates: [], includedDateTimes: [] },
      assignment: routine.assignment?.mode === 'advanced' ? { mode: 'advanced', strategy: routine.assignment.strategy ?? 'round_robin', memberIds: routine.assignment.memberIds ?? [], requiredMemberLabels: routine.assignment.requiredMemberLabels ?? [], excludeUnavailable: routine.assignment.excludeUnavailable ?? true, weights: routine.assignment.weights ?? {} } : routine.assignment,
      reminder: routine.reminder ?? { mode: 'none' },
    })),
    tasks: (input.tasks ?? []).map((task) => ({
      ...task,
      targets: (task.targets ?? []).map((target) => ({ ...target, matchReasons: target.matchReasons ?? ['Legacy explicit target'] })),
      supplies: task.supplies ?? [],
      explanation: task.explanation ?? { schedule: 'Created by the saved routine schedule.', assignment: task.assigneeMemberId ? 'Assigned by the saved routine policy.' : 'No automatic assignee.', targetSummary: 'Targets were captured when this task was created.' },
    })),
    taskEvents: input.taskEvents ?? [],
    supplies: Array.isArray(raw.supplies) ? (raw.supplies as WorkspaceData['supplies']).map((supply) => ({ ...supply, version: supply.version ?? 1 })) : [],
    supplyEvents: Array.isArray(raw.supplyEvents) ? raw.supplyEvents as WorkspaceData['supplyEvents'] : [],
  }
}
