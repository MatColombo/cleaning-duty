/** Phase 16C pure-domain regression; no Supabase migrations are executed. */
declare const require: (id: string) => any
const assert = require('node:assert/strict')
const { webcrypto } = require('node:crypto')
;(globalThis as any).crypto ??= webcrypto
import type { Routine, WorkspaceData, TaskOccurrence } from '../src/types/domain'
import type { OfflineMutation } from '../src/lib/offline'
import { FIXED_BUFFER_LOW_WATER, FIXED_BUFFER_TARGET, materializeTasks, materializeRoutineSlot, occurrenceSlots, ordinalForSlot, previewDueAts, replenishFixedCalendar } from '../src/lib/scheduler'
import { applyMutationLocally } from '../src/lib/mutations'
import { dueExtraCare } from '../src/lib/extraCare'
import { createHouseholdBackup, parseHouseholdBackup } from '../src/lib/backup'
import { serializeWorkspace, buildConfigChanges, isGeneratedOccurrenceBatch } from '../src/lib/configChanges'
import { localDateTimeInZone, zonedLocalToUtc } from '../src/lib/date'
import { stableId } from '../src/lib/id'

const w = '00000000-0000-4000-8000-000000000501'
const r = '00000000-0000-4000-8000-000000000502'
const m = '00000000-0000-4000-8000-000000000503'
const now = new Date('2026-10-12T10:00:00.000Z')
const template: Routine = {
  id:r, workspaceId:w,name:'Kitchen', actionId:'action',targetEntityIds:['item'],includeDescendantTargetIds:[],
  recurrence:{kind:'interval',unit:'day',interval:5,anchorDate:'2026-09-01'},timeOfDay:'10:00',routineTimezone:'UTC',
  scheduleMode:'after_completion',exceptions:{excludedDates:[],includedDateTimes:[]},assignment:{mode:'everyone'},
  reminder:{mode:'at_due'},cleanlinessChannel:'regular',careLevel:'routine',refreshLevelPct:100,
  affectsCleanliness:true,status:'active',revision:1,createdAt:'2026-08-01T00:00:00.000Z',
}
function makeData(routine: Routine=template, zone='UTC'): WorkspaceData {
  return {
    workspace:{id:w,name:'Kitchen',timezone:zone,careSensitivity:'balanced',createdAt:'2026-01-01T00:00:00.000Z'},
    members:[{id:m,workspaceId:w,userId:'user',displayName:'Owner',role:'owner',status:'active',labels:[],createdAt:'2026-01-01T00:00:00.000Z'}],
    entityTypes:[{id:'type',workspaceId:w,name:'Room',createdAt:'2026-01-01T00:00:00.000Z'}],
    entities:[{id:'item',workspaceId:w,typeId:'type',name:'Oven',labels:[],metadata:{},createdAt:'2026-01-01T00:00:00.000Z'}],
    fieldDefinitions:[],layoutScenes:[],layoutElements:[],entityRelations:[],
    actions:[{id:'action',workspaceId:w,name:'Clean',defaultSupplyIds:[],metadata:{},revision:1,createdAt:'2026-01-01T00:00:00.000Z'}],
    routines:[routine],tasks:[],taskEvents:[],healthTrajectories:[],completionSnapshots:[],supplies:[],supplyEvents:[],
    extraCareMode:'integrated',extraCareEvents:[],extraCareLegacyCarries:[],
  }
}
function mutate(data:WorkspaceData, kind:'complete'|'skip'|'undo'|'reopen_today'|'postpone',eventId:string,eventAt:string,sourceEventId?:string):WorkspaceData {
  const task = data.tasks.find(row=>row.routineId===r && row.state !== 'cancelled' &&
    ((kind==='complete'||kind==='skip'||kind==='postpone') ? row.state==='scheduled' : row.state!=='scheduled'))
  assert.ok(task,`Missing lifecycle task for ${kind}`)
  const payload:OfflineMutation = {id:eventId,workspaceId:w,kind,taskId:task!.id,expectedVersion:task!.version,
    eventId,eventAt,sourceEventId,actorMemberId:m,completionEffects:[],integrated:true,
    ...(kind==='postpone'?{effectiveDueAt:'2026-09-10T11:00:00.000Z'}:{})}
  return applyMutationLocally(data,payload)
}
function state(d:WorkspaceData):[string,string,string|undefined][] {
  return d.tasks.filter(t=>t.routineId===r).map(t=>[t.state,t.scheduledSlotAt??t.originalDueAt,t.successorOfEventId])
}

