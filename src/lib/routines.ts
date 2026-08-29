import type { AdvancedTargetSelector, AssignmentPolicy, RecurrenceRule, ReminderPolicy, ScheduleExceptions, ScheduleMode } from '../types/domain'

export interface RoutineDefinitionLike {
  name: string
  actionId: string
  targetEntityIds: string[]
  includeDescendantTargetIds: string[]
  advancedTargetSelector?: AdvancedTargetSelector
  recurrence: RecurrenceRule
  timeOfDay: string
  scheduleMode: ScheduleMode
  exceptions: ScheduleExceptions
  assignment: AssignmentPolicy
  reminder: ReminderPolicy
  supplyIdsOverride?: string[]
}

function sorted(values: string[] | undefined): string[] | undefined {
  return values ? [...values].sort() : undefined
}

export function routineDefinitionFingerprint(input: RoutineDefinitionLike): string {
  const assignment = input.assignment.mode === 'alternate'
    ? { ...input.assignment, memberIds: sorted(input.assignment.memberIds) }
    : input.assignment.mode === 'advanced'
      ? { ...input.assignment, memberIds: sorted(input.assignment.memberIds), requiredMemberLabels: sorted(input.assignment.requiredMemberLabels) }
      : input.assignment
  return JSON.stringify({
    name: input.name.trim(),
    actionId: input.actionId,
    targetEntityIds: sorted(input.targetEntityIds),
    includeDescendantTargetIds: sorted(input.includeDescendantTargetIds),
    advancedTargetSelector: input.advancedTargetSelector ?? null,
    recurrence: input.recurrence,
    timeOfDay: input.timeOfDay,
    scheduleMode: input.scheduleMode,
    exceptions: {
      excludedDates: sorted(input.exceptions.excludedDates),
      includedDateTimes: sorted(input.exceptions.includedDateTimes),
    },
    assignment,
    reminder: input.reminder,
    supplyIdsOverride: sorted(input.supplyIdsOverride),
  })
}
