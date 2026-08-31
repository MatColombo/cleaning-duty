import type { WorkspaceData, TaskOccurrence } from '../src/types/domain'
import { buildOverviewGroups, dedupeOccurrences } from '../src/lib/overview'
import { applyMutationLocally } from '../src/lib/mutations'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const wid='00000000-0000-4000-8000-000000000001', mid='00000000-0000-4000-8000-000000000002', rid='00000000-0000-4000-8000-000000000003', eid='00000000-0000-4000-8000-000000000004', tid='00000000-0000-4000-8000-000000000005'
function task(overrides: Partial<TaskOccurrence> = {}): TaskOccurrence { return { id:tid,workspaceId:wid,routineId:rid,routineRevision:1,routineNameSnapshot:'Vacuum living room',actionNameSnapshot:'Vacuum',cleanlinessChannel:'regular',careLevel:'routine',scheduledSlotAt:'2026-08-31T09:00:00.000Z',effectiveDueAt:'2026-08-31T09:00:00.000Z',originalDueAt:'2026-08-31T09:00:00.000Z',dueAt:'2026-08-31T09:00:00.000Z',state:'scheduled',assigneeMemberId:mid,targets:[{entityId:eid,entityName:'Living room floor',entityTypeName:'Surface',matchReasons:['Selected']}],supplies:[],explanation:{schedule:'Daily',assignment:'Me',targetSummary:'Floor'},version:1,createdAt:'2026-08-30T09:00:00.000Z',...overrides} }
function data(overrides: Partial<WorkspaceData> = {}): WorkspaceData { return {workspace:{id:wid,name:'Home',timezone:'UTC',careSensitivity:'balanced',createdAt:'2026-08-01T00:00:00.000Z'},members:[{id:mid,workspaceId:wid,displayName:'A',role:'owner',status:'active',labels:[],createdAt:'2026-08-01T00:00:00.000Z'}],fieldDefinitions:[],entityTypes:[{id:'type',workspaceId:wid,name:'Surface',createdAt:'2026-08-01T00:00:00.000Z'}],entities:[{id:eid,workspaceId:wid,typeId:'type',name:'Living room floor',labels:[],metadata:{},createdAt:'2026-08-01T00:00:00.000Z'}],layoutScenes:[],layoutElements:[],entityRelations:[],actions:[{id:'action',workspaceId:wid,name:'Vacuum',defaultSupplyIds:[],metadata:{},revision:1,createdAt:'2026-08-01T00:00:00.000Z'}],routines:[{id:rid,workspaceId:wid,name:'Vacuum living room',actionId:'action',targetEntityIds:[eid],includeDescendantTargetIds:[],recurrence:{kind:'daily',interval:1,anchorDate:'2026-08-01'},timeOfDay:'09:00',routineTimezone:'UTC',scheduleMode:'fixed',exceptions:{excludedDates:[],includedDateTimes:[]},assignment:{mode:'member',memberId:mid},reminder:{mode:'none'},cleanlinessChannel:'regular',careLevel:'routine',refreshLevelPct:100,status:'active',revision:1,createdAt:'2026-08-01T00:00:00.000Z'}],tasks:[task()],taskEvents:[],healthTrajectories:[{workspaceId:wid,itemId:eid,routineId:rid,cleanlinessChannel:'regular',healthAnchorAt:'2026-08-30T09:00:00.000Z',healthAnchorPct:100,healthDueAt:'2026-08-31T09:00:00.000Z',healthOverdueEndAt:'2026-09-01T09:00:00.000Z',updatedAt:'2026-08-30T09:00:00.000Z'}],completionSnapshots:[],supplies:[],supplyEvents:[],...overrides} }

// One occurrence renders once even if duplicate task data leaks into memory.
assert(dedupeOccurrences(data({tasks:[task(), task({id:'dup'})]})).length === 1, 'Overview must dedupe same scheduled slot')

// Grouping is mutually exclusive and activity due today is not treated as overdue-day work.
const groups=buildOverviewGroups(data(),{now:new Date('2026-08-31T10:00:00.000Z'),currentMemberId:mid,scope:'mine',criticalThreshold:100,criticalCount:3})
assert(groups.dueNow.length===1 && groups.overdue.length===0 && groups.laterToday.length===0,'Today occurrence must occupy one group')
assert(groups.criticalItems.length===1,'Critical cleanliness is item-based, independent from occurrence count')


// Latest REOPENED lifecycle event wins over an older terminal event in Overview.
const reopenedOverview=data({tasks:[task({state:'scheduled',version:3})],taskEvents:[
  {id:'old-complete',workspaceId:wid,taskId:tid,type:'COMPLETED',at:'2026-08-31T10:00:00.000Z',metadata:{}},
  {id:'later-reopen',workspaceId:wid,taskId:tid,type:'REOPENED',at:'2026-08-31T10:01:00.000Z',metadata:{undoOf:'old-complete'}},
]})
const reopenGroups=buildOverviewGroups(reopenedOverview,{now:new Date('2026-08-31T10:02:00.000Z'),currentMemberId:mid,scope:'mine'})
assert(reopenGroups.dueNow.length===1 && reopenGroups.finished.length===0,'REOPENED must make the occurrence actionable again')