// 1. Actual completion instant, not original September 1 due timestamp.
let data = materializeTasks(makeData(),45,now)
assert.equal(data.tasks.length,1,'After Completion never pre-issues speculative future rows')
assert.equal(data.tasks[0].scheduledSlotAt,'2026-09-01T10:00:00.000Z')
const source = data.tasks[0]
data = mutate(data,'complete','complete-sep-3','2026-09-03T13:15:00.000Z')
assert.deepEqual(state(data),[
  ['completed','2026-09-01T10:00:00.000Z',undefined],
  ['scheduled','2026-09-08T13:15:00.000Z','complete-sep-3'],
])
const unchanged = applyMutationLocally(data,{id:'repeat',workspaceId:w,kind:'complete',taskId:source.id,
  expectedVersion:source.version,eventId:'complete-sep-3',eventAt:'2026-09-03T13:15:00.000Z'})
assert.equal(unchanged,data,'Duplicate delivery cannot create another successor or snapshot')
assert.equal(materializeTasks(data,45,now).tasks.length,2,'Startup is idempotent after completion')
const undone = mutate(data,'undo','undo-sep-3','2026-09-03T14:00:00.000Z','complete-sep-3')
assert.deepEqual(undone.tasks.map(t=>t.state),['scheduled','cancelled'],'Undo retains cancelled successor history')
assert.equal(undone.taskEvents.some(e=>e.type==='CANCELLED'&&e.metadata.undoOf==='complete-sep-3'),true)
assert.equal(mutate(undone,'complete','complete-again','2026-09-04T11:00:00.000Z').tasks.length,3,
  'Recompletion uses a new deterministic due slot without restoring cancelled prior successor')
const modified = {...data,tasks:data.tasks.map(t=>t.successorOfEventId?{...t,version:2}:t)}
assert.equal(mutate(modified,'undo','unsafe-undo','2026-09-03T14:00:00.000Z','complete-sep-3'),modified,
  'Undo must fail closed if successor was edited')

// 1b. Completing the final target must also issue exactly one After Completion
// successor, attributed to the deterministic terminal event (not the target event).
const targetBase=materializeTasks(makeData(),45,now)
const targetEvent='target-16c-event'
const targetCompleted=applyMutationLocally(targetBase,{
  id:targetEvent,workspaceId:w,kind:'complete_target',taskId:targetBase.tasks[0].id,
  targetEntityId:'item',eventId:targetEvent,eventAt:'2026-09-03T13:15:00.000Z',
  expectedVersion:targetBase.tasks[0].version,actorMemberId:m,completionEffects:[],integrated:true,
})
assert.equal(targetCompleted.tasks[0].state,'completed')
assert.equal(targetCompleted.tasks[1].scheduledSlotAt,'2026-09-08T13:15:00.000Z')
assert.equal(targetCompleted.tasks[1].successorOfEventId,stableId(`target-completed:${targetEvent}`))
assert.equal(targetCompleted.taskEvents.filter(e=>e.taskId===targetBase.tasks[0].id&&e.type==='COMPLETED').length,1)

// 2. Skip anchors to scheduled slot (not button timestamp) and advances once.
const skipped = mutate(materializeTasks(makeData(),45,now),'skip','skip-sep-8','2026-09-08T11:00:00.000Z')
assert.equal(skipped.tasks[1].scheduledSlotAt,'2026-09-06T10:00:00.000Z')
const early = mutate(materializeTasks(makeData(),45,now),'complete','early','2026-08-31T08:00:00.000Z')
assert.equal(early.tasks[1].scheduledSlotAt,'2026-09-05T08:00:00.000Z')

// 3. Month edge, leap year, and routine local clock.
const monthRule: Routine={...template,recurrence:{kind:'interval',unit:'month',interval:1,anchorDate:'2026-01-31'},timeOfDay:'10:30'}
let monthData=materializeRoutineSlot(makeData(monthRule),monthRule,'2026-01-31T10:30:00.000Z')
monthData=mutate(monthData,'complete','jan-complete','2026-01-31T19:12:00.000Z')
assert.equal(monthData.tasks[1].scheduledSlotAt,'2026-02-28T10:30:00.000Z')
const leap={...monthRule,recurrence:{kind:'interval',unit:'month',interval:1,anchorDate:'2028-01-31'} as const}
let leapData=materializeRoutineSlot(makeData(leap),leap,'2028-01-31T10:30:00.000Z')
leapData=mutate(leapData,'complete','leap-complete','2028-01-31T13:00:00.000Z')
assert.equal(leapData.tasks[1].scheduledSlotAt,'2028-02-29T10:30:00.000Z')

// 4. Calendar + timezone (DST): local 09:00 remains 09:00 after offset changes.
const rome={...template,routineTimezone:'Europe/Rome',recurrence:{kind:'interval',unit:'day',interval:2,anchorDate:'2026-03-28'} as const}
let dst=materializeRoutineSlot(makeData(rome,'Europe/Rome'),rome,'2026-03-28T08:00:00.000Z')
dst=mutate(dst,'complete','dst','2026-03-28T08:00:00.000Z')
assert.equal(dst.tasks[1].scheduledSlotAt,'2026-03-30T07:00:00.000Z')
assert.equal(localDateTimeInZone('Europe/Rome',dst.tasks[1].scheduledSlotAt),'2026-03-30T09:00')

