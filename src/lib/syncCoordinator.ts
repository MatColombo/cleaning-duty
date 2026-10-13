/** Phase 16A single FIFO coordinator. Outbox writes are synchronous and MUST
 * succeed before the UI treats an edit as queued. It never saves a whole snapshot. */
import type { WorkspaceData } from '../types/domain'
import type { OfflineMutation } from './offline'
import { applyMutationLocally } from './mutations'
import { buildConfigChanges, combineConfigChanges, configAcknowledgedIn, overlayConfiguration,
  serializeWorkspace, type ConfigChangeSet, type EntityChange } from './configChanges'
import { newId } from './id'
import { overlayVisualMutation, visualMutationConfirmed, type VisualOverrideMutation } from './visualOverrides'
import { overlaySceneMutation, sceneMutationConfirmed, type SceneDecorationMutation } from './sceneDecorations'

export type SyncState = 'queued' | 'sending' | 'acknowledged' | 'retrying' | 'conflict' | 'failed'
export type OutboxEntry = {
  id: string
  scope: string
  workspaceId: string
  type: 'configuration' | 'runtime' | 'visual' | 'scene'
  state: SyncState
  queuedAt: string
  attempts: number
  nextAttemptAt?: number
  message?: string
  configuration?: ConfigChangeSet
  runtime?: OfflineMutation
  visual?: VisualOverrideMutation
  scene?: SceneDecorationMutation
}
export interface SyncResult { applied: boolean; conflict: boolean; actualVersion?: number; message?: string }
export interface SyncTransport {
  configuration: (workspaceId: string, id: string, changes: EntityChange[], signal: AbortSignal) => Promise<SyncResult>
  runtime: (mutation: OfflineMutation, signal: AbortSignal) => Promise<SyncResult>
  visual?: (mutation: VisualOverrideMutation, mutationId: string, signal: AbortSignal) => Promise<SyncResult>
  scene?: (mutation: SceneDecorationMutation, mutationId: string, signal: AbortSignal) => Promise<SyncResult>
  reload: (workspaceId: string, signal: AbortSignal) => Promise<WorkspaceData | null>
}
export interface SyncObservation {
  entries: OutboxEntry[]
  pending: number
  sending: boolean
  conflicts: number
  failed: number
}
const PREFIX = 'house-care-sync-outbox-v2:'
const MAX_ATTEMPTS = 7
const BACKOFF_MS = [0, 1000, 3000, 8000, 20000, 45000, 90000, 180000]

export function readOutbox(scope: string): OutboxEntry[] {
  const raw = localStorage.getItem(PREFIX + scope)
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value)) throw new Error('The saved sync outbox is invalid. No edits were discarded.')
  return value as OutboxEntry[]
}
function writeOutbox(scope: string, queue: OutboxEntry[]): void {
  // Storage quota / privacy errors intentionally propagate. Silent storage
  // failures would break the local-first durability guarantee.
  localStorage.setItem(PREFIX + scope, JSON.stringify(queue))
}
export function removeOutbox(scope: string): void { localStorage.removeItem(PREFIX + scope) }

export function projectOutbox(remote: WorkspaceData, entries: OutboxEntry[]): WorkspaceData {
  let result = remote
  for (const entry of entries) {
    if (entry.type === 'configuration' && entry.configuration) result = overlayConfiguration(result, entry.configuration.overlays)
    if (entry.type === 'runtime' && entry.runtime) result = applyMutationLocally(result, entry.runtime)
    if (entry.type === 'visual' && entry.visual) result = overlayVisualMutation(result, entry.visual, entry.id, entry.queuedAt)
    if (entry.type === 'scene' && entry.scene) result = overlaySceneMutation(result, entry.scene, entry.id, entry.queuedAt)
  }
  return result
}

/** Rebase field-level CAS only after an explicit user choice. */
export function rebaseChanges(changes: EntityChange[], server: WorkspaceData): EntityChange[] {
  const source = serializeWorkspace(server)
  return changes.map((change) => {
    const current = source[change.table]?.find((row) =>
      Object.entries(change.key).every(([name, value]) => JSON.stringify(row[name]) === JSON.stringify(value)))
    if (change.before === null) {
      if (current) throw new Error('Cannot rebase a creation onto an existing row.')
      return change
    }
    if (!current && change.after !== null) throw new Error('The cloud item was deleted; cannot rebase automatically.')
    return { ...change, before: current ? Object.fromEntries(Object.keys(change.before).map((key) => [key, current[key]])) : change.before }
  })
}

export class SyncCoordinator {
  private entries: OutboxEntry[]
  private timer: ReturnType<typeof setTimeout> | undefined
  private sending: Promise<void> | undefined
  private controller: AbortController | undefined
  private stopped = false
  private generation = 0
  private reloadToken = 0
  private readFailures = 0

