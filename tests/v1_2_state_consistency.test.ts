import { normalizeWorkspaceData } from '../src/lib/dataMigrations'
import { careEstimateForEntity } from '../src/lib/home'
import { buildCriticalItems, mergeCriticalItemsByEntity } from '../src/lib/overview'
import { applyMutationLocally } from '../src/lib/mutations'
import type { TaskOccurrence, WorkspaceData } from '../src/types/domain'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const wid='00000000-0000-4000-8000-000000000101'
const eid='00000000-0000-4000-8000-000000000102'
const regularRid='00000000-0000-4000-8000-000000000103'
const deepRid='00000000-0000-4000-8000-000000000104'
const taskId='00000000-0000-4000-8000-000000000105'
const skippedAt='2026-08-31T08:00:00.000Z'

function task(overrides: Partial<TaskOccurrence> = {}): TaskOccurrence {
  return {
    id:taskId, workspaceId:wid, routineId:regularRid, routineRevision:1, routineNameSnapshot:'Regular clean', actionNameSnapshot:'Wipe',
    cleanlinessChannel:'regular', careLevel:'routine', scheduledSlotAt:'2026-08-31T08:00:00.000Z', effectiveDueAt:'2026-08-31T08:00:00.000Z',
    originalDueAt:'2026-08-31T08:00:00.000Z', dueAt:'2026-08-31T08:00:00.000Z', state:'skipped', completedAt:skippedAt,
    targets:[{entityId:eid,entityName:'Table',entityTypeName:'Item',matchReasons:['Selected']}], supplies:[], explanation:{schedule:'',assignment:'',targetSummary:''}, version:2, createdAt:'2026-08-01T00:00:00.000Z', ...overrides,
  }
}

const base: WorkspaceData = {
  workspace:{id:wid,name:'Home',timezone:'UTC',careSensitivity:'balanced',createdAt:'2026-08-01T00:00:00.000Z'}, members:[], fieldDefinitions:[],
  entityTypes:[{id:'type',workspaceId:wid,name:'Item',createdAt:'2026-08-01T00:00:00.000Z'}], entities:[{id:eid,workspaceId:wid,typeId:'type',name:'Table',labels:[],metadata:{},createdAt:'2026-08-01T00:00:00.000Z'}],
  layoutScenes:[],layoutElements:[],entityRelations:[],supplies:[],supplyEvents:[],actions:[{id:'a',workspaceId:wid,name:'Wipe',defaultSupplyIds:[],metadata:{},revision:1,createdAt:'2026-08-01T00:00:00.000Z'}],
  routines:[
    {id:regularRid,workspaceId:wid,name:'Regular clean',actionId:'a',targetEntityIds:[eid],includeDescendantTargetIds:[],recurrence:{kind:'interval',unit:'day',interval:2,anchorDate:'2026-08-01'},timeOfDay:'08:00',routineTimezone:'UTC',scheduleMode:'fixed',exceptions:{excludedDates:[],includedDateTimes:[]},assignment:{mode:'unassigned'},reminder:{mode:'none'},cleanlinessChannel:'regular',careLevel:'routine',refreshLevelPct:100,status:'active',revision:1,createdAt:'2026-08-01T08:00:00.000Z'},
    {id:deepRid,workspaceId:wid,name:'Deep clean',actionId:'a',targetEntityIds:[eid],includeDescendantTargetIds:[],recurrence:{kind:'interval',unit:'week',interval:1,anchorDate:'2026-08-01'},timeOfDay:'08:00',routineTimezone:'UTC',scheduleMode:'fixed',exceptions:{excludedDates:[],includedDateTimes:[]},assignment:{mode:'unassigned'},reminder:{mode:'none'},cleanlinessChannel:'deep',careLevel:'deep',refreshLevelPct:100,status:'active',revision:1,createdAt:'2026-08-01T08:00:00.000Z'},
  ],
  tasks:[task()], taskEvents:[{id:'skip-event',workspaceId:wid,taskId,type:'SKIPPED',at:skippedAt,metadata:{}}],
  healthTrajectories:[
    {workspaceId:wid,itemId:eid,routineId:regularRid,cleanlinessChannel:'regular',healthAnchorAt:skippedAt,healthAnchorPct:100,healthDueAt:'2026-09-02T08:00:00.000Z',healthOverdueEndAt:'2026-09-04T08:00:00.000Z',lastRefreshCompletionId:'bad-snapshot',updatedAt:skippedAt},
    {workspaceId:wid,itemId:eid,routineId:deepRid,cleanlinessChannel:'deep',healthAnchorAt:'2026-08-24T08:00:00.000Z',healthAnchorPct:100,healthDueAt:'2026-08-31T08:00:00.000Z',healthOverdueEndAt:'2026-09-07T08:00:00.000Z',updatedAt:'2026-08-24T08:00:00.000Z'},
  ],
  completionSnapshots:[{id:'bad-snapshot',workspaceId:wid,occurrenceId:taskId,sourceRoutineId:regularRid,trajectoryRoutineId:regularRid,itemId:eid,cleanlinessChannel:'regular',completedAt:skippedAt,refreshLevelPctSnapshot:100,cleanlinessBeforePct:20,cleanlinessAfterPct:100,healthRefreshApplied:true,scheduledSlotAt:'2026-08-31T08:00:00.000Z'}],
}

