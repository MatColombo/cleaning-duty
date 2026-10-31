import type { TaskOccurrence, Routine } from '../types/domain'

const dueMs = (task: TaskOccurrence) => new Date(task.effectiveDueAt ?? task.dueAt).getTime()
/** Only fixed-calendar occurrences that are already due can supersede older due occurrences.
 * Never merge completion-relative tasks, secondary tasks, or different routines. */
export function supersededOccurrenceIds(tasks: TaskOccurrence[], routines: Routine[], now: Date = new Date()): Set<string> {
  const fixed = new Set(routines.filter((r) => r.scheduleMode !== 'after_completion' && !r.parentRoutineId).map((r) => r.id))
  const latest = new Map<string, TaskOccurrence>()
  for (const task of tasks) {
    if (task.state !== 'scheduled' || !fixed.has(task.routineId) || dueMs(task) > now.getTime() || !Number.isFinite(dueMs(task))) continue
    const previous = latest.get(task.routineId)
    if (!previous || dueMs(task) > dueMs(previous) || (dueMs(task) === dueMs(previous) && task.id > previous.id)) latest.set(task.routineId, task)
  }
  const ids = new Set<string>()
  for (const task of tasks) {
    const newest = latest.get(task.routineId)
    if (newest && task.state === 'scheduled' && task.id !== newest.id && dueMs(task) <= dueMs(newest)) ids.add(task.id)
  }
  return ids
}
