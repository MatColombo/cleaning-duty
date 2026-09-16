import type { AdditionalActivityInput } from '../types/domain'
import { saveAdditionalActivities } from '../lib/linkedRoutines'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  ActionDefinition,
  CareLevel,
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
  RoutineStatus,
  AdvancedTargetSelector,
  ScheduleExceptions,
  ScheduleMode,
  StockStatus,
  Supply,
  SupplyEvent,
  TaskAssignmentScope,
  WorkspaceData,
  WorkspaceMember,
  WorkspaceSummary,
} from '../types/domain'
import { useAuth } from './AuthContext'
import { clearLocalData, createLocalWorkspace, loadLocalData, saveLocalData } from '../lib/localRepository'
import { applyCloudMutation, archiveCloudWorkspace, createCloudWorkspace, deleteCloudWorkspace, listCloudWorkspaces, loadCloudData, replaceCloudData, restoreCloudWorkspace, saveCloudData } from '../lib/cloudRepository'
import { materializeRoutineSlot, materializeTasks, nextTheoreticalSlotAfter } from '../lib/scheduler'
import { newId, nowIso } from '../lib/id'
import { normalizeWorkspaceData } from '../lib/dataMigrations'
import { prepareImportedWorkspace, type HouseholdBackup } from '../lib/backup'
import { applyMutationLocally } from '../lib/mutations'
import { applyStarterPack as buildStarterPack } from '../lib/templates'
import { clearCloudCache, enqueueOfflineMutation, loadCloudCache, loadOfflineQueue, loadSyncConflicts, migrateLegacyOfflineStorage, saveCloudCache, saveOfflineQueue, saveSyncConflicts, clearSyncConflicts, type OfflineMutation, type SyncConflict } from '../lib/offline'
import { clearSelectedWorkspaceId, loadSelectedWorkspaceId, loadWorkspaceCatalog, saveSelectedWorkspaceId, saveWorkspaceCatalog, workspaceScope } from '../lib/workspaces'
import { logClientError, normalizeError, setDiagnosticContext } from '../lib/errorLog'
import { routineDefinitionFingerprint } from '../lib/routines'
import { buildCompletionHealthEffects } from '../lib/cleanliness'

interface EntityInput { name: string; typeId: string; parentId?: string; labels: string[]; metadata: Record<string, MetadataValue> }
interface ActionInput { name: string; icon?: string; instructions?: string; defaultSupplyIds: string[]; metadata: Record<string, MetadataValue> }
interface RoutineInput {
  affectsCleanliness?: boolean
  additionalActivities?: AdditionalActivityInput[]
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
  careLevel: CareLevel
  refreshLevelPct: number
  supplyIdsOverride?: string[]
}
interface SupplyInput { name: string; icon?: string; status: StockStatus; quantity?: number; unit?: string; metadata: Record<string, MetadataValue> }
interface FieldInput { target: MetadataTarget; name: string; fieldType: MetadataFieldType; options: string[] }
interface LayoutElementInput { sceneId: string; entityId: string; role: LayoutRole; shape: LayoutShape; x: number; y: number; width: number; height: number; rotation: number; zIndex: number; points?: LayoutPoint[]; labelPosition: 'center' | 'top' | 'bottom'; labelFontSize?: number; labelWrap?: boolean; labelWidth?: number; labelRotation?: number; fillColor?: string; textColor?: string; textBackgroundColor?: string }
interface RelationInput { fromEntityId: string; toEntityId?: string; targetSceneId?: string; kind: RelationKind; label?: string }


