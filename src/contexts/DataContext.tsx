import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  ActionDefinition,
  AssignmentPolicy,
  Entity,
  EntityRelation,
  EntityType,
  LayoutElement,
  LayoutPoint,
  LayoutRole,
  LayoutScene,
  LayoutSceneKind,
  LayoutShape,
  Locale,
  RelationKind,
  MetadataFieldDefinition,
  MetadataFieldType,
  MetadataTarget,
  MetadataValue,
  RecurrenceRule,
  ReminderPolicy,
  Routine,
  AdvancedTargetSelector,
  ScheduleExceptions,
  ScheduleMode,
  StockStatus,
  Supply,
  SupplyEvent,
  WorkspaceData,
  WorkspaceMember,
} from '../types/domain'
import { useAuth } from './AuthContext'
import { clearLocalData, createLocalWorkspace, loadLocalData, saveLocalData } from '../lib/localRepository'
import { applyCloudMutation, createCloudWorkspace, loadCloudData, replaceCloudData, saveCloudData } from '../lib/cloudRepository'
import { materializeTasks } from '../lib/scheduler'
import { newId, nowIso } from '../lib/id'
import { normalizeWorkspaceData } from '../lib/dataMigrations'
import { prepareImportedWorkspace, type HouseholdBackup } from '../lib/backup'
import { applyMutationLocally } from '../lib/mutations'
import { applyStarterPack as buildStarterPack } from '../lib/templates'
import { enqueueOfflineMutation, loadCloudCache, loadOfflineQueue, loadSyncConflicts, saveCloudCache, saveOfflineQueue, saveSyncConflicts, clearSyncConflicts, type OfflineMutation, type SyncConflict } from '../lib/offline'

interface EntityInput { name: string; typeId: string; parentId?: string; labels: string[]; metadata: Record<string, MetadataValue> }
interface ActionInput { name: string; icon?: string; instructions?: string; defaultSupplyIds: string[]; metadata: Record<string, MetadataValue> }
interface RoutineInput {
  name: string
  actionId: string
  targetEntityIds: string[]
  includeDescendantTargetIds: string[]
  advancedTargetSelector?: AdvancedTargetSelector
  recurrence: RecurrenceRule
  timeOfDay: string
  scheduleMode: ScheduleMode
  exceptions: ScheduleExceptions
  assignment: AssignmentPolicy
  reminder: ReminderPolicy
  supplyIdsOverride?: string[]
}
interface SupplyInput { name: string; icon?: string; status: StockStatus; quantity?: number; unit?: string; metadata: Record<string, MetadataValue> }
interface FieldInput { target: MetadataTarget; name: string; fieldType: MetadataFieldType; options: string[] }
interface LayoutElementInput { sceneId: string; entityId: string; role: LayoutRole; shape: LayoutShape; x: number; y: number; width: number; height: number; rotation: number; zIndex: number; points?: LayoutPoint[]; labelPosition: 'center' | 'top' }
interface RelationInput { fromEntityId: string; toEntityId?: string; targetSceneId?: string; kind: RelationKind; label?: string }

