const assert = {
  ok(value: unknown, message?: string) { if (!value) throw new Error(message ?? 'Expected truthy value') },
  equal(actual: unknown, expected: unknown, message?: string) { if (actual !== expected) throw new Error(`${message ?? 'Mismatch'}: ${String(actual)} !== ${String(expected)}`) },
  deepEqual(actual: unknown, expected: unknown, message?: string) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message ?? 'Mismatch'}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`) },
}
import type { Routine, WorkspaceData, TaskOccurrence } from '../src/types/domain'
import { materializeRoutineSlot, materializeAdditionalActivities } from '../src/lib/scheduler'
import { applyMutationLocally } from '../src/lib/mutations'
import { buildIntegratedEffects, dueExtraCare, completedExtraCare, activeExtraEvents, isLegacyLinkedTask } from '../src/lib/extraCare'
import { additionalActivityAppendix } from '../src/lib/presentation'
import { buildOverviewGroups } from '../src/lib/overview'
import { createHouseholdBackup, parseHouseholdBackup } from '../src/lib/backup'
import { activityOutcomeSummary, auditEntries, dailyCompletionTrend } from '../src/lib/analytics'
import { translations } from '../src/lib/translations'
import type { OfflineMutation } from '../src/lib/offline'

const wid = '00000000-0000-4000-8000-000000000901'
const mid = '00000000-0000-4000-8000-000000000902'
const rid = '00000000-0000-4000-8000-000000000903'
const cid = '00000000-0000-4000-8000-000000000904'
const since = '2026-09-01T00:00:00.000Z'
const parent: Routine = {
  id: rid, workspaceId: wid, name: 'Main kitchen clean', actionId: 'clean', targetEntityIds: ['item'], includeDescendantTargetIds: [],
  recurrence: { kind: 'interval', interval: 1, unit: 'day', anchorDate: '2026-09-01' }, timeOfDay: '10:00', routineTimezone: 'UTC',
  scheduleMode: 'fixed', exceptions: { excludedDates: [], includedDateTimes: [] }, assignment: { mode: 'everyone' }, reminder: { mode: 'at_due' },
  cleanlinessChannel: 'regular', careLevel: 'routine', refreshLevelPct: 100, affectsCleanliness: true, status: 'active', revision: 1, createdAt: since,
}
const child: Routine = {
  ...parent, id: cid, name: 'Deep oven care', actionId: 'deep', parentRoutineId: rid, triggerEvery: 4,
  cleanlinessChannel: 'deep', careLevel: 'deep', refreshLevelPct: 100, supplyIdsOverride: ['polish'],
}
function fixture(): WorkspaceData {
  let data: WorkspaceData = {
    workspace: { id: wid, name: 'Kitchen', timezone: 'UTC', careSensitivity: 'balanced', createdAt: since },
    members: [{ id: mid, workspaceId: wid, userId: 'user', displayName: 'Owner', role: 'owner', status: 'active', labels: [], createdAt: since }],
    entityTypes: [{ id: 'obj', workspaceId: wid, name: 'Object', createdAt: since }],
    entities: [{ id: 'item', workspaceId: wid, typeId: 'obj', name: 'Oven', labels: [], metadata: {}, createdAt: since }],
    fieldDefinitions: [], layoutScenes: [], layoutElements: [], entityRelations: [],
    actions: [
      { id: 'clean', workspaceId: wid, name: 'Clean', defaultSupplyIds: [], metadata: {}, revision: 1, createdAt: since },
      { id: 'deep', workspaceId: wid, name: 'Deep', defaultSupplyIds: ['polish'], metadata: {}, revision: 1, createdAt: since },
    ],
    routines: [parent, child], tasks: [], taskEvents: [], supplies: [{ id: 'polish', workspaceId: wid, name: 'Polish', status: 'low', version: 1, metadata: {}, createdAt: since }], supplyEvents: [],
    healthTrajectories: [
      { workspaceId: wid, routineId: rid, itemId: 'item', cleanlinessChannel: 'regular', healthAnchorAt: since, healthAnchorPct: 45, healthDueAt: '2026-09-02T10:00:00.000Z', healthOverdueEndAt: '2026-09-03T10:00:00.000Z', updatedAt: since },
      { workspaceId: wid, routineId: cid, itemId: 'item', cleanlinessChannel: 'deep', healthAnchorAt: since, healthAnchorPct: 45, healthDueAt: '2026-09-05T10:00:00.000Z', healthOverdueEndAt: '2026-09-09T10:00:00.000Z', updatedAt: since },
    ], completionSnapshots: [], extraCareMode: 'integrated', extraCareEvents: [], extraCareLegacyCarries: [],
  }
  for (let day=1; day<=9; day++) data = materializeRoutineSlot(data, parent, `2026-09-${String(day).padStart(2,'0')}T10:00:00.000Z`)
  return materializeAdditionalActivities(data)
}
function taskAt(data: WorkspaceData, ordinal: number): TaskOccurrence {
  const t = data.tasks.find(row => row.routineId === rid && row.triggerOrdinal === ordinal)
  assert.ok(t, `Missing primary ${ordinal}`)
  return t!
}
function action(data: WorkspaceData, ordinal: number, kind: 'complete'|'skip'|'extra_postpone'|'undo'|'reopen_today', eventId: string, sourceEventId?: string): WorkspaceData {
  const task = taskAt(data,ordinal)
  const at = `2026-09-${String(ordinal).padStart(2,'0')}T11:00:00.000Z`
  const integrated = kind === 'complete' ? buildIntegratedEffects(data,task,at,eventId,mid) : null
  const mutation: OfflineMutation = {
    id: `mutation:${eventId}`, workspaceId: wid, kind, taskId: task.id, expectedVersion: task.version,
    eventId,eventAt:at,actorMemberId:mid,integrated:true,extraRoutineId:kind==='extra_postpone'?cid:undefined,
    sourceEventId,completionEffects:integrated?.parentEffects,extraCompletions:integrated?.extras,
    trajectoryBefore:integrated?.beforeTrajectories,
  }
  return applyMutationLocally(data,mutation)
}

const base = fixture()
assert.equal(base.tasks.length,9,'No V2 child occurrences are materialized')
assert.deepEqual([1,2,3,4,5,6,7,8,9].filter(n => dueExtraCare(base,taskAt(base,n)).length),[4,5,6,7,8,9],
  'Pending #4 remains owed on later unhandled occurrences; one execution discharges it')
assert.equal(additionalActivityAppendix(base,taskAt(base,3)).length,0)
assert.deepEqual(additionalActivityAppendix(base,taskAt(base,4)).map(e => [e.routine.id,e.status,e.occurrence,e.supplies[0].supplyName]),[[cid,'due',undefined,'Polish']])
const completed = action(base,4,'complete','complete4')
assert.equal(taskAt(completed,4).state,'completed')
assert.deepEqual(activeExtraEvents(completed).map(row => [row.routineId,row.type,row.parentEventId]), [[cid,'COMPLETED','complete4']])
assert.equal(completedExtraCare(completed,taskAt(completed,4)).length,1)
assert.equal(completed.completionSnapshots.some(s => s.sourceRoutineId===cid && s.occurrenceId===taskAt(base,4).id),true)
assert.equal(dueExtraCare(completed,taskAt(completed,5)).length,0)
assert.equal(dueExtraCare(completed,taskAt(completed,8)).length,1,'#8 still triggers independent of #4 completion')
const retry = action(completed,4,'complete','complete4')
assert.equal(retry.taskEvents.length,completed.taskEvents.length,'Duplicate event does not double execute')
const restored = action(completed,4,'undo','undo4','complete4')
assert.equal(taskAt(restored,4).state,'scheduled')
assert.equal(activeExtraEvents(restored).filter(row=>row.type==='COMPLETED').length,0)
assert.equal(dueExtraCare(restored,taskAt(restored,4)).length,1)
assert.deepEqual(restored.healthTrajectories.map(r=>[r.routineId,r.healthAnchorPct]).sort(),base.healthTrajectories.map(r=>[r.routineId,r.healthAnchorPct]).sort(), 'Undo restores exact previous cleanliness, not a fresh 100% state')

let postponed = action(base,4,'extra_postpone','postpone4')
assert.equal(dueExtraCare(postponed,taskAt(postponed,4)).length,0)
assert.equal(dueExtraCare(postponed,taskAt(postponed,5)).length,1,'Postponing #4 targets #5, not #8')
postponed = action(postponed,5,'extra_postpone','postpone5')
assert.equal(dueExtraCare(postponed,taskAt(postponed,5)).length,0)
assert.equal(dueExtraCare(postponed,taskAt(postponed,6)).length,1,'Repeated deferral moves #5 to #6')
postponed = action(postponed,6,'complete','complete6')
assert.equal(activeExtraEvents(postponed).filter(row=>row.type==='COMPLETED').length,1)
assert.equal(dueExtraCare(postponed,taskAt(postponed,7)).length,0)
assert.equal(dueExtraCare(postponed,taskAt(postponed,8)).length,1,'Regular #8 trigger is not erased by postponed #4')
// Carry from #4 is explicitly postponed through #7 into the ordinary #8
// cadence trigger. Exactly one appendix and one integrated Extra result.
let collision = base
for (let n=4; n<=7; n++) collision = action(collision,n,'extra_postpone',`collisionPostpone${n}`)
assert.deepEqual(dueExtraCare(collision,taskAt(collision,8)).map(row=>row.id),[cid],'Next-ordinal carry and regular #8 trigger merge to one')
collision = action(collision,8,'complete','collisionComplete8')
assert.equal(activeExtraEvents(collision).filter(row=>row.type==='COMPLETED' && row.parentOccurrenceId===taskAt(collision,8).id).length,1,'Collision produces one Extra execution')
const undoPostpone = action(action(base,4,'extra_postpone','postpone4b'),4,'undo','undoPostpone','postpone4b')
assert.equal(dueExtraCare(undoPostpone,taskAt(undoPostpone,4)).length,1)
const skipped = action(base,4,'skip','skip4')
assert.equal(dueExtraCare(skipped,taskAt(skipped,5)).length,1,'Skip does not silently complete overdue Extra Care')
const afterSkip = action(skipped,5,'complete','complete5')
assert.equal(dueExtraCare(afterSkip,taskAt(afterSkip,8)).length,1)

const paused = { ...base, routines: [parent,{...child,status:'paused' as const}] }
assert.equal(dueExtraCare(paused,taskAt(paused,4)).length,0)
assert.equal(dueExtraCare({...paused,routines:[parent,child]},taskAt(paused,5)).length,1,'Resume keeps pending cadence')
const archived = {...base,routines:[parent,{...child,archivedAt:'2026-09-03T11:00:00Z'}]}
assert.equal(dueExtraCare(archived,taskAt(archived,4)).length,0)
const reassigned = applyMutationLocally(base,{id:'rea',workspaceId:wid,kind:'reassign',taskId:taskAt(base,4).id,expectedVersion:1,eventId:'reassigned',eventAt:'2026-09-04T10:00:00Z',assignmentScope:'unassigned',integrated:true})
assert.equal(dueExtraCare(reassigned,taskAt(reassigned,4)).length,1,'Reassignment does not discharge or duplicate Extra Care')

const legacyRow: TaskOccurrence = { ...taskAt(base,4), id:'00000000-0000-4000-8000-000000000905',routineId:cid,parentOccurrenceId:taskAt(base,4).id,state:'completed',completedAt:'2026-09-04T11:00:00Z',routineNameSnapshot:child.name }
const importedV1 = {...base,tasks:[...base.tasks,legacyRow]}
assert.equal(isLegacyLinkedTask(importedV1,legacyRow),true)
assert.equal(dueExtraCare(importedV1,taskAt(importedV1,5)).length,0,'V1 completed child is discharged; history preserved')
const blocked = applyMutationLocally(importedV1,{id:'legacy',workspaceId:wid,kind:'skip',taskId:legacyRow.id,expectedVersion:legacyRow.version,eventId:'legacy-skipped',eventAt:since,integrated:true})
assert.equal(blocked,importedV1,'Historical V1 child is not independently actionable in V2')
const legacyPending = {...base,tasks:[...base.tasks,{...legacyRow,state:'scheduled' as const,completedAt:undefined}]}
assert.equal(dueExtraCare(legacyPending,taskAt(legacyPending,5)).length,1,'Pending legacy child carries to next primary even without SQL activation')
const migratedPostponed = {...base,extraCareLegacyCarries:[{ id: 'carry4',workspaceId:wid,
  routineId:cid,originOccurrenceId:taskAt(base,4).id,targetOrdinal:5 }]}
assert.equal(dueExtraCare(migratedPostponed,taskAt(migratedPostponed,4)).length,0,'Migration preserves V1 postponement without early #4 execution')
assert.equal(dueExtraCare(migratedPostponed,taskAt(migratedPostponed,5)).length,1,'Converted V1 child is due on #5')
const backup = parseHouseholdBackup(JSON.stringify(createHouseholdBackup(completed)))
assert.equal(backup.data.extraCareEvents?.length,1)
assert.equal(backup.data.extraCareMode,'integrated')
const older = { ...createHouseholdBackup(importedV1), schema_version:8 }
assert.equal(parseHouseholdBackup(JSON.stringify(older)).schema_version,11)
assert.equal(older.data.tasks.some(t=>t.parentOccurrenceId),true)
assert.deepEqual(Object.keys(translations.en).sort(),Object.keys(translations.it).sort())
assert.equal(buildOverviewGroups(base,{ now: new Date('2026-09-04T10:01:00Z') }).dueNow.some(t=>t.routineId===cid),false)
assert.equal(activityOutcomeSummary(completed,30,new Date('2026-09-10')).completed>=1,true)
assert.equal(auditEntries(completed).some(event=>event.source==='extra' && event.title.includes('Deep oven care')),true,'Analysis audit attributes Extra Care')
console.log('V2 Phase 16B: 4->5->6, #8 merge, atomic parent+extra, Undo, skip, archive, V1 history/backup, no child cards passed')

// Phase 16B + Phase 16A: integrated Complete/Undo/Stock are distinct durable
// outbox records. Lost acknowledgement and reload cannot double-complete extras.
import { SyncCoordinator, readOutbox } from '../src/lib/syncCoordinator'
const localOutbox = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (key: string) => localOutbox.get(key) ?? null,
  setItem: (key: string, value: string) => { localOutbox.set(key, value) },
  removeItem: (key: string) => { localOutbox.delete(key) },
}
async function integratedOutboxRegression(): Promise<void> {
  const start = fixture()
  const primary = taskAt(start, 4)
  const effects = buildIntegratedEffects(start, primary, '2026-09-04T11:00:00.000Z', 'outboxComplete', mid)
  const complete: OfflineMutation = {
    id:'outboxMutation1',workspaceId:wid,kind:'complete',taskId:primary.id,
    expectedVersion:primary.version,eventId:'outboxComplete',eventAt:'2026-09-04T11:00:00.000Z',actorMemberId:mid,
    integrated:true,completionEffects:effects.parentEffects,extraCompletions:effects.extras,
    trajectoryBefore:effects.beforeTrajectories,
  }
  const afterComplete = applyMutationLocally(start,complete)
  const undo: OfflineMutation = {
    id:'outboxMutation2',workspaceId:wid,kind:'undo',taskId:primary.id,
    expectedVersion:taskAt(afterComplete,4).version,eventId:'outboxUndo',sourceEventId:'outboxComplete',
    eventAt:'2026-09-04T11:01:00.000Z',actorMemberId:mid,integrated:true,
  }
  const supply: OfflineMutation = {
    id:'outboxMutation3',workspaceId:wid,kind:'supply_status',supplyId:'polish',
    expectedVersion:1,eventId:'outboxSupply',eventAt:'2026-09-04T11:02:00.000Z',status:'available',
  }
  const scope='phase16b-user:phase16b-household'
  let remote = start, calls = 0, failAck = true
  const receipts = new Set<string>()
  const transport = {
    configuration: async () => ({ applied:false,conflict:true }),
    runtime: async (m: OfflineMutation) => {
      calls += 1
      if (receipts.has(m.eventId)) return { applied:true,conflict:false }
      const row = m.kind==='supply_status' ? remote.supplies.find(r=>r.id===m.supplyId)
        : remote.tasks.find(r=>r.id===m.taskId)
      if (!row || row.version!==m.expectedVersion) return { applied:false,conflict:true }
      remote=applyMutationLocally(remote,m)
      receipts.add(m.eventId)
      if (failAck) { failAck=false; throw new Error('network timeout after commit') }
      return { applied:true,conflict:false }
    },
    reload: async () => structuredClone(remote),
  }
  const offline = new SyncCoordinator(scope,wid,transport,()=>false,()=>{},()=>{})
  offline.enqueueRuntime(complete)
  offline.enqueueRuntime(undo)
  offline.enqueueRuntime(supply)
  assert.deepEqual(readOutbox(scope).map(row=>row.runtime?.kind),['complete','undo','supply_status'])
  offline.stop()
  const online = new SyncCoordinator(scope,wid,transport,()=>true,()=>{},()=>{})
  await online.flush()
  assert.equal(readOutbox(scope)[0].state,'retrying','Lost ACK persists retryable Complete')
  online.stop()
  const recovered = readOutbox(scope).map((row)=>({ ...row,nextAttemptAt:0 }))
  localOutbox.set(`house-care-sync-outbox-v2:${scope}`,JSON.stringify(recovered))
  const resumed = new SyncCoordinator(scope,wid,transport,()=>true,()=>{},()=>{})
  await resumed.flush()
  assert.equal(readOutbox(scope).length,0,'All three operations were acknowledged and verified')
  assert.equal(calls,4,'Complete is retried once; Undo and Stock sent separately')
  assert.equal(remote.taskEvents.filter(event=>event.id==='outboxComplete').length,1)
  assert.equal(remote.taskEvents.filter(event=>event.id==='outboxUndo').length,1)
  assert.equal((remote.extraCareEvents??[]).filter(event=>event.type==='COMPLETED').length,1)
  assert.equal((remote.extraCareEvents??[]).filter(event=>event.type==='REOPENED').length,1)
  assert.equal(remote.supplies.find(row=>row.id==='polish')?.status,'available')
  assert.equal(taskAt(remote,4).state,'scheduled')
  assert.deepEqual(remote.healthTrajectories.map(r=>[r.routineId,r.healthAnchorPct]).sort(),start.healthTrajectories.map(r=>[r.routineId,r.healthAnchorPct]).sort())
  resumed.stop()
  console.log('Phase 16B durable outbox: offline restart, lost ACK, Complete+Undo+Stock, single Extra Care execution passed')
}
integratedOutboxRegression().catch((error: unknown) => { console.error(error); throw error })
