/** Deterministic 16C two-client / retry tests. Simulated server; NOT cloud E2E. */
declare const require: (name:string) => any
const assert = require('node:assert/strict')
;(globalThis as any).crypto ??= require('node:crypto').webcrypto
import type { WorkspaceData, Routine } from '../src/types/domain'
import type { OfflineMutation } from '../src/lib/offline'
import { applyMutationLocally } from '../src/lib/mutations'
import { materializeTasks } from '../src/lib/scheduler'
import { SyncCoordinator, readOutbox, type SyncTransport } from '../src/lib/syncCoordinator'

const store=new Map<string,string>()
;(globalThis as any).localStorage={
  getItem:(k:string)=>store.get(k)??null,
  setItem:(k:string,v:string)=>{store.set(k,v)},removeItem:(k:string)=>store.delete(k),
}
const w='00000000-0000-4000-8000-000000000620',r='00000000-0000-4000-8000-000000000621'
type TaskMutation = Exclude<OfflineMutation,{kind:'supply_status'}>
const initial='2026-09-01T10:00:00.000Z'
const routine:Routine={id:r,workspaceId:w,name:'Clean kitchen',actionId:'clean',targetEntityIds:['item'],includeDescendantTargetIds:[],
  recurrence:{kind:'interval',unit:'day',interval:5,anchorDate:'2026-09-01'},scheduleMode:'after_completion',timeOfDay:'10:00',routineTimezone:'UTC',
  exceptions:{excludedDates:[],includedDateTimes:[]},assignment:{mode:'everyone'},reminder:{mode:'at_due'},
  cleanlinessChannel:'regular',careLevel:'routine',refreshLevelPct:100,
  status:'active',revision:1,createdAt:'2026-01-01T00:00:00.000Z'}
