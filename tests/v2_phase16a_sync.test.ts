/** Reproducible Phase 16A races against an instrumented in-memory CAS transport.
 * These are not live Supabase or installed-PWA tests. */
declare const require: (id: string) => any
declare const process: { exitCode?: number }
import type { WorkspaceData } from '../src/types/domain'
import type { OfflineMutation } from '../src/lib/offline'
import { normalizeWorkspaceData } from '../src/lib/dataMigrations'
import { applyMutationLocally } from '../src/lib/mutations'
import { buildConfigChanges, combineConfigChanges, configAcknowledgedIn, serializeWorkspace, type EntityChange } from '../src/lib/configChanges'
import { SyncCoordinator, projectOutbox, readOutbox, type SyncTransport, type OutboxEntry } from '../src/lib/syncCoordinator'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Buffer = require('node:buffer').Buffer
const cryptoModule = require('node:crypto')
;(globalThis as any).crypto ??= cryptoModule.webcrypto
const store = new Map<string, string>()
let rejectStore = false
;(globalThis as any).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { if (rejectStore) throw new Error('quota exceeded'); store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
}
const fixture = normalizeWorkspaceData(JSON.parse(fs.readFileSync('tests/fixtures/pre-v2-household-backup.json', 'utf8')).data as WorkspaceData)
const deep = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const editName = (d: WorkspaceData, name: string): WorkspaceData => ({ ...d, entities: d.entities.map((x, i) => i === 0 ? { ...x, name } : x) })
const editLabels = (d: WorkspaceData, labels: string[]): WorkspaceData => ({ ...d, entities: d.entities.map((x, i) => i === 0 ? { ...x, labels } : x) })
const editX = (d: WorkspaceData, x: number): WorkspaceData => ({ ...d, layoutElements: d.layoutElements.map((r, i) => i === 0 ? { ...r, x } : r) })
function taskMutation(current: WorkspaceData, kind: 'complete' | 'undo', sourceEventId?: string): OfflineMutation {
  const task = current.tasks.find((x) => x.state === (kind === 'complete' ? 'scheduled' : 'completed'))!
  assert.ok(task, 'fixture must contain a task in the requested state')
  return { id: crypto.randomUUID(), workspaceId: current.workspace.id, kind, taskId: task.id, expectedVersion: task.version,
    eventId: crypto.randomUUID(), eventAt: new Date().toISOString(), sourceEventId }
}
function stockMutation(current: WorkspaceData): OfflineMutation {
  const supply = current.supplies[0]
  assert.ok(supply)
  return { id: crypto.randomUUID(), workspaceId: current.workspace.id, kind: 'supply_status', supplyId: supply.id,
    expectedVersion: supply.version, status: supply.status === 'low' ? 'available' : 'low',
    eventId: crypto.randomUUID(), eventAt: new Date().toISOString() }
}

