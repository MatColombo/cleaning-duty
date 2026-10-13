/** Pure cache/mutation isolation tests. They do not verify browser paint or Supabase authorization. */
declare const require: (value: string) => any
declare const process: { exitCode?: number }
import type { WorkspaceData, WorkspaceSummary } from '../src/types/domain'
import { saveCloudCache, loadCloudCache, clearUserCloudCaches } from '../src/lib/offline'
import { readAuthorizedSnapshot, SNAPSHOT_MAX_AGE_MS } from '../src/lib/startupSnapshot'
import { workspaceScope } from '../src/lib/workspaces'
import { SyncCoordinator, projectOutbox, type SyncTransport } from '../src/lib/syncCoordinator'
import { APP_VERSION } from '../src/app/version'

async function main() {
const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
;(globalThis as any).crypto ??= crypto.webcrypto
const kv = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k:string) => kv.get(k) ?? null,
  setItem: (k:string,v:string) => { kv.set(k,v) },
  removeItem: (k:string) => { kv.delete(k) },
  get length() { return kv.size },
  key: (i:number) => [...kv.keys()][i] ?? null,
}
const household = JSON.parse(fs.readFileSync('tests/fixtures/pre-v2-household-backup.json','utf8')).data as WorkspaceData
const id = household.workspace.id
const alice = 'alice-account'
const bob = 'bob-account'
const scopeA = workspaceScope(alice,id)
const scopeB = workspaceScope(bob,id)
const catalog: WorkspaceSummary[] = [{
  id, name: household.workspace.name, timezone: household.workspace.timezone,
  role: 'owner', createdAt: household.workspace.createdAt,
}]
const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value)) as T
const key = `house-care-cloud-cache-v1:${scopeA}`

saveCloudCache(scopeA,household)
assert.equal(readAuthorizedSnapshot(alice,id,catalog)?.workspace.id,id)
assert.equal(readAuthorizedSnapshot(bob,id,catalog),null, 'a second account cannot use the first account cache')
assert.equal(readAuthorizedSnapshot(alice,id,[]),null, 'no membership catalog, no hydration')
assert.equal(readAuthorizedSnapshot(alice,id,[{...catalog[0],archivedAt:new Date().toISOString()}]),null, 'archived household')
assert.equal(readAuthorizedSnapshot(alice,'other-home',catalog),null, 'wrong workspace')
assert.equal(readAuthorizedSnapshot(bob,id,catalog),null, 'same household, different account: no backing cache')
let envelope = JSON.parse(kv.get(key)!)
assert.equal(envelope.appVersion,APP_VERSION)
assert.equal(envelope.schema,2)
assert.equal(envelope.scope,scopeA)

// Reject wrong partition, incompatible cache/worker revision, schema and age.
kv.set(key,JSON.stringify({...envelope,scope:scopeB}))
assert.equal(readAuthorizedSnapshot(alice,id,catalog),null)
kv.set(key,JSON.stringify({...envelope,appVersion:'v1.0.0'}))
assert.equal(readAuthorizedSnapshot(alice,id,catalog),null)
kv.set(key,JSON.stringify({...envelope,schema:1}))
assert.equal(readAuthorizedSnapshot(alice,id,catalog),null)
kv.set(key,JSON.stringify({...envelope,cachedAt:new Date(Date.now()-SNAPSHOT_MAX_AGE_MS-5_000).toISOString()}))
assert.equal(readAuthorizedSnapshot(alice,id,catalog),null)
assert.ok(readAuthorizedSnapshot(alice,id,catalog,true),'unexpired authenticated offline caller may accept aged snapshot')
kv.set(key,JSON.stringify({...envelope,data:{...household,workspace:{...household.workspace,id:'tampered'}}}))
assert.equal(readAuthorizedSnapshot(alice,id,catalog),null,'tampered snapshot scope')
kv.set(key,JSON.stringify(envelope))

// Pending edits must overlay a delayed full read; cached optimistic edits are
// already applied, and projecting the same configuration twice is idempotent.
const server = clone(household)
let online = false
let displayed = clone(household)
const transport: SyncTransport = {
  configuration: async () => ({applied:true,conflict:false}),
  runtime: async () => ({applied:true,conflict:false}),
  reload: async () => clone(server),
}
const coordinator = new SyncCoordinator(scopeA,id,transport,() => online,()=>{},(_remote,projected)=>{ displayed=projected })
const changed = {...household, entities: household.entities.map((row,i) => i===0 ? {...row,name:'New title'} : row)}
coordinator.enqueueConfiguration(household,changed)
saveCloudCache(scopeA,changed)
const optimistic = readAuthorizedSnapshot(alice,id,catalog)!
const projected = projectOutbox(optimistic,coordinator.observe().entries)
assert.equal(projected.entities[0].name,'New title')
online = true
await coordinator.refresh()
assert.equal(displayed.entities[0].name,'New title','cloud read cannot erase a local outbox edit')
const modified = {...displayed, entities: displayed.entities.map((row,i) => i===0 ? {...row,labels:['urgent']} : row)}
coordinator.enqueueConfiguration(displayed,modified)
await coordinator.refresh()
assert.equal(displayed.entities[0].name,'New title')
assert.deepEqual(displayed.entities[0].labels,['urgent'])
coordinator.stop()

// Logout clears private cached payload but intentionally retains the mutation
// outbox, which is keyed to the same account and never exposed to another user.
saveCloudCache(scopeB,household)
clearUserCloudCaches(alice)
assert.equal(loadCloudCache(scopeA),null)
assert.ok(loadCloudCache(scopeB))
assert.ok(kv.has(`house-care-sync-outbox-v2:${scopeA}`),'unsent edits must survive logout')
assert.equal(readAuthorizedSnapshot(bob,id,catalog)?.workspace.id,id)
console.log('Phase 16D snapshot: membership gate, cross-user isolation, cache/schema/age validation, delayed-read overlay, logout durability — PASS (pure tests)')

}
void main().catch((error) => { console.error(error); process.exitCode = 1 })