assert.equal(zonedLocalToUtc('2026-03-29','02:30','Europe/Rome'),'2026-03-29T01:30:00.000Z', 'Nonexistent 02:30 shifts to 03:30 on spring DST change')
assert.equal(zonedLocalToUtc('2026-10-25','02:30','Europe/Rome'),'2026-10-25T01:30:00.000Z', 'Repeated 02:30 resolves to standard time on autumn DST fold')

// 5. Count-based 18-month fixed buffer, date edge and exact deterministic identities.
const distant={...template,scheduleMode:'fixed' as const,recurrence:{kind:'interval',unit:'month',interval:18,anchorDate:'2026-01-31'} as const}
let fixed=materializeTasks(makeData(distant),45,now)
assert.equal(FIXED_BUFFER_TARGET,5)
assert.equal(FIXED_BUFFER_LOW_WATER,2)
assert.deepEqual(fixed.tasks.map(t=>t.scheduledSlotAt),[
  '2027-07-31T10:00:00.000Z','2029-01-31T10:00:00.000Z',
  '2030-07-31T10:00:00.000Z','2032-01-31T10:00:00.000Z','2033-07-31T10:00:00.000Z',
])
assert.equal(materializeTasks(fixed,45,now),fixed,'Repeated launch does not rewrite already buffered tasks')
assert.deepEqual(previewDueAts(makeData(distant),distant,5),fixed.tasks.map(t=>t.scheduledSlotAt),
  'Routine preview is no longer capped to 730 days')
const first=fixed.tasks.map(t=>t.id)
fixed={...fixed,tasks:fixed.tasks.map((t,i)=>i>=3?{...t,state:'completed' as const,version:2}:t)}
assert.equal(materializeTasks(fixed,45,now).tasks.length,5,'Three remaining future tasks do not replenish')
fixed={...fixed,tasks:fixed.tasks.map((t,i)=>i===0?{...t,state:'completed' as const,version:2}:t)}
assert.equal(materializeTasks(fixed,45,now).tasks.length,8,'Replenish once only two active future items remain')
// Re-create a clean state and explicitly reduce future scheduled count to 2.
let shrink=materializeTasks(makeData(distant),45,now)
shrink={...shrink,tasks:shrink.tasks.map((t,i)=>i<3?{...t,state:'skipped' as const,version:2}:t)}
const replenished=materializeTasks(shrink,45,now)
assert.equal(replenished.tasks.filter(t=>t.state==='scheduled').length,5)
assert.equal(replenished.tasks.length,8)
assert.deepEqual(replenished.tasks.slice(0,5).map(t=>t.id),first,'Existing rows never change identity')
assert.deepEqual(materializeTasks(replenished,45,now).tasks.map(t=>t.id),replenished.tasks.map(t=>t.id))
const independent=materializeTasks(makeData(distant),45,now)
assert.deepEqual(independent.tasks.map(t=>t.id),first,'Two devices generate the same deterministic UUIDs')
const rows=buildConfigChanges(makeData(distant),independent).changes
assert.equal(isGeneratedOccurrenceBatch(rows),true,'Fixed generated rows use idempotent narrow cloud insert')
assert.equal(rows.filter(ch=>ch.table==='task_occurrences').length,5)

// 6. Fixed exceptions, high-frequency cadence, ordinal, and linked Extra Care.
const calendar={...template,scheduleMode:'fixed' as const,
  recurrence:{kind:'daily',interval:1,anchorDate:'2026-10-12'} as const,
  exceptions:{excludedDates:['2026-10-13'],includedDateTimes:['2026-10-14T07:45']}}
const withException=materializeTasks(makeData(calendar),45,now)
assert.equal(withException.tasks.some(t=>t.scheduledSlotAt==='2026-10-13T10:00:00.000Z'),false)
assert.equal(withException.tasks.some(t=>t.scheduledSlotAt==='2026-10-14T07:45:00.000Z'),true)
assert.equal(withException.tasks.some(t=>t.scheduledSlotAt==='2026-10-14T10:00:00.000Z'),true)
assert.equal(new Set(withException.tasks.map(t=>t.id)).size,withException.tasks.length)
const child:Routine={...calendar,id:'00000000-0000-4000-8000-000000000504',parentRoutineId:r,triggerEvery:4,
  cleanlinessChannel:'deep',careLevel:'deep'}