interface DataValue {
  data: WorkspaceData | null
  loading: boolean
  saving: boolean
  error: string | null
  online: boolean
  pendingSync: number
  syncConflicts: SyncConflict[]
  dismissSyncConflicts: () => void
  currentMember?: WorkspaceMember
  createWorkspace: (name: string, ownerName: string, timezone: string) => Promise<void>
  updateWorkspace: (patch: Partial<Pick<WorkspaceData['workspace'], 'name' | 'timezone' | 'careSensitivity'>>) => Promise<void>
  applyStarterPack: (locale: Locale) => Promise<void>
  addMember: (displayName: string, email?: string) => Promise<void>
  updateMemberAssignmentProfile: (id: string, labels: string[], unavailableUntil?: string) => Promise<void>
  addFieldDefinition: (input: FieldInput) => Promise<void>
  updateFieldDefinition: (id: string, input: FieldInput) => Promise<void>
  archiveFieldDefinition: (id: string) => Promise<void>
  addEntityType: (name: string, icon?: string) => Promise<string>
  updateEntityType: (id: string, patch: Partial<Pick<EntityType, 'name' | 'icon'>>) => Promise<void>
  archiveEntityType: (id: string) => Promise<void>
  addEntity: (input: EntityInput) => Promise<string>
  updateEntity: (id: string, input: EntityInput) => Promise<void>
  archiveEntity: (id: string) => Promise<void>
  addLayoutScene: (name: string, kind: LayoutSceneKind) => Promise<string>
  updateLayoutScene: (id: string, patch: Partial<Pick<LayoutScene, 'name' | 'kind' | 'order'>>) => Promise<void>
  archiveLayoutScene: (id: string) => Promise<void>
  addLayoutElement: (input: LayoutElementInput) => Promise<string>
  updateLayoutElement: (id: string, patch: Partial<Pick<LayoutElement, 'sceneId' | 'shape' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex' | 'points' | 'labelPosition'>>) => Promise<void>
  archiveLayoutElement: (id: string) => Promise<void>
  addEntityRelation: (input: RelationInput) => Promise<string>
  archiveEntityRelation: (id: string) => Promise<void>
  addSupply: (input: SupplyInput) => Promise<void>
  updateSupply: (id: string, input: SupplyInput) => Promise<void>
  setSupplyStatus: (id: string, status: StockStatus, sourceTaskId?: string) => Promise<void>
  archiveSupply: (id: string) => Promise<void>
  addAction: (input: ActionInput) => Promise<void>
  updateAction: (id: string, input: ActionInput) => Promise<void>
  archiveAction: (id: string) => Promise<void>
  addRoutine: (input: RoutineInput) => Promise<void>
  updateRoutine: (id: string, input: RoutineInput) => Promise<void>
  archiveRoutine: (id: string) => Promise<void>
  completeTask: (id: string) => Promise<void>
  completeTaskTarget: (id: string, entityId: string) => Promise<void>
  skipTask: (id: string) => Promise<void>
  postponeTask: (id: string, dueAt: string) => Promise<void>
  reassignTask: (id: string, memberId?: string) => Promise<void>
  importBackup: (backup: HouseholdBackup) => Promise<void>
  resetLocal: () => void
}

const DataContext = createContext<DataValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, cloudUser, isCloud } = useAuth()
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [pendingSync, setPendingSync] = useState(0)
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([])
  const dataRef = useRef<WorkspaceData | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

  const persist = useCallback(async (next: WorkspaceData) => {
    if (isCloud && typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Configuration changes require a connection. Daily task actions can still be used offline.')
    }
    setSaving(true)
    const save = async () => {
      if (isCloud) {
        await saveCloudData(next, user?.id)
        if (user?.id) saveCloudCache(user.id, next)
      } else saveLocalData(next)
    }
    const queued = saveQueueRef.current.catch(() => undefined).then(save)
    saveQueueRef.current = queued
    try {
      await queued
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      throw err
    } finally {
      if (saveQueueRef.current === queued) setSaving(false)
    }
  }, [isCloud, user?.id])

  const refreshFromCloud = useCallback(async (): Promise<WorkspaceData | null> => {
    if (!isCloud || !cloudUser || !user?.id) return dataRef.current
    let fresh = await loadCloudData(cloudUser)
    if (!fresh) return null
    fresh = normalizeWorkspaceData(fresh)
    const generated = materializeTasks(fresh)
    if (JSON.stringify(generated) !== JSON.stringify(fresh)) await saveCloudData(generated, user.id)
    saveCloudCache(user.id, generated)
    dataRef.current = generated
    setData(generated)
    return generated
  }, [isCloud, cloudUser, user?.id])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) { setData(null); setLoading(false); return }
      setLoading(true)
      setPendingSync(isCloud ? loadOfflineQueue(user.id).length : 0)
      setSyncConflicts(isCloud ? loadSyncConflicts(user.id) : [])
      try {
        let loaded: WorkspaceData | null
        if (isCloud && cloudUser) {
          if (typeof navigator !== 'undefined' && !navigator.onLine) loaded = loadCloudCache(user.id)
          else {
            try { loaded = await loadCloudData(cloudUser) }
            catch (err) {
              loaded = loadCloudCache(user.id)
              if (!loaded) throw err
              setError('Using cached household data until the connection recovers.')
            }
          }
        } else loaded = loadLocalData()
        if (loaded) {
          loaded = normalizeWorkspaceData(loaded)
          const generated = materializeTasks(loaded)
          if (JSON.stringify(generated) !== JSON.stringify(loaded)) {
            if (isCloud && navigator.onLine) await saveCloudData(generated, user.id)
            else if (!isCloud) saveLocalData(generated)
          }
          loaded = generated
          if (isCloud) saveCloudCache(user.id, loaded)
        }
        if (!cancelled) { dataRef.current = loaded; setData(loaded); if (navigator.onLine) setError(null) }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user?.id, cloudUser?.id, isCloud])

  const currentMember = useMemo(() => {
    if (!data || !user) return undefined
    return data.members.find((member) => member.userId === user.id) ?? data.members.find((member) => member.role === 'owner')
  }, [data, user])

  const commit = useCallback(async (mutate: (current: WorkspaceData) => WorkspaceData) => {
    const current = dataRef.current
    if (!current) return
    if (isCloud && typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('Configuration changes require a connection. Daily task actions can still be used offline.')
      return
    }
    const next = materializeTasks(normalizeWorkspaceData(mutate(current)))
    dataRef.current = next
    setData(next)
    await persist(next)
  }, [isCloud, persist])

  const recordConflict = useCallback((mutation: OfflineMutation) => {
    if (!user?.id) return
    const conflict: SyncConflict = {
      id: newId(), mutationId: mutation.id, kind: mutation.kind,
      itemId: mutation.kind === 'supply_status' ? mutation.supplyId : mutation.taskId,
      at: nowIso(), message: 'The item changed on another device before this offline action could sync.',
    }
    const next = [...loadSyncConflicts(user.id), conflict].slice(-30)
    saveSyncConflicts(user.id, next)
    setSyncConflicts(next)
  }, [user?.id])

  const performRuntimeMutation = useCallback(async (mutation: OfflineMutation) => {
    const current = dataRef.current
    if (!current || !user) return
    const optimistic = materializeTasks(normalizeWorkspaceData(applyMutationLocally(current, mutation)))
    dataRef.current = optimistic
    setData(optimistic)

    if (!isCloud) { saveLocalData(optimistic); return }
    saveCloudCache(user.id, optimistic)
    if (!navigator.onLine) {
      const queue = enqueueOfflineMutation(user.id, mutation)
      setPendingSync(queue.length)
      return
    }

    setSaving(true)
    try {
      const result = await applyCloudMutation(mutation)
      if (result.conflict || !result.applied) recordConflict(mutation)
      await refreshFromCloud()
      setError(result.conflict ? 'A change from another device won a sync conflict. Cloud data was kept.' : null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!navigator.onLine || /fetch|network|timeout/i.test(message)) {
        const queue = enqueueOfflineMutation(user.id, mutation)
        setPendingSync(queue.length)
        setOnline(false)
        setError(null)
      } else {
        setError(message)
        await refreshFromCloud().catch(() => undefined)
        throw err
      }
    } finally { setSaving(false) }
  }, [isCloud, user, recordConflict, refreshFromCloud])

  const flushOfflineQueue = useCallback(async () => {
    if (!isCloud || !user?.id || !cloudUser || !navigator.onLine) return
    const queue = loadOfflineQueue(user.id)
    if (!queue.length) { setPendingSync(0); return }
    setSaving(true)
    const remaining: OfflineMutation[] = []
    const conflictedItems = new Set<string>()
    try {
      for (let index = 0; index < queue.length; index += 1) {
        const mutation = queue[index]
        const itemKey = mutation.kind === 'supply_status' ? `supply:${mutation.supplyId}` : `task:${mutation.taskId}`
        if (conflictedItems.has(itemKey)) {
          recordConflict(mutation)
          continue
        }
        try {
          const result = await applyCloudMutation(mutation)
          if (result.conflict || !result.applied) {
            recordConflict(mutation)
            conflictedItems.add(itemKey)
          }
        } catch {
          remaining.push(...queue.slice(index))
          break
        }
      }
      saveOfflineQueue(user.id, remaining)
      setPendingSync(remaining.length)
      if (!remaining.length) { await refreshFromCloud(); setError(null) }
    } finally { setSaving(false) }
  }, [isCloud, user?.id, cloudUser, recordConflict, refreshFromCloud])

  useEffect(() => {
    const onOnline = () => { setOnline(true); void flushOfflineQueue() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    if (navigator.onLine && !loading) void flushOfflineQueue()
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [flushOfflineQueue, loading])

  const cancelFutureTasks = useCallback((current: WorkspaceData, routineId: string): WorkspaceData => {
    const now = Date.now()
    const actorMemberId = currentMember?.id
    const routine = current.routines.find((item) => item.id === routineId)
    const cancelAllPending = routine?.scheduleMode === 'after_completion'
    const cancelledIds: string[] = []
    const tasks = current.tasks.map((task) => {
      if (task.routineId !== routineId || task.state !== 'scheduled') return task
      if (!cancelAllPending && new Date(task.dueAt).getTime() < now) return task
      cancelledIds.push(task.id)
      return { ...task, state: 'cancelled' as const, version: task.version + 1 }
    })
    const at = nowIso()
    return {
      ...current,
      tasks,
      taskEvents: [
        ...current.taskEvents,
        ...cancelledIds.map((taskId) => ({ id: newId(), workspaceId: current.workspace.id, taskId, type: 'CANCELLED' as const, at, actorMemberId, metadata: { reason: 'routine_changed' } })),
      ],
    }
  }, [currentMember?.id])

  const value = useMemo<DataValue>(() => ({
    data, loading, saving, error, online, pendingSync, syncConflicts,
    dismissSyncConflicts: () => { if (user?.id) clearSyncConflicts(user.id); setSyncConflicts([]) },
    currentMember,
    createWorkspace: async (name, ownerName, timezone) => {
      if (!user) return
      const created = isCloud && cloudUser
        ? await createCloudWorkspace(cloudUser, name, ownerName, timezone)
        : createLocalWorkspace(name, ownerName, timezone)
      dataRef.current = created
      setData(created)
      await persist(created)
    },
    updateWorkspace: async (patch) => commit((current) => currentMember?.role === 'owner' ? { ...current, workspace: { ...current.workspace, ...patch } } : current),
    applyStarterPack: async (locale) => commit((current) => currentMember?.role === 'owner' ? buildStarterPack(current, locale) : current),
    addMember: async (displayName, email) => commit((current) => currentMember?.role !== 'owner' ? current : ({
      ...current,
      members: [...current.members, {
        id: newId(), workspaceId: current.workspace.id, displayName, email: email || undefined,
        role: 'member', status: email ? 'invited' : 'active', labels: [], createdAt: nowIso(),
      }],
    })),
    updateMemberAssignmentProfile: async (id, labels, unavailableUntil) => commit((current) => currentMember?.role !== 'owner' ? current : ({
      ...current,
      members: current.members.map((member) => member.id === id ? { ...member, labels, unavailableUntil: unavailableUntil || undefined } : member),
    })),
    addFieldDefinition: async (input) => commit((current) => ({
      ...current,
      fieldDefinitions: [...current.fieldDefinitions, { id: newId(), workspaceId: current.workspace.id, ...input, createdAt: nowIso() }],
    })),
    updateFieldDefinition: async (id, input) => commit((current) => ({
      ...current,
      fieldDefinitions: current.fieldDefinitions.map((item) => item.id === id ? { ...item, ...input } : item),
    })),
    archiveFieldDefinition: async (id) => commit((current) => ({
      ...current,
      fieldDefinitions: current.fieldDefinitions.map((item) => item.id === id ? { ...item, archivedAt: nowIso() } : item),
    })),
    addEntityType: async (name, icon) => {
      const id = newId()
      await commit((current) => ({
        ...current,
        entityTypes: [...current.entityTypes, { id, workspaceId: current.workspace.id, name, icon: icon || undefined, createdAt: nowIso() }],
      }))
      return id
    },
    updateEntityType: async (id, patch) => commit((current) => ({
      ...current,
      entityTypes: current.entityTypes.map((item) => item.id === id ? { ...item, ...patch } : item),
    })),
    archiveEntityType: async (id) => commit((current) => {
      if (current.entities.some((entity) => entity.typeId === id && !entity.archivedAt)) return current
      if (current.routines.some((routine) => !routine.archivedAt && routine.advancedTargetSelector?.conditions.some((condition) => condition.kind === 'type' && condition.typeId === id))) return current
      return { ...current, entityTypes: current.entityTypes.map((item) => item.id === id ? { ...item, archivedAt: nowIso() } : item) }
    }),
    addEntity: async (input) => {
      const id = newId()
      await commit((current) => ({
        ...current,
        entities: [...current.entities, { id, workspaceId: current.workspace.id, ...input, createdAt: nowIso() }],
      }))
      return id
    },
    updateEntity: async (id, input) => commit((current) => ({
      ...current,
      entities: current.entities.map((item) => item.id === id ? { ...item, ...input } : item),
    })),
    archiveEntity: async (id) => commit((current) => {
      if (current.routines.some((routine) => !routine.archivedAt && (routine.targetEntityIds.includes(id) || routine.advancedTargetSelector?.conditions.some((condition) => condition.kind === 'descendant_of' && condition.entityId === id)))) return current
      const at = nowIso()
      return {
        ...current,
        entities: current.entities.map((item) => item.id === id ? { ...item, archivedAt: at } : item),
        layoutElements: current.layoutElements.map((item) => item.entityId === id && !item.archivedAt ? { ...item, archivedAt: at } : item),
        entityRelations: current.entityRelations.map((item) => (item.fromEntityId === id || item.toEntityId === id) && !item.archivedAt ? { ...item, archivedAt: at } : item),
      }
    }),
    addLayoutScene: async (name, kind) => {
      const id = newId()
      await commit((current) => ({
        ...current,
        layoutScenes: [...current.layoutScenes, { id, workspaceId: current.workspace.id, name, kind, order: current.layoutScenes.filter((item) => !item.archivedAt).length, createdAt: nowIso() }],
      }))
      return id
    },
    updateLayoutScene: async (id, patch) => commit((current) => ({
      ...current,
      layoutScenes: current.layoutScenes.map((item) => item.id === id ? { ...item, ...patch } : item),
    })),
    archiveLayoutScene: async (id) => commit((current) => {
      const at = nowIso()
      return {
        ...current,
        layoutScenes: current.layoutScenes.map((item) => item.id === id ? { ...item, archivedAt: at } : item),
        layoutElements: current.layoutElements.map((item) => item.sceneId === id && !item.archivedAt ? { ...item, archivedAt: at } : item),
        entityRelations: current.entityRelations.map((item) => item.targetSceneId === id && !item.archivedAt ? { ...item, archivedAt: at } : item),
      }
    }),
    addLayoutElement: async (input) => {
      const id = newId()
      await commit((current) => ({
        ...current,
        layoutElements: [...current.layoutElements, { id, workspaceId: current.workspace.id, ...input, createdAt: nowIso() }],
      }))
      return id
    },
    updateLayoutElement: async (id, patch) => commit((current) => ({
      ...current,
      layoutElements: current.layoutElements.map((item) => item.id === id ? { ...item, ...patch } : item),
    })),
    archiveLayoutElement: async (id) => commit((current) => ({
      ...current,
      layoutElements: current.layoutElements.map((item) => item.id === id ? { ...item, archivedAt: nowIso() } : item),
    })),
    addEntityRelation: async (input) => {
      const id = newId()
      await commit((current) => ({
        ...current,
        entityRelations: [...current.entityRelations, { id, workspaceId: current.workspace.id, ...input, createdAt: nowIso() }],
      }))
      return id
    },
    archiveEntityRelation: async (id) => commit((current) => ({
      ...current,
      entityRelations: current.entityRelations.map((item) => item.id === id ? { ...item, archivedAt: nowIso() } : item),
    })),
    addSupply: async (input) => commit((current) => {
      const id = newId(); const at = nowIso()
      return {
        ...current,
        supplies: [...current.supplies, { id, workspaceId: current.workspace.id, ...input, version: 1, createdAt: at }],
        supplyEvents: [...current.supplyEvents, { id: newId(), workspaceId: current.workspace.id, supplyId: id, type: 'SUPPLY_CREATED', at, actorMemberId: currentMember?.id, metadata: { status: input.status } }],
      }
    }),
    updateSupply: async (id, input) => commit((current) => {
      const before = current.supplies.find((item) => item.id === id)
      if (!before) return current
      const at = nowIso()
      const events: SupplyEvent[] = [{ id: newId(), workspaceId: current.workspace.id, supplyId: id, type: 'SUPPLY_UPDATED', at, actorMemberId: currentMember?.id, metadata: {} }]
      if (before.status !== input.status) events.push({ id: newId(), workspaceId: current.workspace.id, supplyId: id, type: 'STOCK_CHANGED' as const, at, actorMemberId: currentMember?.id, metadata: { from: before.status, to: input.status } })
      return {
        ...current,
        supplies: current.supplies.map((item) => item.id === id ? { ...item, ...input, version: before.status !== input.status ? item.version + 1 : item.version } : item),
        supplyEvents: [...current.supplyEvents, ...events],
      }
    }),
    setSupplyStatus: async (id, status, sourceTaskId) => {
      const current = dataRef.current
      const supply = current?.supplies.find((item) => item.id === id)
      if (!current || !supply || supply.status === status) return
      const mutation: OfflineMutation = {
        id: newId(), workspaceId: current.workspace.id, kind: 'supply_status', supplyId: id,
        expectedVersion: supply.version, eventId: newId(), eventAt: nowIso(), actorMemberId: currentMember?.id,
        status, sourceTaskId,
      }
      await performRuntimeMutation(mutation)
    },
    archiveSupply: async (id) => commit((current) => {
      const inUse = current.actions.some((action) => !action.archivedAt && action.defaultSupplyIds.includes(id))
        || current.routines.some((routine) => !routine.archivedAt && routine.supplyIdsOverride?.includes(id))
      if (inUse) return current
      const supply = current.supplies.find((item) => item.id === id)
      if (!supply || supply.archivedAt) return current
      const at = nowIso()
      return {
        ...current,
        supplies: current.supplies.map((item) => item.id === id ? { ...item, archivedAt: at } : item),
        supplyEvents: [...current.supplyEvents, { id: newId(), workspaceId: current.workspace.id, supplyId: id, type: 'SUPPLY_ARCHIVED', at, actorMemberId: currentMember?.id, metadata: {} }],
      }
    }),
    addAction: async (input) => commit((current) => ({
      ...current,
      actions: [...current.actions, { id: newId(), workspaceId: current.workspace.id, ...input, revision: 1, createdAt: nowIso() }],
    })),
    updateAction: async (id, input) => commit((current) => {
      const affected = current.routines.filter((routine) => routine.actionId === id && !routine.archivedAt).map((routine) => routine.id)
      let next = current
      for (const routineId of affected) next = cancelFutureTasks(next, routineId)
      return {
        ...next,
        actions: next.actions.map((item) => item.id === id ? { ...item, ...input, revision: item.revision + 1 } : item),
        routines: next.routines.map((routine) => affected.includes(routine.id) ? { ...routine, revision: routine.revision + 1 } : routine),
      }
    }),
    archiveAction: async (id) => commit((current) => {
      if (current.routines.some((routine) => routine.actionId === id && !routine.archivedAt)) return current
      return { ...current, actions: current.actions.map((item) => item.id === id ? { ...item, archivedAt: nowIso() } : item) }
    }),
    addRoutine: async (input) => commit((current) => ({
      ...current,
      routines: [...current.routines, { id: newId(), workspaceId: current.workspace.id, ...input, revision: 1, createdAt: nowIso() }],
    })),
    updateRoutine: async (id, input) => commit((current) => {
      const cancelled = cancelFutureTasks(current, id)
      return {
        ...cancelled,
        routines: cancelled.routines.map((item) => item.id === id ? { ...item, ...input, revision: item.revision + 1 } : item),
      }
    }),
    archiveRoutine: async (id) => commit((current) => {
      const cancelled = cancelFutureTasks(current, id)
      return {
        ...cancelled,
        routines: cancelled.routines.map((item) => item.id === id ? { ...item, archivedAt: nowIso(), revision: item.revision + 1 } : item),
      }
    }),
    completeTask: async (id) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'complete', taskId: id, expectedVersion: task.version, eventId: newId(), eventAt: nowIso(), actorMemberId: currentMember?.id })
    },
    completeTaskTarget: async (id, entityId) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      const target = task?.targets.find((item) => item.entityId === entityId)
      if (!current || !task || task.state !== 'scheduled' || !target || target.completedAt) return
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'complete_target', taskId: id, targetEntityId: entityId, expectedVersion: task.version, eventId: newId(), eventAt: nowIso(), actorMemberId: currentMember?.id })
    },
    skipTask: async (id) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'skip', taskId: id, expectedVersion: task.version, eventId: newId(), eventAt: nowIso(), actorMemberId: currentMember?.id })
    },
    postponeTask: async (id, dueAt) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'postpone', taskId: id, expectedVersion: task.version, eventId: newId(), eventAt: nowIso(), actorMemberId: currentMember?.id, dueAt })
    },
    reassignTask: async (id, memberId) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'reassign', taskId: id, expectedVersion: task.version, eventId: newId(), eventAt: nowIso(), actorMemberId: currentMember?.id, assigneeMemberId: memberId, clearAssignee: !memberId })
    },
    importBackup: async (backup) => {
      const current = dataRef.current
      if (!current || !currentMember || currentMember.role !== 'owner') throw new Error('Only the household owner can import a backup.')
      setSaving(true)
      try {
        const imported = materializeTasks(prepareImportedWorkspace(backup, current, currentMember))
        if (isCloud) await replaceCloudData(imported, user?.id)
        else saveLocalData(imported)
        dataRef.current = imported
        setData(imported)
        if (isCloud && user?.id) saveCloudCache(user.id, imported)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        throw err
      } finally {
        setSaving(false)
      }
    },
    resetLocal: () => {
      if (isCloud) return
      clearLocalData()
      dataRef.current = null
      setData(null)
    },
  }), [data, loading, saving, error, online, pendingSync, syncConflicts, currentMember, user, isCloud, cloudUser, persist, commit, cancelFutureTasks, performRuntimeMutation])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}
