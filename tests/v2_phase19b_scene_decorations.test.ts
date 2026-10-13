/** Phase 19B: pure transport simulation. Not a real Supabase or browser test. */
declare const require: (name: string) => any
declare const process: { exitCode?: number }
import type { WorkspaceData } from '../src/types/domain'
import { normalizeWorkspaceData } from '../src/lib/dataMigrations'
import { createHouseholdBackup, parseHouseholdBackup, prepareImportedWorkspace } from '../src/lib/backup'
import { readOutbox, SyncCoordinator, projectOutbox, type SyncTransport } from '../src/lib/syncCoordinator'
import { HOME_ILLUSTRATION_GENERATOR } from '../src/lib/homeIllustration'
import { overlaySceneMutation, readableSceneDecorations, sceneMutationConfirmed,
  sceneRow, validatedSceneDecorations, type SceneDecorationMutation, type SceneDecoration } from '../src/lib/sceneDecorations'
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { webcrypto } = require('node:crypto')
;(globalThis as any).crypto ??= webcrypto
const store=new Map<string,string>()
;(globalThis as any).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v)},removeItem:(k:string)=>{store.delete(k)}}
const fixture=JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json','utf8'))
const base:WorkspaceData=normalizeWorkspaceData({...fixture.data,sceneDecorationsAvailable:true,sceneDecorations:[]})
const wid=base.workspace.id
const scene=base.layoutScenes[0]
const element=base.layoutElements.find(x=>x.sceneId===scene?.id)
assert.ok(scene,'Fixture must contain an original Home scene')
const deco=(kind='plant', elementId?:string): SceneDecoration=>({id:'deco-1',kind:kind as SceneDecoration['kind'],ink:'teal',layer:'above',x:500,y:350,scale:1,rotation:0,...(elementId?{elementId}:{})})
const mutation=(items:SceneDecoration[],expectedRevision=0):SceneDecorationMutation=>({workspaceId:wid,sceneId:scene.id,items,expectedRevision,generatorVersion:HOME_ILLUSTRATION_GENERATOR})
const copy=<T>(item:T):T=>JSON.parse(JSON.stringify(item)) as T
assert.deepEqual(validatedSceneDecorations([deco()]),[deco()])
for (const bad of [
 [{...deco(),url:'https://bad.test'}], [{...deco(),svg:'<svg>'}], [{...deco(),script:'alert(1)'}],
 [{...deco(),x:9999}], [{...deco(),scale:1.11}], [{...deco(),kind:'javascript'}],
 [{...deco(),ink:'evil'}], [{...deco(),rotation:17}], [deco(),deco()],
 Array.from({length:17},(_,i)=>({...deco(),id:`prop-${i}`})),
]) assert.throws(()=>validatedSceneDecorations(bad),'Unsafe/oversized/duplicate scene data must fail before queuing')
assert.equal(readableSceneDecorations(base,scene.id).length,0)
const saved=overlaySceneMutation(base,mutation([deco('plant',element?.id)]),'local-op','2026-10-12T14:00:00Z')
assert.equal(sceneRow(saved,scene.id)?.revision,1)
assert.equal(readableSceneDecorations(saved,scene.id).length,1)
assert.deepEqual(readableSceneDecorations({...saved,layoutElements:saved.layoutElements.filter(x=>x.id!==element?.id)},scene.id),[], 'Missing anchor cannot render')
assert.deepEqual(readableSceneDecorations({...saved,layoutScenes:saved.layoutScenes.map(x=>x.id===scene.id?{...x,archivedAt:'2026-10-12T00:00:00Z'}:x)},scene.id),[], 'Archive preserves row but hides art')
assert.equal(sceneMutationConfirmed(saved,mutation([deco('plant',element?.id)]),'local-op'),true)
assert.equal(sceneMutationConfirmed(saved,mutation([deco('plant',element?.id)]),'wrong'),false)
assert.deepEqual(readableSceneDecorations({...saved,sceneDecorations:saved.sceneDecorations?.map(x=>({...x,generatorVersion:99}))},scene.id),[], 'Unknown generator displays Auto')