interface DataValue {
  data: WorkspaceData | null
  workspaces: WorkspaceSummary[]
  loading: boolean
  saving: boolean
  error: string | null
  clearError: () => void
  online: boolean
  pendingSync: number
  syncConflicts: SyncConflict[]
  dismissSyncConflicts: () => void
  currentMember?: WorkspaceMember
  switchWorkspace: (workspaceId: string) => Promise<void>
  archiveWorkspace: (workspaceId: string) => Promise<void>
  restoreWorkspace: (workspaceId: string) => Promise<void>
  deleteWorkspace: (workspaceId: string) => Promise<void>
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
  updateLayoutScene: (id: string, patch: Partial<Pick<LayoutScene, 'name' | 'kind' | 'order' | 'backgroundColor'>>) => Promise<void>
  archiveLayoutScene: (id: string) => Promise<void>
  addLayoutElement: (input: LayoutElementInput) => Promise<string>
  updateLayoutElement: (id: string, patch: Partial<Pick<LayoutElement, 'sceneId' | 'shape' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex' | 'points' | 'labelPosition' | 'labelFontSize' | 'labelWrap' | 'labelWidth' | 'labelRotation' | 'fillColor' | 'textColor' | 'textBackgroundColor'>>) => Promise<void>
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
  setRoutineStatus: (id: string, status: RoutineStatus) => Promise<void>
  completeTask: (id: string) => Promise<string | null>
  completeTaskTarget: (id: string, entityId: string) => Promise<void>
  skipTask: (id: string) => Promise<string | null>
  postponeTask: (id: string, dueAt: string) => Promise<string | null>
  reassignTask: (id: string, memberId?: string, assignmentScope?: TaskAssignmentScope) => Promise<string | null>
  undoTaskAction: (id: string, sourceEventId: string) => Promise<void>
  restoreTaskToToday: (id: string, sourceEventId?: string) => Promise<void>
  importBackup: (backup: HouseholdBackup) => Promise<void>
  resetLocal: () => void
}

const DataContext = createContext<DataValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, cloudUser, isCloud, preferredWorkspaceId, setPreferredWorkspaceId } = useAuth()
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [pendingSync, setPendingSync] = useState(0)
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([])
  const dataRef = useRef<WorkspaceData | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

  const newestActiveWorkspace = useCallback((catalog: WorkspaceSummary[]): WorkspaceSummary | undefined =>
    catalog.filter((item) => !item.archivedAt).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0], [])

  const reportError = useCallback((err: unknown, area: string): string => {
    const message = logClientError(err, { area })
    setError(message)
    return message
  }, [])

  const rememberWorkspace = useCallback(async (workspaceId: string | null) => {
    if (!user?.id) return
    if (workspaceId) saveSelectedWorkspaceId(user.id, workspaceId)
    else clearSelectedWorkspaceId(user.id)
    if (isCloud && preferredWorkspaceId !== workspaceId) {
      try { await setPreferredWorkspaceId(workspaceId) }
      catch (err) { logClientError(err, { area: 'save preferred home' }) }
    }
  }, [user?.id, isCloud, preferredWorkspaceId, setPreferredWorkspaceId])

  useEffect(() => {
    setDiagnosticContext({
      userId: user?.id,
      workspaceId: data?.workspace.id,
      workspaceName: data?.workspace.name,
    })
  }, [user?.id, data?.workspace.id, data?.workspace.name])

  const persist = useCallback(async (next: WorkspaceData) => {
    if (isCloud && typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Configuration changes require a connection. Daily task actions can still be used offline.')
    }
    setSaving(true)
    const save = async () => {
      if (isCloud) {
        await saveCloudData(next, user?.id)
        if (user?.id) saveCloudCache(workspaceScope(user.id, next.workspace.id), next)
      } else saveLocalData(next)
    }
    const queued = saveQueueRef.current.catch(() => undefined).then(save)
    saveQueueRef.current = queued
    try {
      await queued
      setError(null)
    } catch (err) {
      reportError(err, 'save household data')
      throw err
    } finally {
      if (saveQueueRef.current === queued) setSaving(false)
    }
  }, [isCloud, user?.id, reportError])

  const refreshWorkspaceCatalog = useCallback(async (): Promise<WorkspaceSummary[]> => {
    if (!user) return []
    if (!isCloud || !cloudUser) {
      const local = dataRef.current
      const summaries: WorkspaceSummary[] = local ? [{
        id: local.workspace.id, name: local.workspace.name, timezone: local.workspace.timezone, role: 'owner',
        ownerUserId: local.workspace.ownerUserId, archivedAt: local.workspace.archivedAt, createdAt: local.workspace.createdAt,
      }] : []
      setWorkspaces(summaries)
      return summaries
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = loadWorkspaceCatalog(user.id)
      setWorkspaces(cached)
      return cached
    }
    const next = await listCloudWorkspaces(cloudUser)
    saveWorkspaceCatalog(user.id, next)
    setWorkspaces(next)
    return next
  }, [user, isCloud, cloudUser])

  const refreshFromCloud = useCallback(async (workspaceId?: string): Promise<WorkspaceData | null> => {
    if (!isCloud || !cloudUser || !user?.id) return dataRef.current
    const targetId = workspaceId ?? dataRef.current?.workspace.id
    if (!targetId) return null
    let fresh = await loadCloudData(cloudUser, targetId)
    if (!fresh) return null
    fresh = normalizeWorkspaceData(fresh)
    const generated = materializeTasks(fresh)
    if (JSON.stringify(generated) !== JSON.stringify(fresh)) await saveCloudData(generated, user.id)
    saveCloudCache(workspaceScope(user.id, targetId), generated)
    await rememberWorkspace(targetId)
    dataRef.current = generated
    setData(generated)
    return generated
  }, [isCloud, cloudUser, user?.id, rememberWorkspace])

  const activateWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    if (!user) return
    if (!isCloud || !cloudUser) {
      if (dataRef.current?.workspace.id !== workspaceId) throw new Error('Local mode supports one household.')
      return
    }
    setLoading(true)
    try {
      await saveQueueRef.current.catch(() => undefined)
      const scope = workspaceScope(user.id, workspaceId)
      let loaded: WorkspaceData | null
      if (typeof navigator !== 'undefined' && !navigator.onLine) loaded = loadCloudCache(scope)
      else {
        try { loaded = await loadCloudData(cloudUser, workspaceId) }
        catch (err) {
          loaded = loadCloudCache(scope)
          if (!loaded) throw err
          setError('Using cached household data until the connection recovers.')
        }
      }
      if (!loaded) throw new Error('This household is not available on this device yet.')
      loaded = materializeTasks(normalizeWorkspaceData(loaded))
      if (navigator.onLine) saveCloudCache(scope, loaded)
      await rememberWorkspace(workspaceId)
      dataRef.current = loaded
      setData(loaded)
      setPendingSync(loadOfflineQueue(scope).length)
      setSyncConflicts(loadSyncConflicts(scope))
      if (navigator.onLine) setError(null)
    } finally { setLoading(false) }
  }, [user, isCloud, cloudUser, rememberWorkspace])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) { dataRef.current = null; setData(null); setWorkspaces([]); setLoading(false); return }
      setLoading(true)
      try {
        let loaded: WorkspaceData | null = null
        if (isCloud && cloudUser) {
          let catalog: WorkspaceSummary[]
          if (typeof navigator !== 'undefined' && !navigator.onLine) catalog = loadWorkspaceCatalog(user.id)
          else {
            try { catalog = await listCloudWorkspaces(cloudUser); saveWorkspaceCatalog(user.id, catalog) }
            catch (err) {
              catalog = loadWorkspaceCatalog(user.id)
              if (!catalog.length) throw err
              setError('Using cached household list until the connection recovers.')
            }
          }
          if (!cancelled) setWorkspaces(catalog)
          const active = catalog.filter((item) => !item.archivedAt)
          const devicePreferredId = loadSelectedWorkspaceId(user.id)
          const preferredId = preferredWorkspaceId ?? devicePreferredId
          const selected = active.find((item) => item.id === preferredId) ?? newestActiveWorkspace(active)
          if (selected) {
            migrateLegacyOfflineStorage(user.id, selected.id)
            const scope = workspaceScope(user.id, selected.id)
            setPendingSync(loadOfflineQueue(scope).length)
            setSyncConflicts(loadSyncConflicts(scope))
            if (typeof navigator !== 'undefined' && !navigator.onLine) loaded = loadCloudCache(scope)
            else {
              try { loaded = await loadCloudData(cloudUser, selected.id) }
              catch (err) {
                loaded = loadCloudCache(scope)
                if (!loaded) throw err
                setError('Using cached household data until the connection recovers.')
              }
            }
            if (loaded) await rememberWorkspace(selected.id)
          } else {
            setPendingSync(0)
            setSyncConflicts([])
          }
        } else {
          loaded = loadLocalData()
          if (loaded && !cancelled) setWorkspaces([{
            id: loaded.workspace.id, name: loaded.workspace.name, timezone: loaded.workspace.timezone, role: 'owner',
            ownerUserId: loaded.workspace.ownerUserId, archivedAt: loaded.workspace.archivedAt, createdAt: loaded.workspace.createdAt,
          }])
        }
        if (loaded) {
          loaded = normalizeWorkspaceData(loaded)
          const generated = materializeTasks(loaded)
          if (JSON.stringify(generated) !== JSON.stringify(loaded)) {
            if (isCloud && navigator.onLine) await saveCloudData(generated, user.id)
            else if (!isCloud) saveLocalData(generated)
          }
          loaded = generated
          if (isCloud) saveCloudCache(workspaceScope(user.id, loaded.workspace.id), loaded)
        }
        if (!cancelled) { dataRef.current = loaded; setData(loaded); if (navigator.onLine) setError(null) }
      } catch (err) {
        if (!cancelled) reportError(err, 'load household')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user?.id, cloudUser?.id, isCloud, preferredWorkspaceId, newestActiveWorkspace, rememberWorkspace, reportError])

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
      at: nowIso(), message: mutation.kind === 'reopen_today' ? 'The activity changed before it could be restored to today.' : 'The cloud item changed before this action could sync.',
    }
    const scope = workspaceScope(user.id, mutation.workspaceId)
    const next = [...loadSyncConflicts(scope), conflict].slice(-30)
    saveSyncConflicts(scope, next)
    setSyncConflicts(next)
  }, [user?.id])

  const performRuntimeMutation = useCallback(async (mutation: OfflineMutation) => {
    const current = dataRef.current
    if (!current || !user) return
    const optimistic = materializeTasks(normalizeWorkspaceData(applyMutationLocally(current, mutation)))
    dataRef.current = optimistic
    setData(optimistic)

    if (!isCloud) { saveLocalData(optimistic); return }
    const scope = workspaceScope(user.id, current.workspace.id)
    saveCloudCache(scope, optimistic)
    if (!navigator.onLine) {
      const queue = enqueueOfflineMutation(scope, mutation)
      setPendingSync(queue.length)
      return
    }

    setSaving(true)
    try {
      // Runtime mutations and whole-household configuration saves share one cloud
      // write queue. This prevents an older snapshot from landing after Complete/
      // Skip/Postpone/Reassign and rolling the task back to stale runtime values.
      const write = saveQueueRef.current.catch(() => undefined).then(() => applyCloudMutation(mutation))
      saveQueueRef.current = write.then(() => undefined)
      const result = await write
      if (result.conflict || !result.applied) recordConflict(mutation)
      await refreshFromCloud()
      setError(result.conflict ? 'A cloud version conflict was detected. The latest cloud state was kept.' : null)
    } catch (err) {
      const message = normalizeError(err)
      if (!navigator.onLine || /fetch|network|timeout/i.test(message)) {
        const queue = enqueueOfflineMutation(scope, mutation)
        setPendingSync(queue.length)
        setOnline(false)
        setError(null)
      } else {
        reportError(err, 'apply task or stock action')
        await refreshFromCloud().catch(() => undefined)
        throw err
      }
    } finally { setSaving(false) }
  }, [isCloud, user, recordConflict, refreshFromCloud, reportError])

  const flushOfflineQueue = useCallback(async () => {
    if (!isCloud || !user?.id || !cloudUser || !navigator.onLine) return
    const workspaceId = dataRef.current?.workspace.id
    if (!workspaceId) return
    const scope = workspaceScope(user.id, workspaceId)
    const queue = loadOfflineQueue(scope)
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
      saveOfflineQueue(scope, remaining)
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
    const actorMemberId = currentMember?.id
    const cancelledIds: string[] = []
    const tasks = current.tasks.map((task) => {
      if (task.routineId !== routineId || task.state !== 'scheduled') return task
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
    data, workspaces, loading, saving, error, online, pendingSync, syncConflicts,
    clearError: () => setError(null),
    dismissSyncConflicts: () => {
      if (user?.id && dataRef.current?.workspace.id) clearSyncConflicts(workspaceScope(user.id, dataRef.current.workspace.id))
      setSyncConflicts([])
    },
    currentMember,
    switchWorkspace: async (workspaceId) => {
      if (online && pendingSync > 0) await flushOfflineQueue()
      await activateWorkspace(workspaceId)
    },
    archiveWorkspace: async (workspaceId) => {
      if (!isCloud || !cloudUser || !user) return
      await saveQueueRef.current.catch(() => undefined)
      if (dataRef.current?.workspace.id === workspaceId && online && pendingSync > 0) {
        await flushOfflineQueue()
        const scope = workspaceScope(user.id, workspaceId)
        if (loadOfflineQueue(scope).length) throw new Error('Sync pending changes before archiving this household.')
      }
      await archiveCloudWorkspace(workspaceId)
      const catalog = await refreshWorkspaceCatalog()
      if (dataRef.current?.workspace.id === workspaceId) {
        const next = newestActiveWorkspace(catalog.filter((item) => item.id !== workspaceId))
        if (next) await activateWorkspace(next.id)
        else {
          await rememberWorkspace(null)
          dataRef.current = null
          setData(null)
          setPendingSync(0)
          setSyncConflicts([])
        }
      }
    },
    restoreWorkspace: async (workspaceId) => {
      if (!isCloud || !cloudUser || !user) return
      await restoreCloudWorkspace(workspaceId)
      await refreshWorkspaceCatalog()
      if (!dataRef.current) await activateWorkspace(workspaceId)
    },
    deleteWorkspace: async (workspaceId) => {
      if (!isCloud || !cloudUser || !user) return
      await deleteCloudWorkspace(workspaceId)
      const scope = workspaceScope(user.id, workspaceId)
      clearCloudCache(scope)
      saveOfflineQueue(scope, [])
      clearSyncConflicts(scope)
      const catalog = await refreshWorkspaceCatalog()
      if (dataRef.current?.workspace.id === workspaceId) {
        const next = newestActiveWorkspace(catalog.filter((item) => item.id !== workspaceId))
        if (next) await activateWorkspace(next.id)
        else {
          await rememberWorkspace(null)
          dataRef.current = null
          setData(null)
          setPendingSync(0)
          setSyncConflicts([])
        }
      }
    },
    createWorkspace: async (name, ownerName, timezone) => {
      if (!user) return
      const created = isCloud && cloudUser
        ? await createCloudWorkspace(cloudUser, name, ownerName, timezone)
        : createLocalWorkspace(name, ownerName, timezone)
      dataRef.current = created
      setData(created)
      if (isCloud) {
        await rememberWorkspace(created.workspace.id)
        saveCloudCache(workspaceScope(user.id, created.workspace.id), created)
      }
      await persist(created)
      await refreshWorkspaceCatalog()
    },
    updateWorkspace: async (patch) => {
      await commit((current) => currentMember?.role === 'owner' ? { ...current, workspace: { ...current.workspace, ...patch } } : current)
      if (dataRef.current && (patch.name || patch.timezone)) {
        setWorkspaces((current) => current.map((item) => item.id === dataRef.current!.workspace.id ? { ...item, name: dataRef.current!.workspace.name, timezone: dataRef.current!.workspace.timezone } : item))
      }
    },
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
    addRoutine: async (input) => commit((current) => {
      const { additionalActivities, ...definition } = input
      const fingerprint = routineDefinitionFingerprint(definition)
      const duplicate = current.routines.some((routine) => !routine.archivedAt && !routine.parentRoutineId && routineDefinitionFingerprint(routine) === fingerprint)
      if (duplicate) throw new Error('A routine with these settings already exists.')
      const parent: Routine = {
        id: newId(), workspaceId: current.workspace.id, ...definition,
        affectsCleanliness: definition.affectsCleanliness !== false,
        cleanlinessChannel: input.careLevel === 'deep' ? 'deep' : 'regular',
        routineTimezone: current.workspace.timezone,
        refreshLevelPct: Math.max(10, Math.min(100, input.refreshLevelPct ?? 100)), status: 'active', revision: 1, createdAt: nowIso(),
      }
      return saveAdditionalActivities({ ...current, routines: [...current.routines, parent] }, parent, additionalActivities, currentMember?.id)
    }),
    updateRoutine: async (id, input) => commit((current) => {
      const existing = current.routines.find((item) => item.id === id)
      if (!existing) return current
      if (existing.parentRoutineId) throw new Error('Edit additional activities through their parent routine.')
      const { additionalActivities, ...definition } = input
      const refreshLevelPct = Math.max(10, Math.min(100, input.refreshLevelPct ?? existing.refreshLevelPct ?? 100))
      const affectsCleanliness = input.affectsCleanliness !== false
      const onlyPolicyChanged = routineDefinitionFingerprint({ ...existing, refreshLevelPct, affectsCleanliness }) === routineDefinitionFingerprint({ ...definition, refreshLevelPct, affectsCleanliness, status: existing.status ?? 'active' })
      const base = onlyPolicyChanged ? current : cancelFutureTasks(current, id)
      const parent: Routine = {
        ...existing, ...definition, refreshLevelPct, affectsCleanliness,
        cleanlinessChannel: input.careLevel === 'deep' ? 'deep' : 'regular',
        routineTimezone: existing.routineTimezone ?? current.workspace.timezone,
        status: existing.status ?? 'active', revision: existing.revision + (onlyPolicyChanged ? 0 : 1),
      }
      return saveAdditionalActivities({ ...base, routines: base.routines.map((item) => item.id === id ? parent : item) }, parent, additionalActivities, currentMember?.id)
    }),
    archiveRoutine: async (id) => commit((current) => {
      const ids = new Set(current.routines.filter((routine) => routine.id === id || routine.parentRoutineId === id).map((routine) => routine.id))
      let cancelled = current
      for (const routineId of ids) cancelled = cancelFutureTasks(cancelled, routineId)
      return {
        ...cancelled,
        routines: cancelled.routines.map((item) => ids.has(item.id) ? { ...item, archivedAt: nowIso(), status: 'ended', revision: item.revision + 1 } : item),
      }
    }),
    setRoutineStatus: async (id, status) => commit((current) => {
      const at = nowIso()
      const nowMs = new Date(at).getTime()
      const routine = current.routines.find((item) => item.id === id)
      if (!routine) return current
      const affectedIds = new Set(current.routines.filter((item) => item.id === id || item.parentRoutineId === id).map((item) => item.id))
      const routines = current.routines.map((item) => affectedIds.has(item.id) ? { ...item, status } : item)

      if (status === 'paused' || status === 'ended') {
        const reason = status === 'paused' ? 'routine_paused' : 'routine_ended'
        const cancelledIds: string[] = []
        const tasks = current.tasks.map((task) => {
          if (!affectedIds.has(task.routineId) || task.state !== 'scheduled') return task
          cancelledIds.push(task.id)
          return { ...task, state: 'cancelled' as const, version: task.version + 1 }
        })
        return {
          ...current,
          routines,
          tasks,
          taskEvents: [...current.taskEvents, ...cancelledIds.map((taskId) => ({
            id: newId(), workspaceId: current.workspace.id, taskId, type: 'CANCELLED' as const, at, actorMemberId: currentMember?.id, metadata: { reason },
          }))],
        }
      }

      // Resume only tasks that were cancelled specifically by Pause and are still
      // in the future. Past paused slots stay historical and are never recreated.
      const reopenedIds: string[] = []
      const latestCancelReason = (taskId: string): unknown => current.taskEvents
        .filter((event) => event.taskId === taskId && event.type === 'CANCELLED')
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]?.metadata.reason
      let next: WorkspaceData = {
        ...current,
        routines,
        tasks: current.tasks.map((task) => {
          if (!affectedIds.has(task.routineId) || task.state !== 'cancelled' || latestCancelReason(task.id) !== 'routine_paused') return task
          if (new Date(task.effectiveDueAt ?? task.dueAt).getTime() < nowMs) return task
          reopenedIds.push(task.id)
          return { ...task, state: 'scheduled' as const, version: task.version + 1 }
        }),
        taskEvents: current.taskEvents,
      }
      if (reopenedIds.length) {
        next = {
          ...next,
          taskEvents: [...next.taskEvents, ...reopenedIds.map((taskId) => ({
            id: newId(), workspaceId: current.workspace.id, taskId, type: 'REOPENED' as const, at, actorMemberId: currentMember?.id, metadata: { reason: 'routine_resumed' },
          }))],
        }
      }

      const resumedRoutine = next.routines.find((item) => item.id === id)!
      if (resumedRoutine.scheduleMode === 'after_completion') {
        const hasFuture = next.tasks.some((task) => task.routineId === id && task.state === 'scheduled')
        if (!hasFuture) {
          const dueAt = nextTheoreticalSlotAfter(resumedRoutine, at, next.workspace.timezone)
          if (dueAt) next = materializeRoutineSlot(next, resumedRoutine, dueAt)
        }
        return materializeTasks(normalizeWorkspaceData(next))
      }

      // Fill any future fixed-calendar gaps. Cancelled past pause slots remain in
      // the slot-key set, preventing accidental historical recreation.
      return materializeTasks(normalizeWorkspaceData(next))
    }),
    completeTask: async (id) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return null
      const eventAt = nowIso(); const eventId = newId()
      const targetIds = task.targets.filter((target) => !target.completedAt).map((target) => target.entityId)
      const completionEffects = buildCompletionHealthEffects(current, task, eventAt, targetIds, currentMember?.id)
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'complete', taskId: id, expectedVersion: task.version, eventId, eventAt, actorMemberId: currentMember?.id, completionEffects })
      return eventId
    },
    completeTaskTarget: async (id, entityId) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      const target = task?.targets.find((item) => item.entityId === entityId)
      if (!current || !task || task.state !== 'scheduled' || !target || target.completedAt) return
      const eventAt = nowIso(); const eventId = newId()
      const completionEffects = buildCompletionHealthEffects(current, task, eventAt, [entityId], currentMember?.id)
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'complete_target', taskId: id, targetEntityId: entityId, expectedVersion: task.version, eventId, eventAt, actorMemberId: currentMember?.id, completionEffects })
    },
    skipTask: async (id) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return null
      const eventId = newId()
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'skip', taskId: id, expectedVersion: task.version, eventId, eventAt: nowIso(), actorMemberId: currentMember?.id })
      return eventId
    },
    postponeTask: async (id, dueAt) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return null
      const eventId = newId()
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'postpone', taskId: id, expectedVersion: task.version, eventId, eventAt: nowIso(), actorMemberId: currentMember?.id, dueAt, effectiveDueAt: dueAt })
      return eventId
    },
    reassignTask: async (id, memberId, assignmentScope) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return null
      const eventId = newId()
      const scope = assignmentScope ?? (memberId ? 'member' : 'unassigned')
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'reassign', taskId: id, expectedVersion: task.version, eventId, eventAt: nowIso(), actorMemberId: currentMember?.id, assigneeMemberId: scope === 'member' ? memberId : undefined, clearAssignee: scope !== 'member', assignmentScope: scope })
      return eventId
    },
    undoTaskAction: async (id, sourceEventId) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task) return
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'undo', taskId: id, expectedVersion: task.version, sourceEventId, eventId: newId(), eventAt: nowIso(), actorMemberId: currentMember?.id })
    },
    restoreTaskToToday: async (id, sourceEventId) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task) return
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'reopen_today', taskId: id, expectedVersion: task.version, sourceEventId, eventId: newId(), eventAt: nowIso(), actorMemberId: currentMember?.id })
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
        if (isCloud && user?.id) saveCloudCache(workspaceScope(user.id, imported.workspace.id), imported)
        setError(null)
      } catch (err) {
        reportError(err, 'import backup')
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
      setWorkspaces([])
    },
  }), [data, workspaces, loading, saving, error, online, pendingSync, syncConflicts, currentMember, user, isCloud, cloudUser, persist, commit, cancelFutureTasks, performRuntimeMutation, activateWorkspace, refreshWorkspaceCatalog, flushOfflineQueue, newestActiveWorkspace, rememberWorkspace, reportError])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}