const normalized=normalizeWorkspaceData(base)
assert(!normalized.tasks[0].completedAt,'Skipped occurrence must not retain task-level completed_at')
const regularTrajectory=normalized.healthTrajectories.find((row)=>row.routineId===regularRid&&row.itemId===eid&&row.cleanlinessChannel==='regular')
assert(regularTrajectory?.lastRefreshCompletionId!=='bad-snapshot','Skipped stale completion snapshot must not remain the live cleanliness anchor')

const now=new Date('2026-08-31T12:00:00.000Z')
const homeScore=careEstimateForEntity(normalized,eid,now).routine.score
const critical=buildCriticalItems(normalized,now,101,3)
const overviewRegular=critical.find((item)=>item.itemId===eid&&item.channel==='regular')?.score
assert(homeScore!=null && overviewRegular!=null && Math.abs(homeScore-overviewRegular)<1e-9,'Home and Overview must use the same regular cleanliness score')
assert(critical.some((item)=>item.itemId===eid&&item.channel==='deep'),'Critical cleanliness must include deep-cleaning trajectories')
const mergedCritical=mergeCriticalItemsByEntity(critical).find((item)=>item.itemId===eid)
assert(mergedCritical?.channels.some((channel)=>channel.channel==='regular')&&mergedCritical.channels.some((channel)=>channel.channel==='deep'),'Critical cleanliness UI summary must label an item as both when routine and deep are below threshold')

const skipped=normalizeWorkspaceData({...normalized,tasks:[task({completedAt:undefined})],taskEvents:[{id:'skip-source',workspaceId:wid,taskId,type:'SKIPPED',at:'2026-08-31T10:00:00.000Z',metadata:{}}]})
const restoredSkip=applyMutationLocally(skipped,{id:'m1',workspaceId:wid,kind:'reopen_today',taskId,expectedVersion:999,sourceEventId:'skip-source',eventId:'restore-skip',eventAt:'2026-08-31T12:30:00.000Z'})
assert(restoredSkip.tasks[0].state==='scheduled','Restore-to-today must reopen a skipped occurrence without relying on stale version equality')
assert(restoredSkip.tasks[0].effectiveDueAt==='2026-08-31T12:30:00.000Z','Restore-to-today must make the occurrence actionable today')