class Server {
  data=copy(base)
  receipts=new Set<string>()
  requests=0
  reads=0
  lostAck=false
  blockedRead?: Promise<void>
  seenRead?: ()=>void
  async apply(m:SceneDecorationMutation,id:string){
    this.requests++
    if(this.receipts.has(id))return {applied:true,conflict:false}
    const previous=sceneRow(this.data,m.sceneId)
    if((previous?.revision??0)!==m.expectedRevision)return {applied:false,conflict:true}
    this.data=overlaySceneMutation(this.data,m,id,new Date().toISOString())
    this.receipts.add(id)
    if(this.lostAck){this.lostAck=false;throw new Error('network timeout after commit')}
    return {applied:true,conflict:false}
  }
  async read(){this.reads++;const value=copy(this.data);this.seenRead?.();if(this.blockedRead)await this.blockedRead;return value}
  transport():SyncTransport{return {configuration:async()=>({applied:true,conflict:false}),runtime:async()=>({applied:true,conflict:false}),visual:async()=>({applied:true,conflict:false}),scene:(m,id)=>this.apply(m,id),reload:()=>this.read()}}
}
function client(server:Server,key:string,connected=false){
  const scope=`phase19b-${key}:${wid}`
  let online=connected,visible=copy(base)
  const sync=new SyncCoordinator(scope,wid,server.transport(),()=>online,()=>{},(_remote,projected)=>{visible=projected})
  return {scope,sync,get visible(){return visible},online:(value:boolean)=>online=value,
    save:(m:SceneDecorationMutation)=>{const id=sync.enqueueScene(m);visible=overlaySceneMutation(visible,m,id,new Date().toISOString());return id}}
}
async function run(){
  const server=new Server();const a=client(server,'alice')
  const id=a.save(mutation([deco()]))
  assert.equal(readOutbox(a.scope).length,1,'Queued before cloud acknowledgement')
  assert.equal(server.requests,0,'No requests from preview/drag')
  a.online(true);await a.sync.flush()
  assert.equal(server.requests,1)
  assert.equal(server.data.sceneDecorations?.[0].revision,1)
  assert.equal(readOutbox(a.scope).length,0)
  const b=client(server,'bob',true);await b.sync.refresh()
  assert.equal(readableSceneDecorations(b.visible,scene.id)[0].kind,'plant','Member B reads next refresh')
  const second=a.save(mutation([deco('rug')],1));await a.sync.flush()
  assert.equal(server.data.sceneDecorations?.[0].revision,2)
  const stale=b.save(mutation([deco('sofa')],1));await b.sync.flush()
  assert.equal(b.sync.observe().entries[0]?.state,'conflict')
  assert.equal(server.data.sceneDecorations?.[0].items[0].kind,'rug')
  assert.equal(readableSceneDecorations(b.visible,scene.id)[0].kind,'sofa','Unsynced local art preserved')
  await b.sync.resolveConflict(stale,'keep_local');await b.sync.flush()
  assert.equal(server.data.sceneDecorations?.[0].revision,3)
  assert.equal(server.data.sceneDecorations?.[0].items[0].kind,'sofa')
  await a.sync.refresh();a.save(mutation([],3));await a.sync.flush()
  assert.deepEqual(readableSceneDecorations(server.data,scene.id),[],'Reset Auto uses revisioned tombstone')
  assert.equal(server.data.sceneDecorations?.[0].revision,4)
  // A/B before the first server refresh: the later confirmed revision is
  // authoritative, while the earlier ACK must not become a phantom conflict.
  const rapidServer=new Server()
  const rapid=client(rapidServer,'rapid')
  rapid.save(mutation([deco('plant')]))
  rapid.save(mutation([deco('rug')],1))
  rapid.online(true);await rapid.sync.flush()
  assert.equal(rapidServer.data.sceneDecorations?.[0].revision,2,'Both ordered writes landed')
  assert.equal(rapidServer.data.sceneDecorations?.[0].items[0].kind,'rug')
  assert.equal(readOutbox(rapid.scope).length,0,'Earlier ACK superseded by confirmed later CAS must clear')
  rapid.sync.stop()
  a.sync.stop();b.sync.stop()

  const offlineServer=new Server();const offline=client(offlineServer,'offline')
  offline.save(mutation([deco()]));offline.sync.stop()
  const restart=client(offlineServer,'offline',true);offlineServer.lostAck=true
  await restart.sync.flush()
  assert.equal(offlineServer.data.sceneDecorations?.[0].revision,1)
  restart.sync.stop()
  const entries=readOutbox(offline.scope);entries[0].state='sending'
  store.set(`house-care-sync-outbox-v2:${offline.scope}`,JSON.stringify(entries))
  const retry=client(offlineServer,'offline',true);await retry.sync.flush()
  assert.equal(offlineServer.data.sceneDecorations?.[0].revision,1,'Lost ACK does not repeat edit')
  assert.equal(readOutbox(offline.scope).length,0)
  retry.sync.stop()

  const slow=new Server();let resume!:()=>void;let reached!:()=>void
  slow.blockedRead=new Promise<void>(resolve=>{resume=resolve})
  const requested=new Promise<void>(resolve=>{reached=resolve})
  slow.seenRead=reached
  const c=client(slow,'slow',true)
  const reading=c.sync.refresh();await requested
  c.save(mutation([deco()]));c.online(false);resume();await reading
  assert.equal(readableSceneDecorations(c.visible,scene.id).length,1,'Old cloud refresh cannot discard pending scene edit')
  c.sync.stop()

  const backup=createHouseholdBackup(saved)
  assert.equal(backup.schema_version,11)
  const parsed=parseHouseholdBackup(JSON.stringify(backup))
  assert.equal(parsed.data.sceneDecorations?.length,1,'V11 preserves instructions not raster')
  assert.equal(parsed.data.sceneDecorations?.[0].workspaceId,wid)
  assert.equal(prepareImportedWorkspace(parsed,base,base.members[0]).sceneDecorations?.length,1)
  const v10={...backup,schema_version:10,data:{...backup.data,sceneDecorations:undefined}}
  assert.deepEqual(parseHouseholdBackup(JSON.stringify(v10)).data.sceneDecorations,[],'V10 import uses Auto')
  const legacy={...backup,schema_version:9,data:{...backup.data,visualOverrides:undefined,sceneDecorations:undefined}}
  assert.deepEqual(parseHouseholdBackup(JSON.stringify(legacy)).data.sceneDecorations,[],'Pre-V2 import uses Auto')
  assert.throws(()=>parseHouseholdBackup(JSON.stringify({...backup,data:{...backup.data,sceneDecorations:[{...backup.data.sceneDecorations![0],items:[{...deco(),url:'https://bad.test'}]}]}})))
  assert.ok(id&&second)
  console.log('Phase 19B: CAS, duplicate retry, offline restart, stale refresh, Reset Auto, v9/v10/v11 backups PASS (simulated)')
}
void run().catch(err=>{console.error(err);process.exitCode=1})
