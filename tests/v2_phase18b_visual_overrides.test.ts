/** Phase 18B: deterministic simulated transport, NOT a live Supabase/RLS test. */
declare const require: (name: string) => any
declare const process: { exitCode?: number }
import type { WorkspaceData } from '../src/types/domain'
import { normalizeWorkspaceData } from '../src/lib/dataMigrations'
import { createHouseholdBackup, parseHouseholdBackup, prepareImportedWorkspace } from '../src/lib/backup'
import { readOutbox, SyncCoordinator, projectOutbox, type SyncTransport } from '../src/lib/syncCoordinator'
import { effectiveVisualOverrides, overlayVisualMutation, readableVisualOverride,
  validatedVisualOverrides, visualMutationConfirmed, type VisualOverrideMutation } from '../src/lib/visualOverrides'
import { HOUSE_CARE_VISUAL_VERSION } from '../src/visual/version'
import { renderStudioPreviewSvg } from '../src/visual/studio/preview'
import { generateCardVisualRecipe } from '../src/visual/procedural/recipe'
import { vectorPaletteFromTheme } from '../src/visual/palette'
import { themePreset } from '../src/lib/theme'

const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { webcrypto } = require('node:crypto')
const Buffer = require('node:buffer').Buffer
;(globalThis as any).crypto ??= webcrypto
const storage = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v) },
  removeItem: (k: string) => { storage.delete(k) },
}
const backupV9 = JSON.parse(readFileSync('tests/fixtures/pre-v2-household-backup.json', 'utf8'))
const base: WorkspaceData = { ...normalizeWorkspaceData(backupV9.data), visualOverrides: [], visualOverridesAvailable: true }
const uid = base.workspace.id
const routineId = base.routines[0].id
const entityId = base.entities[0].id
const actionId = base.actions[0].id
const mutation = (kind: 'routine' | 'action' | 'entity', id: string, overrides: VisualOverrideMutation['overrides'], expectedRevision=0): VisualOverrideMutation => ({
  workspaceId: uid, subjectType: kind, subjectId: id, expectedRevision, generatorVersion: HOUSE_CARE_VISUAL_VERSION, overrides,
})
const deep = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
for (const bad of [{script:'alert(1)'},{subjectId:'http://bad'},{scale:2},{scale:1.03},{animation:'evil'},{prop:'<svg>'},{eyes:'not-listed'},{nested:{url:'https://bad'}}]) {
  assert.throws(() => validatedVisualOverrides(bad), 'Unsafe JSON must be rejected before it reaches the outbox')
}
assert.deepEqual(validatedVisualOverrides({pose:'wave',eyes:'proud',scale:1.1}),{eyes:'proud',pose:'wave',scale:1.1})
const tooBig = 'x'.repeat(2500)
assert.throws(() => validatedVisualOverrides({subjectId:tooBig}), 'Oversized or invalid value denied')
const automatic = generateCardVisualRecipe({routineId,actionId,primaryTargetId:entityId,occurrenceId:'visual18b',subjectName:'Oven',actionName:'Degrease'})
const p = vectorPaletteFromTheme(themePreset('house-care-retro').palette)
const original = renderStudioPreviewSvg(automatic, {}, 'visual18b',p)
assert.equal(readableVisualOverride(base,'routine',routineId),undefined)