const linked=materializeTasks({...makeData(calendar),routines:[calendar,child]},45,now)
assert.equal(linked.tasks.length,5,'V2 integrated children have no standalone occurrences')
assert.equal(linked.tasks.filter(t=>t.triggerOrdinal===4).length,1)
assert.equal(linked.tasks.every(t=>!t.parentOccurrenceId),true)
const paused={...calendar,status:'paused' as const}
assert.equal(materializeTasks(makeData(paused),45,now).tasks.length,0)
const archived={...calendar,archivedAt:'2026-10-10T10:00:00.000Z'}
assert.equal(materializeTasks(makeData(archived),45,now).tasks.length,0)
// Old terminal rows are history and cannot be rescheduled during materialization.
const past={...withException,tasks:withException.tasks.map((t,i)=>i===0?{...t,state:'completed' as const,version:7}:t)}
assert.equal(materializeTasks(past,45,now).tasks.find(t=>t.id===past.tasks[0].id)?.version,7)

// 6b. Completion-relative primary carries integrated Extra Care correctly.
const deepChild:Routine={...template,id:'00000000-0000-4000-8000-000000000505',
  name:'Deep oven',parentRoutineId:r,triggerEvery:4,cleanlinessChannel:'deep',careLevel:'deep'}
let afterWithExtra=materializeTasks({...makeData(),routines:[template,deepChild]},45,now)
for (let ordinal=1;ordinal<=3;ordinal++) {
  const active=afterWithExtra.tasks.find(t=>t.state==='scheduled')!
  assert.equal(active.triggerOrdinal,ordinal)
  afterWithExtra=applyMutationLocally(afterWithExtra,{id:`extra-series-${ordinal}`,workspaceId:w,
    kind:'complete',taskId:active.id,expectedVersion:active.version,
    eventId:`extra-event-${ordinal}`,eventAt:`2026-09-${String(ordinal*5).padStart(2,'0')}T12:00:00.000Z`,
    completionEffects:[],integrated:true,extraCompletions:[]})
}
const fourth=afterWithExtra.tasks.find(t=>t.state==='scheduled')!
assert.equal(fourth.triggerOrdinal,4)
assert.deepEqual(dueExtraCare(afterWithExtra,fourth).map(c=>c.id),[deepChild.id])
afterWithExtra=applyMutationLocally(afterWithExtra,{id:'skip-series-4',workspaceId:w,kind:'skip',
  taskId:fourth.id,expectedVersion:fourth.version,eventId:'skip-series-4',eventAt:'2026-09-22T12:00:00.000Z',integrated:true})
const fifth=afterWithExtra.tasks.find(t=>t.state==='scheduled')!
assert.equal(fifth.triggerOrdinal,5)
assert.deepEqual(dueExtraCare(afterWithExtra,fifth).map(c=>c.id),[deepChild.id],
  'Skipping #4 keeps due Extra Care attached to the next primary recurrence')

// 7. Calendar-index seek matches original anchors/ordinals for weekdays and monthly Nth.
for (const rule of [
  {kind:'weekdays' as const,anchorDate:'2026-01-06',weekdays:[1,3,5],intervalWeeks:2},
  {kind:'monthlyNth' as const,anchorDate:'2026-01-01',weekday:1,ordinal:2 as const,intervalMonths:2},
]) {
  const schedule={...calendar,recurrence:rule,exceptions:{excludedDates:[],includedDateTimes:[]}}
  const result=materializeTasks(makeData(schedule),45,now)
  const list=occurrenceSlots(schedule,'2026-10-11','2028-12-31','UTC',400)
  assert.deepEqual(result.tasks.map(t=>t.scheduledSlotAt),list.slice(0,5).map(t=>t.dueAt))
  for (const t of result.tasks) assert.equal(t.triggerOrdinal,ordinalForSlot(schedule,t.scheduledSlotAt,'UTC'))
}

// 8. Notification/deep-link essentials: stable task ids and due slots after restart.
const reboot=JSON.parse(JSON.stringify(replenished)) as WorkspaceData
const afterBoot=materializeTasks(reboot,45,now)
assert.deepEqual(afterBoot.tasks.map(t=>[t.id,t.effectiveDueAt,t.scheduledSlotAt]),
  replenished.tasks.map(t=>[t.id,t.effectiveDueAt,t.scheduledSlotAt]))
assert.equal(serializeWorkspace(afterBoot).task_occurrences[0].id,replenished.tasks[0].id)
const backup=createHouseholdBackup(data)
const recovered=parseHouseholdBackup(JSON.stringify(backup))
assert.ok(recovered,'16C household export remains parseable')
assert.equal(recovered!.data.tasks.some(t=>t.successorOfEventId==='complete-sep-3'),true)

console.log('Phase 16C: After Completion timestamps, Undo guards, DST/month edge, five-slot fixed buffering, old backup, deterministic IDs, previews, exceptions and V2 Extra Care — PASS (pure domain)')
