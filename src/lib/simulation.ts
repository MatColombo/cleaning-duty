import type { Routine, TaskOccurrence, WorkspaceData } from '../types/domain'
import { addDays, localDateInZone } from './date'
import { resolveAssignment } from './assignment'
import { occurrenceSlots, previewDueAts } from './scheduler'
import { resolvedRoutineTargets } from './targeting'

export interface RoutineSimulationRow {
  dueAt: string
  targetNames: string[]
  assigneeName?: string
  assignmentExplanation: string
  conflicts: string[]
}

export function simulateRoutine(data: WorkspaceData, routine: Routine, days = 30): RoutineSimulationRow[] {
  const from = localDateInZone(data.workspace.timezone)
  const to = addDays(from, days)
  const targets = resolvedRoutineTargets(data, routine)
  const slots = routine.scheduleMode === 'fixed'
    ? occurrenceSlots(routine, from, to, data.workspace.timezone, 500)
    : previewDueAts(data, routine, 120)
        .filter((dueAt) => new Date(dueAt).getTime() <= new Date(`${to}T23:59:59Z`).getTime())
        .map((dueAt, index) => ({ date: localDateInZone(data.workspace.timezone, new Date(dueAt)), time: routine.timeOfDay, dueAt, index, source: 'rule' as const }))

  let virtualData: WorkspaceData = { ...data, tasks: [...data.tasks] }
  const rows: RoutineSimulationRow[] = []
  for (const [index, slot] of slots.slice(0, 120).entries()) {
    const assignment = resolveAssignment(virtualData, routine, index, slot.dueAt)
    const assignee = data.members.find((member) => member.id === assignment.memberId)
    const conflicts: string[] = []
    if (!targets.length) conflicts.push('No targets matched')
    if (assignment.conflict) conflicts.push(assignment.conflict)
    if (assignment.memberId) {
      const sameWindow = virtualData.tasks.filter((task) => task.state === 'scheduled' && task.assigneeMemberId === assignment.memberId && Math.abs(new Date(task.dueAt).getTime() - new Date(slot.dueAt).getTime()) < 60 * 60 * 1000)
      if (sameWindow.length) conflicts.push(`${sameWindow.length} other task(s) within 1 hour`)
    }
    rows.push({ dueAt: slot.dueAt, targetNames: targets.map((target) => target.entity.name), assigneeName: assignee?.displayName, assignmentExplanation: assignment.explanation, conflicts })

    const pseudoTask: TaskOccurrence = {
      id: `simulation-${index}`,
      workspaceId: data.workspace.id,
      routineId: routine.id,
      routineRevision: routine.revision,
      routineNameSnapshot: routine.name,
      actionNameSnapshot: 'Simulation',
      originalDueAt: slot.dueAt,
      dueAt: slot.dueAt,
      state: 'scheduled',
      assigneeMemberId: assignment.memberId,
      targets: [],
      supplies: [],
      explanation: { schedule: '', assignment: assignment.explanation, targetSummary: '' },
      version: 1,
      createdAt: slot.dueAt,
    }
    virtualData = { ...virtualData, tasks: [...virtualData.tasks, pseudoTask] }
  }
  return rows
}
