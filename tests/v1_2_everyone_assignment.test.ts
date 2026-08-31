import { resolveAssignment } from '../src/lib/assignment'
import { normalizeWorkspaceData } from '../src/lib/dataMigrations'
import { applyMutationLocally } from '../src/lib/mutations'
import { materializeRoutineSlot } from '../src/lib/scheduler'
import type { Routine, TaskOccurrence, WorkspaceData } from '../src/types/domain'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const wid='00000000-0000-4000-8000-000000000201'
const m1='00000000-0000-4000-8000-000000000202'
const m2='00000000-0000-4000-8000-000000000203'
const eid='00000000-0000-4000-8000-000000000204'
const rid='00000000-0000-4000-8000-000000000205'
const aid='00000000-0000-4000-8000-000000000206'
const due='2026-09-01T08:00:00.000Z'

const everyoneRoutine: Routine = {
  id:rid, workspaceId:wid, name:'Shared kitchen clean', actionId:aid, targetEntityIds:[eid], includeDescendantTargetIds:[],
  recurrence:{kind:'interval',unit:'day',interval:1,anchorDate:'2026-08-31'}, timeOfDay:'08:00', routineTimezone:'UTC', scheduleMode:'fixed',
  exceptions:{excludedDates:[],includedDateTimes:[]}, assignment:{mode:'everyone'}, reminder:{mode:'at_due'}, cleanlinessChannel:'regular', careLevel:'routine',
  refreshLevelPct:100, status:'active', revision:1, createdAt:'2026-08-31T07:00:00.000Z',
}

const base: WorkspaceData = {
  workspace:{id:wid,name:'Home',timezone:'UTC',careSensitivity:'balanced',createdAt:'2026-08-31T07:00:00.000Z'},
  members:[
    {id:m1,workspaceId:wid,userId:'user-1',displayName:'One',role:'owner',status:'active',labels:[],createdAt:'2026-08-31T07:00:00.000Z'},
    {id:m2,workspaceId:wid,userId:'user-2',displayName:'Two',role:'member',status:'active',labels:[],createdAt:'2026-08-31T07:00:00.000Z'},
  ],
  fieldDefinitions:[],entityTypes:[{id:'type',workspaceId:wid,name:'Item',createdAt:'2026-08-31T07:00:00.000Z'}],
  entities:[{id:eid,workspaceId:wid,typeId:'type',name:'Kitchen counter',labels:[],metadata:{},createdAt:'2026-08-31T07:00:00.000Z'}],
  layoutScenes:[],layoutElements:[],entityRelations:[],
  actions:[{id:aid,workspaceId:wid,name:'Wipe',defaultSupplyIds:[],metadata:{},revision:1,createdAt:'2026-08-31T07:00:00.000Z'}],
  routines:[everyoneRoutine],tasks:[],taskEvents:[],healthTrajectories:[],completionSnapshots:[],supplies:[],supplyEvents:[],
}

const resolved=resolveAssignment(base,everyoneRoutine,0,due)
assert(resolved.scope==='everyone'&&!resolved.memberId,'Everyone must be an explicit non-member assignment scope')

const materialized=materializeRoutineSlot(base,everyoneRoutine,due)
assert(materialized.tasks.length===1,'Everyone routine must materialize one occurrence, not one occurrence per person')
assert(materialized.tasks[0].assignmentScope==='everyone'&&!materialized.tasks[0].assigneeMemberId,'Everyone occurrence must carry broadcast scope without a single assignee id')
assert(materialized.taskEvents.some((event)=>event.type==='ASSIGNED'&&event.metadata.assignmentScope==='everyone'),'Everyone materialization must snapshot its assignment semantics in history')

const memberTask: TaskOccurrence={...materialized.tasks[0],assignmentScope:'member',assigneeMemberId:m1,version:1}
const reassignEveryone=applyMutationLocally({...materialized,tasks:[memberTask],taskEvents:[]},{id:'mut-everyone',workspaceId:wid,kind:'reassign',taskId:memberTask.id,expectedVersion:1,assignmentScope:'everyone',eventId:'evt-everyone',eventAt:'2026-08-31T20:30:00.000Z'})
assert(reassignEveryone.tasks[0].assignmentScope==='everyone'&&!reassignEveryone.tasks[0].assigneeMemberId,'Reassign to Everyone must clear a specific assignee and preserve broadcast semantics')
const reassignUnassigned=applyMutationLocally(reassignEveryone,{id:'mut-unassigned',workspaceId:wid,kind:'reassign',taskId:memberTask.id,expectedVersion:2,assignmentScope:'unassigned',eventId:'evt-unassigned',eventAt:'2026-08-31T20:31:00.000Z'})
assert(reassignUnassigned.tasks[0].assignmentScope==='unassigned'&&!reassignUnassigned.tasks[0].assigneeMemberId,'Unassigned must remain distinct from Everyone')

const legacyEveryone={...materialized,tasks:[Object.fromEntries(Object.entries(materialized.tasks[0]).filter(([key])=>key!=='assignmentScope')) as unknown as TaskOccurrence]}
const normalized=normalizeWorkspaceData(legacyEveryone)
assert(normalized.tasks[0].assignmentScope==='everyone','Legacy null-assignee rows belonging to an Everyone routine must migrate to Everyone')

console.log('v1.2.0 Everyone assignment tests passed')