const completedTask=task({state:'completed',completedAt:'2026-08-31T10:00:00.000Z',version:3,targets:[{entityId:eid,entityName:'Table',entityTypeName:'Item',matchReasons:['Selected'],completedAt:'2026-08-31T10:00:00.000Z'}]})
const completedData: WorkspaceData={...normalized,tasks:[completedTask],taskEvents:[{id:'complete-source',workspaceId:wid,taskId,type:'COMPLETED',at:'2026-08-31T10:00:00.000Z',metadata:{}}],healthTrajectories:[{workspaceId:wid,itemId:eid,routineId:regularRid,cleanlinessChannel:'regular',healthAnchorAt:'2026-08-31T10:00:00.000Z',healthAnchorPct:100,healthDueAt:'2026-09-02T08:00:00.000Z',healthOverdueEndAt:'2026-09-04T08:00:00.000Z',lastRefreshCompletionId:'completion-snapshot',updatedAt:'2026-08-31T10:00:00.000Z'}],completionSnapshots:[{id:'completion-snapshot',workspaceId:wid,occurrenceId:taskId,sourceRoutineId:regularRid,trajectoryRoutineId:regularRid,itemId:eid,cleanlinessChannel:'regular',completedAt:'2026-08-31T10:00:00.000Z',refreshLevelPctSnapshot:100,cleanlinessBeforePct:20,cleanlinessAfterPct:100,healthRefreshApplied:true,scheduledSlotAt:'2026-08-31T08:00:00.000Z'}]}
const restoredComplete=applyMutationLocally(completedData,{id:'m2',workspaceId:wid,kind:'reopen_today',taskId,expectedVersion:999,sourceEventId:'complete-source',eventId:'restore-complete',eventAt:'2026-08-31T12:45:00.000Z'})
assert(restoredComplete.tasks[0].state==='scheduled'&&!restoredComplete.tasks[0].targets[0].completedAt,'Restore-to-today must fully reopen completed activity targets')
assert(!restoredComplete.healthTrajectories.some((row)=>row.lastRefreshCompletionId==='completion-snapshot'),'Restoring a completed activity must remove its live cleanliness refresh')

const legacyCompletedData: WorkspaceData={...normalized,tasks:[completedTask],taskEvents:[],healthTrajectories:[],completionSnapshots:[]}
const restoredLegacyComplete=applyMutationLocally(legacyCompletedData,{id:'m3',workspaceId:wid,kind:'reopen_today',taskId,expectedVersion:999,eventId:'restore-legacy-complete',eventAt:'2026-08-31T13:00:00.000Z'})
assert(restoredLegacyComplete.tasks[0].state==='scheduled','Restore-to-today must support legacy completed rows without a lifecycle event')
assert(!restoredLegacyComplete.tasks[0].completedAt,'Legacy completed restore must clear completed_at')


const staleScheduledSkip: WorkspaceData={...normalized,tasks:[task({state:'scheduled',completedAt:undefined,version:7})],taskEvents:[
  {id:'older-postpone',workspaceId:wid,taskId,type:'POSTPONED',at:'2026-08-31T10:00:00.000Z',metadata:{from:'2026-08-31T08:00:00.000Z',to:'2026-09-01T08:00:00.000Z'}},
  {id:'authoritative-skip',workspaceId:wid,taskId,type:'SKIPPED',at:'2026-08-31T10:01:00.000Z',metadata:{}},
]}
const restoredStaleSkip=applyMutationLocally(staleScheduledSkip,{id:'m4',workspaceId:wid,kind:'reopen_today',taskId,expectedVersion:1,sourceEventId:'older-postpone',eventId:'restore-stale-skip',eventAt:'2026-08-31T13:15:00.000Z'})
assert(restoredStaleSkip.tasks[0].state==='scheduled'&&restoredStaleSkip.tasks[0].effectiveDueAt==='2026-08-31T13:15:00.000Z','Restore-to-today must trust canonical skipped lifecycle history even when the persisted/cache row is stale scheduled')
const restoreEvent=restoredStaleSkip.taskEvents.find((event)=>event.id==='restore-stale-skip')
assert(restoreEvent?.metadata.restoreOf==='authoritative-skip','Restore-to-today must derive the authoritative source event rather than trusting a stale client source id')

console.log('v1.2.0 state consistency tests passed')