const empty:WorkspaceData={
  workspace:{id:w,name:'Household',timezone:'UTC',careSensitivity:'balanced',createdAt:'2026-01-01T00:00:00.000Z'},
  members:[],entityTypes:[{id:'type',workspaceId:w,name:'Item',createdAt:initial}],
  entities:[{id:'item',workspaceId:w,typeId:'type',name:'Oven',labels:[],metadata:{},createdAt:initial}],
  fieldDefinitions:[],layoutScenes:[],layoutElements:[],entityRelations:[],
  actions:[{id:'clean',workspaceId:w,name:'Clean',defaultSupplyIds:[],metadata:{},revision:1,createdAt:initial}],
  routines:[routine],tasks:[],taskEvents:[],supplies:[],supplyEvents:[],healthTrajectories:[],completionSnapshots:[],
  recurrenceMode:'atomic',extraCareMode:'integrated',extraCareEvents:[],extraCareLegacyCarries:[],
}
const base=materializeTasks({...empty,recurrenceMode:undefined},45,new Date('2026-09-01T11:00:00.000Z'))
base.recurrenceMode='atomic'
assert.equal(base.tasks.length,1)
const task=base.tasks[0]
function snapshot(value:WorkspaceData):WorkspaceData{return JSON.parse(JSON.stringify(value)) as WorkspaceData}
function complete(id:string,at:string):TaskMutation {
  const event:TaskMutation={id,workspaceId:w,kind:'complete',taskId:task.id,
    expectedVersion:1,eventId:id,eventAt:at,completionEffects:[],integrated:true,afterCompletion:true}
  const projected=applyMutationLocally(base,event)
  event.afterCompletionSuccessor=projected.tasks.find(row=>row.successorOfEventId===id)
  event.afterCompletionEvents=projected.taskEvents.filter(row=>row.taskId===event.afterCompletionSuccessor?.id)
  assert.ok(event.afterCompletionSuccessor)
  assert.equal(event.afterCompletionEvents?.length,2,'Creation + Assignment events are retained with the successor')
  return event
}
class CloudFixture {
  data=snapshot(base)
  accept=0
  duplicate=0
  failAfterCommit=false
  transport:SyncTransport={
    configuration:async()=>{throw Error('No generated configuration writes expected')},
    runtime:async(mutation)=>{
      if(mutation.kind==='supply_status') throw Error('Unexpected supply mutation')
      if(this.data.taskEvents.some(row=>row.id===mutation.eventId)){
        this.duplicate++; return {applied:true,conflict:false}
      }
      const previous=this.data.tasks.find(row=>row.id===mutation.taskId)
      if(!previous||previous.version!==mutation.expectedVersion)return{applied:false,conflict:true}
      this.data=applyMutationLocally(this.data,mutation)
      this.accept++
      if(this.failAfterCommit){this.failAfterCommit=false;throw Error('network timeout after commit')}
      return{applied:true,conflict:false}
    },
    reload:async()=>snapshot(this.data),
  }
}
async function main(){
  const cloud=new CloudFixture()
  const original=complete('00000000-0000-4000-8000-000000000622','2026-09-03T13:00:00.000Z')
  const scope=`user-a:${w}`
  let connected=false
  const first=new SyncCoordinator(scope,w,cloud.transport,()=>connected,()=>{},()=>{})
  first.enqueueRuntime(original)
  assert.equal(readOutbox(scope).length,1,'Offline mutation is durable')
  assert.equal((readOutbox(scope)[0].runtime as TaskMutation)?.afterCompletionSuccessor?.scheduledSlotAt,'2026-09-08T13:00:00.000Z')
  first.stop()
  const resumed=new SyncCoordinator(scope,w,cloud.transport,()=>connected,()=>{},()=>{})
  cloud.failAfterCommit=true
  connected=true
  await resumed.flush()
  assert.equal(readOutbox(scope)[0].state,'retrying')
  assert.equal(cloud.data.tasks.filter(row=>row.successorOfEventId===original.eventId).length,1)
  resumed.stop()
  const retry=readOutbox(scope)
  retry[0].nextAttemptAt=0
  store.set(`house-care-sync-outbox-v2:${scope}`,JSON.stringify(retry))
  const third=new SyncCoordinator(scope,w,cloud.transport,()=>connected,()=>{},()=>{})
  await third.flush()
  assert.equal(readOutbox(scope).length,0,'ACK was lost but duplicate replay is fully reconciled')
  assert.equal(cloud.accept,1)
  assert.equal(cloud.duplicate,1)
  assert.equal(cloud.data.taskEvents.filter(row=>row.id===original.eventId).length,1)
  assert.equal(cloud.data.tasks.filter(row=>row.successorOfEventId===original.eventId).length,1)
  assert.equal(cloud.data.tasks[1].scheduledSlotAt,'2026-09-08T13:00:00.000Z', 'Retry preserves original eventAt')
  third.stop()

  // Two devices independently complete the same task: first wins; second
  // receives a durable recoverable conflict, never an overwritten successor.
  const race=new CloudFixture()
  const aliceScope=`alice:${w}`;const bobScope=`bob:${w}`
  const alice=new SyncCoordinator(aliceScope,w,race.transport,()=>true,()=>{},()=>{})
  const bob=new SyncCoordinator(bobScope,w,race.transport,()=>true,()=>{},()=>{})
  alice.enqueueRuntime(complete('00000000-0000-4000-8000-000000000623','2026-09-03T09:30:00.000Z'))
  bob.enqueueRuntime(complete('00000000-0000-4000-8000-000000000624','2026-09-03T20:00:00.000Z'))
  await alice.flush();await bob.flush()
  assert.equal(race.accept,1)
  assert.equal(readOutbox(bobScope)[0].state,'conflict')
  assert.equal(race.data.tasks.length,2)
  assert.equal(race.data.tasks[1].scheduledSlotAt,'2026-09-08T09:30:00.000Z')
  assert.equal(race.data.taskEvents.filter(row=>row.type==='COMPLETED').length,1)
  alice.stop();bob.stop()
  console.log('Phase 16C durable coordinator: original event timestamp, offline restart, ACK-loss replay, one successor, two-client version conflict — PASS (simulated)')
}
main().catch((error:unknown)=>{console.error(error);process.exitCode=1})
declare const process:{exitCode?:number}