class Server {
  data: WorkspaceData = deep(base)
  receipts = new Map<string, number>()
  requests: { bytes: number; type: string }[] = []
  reads = 0
  lostAck = false
  readWait: Promise<void> | undefined
  startRead: (() => void) | undefined
  async apply(m: VisualOverrideMutation, id: string): Promise<{applied:boolean;conflict:boolean}> {
    this.requests.push({type:'visual',bytes:Buffer.byteLength(JSON.stringify({p_workspace_id:m.workspaceId,p_subject_type:m.subjectType,p_subject_id:m.subjectId,p_expected_revision:m.expectedRevision,p_overrides:m.overrides,p_mutation_id:id}))})
    if (this.receipts.has(id)) return {applied:true,conflict:false}
    const serverRow = this.data.visualOverrides?.find((r)=>r.subjectType===m.subjectType&&r.subjectId===m.subjectId)
    if ((serverRow?.revision ?? 0)!==m.expectedRevision) return {applied:false,conflict:true}
    this.data=overlayVisualMutation(this.data,m,id,new Date().toISOString())
    this.receipts.set(id,m.expectedRevision+1)
    if (this.lostAck) { this.lostAck=false; throw new Error('network timeout after commit') }
    return {applied:true,conflict:false}
  }
  async read(): Promise<WorkspaceData> {
    this.reads++
    const snapshot=deep(this.data)
    this.startRead?.()
    if (this.readWait) await this.readWait
    return snapshot
  }
  transport(): SyncTransport { return {
    configuration: async()=>({applied:true,conflict:false}),
    runtime: async()=>({applied:true,conflict:false}),
    visual: (m,id)=>this.apply(m,id),
    reload: ()=>this.read(),
  } }
}
function createClient(server:Server, id:string, online=false) {
  const scope=`member-${id}:${uid}`
  let connected=online, visible=deep(base)
  let observations=0
  const coordinator=new SyncCoordinator(scope,uid,server.transport(),()=>connected,()=>{observations++},(_raw,proj)=>{visible=proj})
  return {scope,coordinator,get visible(){return visible},get observations(){return observations},setOnline:(value:boolean)=>{connected=value},
    save:(m:VisualOverrideMutation)=>{const key=coordinator.enqueueVisual(m);visible=overlayVisualMutation(visible,m,key,new Date().toISOString());return key},
  }
}
async function run(){
  const server = new Server()
  const a = createClient(server,'a')
  const first = a.save(mutation('routine',routineId,{pose:'thumbs-up'}))
  assert.equal(readOutbox(a.scope).length,1,'First edit durable before network')
  assert.equal(server.requests.length,0,'No slider/picker network requests')
  assert.equal(effectiveVisualOverrides(a.visible,{routineId,actionId,primaryTargetId:entityId})?.pose,'thumbs-up')
  a.setOnline(true);await a.coordinator.flush()
  assert.equal(server.requests.length,1)
  assert.equal(server.receipts.get(first),1,'Initial save increments one revision')
  assert.equal(readOutbox(a.scope).length,0)
  assert.equal(visualMutationConfirmed(server.data,mutation('routine',routineId,{pose:'thumbs-up'}),first),true)
  const b=createClient(server,'b',true)
  await b.coordinator.refresh()
  assert.equal(readableVisualOverride(b.visible,'routine',routineId)?.pose,'thumbs-up','Member B reads on ordinary refresh')
  assert.equal(b.visible.visualOverrides?.length,1)
  assert.equal(effectiveVisualOverrides(b.visible,{routineId,actionId,primaryTargetId:entityId})?.pose,'thumbs-up')
  const inheritedAction=overlayVisualMutation(base,mutation('action',actionId,{pose:'wave'}),'action-init','2026-10-12T00:00:00Z')
  assert.equal(effectiveVisualOverrides(inheritedAction,{routineId,actionId,primaryTargetId:entityId})?.pose,'wave','Action art applies without a more specific override')
  const inheritedEntity=overlayVisualMutation(inheritedAction,mutation('entity',entityId,{pose:'celebrate'}),'entity-init','2026-10-12T00:00:01Z')
  assert.equal(effectiveVisualOverrides(inheritedEntity,{routineId,actionId,primaryTargetId:entityId})?.pose,'celebrate','Entity overrides Action')
  const incompatible={...inheritedEntity,visualOverrides:inheritedEntity.visualOverrides!.map((r)=>r.subjectType==='entity'?{...r,generatorVersion:999}:r)}
  assert.deepEqual(effectiveVisualOverrides(incompatible,{routineId,actionId,primaryTargetId:entityId}),{},'Unsupported version renders Auto, not inherited Action artwork')
  assert.equal(server.reads,2,'No polling loop')

  // Concurrent conflict: B did not refresh after A's second save.
  const alice2=a.save(mutation('routine',routineId,{pose:'wave'},1));a.setOnline(true);await a.coordinator.flush()
  assert.equal(server.data.visualOverrides?.[0].revision,2)
  const bob=b.save(mutation('routine',routineId,{pose:'fist-pump'},1))
  await b.coordinator.flush()
  assert.equal(b.coordinator.observe().entries[0]?.state,'conflict')
  assert.equal(readableVisualOverride(b.visible,'routine',routineId)?.pose,'fist-pump','Conflict retains local artwork')
  assert.equal(server.data.visualOverrides?.[0].overrides.pose,'wave','Server rejects stale B without overwrite')
  await b.coordinator.resolveConflict(bob,'keep_local');await b.coordinator.flush()
  assert.equal(server.data.visualOverrides?.[0].overrides.pose,'fist-pump')
  assert.equal(server.data.visualOverrides?.[0].revision,3)
  assert.ok(alice2)

  // Reset to Auto is a revisioned empty JSON, not a dangerous delete.
  await a.coordinator.refresh()
  const reset=a.save(mutation('routine',routineId,{},3));await a.coordinator.flush()
  assert.ok(reset)
  assert.deepEqual(effectiveVisualOverrides(server.data,{routineId,actionId,primaryTargetId:entityId}),{})
  assert.equal(renderStudioPreviewSvg(automatic,effectiveVisualOverrides(server.data,{routineId,actionId,primaryTargetId:entityId}), 'visual18b',p),original)
  a.coordinator.stop();b.coordinator.stop()

  // Offline restart + lost acknowledgement: replayed mutation ID is idempotent.
  const crashServer=new Server()
  const offline=createClient(crashServer,'offline')
  const id=offline.save(mutation('entity',entityId,{expression:'joyful'}))
  assert.equal(crashServer.requests.length,0)
  offline.coordinator.stop()
  const restarted=createClient(crashServer,'offline',true)
  crashServer.lostAck=true
  await restarted.coordinator.flush()
  assert.equal(crashServer.data.visualOverrides?.length,1)
  assert.equal(crashServer.data.visualOverrides?.[0].revision,1)
  // Simulate a reload while the delivery response is unavailable.
  restarted.coordinator.stop()
  const pending=readOutbox(offline.scope)
  pending[0].state='sending'
  storage.set(`house-care-sync-outbox-v2:${offline.scope}`,JSON.stringify(pending))
  const recovered=createClient(crashServer,'offline',true)
  await recovered.coordinator.flush()
  assert.equal(crashServer.receipts.size,1)
  assert.equal(crashServer.data.visualOverrides?.[0].revision,1)
  assert.equal(readOutbox(offline.scope).length,0)
  assert.ok(id)
  recovered.coordinator.stop()

  // Delayed stale refresh overlays local visual mutation.
  const slowServer=new Server();let release!:()=>void,started!:()=>void
  slowServer.readWait=new Promise<void>((resolve)=>{release=resolve})
  const reached=new Promise<void>((resolve)=>{started=resolve})
  slowServer.startRead=started
  const stale=createClient(slowServer,'stale',true)
  const loading=stale.coordinator.refresh();await reached
  stale.save(mutation('action',actionId,{mouth:'worried'}));stale.setOnline(false)
  release();await loading
  assert.equal(readableVisualOverride(stale.visible,'action',actionId)?.mouth,'worried')
  stale.coordinator.stop()

  // V9 imports remain compatible; v10 preserves instructions and re-scopes on local import.
  const parsedV9=parseHouseholdBackup(JSON.stringify(backupV9))
  assert.equal(parsedV9.schema_version,11)
  assert.deepEqual(parsedV9.data.visualOverrides,[])
  const v10=createHouseholdBackup(server.data)
  assert.equal(v10.schema_version,11)
  assert.deepEqual(v10.data.visualOverrides?.[0].overrides,{},'V10 exports explicit Auto reset without SVG')
  const archivedData = {...server.data, routines:server.data.routines.map((r)=>r.id===routineId?{...r,archivedAt:'2026-10-12T12:00:00Z'}:r)}
  assert.equal(createHouseholdBackup(archivedData).data.visualOverrides?.length,1,'Archived subject artwork remains exportable')
  const rawV10={...v10, schema_version:10, data:{...v10.data,sceneDecorations:undefined}}
  assert.deepEqual(parseHouseholdBackup(JSON.stringify(rawV10)).data.sceneDecorations,[],'Old V10 import has no Home decorations')
  const parsedV10=parseHouseholdBackup(JSON.stringify(v10))
  assert.deepEqual(parsedV10.data.visualOverrides?.[0].overrides,{})
  const localImport=prepareImportedWorkspace(parsedV10,base,base.members[0])
  assert.equal(localImport.visualOverrides?.[0].workspaceId,base.workspace.id)
  assert.throws(()=>parseHouseholdBackup(JSON.stringify({...v10,data:{...v10.data,visualOverrides:[{...v10.data.visualOverrides![0],overrides:{bad:'<svg>'}}]}})), 'Malicious backup overrides rejected')
  console.log('Phase 18B: 2-member refresh, revision conflict/rebase, offline restart, ACK loss, Auto reset, stale read, v9/v10 backups PASSED')
}
void run().catch((err:unknown)=>{console.error(err);process.exitCode=1})
