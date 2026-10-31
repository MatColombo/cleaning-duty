const assert = { equal: (a: unknown, b: unknown) => { if (a !== b) throw new Error(`Expected ${String(b)}, got ${String(a)}`) }, deepEqual: (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Values differ') } }
import { supersededOccurrenceIds } from '../src/lib/occurrenceCoalescing'
import type { TaskOccurrence, Routine } from '../src/types/domain'

const routine = (id: string, scheduleMode: string, parentRoutineId?: string) => ({ id, scheduleMode, parentRoutineId }) as Routine
const task = (id: string, routineId: string, dueAt: string, state = 'scheduled') => ({ id, routineId, dueAt, state, effectiveDueAt: dueAt }) as TaskOccurrence
const now = new Date('2026-10-31T12:00:00Z')
const tasks = [
  task('a', 'fixed', '2026-10-01T10:00:00Z'),
  task('b', 'fixed', '2026-10-15T10:00:00Z'),
  task('c', 'fixed', '2026-10-29T10:00:00Z'),
  task('future', 'fixed', '2026-11-12T10:00:00Z'),
  task('relative-a', 'relative', '2026-10-01T10:00:00Z'),
  task('relative-b', 'relative', '2026-10-15T10:00:00Z'),
  task('secondary-a', 'child', '2026-10-01T10:00:00Z'),
  task('secondary-b', 'child', '2026-10-15T10:00:00Z'),
]
const superseded = supersededOccurrenceIds(tasks, [routine('fixed','fixed'), routine('relative','after_completion'), routine('child','fixed','parent')], now)
assert.deepEqual([...superseded].sort(), ['a','b'])
assert.equal(superseded.has('future'), false)
assert.equal(superseded.has('relative-a'), false)
assert.equal(superseded.has('secondary-a'), false)
console.log('Backlog coalescing regression passed')
