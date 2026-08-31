import { buildOverviewGroups } from '../src/lib/overview'
import { historyEntriesV12 } from '../src/lib/analytics'
import type { TaskOccurrence, WorkspaceData } from '../src/types/domain'
function assert(v: unknown, m: string): asserts v { if (!v) throw new Error(m) }
const baseTask: TaskOccurrence = { id:'t',workspaceId:'w',routineId:'r',routineRevision:1,routineNameSnapshot:'Routine',actionNameSnapshot:'Clean',cleanlinessChannel:'regular',careLevel:'routine',scheduledSlotAt:'2026-08-31T09:00:00Z',effectiveDueAt:'2026-09-01T09:00:00Z',originalDueAt:'2026-08-31T09:00:00Z',dueAt:'2026-09-01T09:00:00Z',state:'scheduled',targets:[],supplies:[],explanation:{schedule:'',assignment:'',targetSummary:''},version:2,createdAt:'2026-08-01T00:00:00Z' }
const data: WorkspaceData = {workspace:{id:'w',name:'H',timezone:'UTC',careSensitivity:'balanced',createdAt:'2026-08-01T00:00:00Z'},members:[],fieldDefinitions:[],entityTypes:[],entities:[],layoutScenes:[],layoutElements:[],entityRelations:[],supplies:[],supplyEvents:[],actions:[],routines:[{id:'r',workspaceId:'w',name:'Routine',actionId:'a',targetEntityIds:[],includeDescendantTargetIds:[],recurrence:{kind:'daily',interval:1,anchorDate:'2026-08-01'},timeOfDay:'09:00',routineTimezone:'UTC',scheduleMode:'fixed',exceptions:{excludedDates:[],includedDateTimes:[]},assignment:{mode:'unassigned'},reminder:{mode:'none'},cleanlinessChannel:'regular',careLevel:'routine',refreshLevelPct:100,status:'active',revision:1,createdAt:'2026-08-01T00:00:00Z'}],tasks:[baseTask],taskEvents:[{id:'p',workspaceId:'w',taskId:'t',type:'POSTPONED',at:'2026-08-31T10:00:00Z',metadata:{from:'2026-08-31T09:00:00Z',to:'2026-09-01T09:00:00Z'}}],healthTrajectories:[],completionSnapshots:[]}
const groups=buildOverviewGroups(data,{now:new Date('2026-08-31T12:00:00Z'),scope:'household'})
assert(groups.finished.some(t=>t.id==='t'),'postponed-today task should be in Finished')
assert(!groups.upcoming.some(t=>t.id==='t'),'postponed-today task must not duplicate in Upcoming')
const completed={...baseTask,id:'c',state:'completed' as const,completedAt:'2026-08-31T11:00:00Z',effectiveDueAt:'2026-08-31T09:00:00Z',dueAt:'2026-08-31T09:00:00Z'}
const history=historyEntriesV12({...data,tasks:[completed],taskEvents:[]},7,new Date('2026-08-31T12:00:00Z'))
assert(history.some(e=>e.taskId==='c'&&e.type==='completed'),'completed_at fallback should appear in Analysis history')
console.log('v1.2.0 corrective tests passed')