// Paused routine hides actionable work and critical cleanliness.
const paused=data({routines:[{...data().routines[0],status:'paused'}]})
const pausedGroups=buildOverviewGroups(paused,{now:new Date('2026-08-31T10:00:00.000Z'),currentMemberId:mid,scope:'mine',criticalThreshold:100,criticalCount:3})
assert(pausedGroups.dueNow.length===0 && pausedGroups.criticalItems.length===0,'Paused routines must be excluded from Overview')

// Undo Skip reopens the exact occurrence and records REOPENED.
const skipped=applyMutationLocally(data(),{id:'m1',workspaceId:wid,kind:'skip',taskId:tid,expectedVersion:1,eventId:'skip-event',eventAt:'2026-08-31T10:01:00.000Z',actorMemberId:mid})
const undone=applyMutationLocally(skipped,{id:'m2',workspaceId:wid,kind:'undo',taskId:tid,expectedVersion:2,sourceEventId:'skip-event',eventId:'undo-event',eventAt:'2026-08-31T10:02:00.000Z',actorMemberId:mid})
assert(undone.tasks[0].state==='scheduled','Undo Skip must reopen exact occurrence')
assert(undone.taskEvents.some((event)=>event.id==='undo-event'&&event.type==='REOPENED'),'Undo must be auditable')

console.log('v1.2 Phase 2 tests passed')

// Undo Reschedule restores the prior effective due time without touching scheduled slot.
const moved=applyMutationLocally(data(),{id:'m3',workspaceId:wid,kind:'postpone',taskId:tid,expectedVersion:1,eventId:'move-event',eventAt:'2026-08-31T10:03:00.000Z',effectiveDueAt:'2026-09-01T12:00:00.000Z'})
const movedBack=applyMutationLocally(moved,{id:'m4',workspaceId:wid,kind:'undo',taskId:tid,expectedVersion:2,sourceEventId:'move-event',eventId:'undo-move',eventAt:'2026-08-31T10:04:00.000Z'})
assert(movedBack.tasks[0].effectiveDueAt==='2026-08-31T09:00:00.000Z','Undo Reschedule must restore prior effective due')
assert(movedBack.tasks[0].scheduledSlotAt==='2026-08-31T09:00:00.000Z','Undo Reschedule must never move theoretical slot')

// Undo Reassign restores the exact previous assignee.
const mid2='00000000-0000-4000-8000-000000000006'
const withSecond=data({members:[...data().members,{id:mid2,workspaceId:wid,displayName:'B',role:'member',status:'active',labels:[],createdAt:'2026-08-01T00:00:00.000Z'}]})
const reassigned=applyMutationLocally(withSecond,{id:'m5',workspaceId:wid,kind:'reassign',taskId:tid,expectedVersion:1,eventId:'assign-event',eventAt:'2026-08-31T10:05:00.000Z',assigneeMemberId:mid2})
const assignedBack=applyMutationLocally(reassigned,{id:'m6',workspaceId:wid,kind:'undo',taskId:tid,expectedVersion:2,sourceEventId:'assign-event',eventId:'undo-assign',eventAt:'2026-08-31T10:06:00.000Z'})
assert(assignedBack.tasks[0].assigneeMemberId===mid,'Undo Reassign must restore previous assignee')

// Undo Complete reopens only the completion performed by that exact action.
const completed=applyMutationLocally(data(),{id:'m7',workspaceId:wid,kind:'complete',taskId:tid,expectedVersion:1,eventId:'complete-event',eventAt:'2026-08-31T10:07:00.000Z',actorMemberId:mid,completionEffects:[]})
const reopened=applyMutationLocally(completed,{id:'m8',workspaceId:wid,kind:'undo',taskId:tid,expectedVersion:2,sourceEventId:'complete-event',eventId:'undo-complete',eventAt:'2026-08-31T10:08:00.000Z',actorMemberId:mid})
assert(reopened.tasks[0].state==='scheduled' && !reopened.tasks[0].completedAt,'Undo Complete must reopen exact occurrence')
assert(!reopened.tasks[0].targets[0].completedAt,'Undo Complete must clear targets completed by that completion')

// Undo on an after-completion routine also cancels the successor created by that action.
const afterRoutine={...data().routines[0],scheduleMode:'after_completion' as const,recurrence:{kind:'interval' as const,unit:'day' as const,interval:1,anchorDate:'2026-08-01'}}
const sourceSkipped=task({state:'skipped',version:2})
const successor=task({id:'successor',scheduledSlotAt:'2026-09-01T09:00:00.000Z',originalDueAt:'2026-09-01T09:00:00.000Z',effectiveDueAt:'2026-09-01T09:00:00.000Z',dueAt:'2026-09-01T09:00:00.000Z',createdAt:'2026-08-31T10:10:01.000Z'})
const afterData=data({routines:[afterRoutine],tasks:[sourceSkipped,successor],taskEvents:[{id:'source-skip',workspaceId:wid,taskId:tid,type:'SKIPPED',at:'2026-08-31T10:10:00.000Z',metadata:{}}]})
const afterUndo=applyMutationLocally(afterData,{id:'m9',workspaceId:wid,kind:'undo',taskId:tid,expectedVersion:2,sourceEventId:'source-skip',eventId:'undo-after',eventAt:'2026-08-31T10:11:00.000Z',actorMemberId:mid})
assert(afterUndo.tasks.find((item)=>item.id===tid)?.state==='scheduled','Undo must reopen the source occurrence')
assert(afterUndo.tasks.find((item)=>item.id==='successor')?.state==='cancelled','Undo must cancel the derived after-completion successor')