class TestServer {
  data = deep(fixture)
  receipts = new Set<string>()
  calls: { kind: string; bytes: number; entityRows: number }[] = []
  failAfterCommit = false
  failHard = false
  delayConfig: Promise<void> | null = null
  delayRead: Promise<void> | null = null
  readReached?: () => void
  async config(_workspaceId: string, id: string, changes: EntityChange[]): Promise<{ applied: boolean; conflict: boolean }> {
    this.calls.push({ kind: 'config', bytes: Buffer.byteLength(JSON.stringify(changes)), entityRows: changes.length })
    if (this.delayConfig) await this.delayConfig
    if (this.failHard) throw Error('Permission denied')
    if (this.receipts.has(id)) return { applied: true, conflict: false }
    const tables = serializeWorkspace(this.data)
    for (const change of changes) {
      const row = tables[change.table]?.find((r) => Object.entries(change.key).every(([key, val]) => JSON.stringify(r[key]) === JSON.stringify(val)))
      if ((change.before === null && row) || (change.before !== null && !row)) return { applied: false, conflict: true }
      if (row && change.before && Object.entries(change.before).some(([key, val]) => JSON.stringify(row[key]) !== JSON.stringify(val))) return { applied: false, conflict: true }
    }
    for (const change of changes) {
      const id = String(change.key.id)
      if (change.table === 'entities') this.data = {
        ...this.data, entities: this.data.entities.map((r) => r.id === id ? {
          ...r, ...(change.after && 'name' in change.after ? { name: String(change.after.name) } : {}),
          ...(change.after && 'labels' in change.after ? { labels: change.after.labels as string[] } : {}),
        } : r),
      }
      if (change.table === 'layout_elements') this.data = {
        ...this.data, layoutElements: this.data.layoutElements.map((r) => r.id === id ? {
          ...r, ...(change.after && 'x' in change.after ? { x: Number(change.after.x) } : {}),
          ...(change.after && 'y' in change.after ? { y: Number(change.after.y) } : {}),
        } : r),
      }
    }
    this.receipts.add(id)
    if (this.failAfterCommit) { this.failAfterCommit = false; throw Error('network timeout after commit') }
    return { applied: true, conflict: false }
  }
  async runtime(m: OfflineMutation): Promise<{ applied: boolean; conflict: boolean }> {
    this.calls.push({ kind: m.kind, bytes: Buffer.byteLength(JSON.stringify(m)), entityRows: 1 })
    if (this.failHard) throw Error('Permission denied')
    if (this.receipts.has(m.eventId)) return { applied: true, conflict: false }
    const row = m.kind === 'supply_status' ? this.data.supplies.find((x) => x.id === m.supplyId) : this.data.tasks.find((x) => x.id === m.taskId)
    if (!row || row.version !== m.expectedVersion) return { applied: false, conflict: true }
    this.data = applyMutationLocally(this.data, m)
    this.receipts.add(m.eventId)
    if (this.failAfterCommit) { this.failAfterCommit = false; throw Error('network timeout after commit') }
    return { applied: true, conflict: false }
  }
  async reload(_workspaceId: string): Promise<WorkspaceData> {
    if (this.delayRead) { this.readReached?.(); await this.delayRead }
    return deep(this.data)
  }
  transport(): SyncTransport {
    return {
      configuration: (scope, id, changes) => this.config(scope, id, changes),
      runtime: (mutation) => this.runtime(mutation),
      reload: (workspaceId) => this.reload(workspaceId),
    }
  }
}
let seq = 0
function harness(server: TestServer, prefix = 'userA', connected = false) {
  const scope = `${prefix}-${++seq}:${fixture.workspace.id}`
  let online = connected
  let display = deep(fixture)
  let status: OutboxEntry[] = []
  const coordinator = new SyncCoordinator(scope, fixture.workspace.id, server.transport(), () => online,
    (state) => { status = state.entries }, (_remote, projected) => { display = projected })
  return { coordinator, scope, get online() { return online }, setOnline: (x: boolean) => { online = x },
    get display() { return display }, get status() { return status },
    update: (before: WorkspaceData, after: WorkspaceData) => { coordinator.enqueueConfiguration(before, after); display = after },
    act: (mutation: OfflineMutation) => { coordinator.enqueueRuntime(mutation); display = applyMutationLocally(display, mutation) },
  }
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((yes) => { resolve = yes })
  return { promise, resolve }
}