  constructor(readonly scope: string, readonly workspaceId: string, private transport: SyncTransport,
    private isOnline: () => boolean, private onChange: (observation: SyncObservation) => void,
    private onRead: (remote: WorkspaceData, projected: WorkspaceData) => void) {
    const existing = readOutbox(scope)
    this.entries = existing.map((x) => x.state === 'sending' ? { ...x, state: 'queued' } : x)
    // Persist recovered in-flight state; no write (or quota requirement) on
    // initial read-only activation when there are no recovered sends.
    if (existing.some((x) => x.state === 'sending')) writeOutbox(this.scope, this.entries)
    this.notify()
  }

  observe(): SyncObservation {
    return { entries: [...this.entries], pending: this.entries.filter((x) => x.state !== 'acknowledged').length,
      sending: Boolean(this.sending), conflicts: this.entries.filter((x) => x.state === 'conflict').length,
      failed: this.entries.filter((x) => x.state === 'failed').length }
  }
  get editEpoch(): number { return this.generation }
  get hasUnresolved(): boolean { return this.entries.some((x) => x.state !== 'acknowledged') }
  private notify(): void { this.onChange(this.observe()) }
  private store(next: OutboxEntry[]): void {
    writeOutbox(this.scope, next)
    this.entries = next
    this.generation += 1
    this.notify()
  }
  /** Queue now, not after a cloud request. No optimistic UI without durability. */
  enqueueConfiguration(from: WorkspaceData, to: WorkspaceData): boolean {
    if (this.stopped || from.workspace.id !== this.workspaceId || to.workspace.id !== this.workspaceId) throw new Error('Household changed during edit')
    const configuration = buildConfigChanges(from, to)
    if (!configuration.changes.length) return false
    const last = this.entries.at(-1)
    if (last?.type === 'configuration' && last.state === 'queued' && last.configuration) {
      this.store([...this.entries.slice(0, -1), { ...last, configuration: combineConfigChanges(last.configuration, configuration) }])
    } else {
      this.store([...this.entries, { id: newId(), scope: this.scope, workspaceId: this.workspaceId,
        type: 'configuration', configuration, state: 'queued', queuedAt: new Date().toISOString(), attempts: 0 }])
    }
    this.schedule(260)
    return true
  }
  enqueueRuntime(mutation: OfflineMutation): void {
    if (this.stopped || mutation.workspaceId !== this.workspaceId) throw new Error('Household changed during task action')
    this.store([...this.entries, { id: mutation.id, scope: this.scope, workspaceId: this.workspaceId,
      type: 'runtime', runtime: mutation, state: 'queued', queuedAt: new Date().toISOString(), attempts: 0 }])
    this.schedule(0)
  }
  /** Explicit studio confirmation only. Serialized with task/config operations. */
  enqueueVisual(mutation: VisualOverrideMutation): string {
    if (this.stopped || mutation.workspaceId !== this.workspaceId) throw new Error('Household changed during visual edit')
    const id = newId()
    this.store([...this.entries, { id, scope: this.scope, workspaceId: this.workspaceId,
      type: 'visual', visual: mutation, state: 'queued', queuedAt: new Date().toISOString(), attempts: 0 }])
    this.schedule(0)
    return id
  }
  /** Only explicit scene Save/Reset, never sliders or pointermove. */
  enqueueScene(mutation: SceneDecorationMutation): string {
    if (this.stopped || mutation.workspaceId !== this.workspaceId) throw new Error('Household changed during scene edit')
    const id = newId()
    this.store([...this.entries, { id, scope: this.scope, workspaceId: this.workspaceId,
      type: 'scene', scene: mutation, state: 'queued', queuedAt: new Date().toISOString(), attempts: 0 }])
    this.schedule(0)
    return id
  }
  private schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer)
    if (this.stopped || !this.isOnline()) return
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush() }, delayMs)
  }
  resume(): void { this.schedule(0) }
  private update(id: string, patch: Partial<OutboxEntry>): void {
    this.store(this.entries.map((x) => x.id === id ? { ...x, ...patch } : x))
  }
  async flush(): Promise<void> {
    if (this.stopped || this.sending || !this.isOnline()) return this.sending
    const job = this.drain()
    this.sending = job
    this.notify()
    try { await job } finally {
      if (this.sending === job) this.sending = undefined
      this.notify()
      // A new edit may have been queued during the final acknowledgement
      // verification read. Its earlier timer could have fired while busy.
      // Pick it up here; do not spin on backoff or blocked conflicts.
      const head = this.entries.find((x) => x.state !== 'acknowledged')
      if (!this.stopped && this.isOnline() && head?.state === 'queued') this.schedule(0)
    }
  }
  private async drain(): Promise<void> {
    const controller = new AbortController()
    this.controller = controller
    try {
      while (!this.stopped && this.isOnline() && !controller.signal.aborted) {
        // A conflict/failed entry blocks later dependent edits; ack records are
        // retained as an overlay until verified by a *new* server read.
        const head = this.entries.find((x) => x.state !== 'acknowledged')
        if (!head || head.state === 'conflict' || head.state === 'failed') break
        if (head.state === 'retrying' && (head.nextAttemptAt ?? 0) > Date.now()) {
          this.schedule((head.nextAttemptAt ?? Date.now()) - Date.now()); break
        }
        this.update(head.id, { state: 'sending', attempts: head.attempts + 1, nextAttemptAt: undefined })
        try {
          const result = head.type === 'configuration'
            ? await this.transport.configuration(this.workspaceId, head.id, head.configuration!.changes, controller.signal)
            : head.type === 'visual'
              ? await (this.transport.visual ? this.transport.visual(head.visual!, head.id, controller.signal) : Promise.reject(new Error('Visual override RPC unavailable')))
              : head.type === 'scene'
                ? await (this.transport.scene ? this.transport.scene(head.scene!, head.id, controller.signal) : Promise.reject(new Error('Scene decoration RPC unavailable')))
                : await this.transport.runtime(head.runtime!, controller.signal)
          if (this.stopped || controller.signal.aborted) return
          if (result.conflict || !result.applied) {
            this.update(head.id, { state: 'conflict', message: result.message ?? 'The cloud record changed. Your local edit is preserved.' })
            break
          }
          this.update(head.id, { state: 'acknowledged', message: undefined })
        } catch (error) {
          if (this.stopped || controller.signal.aborted) return
          const message = error instanceof Error ? error.message : String(error)
          const retryable = !this.isOnline() || /fetch|network|timeout|failed to fetch|abort|50[0-9]|429|503|504/i.test(message)
          if (!retryable || head.attempts + 1 >= MAX_ATTEMPTS) {
            this.update(head.id, { state: 'failed', message })
            break
          }
          const nextAttemptAt = Date.now() + BACKOFF_MS[Math.min(head.attempts + 1, BACKOFF_MS.length - 1)]
          this.update(head.id, { state: 'retrying', nextAttemptAt, message })
          if (this.isOnline()) this.schedule(nextAttemptAt - Date.now())
          break
        }
      }
      if (!this.stopped && this.isOnline() && this.entries.some((x) => x.state === 'acknowledged')) {
        try {
          await this.refresh()
          this.readFailures = 0
        } catch {
          // The write was acknowledged; a failed verification READ must not
          // resend it or discard its overlay. Bounded, failure-driven retry.
          this.readFailures += 1
          if (this.readFailures < MAX_ATTEMPTS) this.schedule(BACKOFF_MS[this.readFailures])
        }
      }
    } finally { if (this.controller === controller) this.controller = undefined }
  }
  /** Every refresh merges unsettled edits; older reads cannot displace them. */
  async refresh(): Promise<void> {
    if (this.stopped || !this.isOnline()) return
    const token = ++this.reloadToken
    const acknowledgedAtStart = new Set(this.entries.filter((x) => x.state === 'acknowledged').map((x) => x.id))
    const controller = new AbortController()
    const owned = !this.controller
    if (owned) this.controller = controller
    const signal = owned ? controller.signal : this.controller!.signal
    try {
      const remote = await this.transport.reload(this.workspaceId, signal)
      if (this.stopped || signal.aborted || token !== this.reloadToken || !remote || remote.workspace.id !== this.workspaceId) return
      // Two ordered edits can both be acknowledged before verification. The
      // server stores only the latest CAS row. A confirmed later revision on
      // the same subject proves the earlier acknowledged revision committed;
      // otherwise the earlier ACK would be incorrectly flagged as a conflict.
      const supersededByConfirmedAck = (entry: OutboxEntry): boolean => {
        if (entry.type !== 'scene' && entry.type !== 'visual') return false
        return this.entries.some((later) => later.id !== entry.id && later.state === 'acknowledged'
          && acknowledgedAtStart.has(later.id) && (
            entry.type === 'scene' && later.type === 'scene' && entry.scene && later.scene
              && later.scene.sceneId === entry.scene.sceneId
              && later.scene.expectedRevision > entry.scene.expectedRevision
              && sceneMutationConfirmed(remote, later.scene, later.id)
            || entry.type === 'visual' && later.type === 'visual' && entry.visual && later.visual
              && later.visual.subjectType === entry.visual.subjectType && later.visual.subjectId === entry.visual.subjectId
              && later.visual.expectedRevision > entry.visual.expectedRevision
              && visualMutationConfirmed(remote, later.visual, later.id)
          ))
      }
      const checked = this.entries.map((entry) => {
        if (entry.state !== 'acknowledged' || !acknowledgedAtStart.has(entry.id)) return entry
        const confirmed = entry.type === 'configuration'
          ? configAcknowledgedIn(remote, entry.configuration!.changes)
          : entry.type === 'visual' ? visualMutationConfirmed(remote, entry.visual!, entry.id) || supersededByConfirmedAck(entry)
          : entry.type === 'scene' ? sceneMutationConfirmed(remote, entry.scene!, entry.id) || supersededByConfirmedAck(entry)
          : entry.runtime!.kind === 'supply_status'
            ? remote.supplyEvents.some((x) => x.id === entry.runtime!.eventId)
            : remote.taskEvents.some((x) => x.id === entry.runtime!.eventId)
              || (remote.extraCareEvents ?? []).some((x) => x.id === entry.runtime!.eventId)
        return confirmed ? null : { ...entry, state: 'conflict' as const,
          message: 'The acknowledged edit is absent from the latest cloud read; the local copy is preserved.' }
      })
      const rest = checked.filter((x): x is OutboxEntry => x !== null)
      // One durable write changes state and clears confirmed acknowledgements.
      if (rest.length !== this.entries.length || rest.some((x, i) => x.state !== this.entries[i]?.state)) this.store(rest)
      const projected = projectOutbox(remote, this.entries)
      this.onRead(remote, projected)
    } finally { if (owned && this.controller === controller) this.controller = undefined }
  }
  async resolveConflict(id: string, choice: 'keep_local' | 'use_cloud'): Promise<void> {
    const position = this.entries.findIndex((x) => x.id === id)
    const entry = this.entries[position]
    if (!entry || (entry.state !== 'conflict' && entry.state !== 'failed')) return
    if (choice === 'use_cloud') {
      // Drop the failed operation AND its causally dependent suffix explicitly.
      this.store(this.entries.slice(0, position))
      await this.refresh(); this.resume(); return
    }
    if (entry.type === 'scene' && entry.state === 'conflict') {
      const latest = await this.transport.reload(this.workspaceId, new AbortController().signal)
      if (!latest || this.stopped) throw new Error('Cannot obtain latest scene revision')
      const row = latest.sceneDecorations?.find(x => x.sceneId === entry.scene!.sceneId && !x.orphanedAt)
      if (!latest.layoutScenes.some(x => x.id === entry.scene!.sceneId && !x.archivedAt)) throw new Error('The scene is no longer active; cannot rebase.')
      this.update(entry.id, { scene: { ...entry.scene!, expectedRevision: row?.revision ?? 0 }, state: 'queued', attempts: 0, message: undefined })
    } else if (entry.type === 'visual' && entry.state === 'conflict') {
      const latest = await this.transport.reload(this.workspaceId, new AbortController().signal)
      if (!latest || this.stopped) throw new Error('Cannot obtain latest visual revision')
      const row = latest.visualOverrides?.find((item) => item.subjectType === entry.visual!.subjectType && item.subjectId === entry.visual!.subjectId)
      this.update(entry.id, { visual: { ...entry.visual!, expectedRevision: row?.revision ?? 0 }, state: 'queued', attempts: 0, message: undefined })
    } else if (entry.type === 'runtime' && entry.state === 'conflict') throw new Error('Task events cannot be forced over newer history. Use cloud, then issue a new action.')
    if (entry.type === 'configuration' && entry.state === 'conflict') {
      const controller = new AbortController()
      const server = await this.transport.reload(this.workspaceId, controller.signal)
      if (!server || this.stopped) throw new Error('Cannot obtain fresh cloud revision')
      const rebased = rebaseChanges(entry.configuration!.changes, server)
      this.update(entry.id, { configuration: { ...entry.configuration!, changes: rebased }, state: 'queued', attempts: 0, message: undefined })
    } else this.update(entry.id, { state: 'queued', attempts: 0, message: undefined })
    this.resume()
  }
  /** Restore/delete requires a fully drained queue, never a best-effort flush. */
  async requireExclusive(): Promise<void> {
    await this.flush()
    if (this.hasUnresolved) throw new Error('Resolve or sync pending changes before restoring this household.')
    // A prior acknowledgement needs verification before destructive reset.
    if (this.entries.length) await this.refresh()
    if (this.entries.length) throw new Error('Cloud acknowledgement could not be verified. Restore was cancelled.')
  }
  stop(): void {
    this.stopped = true
    ++this.reloadToken
    if (this.timer) clearTimeout(this.timer)
    this.controller?.abort()
  }
  resetAfterExclusive(): void { this.stop(); removeOutbox(this.scope) }
}
