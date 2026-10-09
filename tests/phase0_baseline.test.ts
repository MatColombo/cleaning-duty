declare const require: (name: string) => any
declare const process: { cwd(): string }

import { APP_VERSION } from '../src/app/version'
import { BACKUP_SCHEMA_VERSION, parseHouseholdBackup } from '../src/lib/backup'

const { readFileSync } = require('node:fs')
const { join } = require('node:path')

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

const raw = readFileSync(join(process.cwd(), 'tests/fixtures/pre-v2-household-backup.json'), 'utf8')
const backup = parseHouseholdBackup(raw)

assert(backup.schema_version === BACKUP_SCHEMA_VERSION, 'Pre-V2 regression backup must parse at the current backup schema')
assert(backup.application_version === '1.2.1-r4', 'Pre-V2 regression fixture must retain its original historical exporter version')
assert(APP_VERSION !== backup.application_version, 'V2 must import older-version backups without rewriting the source fixture version')
assert(backup.data.workspace.name === 'Pre-V2 Regression Home', 'Fixture household identity changed unexpectedly')
assert(backup.data.members.length === 2, 'Fixture must preserve a multi-member household')
assert(backup.data.layoutScenes.length > 0 && backup.data.layoutElements.length > 0, 'Fixture must preserve Home layout state')
assert(backup.data.supplies.some((supply) => supply.status === 'low'), 'Fixture must include a low-stock supply')
assert(backup.data.tasks.some((task) => task.state === 'completed'), 'Fixture must include completed history')
assert(backup.data.tasks.some((task) => task.effectiveDueAt !== task.scheduledSlotAt), 'Fixture must include a rescheduled occurrence')
assert(backup.data.routines.some((routine) => routine.parentRoutineId && routine.triggerEvery === 3), 'Fixture must include linked every-N activity configuration')
assert(backup.data.tasks.some((task) => task.parentOccurrenceId), 'Fixture must include a linked child occurrence')
assert(backup.data.healthTrajectories.some((trajectory) => trajectory.cleanlinessChannel === 'regular'), 'Fixture must include Regular cleanliness state')
assert(backup.data.healthTrajectories.some((trajectory) => trajectory.cleanlinessChannel === 'deep'), 'Fixture must include Deep cleanliness state')

console.log('Phase 0 pre-V2 regression backup test passed')