async function test(): Promise<void> {
  // Targeted patch and the local-overlay contract.
  const a = editName(fixture, 'Kitchen A')
  const b = editX(a, 555)
  const changed = buildConfigChanges(fixture, a)
  assert.equal(changed.changes.length, 1)
  assert.equal(changed.changes[0].table, 'entities')
  assert.deepEqual(changed.changes[0].before, { name: 'Kitchen' })
  assert.deepEqual(changed.changes[0].after, { name: 'Kitchen A' })
  assert.equal(buildConfigChanges(a, b).changes.length, 1)
  assert.equal(combineConfigChanges(changed, buildConfigChanges(a, b)).changes.length, 2)
  assert.equal(configAcknowledgedIn(a, changed.changes), true)
  assert.equal(configAcknowledgedIn(fixture, changed.changes), false)

  // Offline coalescing = one config RPC for two geometry/name edits.
  const coalesced = harness(new TestServer())
  coalesced.update(fixture, a); coalesced.update(a, b)
  assert.equal(coalesced.status.length, 1)
  assert.equal(coalesced.status[0].configuration?.changes.length, 2)
  coalesced.setOnline(true); await coalesced.coordinator.flush()
  assert.equal(coalesced.display.layoutElements[0].x, 555)
  assert.equal(coalesced.display.entities[0].name, 'Kitchen A')
  assert.equal(coalesced.status.length, 0)
  coalesced.coordinator.stop()

  // A is in flight while B is edited, A ACK, B ACK, delayed refresh retains B.
  const raceServer = new TestServer()
  const locked = deferred(); raceServer.delayConfig = locked.promise
  const race = harness(raceServer)
  race.update(fixture, a)
  race.setOnline(true)
  const inflight = race.coordinator.flush()
  assert.equal(race.status[0].state, 'sending')
  race.update(a, b)
  assert.equal(race.status.length, 2)
  locked.resolve(); await inflight
  assert.equal(raceServer.calls.filter((x) => x.kind === 'config').length, 2)
  assert.equal(raceServer.data.entities[0].name, 'Kitchen A')
  assert.equal(raceServer.data.layoutElements[0].x, 555)
  race.coordinator.stop()

  // A new queued edit while final ACK verification is still loading must
  // restart draining even when its timer fired while the coordinator was busy.
  const lateServer = new TestServer(); const lateRead = deferred(), readEntered = deferred()
  lateServer.delayRead = lateRead.promise; lateServer.readReached = readEntered.resolve
  const late = harness(lateServer)
  late.update(fixture, a); late.setOnline(true)
  const lateDrain = late.coordinator.flush()
  await readEntered.promise
  late.update(a, b)
  lateRead.resolve(); await lateDrain
  await new Promise((resolve) => setTimeout(resolve, 20))
  await late.coordinator.flush()
  assert.equal(lateServer.data.entities[0].name, 'Kitchen A')
  assert.equal(lateServer.data.layoutElements[0].x, 555)
  late.coordinator.stop()

  // Older snapshot resolved after a local edit: pending field remains visible.
  const staleServer = new TestServer(); const slowRead = deferred()
  staleServer.delayRead = slowRead.promise
  const stale = harness(staleServer)
  stale.setOnline(true)
  const staleRefresh = stale.coordinator.refresh()
  stale.update(fixture, editName(fixture, 'Newer local'))
  stale.setOnline(false)
  slowRead.resolve(); await staleRefresh
  assert.equal(stale.display.entities[0].name, 'Newer local')
  stale.coordinator.stop()

  // Both users edit same household: stale field CAS is recoverable, no overwrite.
  const collaborative = new TestServer()
  const clientA = harness(collaborative, 'Alice'), clientB = harness(collaborative, 'Bob')
  clientA.update(fixture, editName(fixture, 'Alice value'))
  clientB.update(fixture, editName(fixture, 'Bob value'))
  clientA.setOnline(true); await clientA.coordinator.flush()
  clientB.setOnline(true); await clientB.coordinator.flush()
  assert.equal(collaborative.data.entities[0].name, 'Alice value')
  assert.equal(clientB.status[0].state, 'conflict')
  assert.equal(clientB.display.entities[0].name, 'Bob value')
  await clientB.coordinator.resolveConflict(clientB.status[0].id, 'keep_local')
  await clientB.coordinator.flush()
  assert.equal(collaborative.data.entities[0].name, 'Bob value')
  clientA.coordinator.stop(); clientB.coordinator.stop()

  // Non-overlapping edits on same entity can be merged without conflicts.
  const disjoint = new TestServer()
  const d1 = harness(disjoint), d2 = harness(disjoint)
  d1.update(fixture, editName(fixture, 'Alpha'))
  d2.update(fixture, editLabels(fixture, ['Beta']))
  d1.setOnline(true); await d1.coordinator.flush()
  d2.setOnline(true); await d2.coordinator.flush()
  assert.equal(d2.status.length, 0)
  assert.equal(disjoint.data.entities[0].name, 'Alpha')
  assert.deepEqual(disjoint.data.entities[0].labels, ['Beta'])
  d1.coordinator.stop(); d2.coordinator.stop()

  // Complete followed by Undo is sequenced; no lifecycle event is coalesced.
  const actions = new TestServer(), lifecycle = harness(actions)
  const complete = taskMutation(fixture, 'complete')
  lifecycle.act(complete)
  const undo = taskMutation(lifecycle.display, 'undo', complete.eventId)
  lifecycle.act(undo)
  assert.equal(lifecycle.status.length, 2)
  lifecycle.setOnline(true); await lifecycle.coordinator.flush()
  assert.equal(actions.data.taskEvents.filter((x) => x.id === complete.eventId).length, 1)
  assert.equal(actions.data.taskEvents.filter((x) => x.id === undo.eventId).length, 1)
  assert.equal(actions.data.tasks.find((x) => x.id === (complete.kind === 'supply_status' ? '' : complete.taskId))?.state, 'scheduled')
  lifecycle.coordinator.stop()

  // A task complete immediately followed by a stock update preserves both.
  const mixed = new TestServer(), paired = harness(mixed)
  const task = taskMutation(fixture, 'complete')
  const stock = stockMutation(fixture)
  paired.act(task); paired.act(stock)
  paired.setOnline(true); await paired.coordinator.flush()
  assert.deepEqual(mixed.calls.map((x) => x.kind), ['complete', 'supply_status'])
  assert.equal(mixed.data.taskEvents.filter((x) => x.id === task.eventId).length, 1)
  assert.equal(mixed.data.supplyEvents.filter((x) => x.id === stock.eventId).length, 1)
  paired.coordinator.stop()

  // Network ACK lost after the backend committed: restart/resend idempotently.
  const badNetwork = new TestServer(), offline = harness(badNetwork)
  const operation = stockMutation(fixture)
  offline.act(operation)
  badNetwork.failAfterCommit = true
  offline.setOnline(true); await offline.coordinator.flush()
  assert.equal(offline.status[0].state, 'retrying')
  offline.coordinator.stop()
  const saved = readOutbox(offline.scope)
  saved[0].nextAttemptAt = 0
  localStorage.setItem(`house-care-sync-outbox-v2:${offline.scope}`, JSON.stringify(saved))
  let restarted: WorkspaceData | null = null
  const recovered = new SyncCoordinator(offline.scope, fixture.workspace.id, badNetwork.transport(), () => true, () => {}, (_, p) => { restarted = p })
  await recovered.flush()
  assert.equal(readOutbox(offline.scope).length, 0)
  assert.equal(badNetwork.data.supplyEvents.filter((x) => x.id === operation.eventId).length, 1)
  assert.ok(restarted)
  recovered.stop()

  // Rejected saves stay durable/visible, and restore cannot leapfrog them.
  const refused = new TestServer(), blocked = harness(refused)
  blocked.update(fixture, editName(fixture, 'Keep this edit'))
  refused.failHard = true
  blocked.setOnline(true); await blocked.coordinator.flush()
  assert.equal(blocked.status[0].state, 'failed')
  await assert.rejects(() => blocked.coordinator.requireExclusive(), /pending changes/i)
  assert.equal(readOutbox(blocked.scope).length, 1)
  refused.failHard = false
  await blocked.coordinator.resolveConflict(blocked.status[0].id, 'keep_local')
  await blocked.coordinator.flush()
  await blocked.coordinator.requireExclusive()
  blocked.coordinator.stop()

  // User/household boundary: a stopped coordinator cannot apply future writes.
  const bounded = new TestServer(), switched = harness(bounded, 'userOne')
  switched.update(fixture, editName(fixture, 'Private local edit'))
  switched.coordinator.stop()
  const other = harness(bounded, 'userTwo')
  assert.equal(other.status.length, 0)
  assert.equal(other.display.entities[0].name, 'Kitchen')
  await assert.rejects(async () => switched.coordinator.enqueueConfiguration(fixture, a), /changed during edit/)
  assert.equal(readOutbox(switched.scope).length, 1)
  other.coordinator.stop()

  // Storage quota failure rejects the mutation BEFORE UI optimistic acceptance.
  const storageFailure = harness(new TestServer())
  rejectStore = true
  assert.throws(() => storageFailure.update(fixture, a), /quota/)
  rejectStore = false
  assert.equal(storageFailure.status.length, 0)
  storageFailure.coordinator.stop()

  // Benchmark actual JSON payload bytes passed to the instrumented transport.
  // Baseline protocol: nonempty table upserts (plus routine_targets delete),
  // not a network/Supabase bill or gzip-on-wire measurement.
  const base = serializeWorkspace(fixture)
  const full = Object.entries(base).filter(([_, rows]) => rows.length)
  const baselineBytes = full.reduce((n, [_, rows]) => n + Buffer.byteLength(JSON.stringify(rows)), 0)
  const measured = [
    { operation: 'layout x: 40 -> 420', patch: buildConfigChanges(fixture, editX(fixture, 420)).changes },
    { operation: 'entity name: Kitchen -> Kitchen A', patch: buildConfigChanges(fixture, editName(fixture, 'Kitchen A')).changes },
    { operation: 'entity labels: [] -> [urgent]', patch: buildConfigChanges(fixture, editLabels(fixture, ['urgent'])).changes },
  ].map(({ operation, patch }) => {
    const patchBytes = Buffer.byteLength(JSON.stringify(patch))
    return { operation, baseline: { requests: full.length + 1, bytes: baselineBytes },
      phase16a: { requests: 1, bytes: patchBytes },
      requestReductionPct: Math.round((1 - 1 / (full.length + 1)) * 10000) / 100,
      byteReductionPct: Math.round((1 - patchBytes / baselineBytes) * 10000) / 100,
      tableRowChanges: patch.length }
  })
  const report = { fixture: 'tests/fixtures/pre-v2-household-backup.json',
    protocol: 'uncompressed JSON payload, excluding HTTP headers/TLS and PostgREST metadata',
    trials: measured }
  fs.mkdirSync('docs/qa', { recursive: true })
  fs.writeFileSync('docs/qa/phase16a-traffic-benchmark.json', JSON.stringify(report, null, 2) + '\n')
  for (const trial of measured) {
    assert.ok(trial.phase16a.bytes < trial.baseline.bytes)
    assert.ok(trial.phase16a.requests < trial.baseline.requests)
  }
  console.log('Phase 16A coordinator/CAS regression passed', JSON.stringify(report))
}

test().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
