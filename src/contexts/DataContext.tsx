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
import { applyCloudConfig, applyCloudMutation, applyCloudVisualOverride, applyCloudSceneDecorations, archiveCloudWorkspace, createCloudWorkspace, deleteCloudWorkspace, listCloudWorkspaces, loadCloudData, replaceCloudData, restoreCloudWorkspace } from '../lib/cloudRepository'
import { materializeTasks } from '../lib/scheduler'
import { newId, nowIso, stableId } from '../lib/id'
import { normalizeWorkspaceData } from '../lib/dataMigrations'
import { prepareImportedWorkspace, type HouseholdBackup } from '../lib/backup'
import { applyMutationLocally } from '../lib/mutations'
import { applyStarterPack as buildStarterPack } from '../lib/templates'
import { clearCloudCache, loadCloudCache, loadOfflineQueue, migrateLegacyOfflineStorage, saveCloudCache, saveOfflineQueue, clearSyncConflicts, type OfflineMutation, type SyncConflict } from '../lib/offline'
import { SyncCoordinator, projectOutbox, readOutbox, removeOutbox, type SyncObservation } from '../lib/syncCoordinator'
import { VISUAL_OVERRIDE_SCHEMA, validatedVisualOverrides, validVisualSubject, overlayVisualMutation, type VisualSubjectKind } from '../lib/visualOverrides'
import { HOUSE_CARE_VISUAL_VERSION } from '../visual/version'
import type { StudioOverrides } from '../visual/studio/draft'
import { overlaySceneMutation, sceneExists, sceneRow, validatedSceneDecorations, type SceneDecoration } from '../lib/sceneDecorations'
import { HOME_ILLUSTRATION_GENERATOR } from '../lib/homeIllustration'
import { clearSelectedWorkspaceId, loadSelectedWorkspaceId, loadWorkspaceCatalog, saveSelectedWorkspaceId, saveWorkspaceCatalog, workspaceScope } from '../lib/workspaces'
import { logClientError, normalizeError, setDiagnosticContext } from '../lib/errorLog'
import { readAuthorizedSnapshot } from '../lib/startupSnapshot'
import { afterFirstFrame, startupMark, startupPath } from '../lib/startupTelemetry'
import { isTransientStartupFailure, isDeniedStartupAccess } from '../lib/startupNetwork'
import { routineDefinitionFingerprint } from '../lib/routines'
import { buildCompletionHealthEffects } from '../lib/cleanliness'
import { buildIntegratedEffects, dueExtraCare, integratedExtraCare, isIntegratedPrimary, isLegacyLinkedTask } from '../lib/extraCare'

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
  retrySyncIssue: (id: string) => Promise<void>
  discardSyncIssue: (id: string) => Promise<void>
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
  postponeExtraCare: (id: string, routineId: string) => Promise<string | null>
  completeTaskTarget: (id: string, entityId: string) => Promise<void>
  skipTask: (id: string) => Promise<string | null>
  postponeTask: (id: string, dueAt: string) => Promise<string | null>
  reassignTask: (id: string, memberId?: string, assignmentScope?: TaskAssignmentScope) => Promise<string | null>
  undoTaskAction: (id: string, sourceEventId: string) => Promise<void>
  restoreTaskToToday: (id: string, sourceEventId?: string) => Promise<void>
  importBackup: (backup: HouseholdBackup) => Promise<void>
  resetLocal: () => void
  commitVisualOverride: (kind: VisualSubjectKind, id: string, overrides: StudioOverrides, expectedRevision: number) => Promise<void>
  commitSceneDecorations: (sceneId: string, items: SceneDecoration[], expectedRevision: number) => Promise<void>
}

const DataContext = createContext<DataValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, cloudUser, isCloud, preferredWorkspaceId, setPreferredWorkspaceId, offlineSessionValid } = useAuth()
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [visibleOwner, setVisibleOwner] = useState<string | null>(null)
  const [catalogOwner, setCatalogOwner] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [pendingSync, setPendingSync] = useState(0)
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([])
  const dataRef = useRef<WorkspaceData | null>(null)
  const coordinatorRef = useRef<SyncCoordinator | null>(null)
  const exclusiveRef = useRef(false)
  const activationRef = useRef(0)
  const cloudUserRef = useRef(cloudUser)
  cloudUserRef.current = cloudUser
  const preferredWorkspaceRef = useRef(preferredWorkspaceId)
  preferredWorkspaceRef.current = preferredWorkspaceId
  const updatePreferredRef = useRef(setPreferredWorkspaceId)
  updatePreferredRef.current = setPreferredWorkspaceId

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
    if (isCloud && preferredWorkspaceRef.current !== workspaceId) {
      // User metadata is preference only: never hold the first useful paint
      // on a redundant auth network request.
      void updatePreferredRef.current(workspaceId).catch((err) =>
        logClientError(err, { area: 'save preferred home' }))
    }
  }, [user?.id, isCloud])

  useEffect(() => {
    setDiagnosticContext({
      userId: user?.id,
      workspaceId: data?.workspace.id,
      workspaceName: data?.workspace.name,
    })
  }, [user?.id, data?.workspace.id, data?.workspace.name])

  const ensureNoRestore = () => {
    if (exclusiveRef.current) throw new Error('Household restore is in progress. Edits are temporarily locked.')
  }

  const attachCoordinator = useCallback((userId: string, workspaceId: string, loaded: WorkspaceData): WorkspaceData => {
    coordinatorRef.current?.stop()
    const scope = workspaceScope(userId, workspaceId)
    const onChange = (state: SyncObservation) => {
      if (coordinatorRef.current?.scope !== scope) return
      setPendingSync(state.pending)
      setSaving(state.sending)
      setSyncConflicts(state.entries.filter((x) => x.state === 'conflict' || x.state === 'failed').map((x) => ({
        id: x.id, mutationId: x.id, kind: x.type === 'visual' ? 'visual' : x.type === 'scene' ? 'scene' : x.runtime?.kind ?? 'configuration',
        itemId: x.type === 'visual' ? x.visual?.subjectId ?? workspaceId : x.type === 'scene' ? x.scene?.sceneId ?? workspaceId : x.runtime?.kind === 'supply_status' ? x.runtime.supplyId : x.runtime?.taskId ?? workspaceId,
        state: x.state === 'failed' ? 'failed' : 'conflict', at: x.queuedAt,
        message: x.message ?? 'Cloud conflict; your local edit is preserved.',
      })))
    }
    const coordinator = new SyncCoordinator(scope, workspaceId, {
      configuration: (wid, id, changes, signal) => applyCloudConfig(wid, id, changes, signal, dataRef.current?.recurrenceMode === 'atomic' || loaded.recurrenceMode === 'atomic'),
      runtime: applyCloudMutation,
      visual: applyCloudVisualOverride,
      scene: applyCloudSceneDecorations,
      reload: async (id, signal) => {
        if (signal.aborted || !cloudUserRef.current) return null
        // The public repository read no longer causes hidden writes.
        return loadCloudData(cloudUserRef.current, id, { membershipConfirmedByCatalog: true })
      },
    }, () => typeof navigator === 'undefined' || navigator.onLine, onChange, (remote, projected) => {
      if (coordinatorRef.current !== coordinator) return
      const next = materializeTasks(normalizeWorkspaceData(projected))
      if (JSON.stringify(next) !== JSON.stringify(projected)) {
        try { coordinator.enqueueConfiguration(projected, next) }
        catch (err) { reportError(err, 'queue generated occurrences') }
      }
      dataRef.current = next
      setData(next)
      try { saveCloudCache(scope, next) }
      catch (err) { reportError(err, 'cache household after sync') }
    })
    coordinatorRef.current = coordinator
    // Preserve V1 offline task mutations on upgrade, without a second writer.
    const legacy = loadOfflineQueue(scope)
    if (legacy.length) {
      for (const mutation of legacy) {
        if (mutation.workspaceId === workspaceId && !coordinator.observe().entries.some((x) => x.id === mutation.id)) coordinator.enqueueRuntime(mutation)
      }
      saveOfflineQueue(scope, [])
    }
    onChange(coordinator.observe())
    const optimistic = projectOutbox(loaded, coordinator.observe().entries)
    coordinator.resume()
    return optimistic
  }, [reportError])

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

  /** A snapshot can be shown only after the account and active membership are
   * checked. On the network path the catalog is fresh/RLS protected. Offline,
   * only an unexpired session plus a scoped cached membership permits display. */
  const activateWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    if (!user) return
    if (!isCloud || !cloudUser) {
      if (dataRef.current?.workspace.id !== workspaceId) throw new Error('Local mode supports one household.')
      return
    }
    const epoch = ++activationRef.current
    coordinatorRef.current?.stop()
    coordinatorRef.current = null
    dataRef.current = null
    setData(null)
    setPendingSync(0)
    setSyncConflicts([])
    setLoading(true)
    let hydrated = false
    try {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      if (offline && !offlineSessionValid) throw new Error('The offline session has expired. Sign in online before opening saved household data.')
      startupMark('catalog-start')
      let catalog: WorkspaceSummary[]
      let disconnected = offline
      try { catalog = offline ? loadWorkspaceCatalog(user.id) : await listCloudWorkspaces(cloudUser) }
      catch (err) {
        if (!offlineSessionValid || !isTransientStartupFailure(err)) throw err
        catalog = loadWorkspaceCatalog(user.id)
        disconnected = true
        setError('Connection unavailable; displaying a locally saved home pending validation.')
      }
      if (epoch !== activationRef.current) return
      startupMark('catalog-ready')
      if (!disconnected) saveWorkspaceCatalog(user.id, catalog)
      setCatalogOwner(user.id)
      setWorkspaces(catalog)
      if (!catalog.some((x) => x.id === workspaceId && !x.archivedAt)) throw new Error('This household is no longer accessible to this account.')
      startupMark('workspace-selected')
      migrateLegacyOfflineStorage(user.id, workspaceId)
      const scope = workspaceScope(user.id, workspaceId)
      const snapshot = readAuthorizedSnapshot(user.id, workspaceId, catalog, disconnected)
      startupMark('snapshot-read')
      if (snapshot) {
        const optimistic = attachCoordinator(user.id, workspaceId, snapshot)
        dataRef.current = optimistic
        setVisibleOwner(user.id)
        setData(optimistic)
        setLoading(false)
        hydrated = true
        startupPath(disconnected ? 'offline' : 'warm')
        startupMark('snapshot-hydrated')
        // Cached selection is local and must not wait on auth metadata.
        void rememberWorkspace(workspaceId)
      }
      if (disconnected) {
        if (!snapshot) throw new Error('No account-scoped offline snapshot is available for this household.')
        setError('Offline: displaying the last saved household; cloud changes are pending validation.')
        return
      }
      startupMark('cloud-read-start')
      if (hydrated) {
        // The coordinator is the only authority for post-hydration remote reads:
        // it overlays every queued/sending edit, including edits made during
        // this fetch. Do not replace it with the raw fetch result.
        // attachCoordinator() assigned the ref; TS cannot track effects inside that helper.
        await (coordinatorRef.current as SyncCoordinator | null)?.refresh()
        if (epoch === activationRef.current) setError(null)
        startupMark('cloud-read-end')
      } else {
        const remote = await loadCloudData(cloudUser, workspaceId, { membershipConfirmedByCatalog: true })
        if (epoch !== activationRef.current) return
        if (!remote) throw new Error('The household could not be loaded.')
        startupMark('cloud-read-end')
        const baseline = normalizeWorkspaceData(remote)
        const optimistic = attachCoordinator(user.id, workspaceId, baseline)
        dataRef.current = optimistic
        setVisibleOwner(user.id)
        setData(optimistic)
        // Set render-ready before expensive occurrence generation or preference
        // updates. Those happen on a later task and never block first paint.
        setLoading(false)
        startupPath('cold')
        void rememberWorkspace(workspaceId)
        try { saveCloudCache(scope, optimistic) } catch (err) { logClientError(err, { area: 'cache household' }) }
      }
      afterFirstFrame(() => {
        if (epoch !== activationRef.current || dataRef.current?.workspace.id !== workspaceId) return
        const current = dataRef.current
        if (!current) return
        const generated = materializeTasks(current)
        startupMark('materialization-end')
        if (JSON.stringify(generated) === JSON.stringify(current)) return
        try {
          coordinatorRef.current?.enqueueConfiguration(current, generated)
          dataRef.current = generated
          setData(generated)
          saveCloudCache(scope, generated)
        } catch (err) { reportError(err, 'queue generated occurrences at activation') }
      })
      setError(null)
    } catch (err) {
      if (epoch === activationRef.current) {
        reportError(err, 'activate household')
        if (!hydrated || isDeniedStartupAccess(err)) {
          dataRef.current = null; setData(null)
          if (isDeniedStartupAccess(err)) try { clearCloudCache(workspaceScope(user.id, workspaceId)) } catch { /* best effort */ }
        }
      }
    } finally {
      if (epoch === activationRef.current) setLoading(false)
    }
  }, [user?.id, isCloud, cloudUser?.id, offlineSessionValid, attachCoordinator, rememberWorkspace, reportError])

  useEffect(() => {
    let cancelled = false
    const epoch = ++activationRef.current
    // Each account transition invalidates in-flight reads before any await.
    coordinatorRef.current?.stop()
    coordinatorRef.current = null
    dataRef.current = null
    setData(null)
    setVisibleOwner(null)
    setCatalogOwner(null)
    setPendingSync(0)
    setSyncConflicts([])
    if (!user) { setWorkspaces([]); setLoading(false); return () => { cancelled = true } }
    setLoading(true)
    async function load() {
      try {
        if (isCloud && cloudUser) {
          const offline = typeof navigator !== 'undefined' && !navigator.onLine
          if (offline && !offlineSessionValid) throw new Error('Offline sign-in has expired. Connect and sign in to unlock saved household data.')
          startupMark('catalog-start')
          let catalog: WorkspaceSummary[]
          let disconnected = offline
          try {
            catalog = offline ? loadWorkspaceCatalog(user!.id) : await listCloudWorkspaces(cloudUser)
            if (!offline) saveWorkspaceCatalog(user!.id, catalog)
          } catch (err) {
            // Only a transport failure with an unexpired local auth token can
            // fall back to the saved membership catalog. Server denials never do.
            if (!offlineSessionValid || !isTransientStartupFailure(err)) throw err
            catalog = loadWorkspaceCatalog(user!.id)
            disconnected = true
            setError('Connection unavailable; cached household access needs revalidation.')
          }
          if (cancelled || epoch !== activationRef.current) return
          startupMark('catalog-ready')
          setCatalogOwner(user!.id)
          setWorkspaces(catalog)
          const active = catalog.filter((x) => !x.archivedAt)
          const preferred = preferredWorkspaceRef.current ?? loadSelectedWorkspaceId(user!.id)
          const selected = active.find((x) => x.id === preferred) ?? newestActiveWorkspace(active)
          if (!selected) { setLoading(false); return }
          startupMark('workspace-selected')
          migrateLegacyOfflineStorage(user!.id, selected.id)
          const scope = workspaceScope(user!.id, selected.id)
          const snapshot = readAuthorizedSnapshot(user!.id, selected.id, catalog, disconnected)
          startupMark('snapshot-read')
          if (snapshot) {
            const optimistic = attachCoordinator(user!.id, selected.id, snapshot)
            dataRef.current = optimistic
            setVisibleOwner(user!.id)
            setData(optimistic)
            setLoading(false)
            startupPath(disconnected ? 'offline' : 'warm')
            startupMark('snapshot-hydrated')
            void rememberWorkspace(selected.id)
          }
          if (disconnected) {
            if (!snapshot) throw new Error('No account-scoped cached home is available while offline.')
            setError('Offline: displaying saved household until the next cloud validation.')
            return
          }
          startupMark('cloud-read-start')
          if (snapshot) {
            await coordinatorRef.current?.refresh()
            if (cancelled || epoch !== activationRef.current) return
            startupMark('cloud-read-end')
          } else {
            const remote = await loadCloudData(cloudUser, selected.id, { membershipConfirmedByCatalog: true })
            if (cancelled || epoch !== activationRef.current) return
            if (!remote) throw new Error('The selected home is unavailable.')
            startupMark('cloud-read-end')
            const optimistic = attachCoordinator(user!.id, selected.id, normalizeWorkspaceData(remote))
            dataRef.current = optimistic
            setVisibleOwner(user!.id)
            setData(optimistic)
            setLoading(false)
            startupPath('cold')
            void rememberWorkspace(selected.id)
            try { saveCloudCache(scope, optimistic) } catch (err) { logClientError(err, { area: 'cache household' }) }
          }
          // After the first render. Fresh cloud reads and pending edits remain
          // protected by the 16A coordinator. A delayed generator cannot write
          // into a different user/household or overwrite newer edits.
          afterFirstFrame(() => {
            if (cancelled || epoch !== activationRef.current || dataRef.current?.workspace.id !== selected.id) return
            const current = dataRef.current
            if (!current) return
            const generated = materializeTasks(current)
            startupMark('materialization-end')
            if (JSON.stringify(generated) === JSON.stringify(current)) return
            try {
              coordinatorRef.current?.enqueueConfiguration(current, generated)
              dataRef.current = generated
              setData(generated)
              saveCloudCache(scope, generated)
            } catch (err) { reportError(err, 'queue startup materialization') }
          })
          setError(null)
        } else {
          const local = loadLocalData()
          if (cancelled || epoch !== activationRef.current) return
          startupPath('local')
          const loaded = local ? normalizeWorkspaceData(local) : null
          setWorkspaces(loaded ? [{
            id: loaded.workspace.id, name: loaded.workspace.name, timezone: loaded.workspace.timezone,
            role: 'owner', ownerUserId: loaded.workspace.ownerUserId,
            archivedAt: loaded.workspace.archivedAt, createdAt: loaded.workspace.createdAt,
          }] : [])
          setCatalogOwner(user!.id)
          dataRef.current = loaded
          setVisibleOwner(user!.id)
          setData(loaded)
          setLoading(false)
          if (loaded) afterFirstFrame(() => {
            if (cancelled || epoch !== activationRef.current || dataRef.current !== loaded) return
            const generated = materializeTasks(loaded)
            startupMark('materialization-end')
            if (generated !== loaded && JSON.stringify(generated) !== JSON.stringify(loaded)) {
              try { saveLocalData(generated); dataRef.current = generated; setData(generated) }
              catch (err) { reportError(err, 'materialize local workspace') }
            }
          })
        }
      } catch (err) {
        if (!cancelled && epoch === activationRef.current) {
          reportError(err, 'load household')
          if (isDeniedStartupAccess(err)) {
            const workspaceId = dataRef.current?.workspace.id
            if (workspaceId && user?.id) try { clearCloudCache(workspaceScope(user.id, workspaceId)) } catch { /* best effort */ }
            dataRef.current = null
            setData(null)
          }
        }
      } finally {
        if (!cancelled && epoch === activationRef.current) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true; if (epoch === activationRef.current) coordinatorRef.current?.stop() }
  }, [user?.id, cloudUser?.id, isCloud, offlineSessionValid, newestActiveWorkspace, rememberWorkspace, reportError, attachCoordinator])

  useEffect(() => () => { coordinatorRef.current?.stop(); coordinatorRef.current = null }, [user?.id, isCloud])

  const currentMember = useMemo(() => {
    if (!data || !user) return undefined
    return data.members.find((member) => member.userId === user.id) ?? data.members.find((member) => member.role === 'owner')
  }, [data, user])

  const commit = useCallback(async (mutate: (current: WorkspaceData) => WorkspaceData) => {
    ensureNoRestore()
    const current = dataRef.current
    if (!current) return
    const next = materializeTasks(normalizeWorkspaceData(mutate(current)))
    if (next === current || JSON.stringify(next) === JSON.stringify(current)) return
    if (isCloud) {
      const coordinator = coordinatorRef.current
      if (!coordinator || coordinator.workspaceId !== current.workspace.id) throw new Error('Safe sync is not ready for this household.')
      // Durable outbox FIRST; failed localStorage writes cannot acknowledge UI edits.
      coordinator.enqueueConfiguration(current, next)
      if (user?.id) {
        try { saveCloudCache(workspaceScope(user.id, current.workspace.id), next) }
        catch (err) { reportError(err, 'save optimistic household cache') }
      }
    } else saveLocalData(next)
    dataRef.current = next
    setData(next)
  }, [isCloud, user?.id, reportError])

  const commitVisualOverride = useCallback(async (kind: VisualSubjectKind, id: string, overrides: StudioOverrides, expectedRevision: number) => {
    ensureNoRestore()
    const current = dataRef.current
    if (!current || !user?.id || !validVisualSubject(current, kind, id)) throw new Error('The visual subject is no longer available in this household.')
    if (isCloud && !current.visualOverridesAvailable) throw new Error('Visual override persistence is unavailable until the additive Phase 18B migration is approved and installed.')
    const clean = validatedVisualOverrides(overrides)
    const previous = current.visualOverrides?.find((row) => row.subjectType === kind && row.subjectId === id)
    if (previous && previous.generatorVersion !== HOUSE_CARE_VISUAL_VERSION) throw new Error('This artwork was made with an unsupported generator version. Preserve or migrate it before editing.')
    if ((previous?.revision ?? 0) !== expectedRevision) throw new Error('Artwork changed since this Studio was opened. Close and reopen to compare before saving.')
    if (JSON.stringify(previous?.overrides ?? {}) === JSON.stringify(clean)) return
    const mutation = { workspaceId: current.workspace.id, subjectType: kind, subjectId: id,
      expectedRevision: previous?.revision ?? 0, generatorVersion: HOUSE_CARE_VISUAL_VERSION, overrides: clean }
    if (isCloud) {
      const coordinator = coordinatorRef.current
      if (!coordinator || coordinator.workspaceId !== current.workspace.id) throw new Error('Safe sync is not ready for this household.')
      // Durable 16A outbox write must succeed before optimistic display.
      const operationId = coordinator.enqueueVisual(mutation)
      const projected = overlayVisualMutation(current, mutation, operationId, new Date().toISOString())
      dataRef.current = projected
      setData(projected)
      try { saveCloudCache(workspaceScope(user.id, current.workspace.id), projected) }
      catch (err) { reportError(err, 'cache visual edit') }
    } else {
      const projected = overlayVisualMutation(current, mutation, newId(), new Date().toISOString())
      saveLocalData(projected)
      dataRef.current = projected
      setData(projected)
    }
  }, [isCloud, user?.id, reportError])

  const commitSceneDecorations = useCallback(async (sceneId: string, items: SceneDecoration[], expectedRevision: number) => {
    ensureNoRestore()
    const current = dataRef.current
    if (!current || !user?.id || !sceneExists(current, sceneId)) throw new Error('Scene is no longer active in this household.')
    if (isCloud && !current.sceneDecorationsAvailable) throw new Error('Saving Home decorations requires the unapplied Phase 19B migration.')
    const clean = validatedSceneDecorations(items)
    if (clean.some(item => item.elementId && !current.layoutElements.some(element => element.id === item.elementId
      && element.sceneId === sceneId && !element.archivedAt))) throw new Error('A decoration references an unavailable placement.')
    const previous = sceneRow(current, sceneId)
    if (previous && previous.generatorVersion !== HOME_ILLUSTRATION_GENERATOR) throw new Error('Unsupported saved Home illustration generator. Preserve or migrate before editing.')
    if ((previous?.revision ?? 0) !== expectedRevision) throw new Error('Another member changed this scene. Close and reopen before confirming.')
    if (JSON.stringify(previous?.items ?? []) === JSON.stringify(clean)) return
    const mutation = { workspaceId: current.workspace.id, sceneId, expectedRevision,
      generatorVersion: HOME_ILLUSTRATION_GENERATOR, items: clean }
    if (isCloud) {
      const coordinator = coordinatorRef.current
      if (!coordinator || coordinator.workspaceId !== current.workspace.id) throw new Error('Safe sync is not ready for this household.')
      // Durable outbox first, then optimistic display. Never enqueue on slider/drag.
      const operationId = coordinator.enqueueScene(mutation)
      const optimistic = overlaySceneMutation(current, mutation, operationId, new Date().toISOString())
      dataRef.current = optimistic
      setData(optimistic)
      try { saveCloudCache(workspaceScope(user.id, current.workspace.id), optimistic) }
      catch (err) { reportError(err, 'cache scene decoration edit') }
    } else {
      const optimistic = overlaySceneMutation(current, mutation, newId(), new Date().toISOString())
      saveLocalData(optimistic)
      dataRef.current = optimistic
      setData(optimistic)
    }
  }, [isCloud, user?.id, reportError])

  const performRuntimeMutation = useCallback(async (mutation: OfflineMutation) => {
    ensureNoRestore()
    const current = dataRef.current
    if (!current || !user) return
    const runtimeProjection = normalizeWorkspaceData(applyMutationLocally(current, mutation))
    if (runtimeProjection === current || !runtimeProjection.taskEvents.some(x => x.id === mutation.eventId)
      && !runtimeProjection.extraCareEvents?.some(x => x.id === mutation.eventId)
      && !runtimeProjection.supplyEvents.some(x => x.id === mutation.eventId)) {
      throw new Error('This task changed or its successor has history. Refresh and resolve the conflict before retrying.')
    }
    const runtimeTask = mutation.kind === 'supply_status' ? undefined : current.tasks.find(t => t.id === mutation.taskId)
    const runtimeRoutine = current.routines.find(r => r.id === runtimeTask?.routineId)
    // Every mutation of a 16C-enrolled completion-relative task must use a
    // versioned V2 RPC. This covers Postpone, Reassign and Extra Care, too.
    const afterCompletion = mutation.kind !== 'supply_status' && runtimeRoutine?.scheduleMode === 'after_completion'
    if (mutation.kind !== 'supply_status') {
      mutation.afterCompletion = afterCompletion
      if (afterCompletion && (mutation.kind === 'complete' || mutation.kind === 'skip' || mutation.kind === 'complete_target')) {
        const source = mutation.kind === 'complete_target' ? stableId(`target-completed:${mutation.eventId}`) : mutation.eventId
        mutation.afterCompletionSuccessor = runtimeProjection.tasks.find(t => t.successorOfEventId === source)
        mutation.afterCompletionEvents = runtimeProjection.taskEvents.filter(event => event.taskId === mutation.afterCompletionSuccessor?.id && ['TASK_CREATED', 'ASSIGNED'].includes(event.type))
      }
    }
    const optimistic = materializeTasks(runtimeProjection)
    if (isCloud && afterCompletion && current.recurrenceMode !== 'atomic') throw new Error('Atomic recurrence is not activated for this cloud household. No edit was queued.')
    if (!isCloud) { saveLocalData(optimistic) }
    else {
      const coordinator = coordinatorRef.current
      if (!coordinator || coordinator.workspaceId !== mutation.workspaceId) throw new Error('Safe sync is not ready for this household.')
      coordinator.enqueueRuntime(mutation)
      if (JSON.stringify(optimistic) !== JSON.stringify(runtimeProjection)) coordinator.enqueueConfiguration(runtimeProjection, optimistic)
      try { saveCloudCache(workspaceScope(user.id, mutation.workspaceId), optimistic) }
      catch (err) { reportError(err, 'cache task action') }
    }
    dataRef.current = optimistic
    setData(optimistic)
  }, [isCloud, user, reportError])

  useEffect(() => {
    const onOnline = () => { setOnline(true); coordinatorRef.current?.resume() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    if (navigator.onLine && !loading) coordinatorRef.current?.resume()
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [loading])

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

  /** Block new edits for the entire archive/restore/delete transaction, not
   * just during the initial outbox drain. */
  const withExclusive = async (operation: () => Promise<void>): Promise<void> => {
    ensureNoRestore()
    exclusiveRef.current = true
    try { await operation() } finally { exclusiveRef.current = false }
  }

  const value = useMemo<DataValue>(() => ({
    data: visibleOwner === user?.id ? data : null,
    workspaces: catalogOwner === user?.id ? workspaces : [],
    loading: loading || Boolean(user && visibleOwner !== user.id && catalogOwner !== user.id),
    saving, error, online, pendingSync, syncConflicts,
    clearError: () => setError(null),
    dismissSyncConflicts: () => {
      // Dismiss the *legacy* historical banner only; unresolved mutations must
      // never be hidden, deleted, or treated as acknowledged by dismissal.
      if (user?.id && dataRef.current?.workspace.id) clearSyncConflicts(workspaceScope(user.id, dataRef.current.workspace.id))
    },
    retrySyncIssue: async (id) => {
      const coordinator = coordinatorRef.current
      if (!coordinator) return
      await coordinator.resolveConflict(id, 'keep_local')
    },
    discardSyncIssue: async (id) => {
      const coordinator = coordinatorRef.current
      if (!coordinator) return
      await coordinator.resolveConflict(id, 'use_cloud')
    },
    currentMember,
    commitVisualOverride,
    commitSceneDecorations,
    switchWorkspace: async (workspaceId) => {
      ensureNoRestore()
      // The old household outbox is durable. Cancel in-flight requests and
      // resume them only after that exact household/user is reactivated.
      await activateWorkspace(workspaceId)
    },
    archiveWorkspace: async (workspaceId) => withExclusive(async () => {
      if (!isCloud || !cloudUser || !user) return
      if (dataRef.current?.workspace.id === workspaceId) await coordinatorRef.current?.requireExclusive()
      else if (readOutbox(workspaceScope(user.id, workspaceId)).length) throw new Error('Resolve pending edits before archiving another household.')
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
    }),
    restoreWorkspace: async (workspaceId) => withExclusive(async () => {
      if (!isCloud || !cloudUser || !user) return
      if (dataRef.current?.workspace.id === workspaceId) await coordinatorRef.current?.requireExclusive()
      else if (readOutbox(workspaceScope(user.id, workspaceId)).length) throw new Error('Resolve pending edits before restoring this household.')
      await restoreCloudWorkspace(workspaceId)
      await refreshWorkspaceCatalog()
      if (!dataRef.current) await activateWorkspace(workspaceId)
    }),
    deleteWorkspace: async (workspaceId) => withExclusive(async () => {
      if (!isCloud || !cloudUser || !user) return
      if (dataRef.current?.workspace.id === workspaceId) await coordinatorRef.current?.requireExclusive()
      else if (readOutbox(workspaceScope(user.id, workspaceId)).length) throw new Error('Resolve pending edits before deleting this household.')
      await deleteCloudWorkspace(workspaceId)
      const scope = workspaceScope(user.id, workspaceId)
      removeOutbox(scope)
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
    }),
    createWorkspace: async (name, ownerName, timezone) => {
      if (!user) return
      const created = isCloud && cloudUser
        ? await createCloudWorkspace(cloudUser, name, ownerName, timezone)
        : createLocalWorkspace(name, ownerName, timezone)
      if (isCloud) {
        await refreshWorkspaceCatalog()
        await activateWorkspace(created.workspace.id)
      } else {
        saveLocalData(created)
        dataRef.current = created
        setData(created)
        await refreshWorkspaceCatalog()
      }
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
      if (isCloud && !integratedExtraCare(current) && input.additionalActivities?.length) throw new Error('Phase 16B cloud activation is required to create integrated Extra Care. See the migration notes.')
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
      if (isCloud && !integratedExtraCare(current) && input.additionalActivities?.length) throw new Error('Phase 16B cloud activation is required to edit integrated Extra Care.')
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
        // Resume only reactivates known, still-future rows cancelled by Pause.
        // Do not fabricate a completion-relative successor from the Resume
        // timestamp. If a terminal row has no safe successor, retain history
        // and require explicit repair rather than silently shifting cadence.
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
      if (isLegacyLinkedTask(current, task)) throw new Error('Extra Care is completed with its primary activity.')
      const integrated = isIntegratedPrimary(current, task) && current.routines.some(r => r.parentRoutineId === task.routineId && !r.archivedAt)
      const effects = integrated ? buildIntegratedEffects(current, task, eventAt, eventId, currentMember?.id) : null
      const completionEffects = effects?.parentEffects ?? buildCompletionHealthEffects(current, task, eventAt, targetIds, currentMember?.id)
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'complete', taskId: id,
        expectedVersion: task.version, eventId, eventAt, actorMemberId: currentMember?.id, completionEffects,
        integrated, extraCompletions: effects?.extras, trajectoryBefore: effects?.beforeTrajectories })
      return eventId
    },
    postponeExtraCare: async (id, extraRoutineId) => {
      const current = dataRef.current; const task = current?.tasks.find(row => row.id === id)
      if (!current || !task || !integratedExtraCare(current) || !dueExtraCare(current, task).some(row => row.id === extraRoutineId)) return null
      const eventId = newId()
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'extra_postpone', taskId: id,
        expectedVersion: task.version, eventId, eventAt: nowIso(), actorMemberId: currentMember?.id, extraRoutineId, integrated: true })
      return eventId
    },
    completeTaskTarget: async (id, entityId) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      const target = task?.targets.find((item) => item.entityId === entityId)
      if (!current || !task || task.state !== 'scheduled' || !target || target.completedAt) return
      if (isLegacyLinkedTask(current, task) || integratedExtraCare(current) && current.routines.some(r => r.parentRoutineId === task.routineId && !r.archivedAt)) throw new Error('Use Complete on the primary activity to include Extra Care.')
      const eventAt = nowIso(); const eventId = newId()
      const completionEffects = buildCompletionHealthEffects(current, task, eventAt, [entityId], currentMember?.id)
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'complete_target', taskId: id, targetEntityId: entityId, expectedVersion: task.version, eventId, eventAt, actorMemberId: currentMember?.id, completionEffects })
    },
    skipTask: async (id) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return null
      if (isLegacyLinkedTask(current, task)) throw new Error('Extra Care is managed through the primary activity.')
      const eventId = newId()
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'skip', taskId: id, expectedVersion: task.version, eventId, eventAt: nowIso(), actorMemberId: currentMember?.id, integrated: isIntegratedPrimary(current, task) && current.routines.some(r => r.parentRoutineId === task.routineId && !r.archivedAt) })
      return eventId
    },
    postponeTask: async (id, dueAt) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return null
      if (isLegacyLinkedTask(current, task)) throw new Error('Extra Care is managed through the primary activity.')
      const eventId = newId()
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'postpone', taskId: id, expectedVersion: task.version, eventId, eventAt: nowIso(), actorMemberId: currentMember?.id, dueAt, effectiveDueAt: dueAt, integrated: isIntegratedPrimary(current, task) && current.routines.some(r => r.parentRoutineId === task.routineId && !r.archivedAt) })
      return eventId
    },
    reassignTask: async (id, memberId, assignmentScope) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task || task.state !== 'scheduled') return null
      if (isLegacyLinkedTask(current, task)) throw new Error('Extra Care is managed through the primary activity.')
      const eventId = newId()
      const scope = assignmentScope ?? (memberId ? 'member' : 'unassigned')
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'reassign', taskId: id, expectedVersion: task.version, eventId, eventAt: nowIso(), actorMemberId: currentMember?.id, integrated: isIntegratedPrimary(current, task) && current.routines.some(r => r.parentRoutineId === task.routineId && !r.archivedAt), assigneeMemberId: scope === 'member' ? memberId : undefined, clearAssignee: scope !== 'member', assignmentScope: scope })
      return eventId
    },
    undoTaskAction: async (id, sourceEventId) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task) return
      if (isLegacyLinkedTask(current, task)) throw new Error('Historical linked activities cannot be edited in integrated mode.')
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'undo', afterCompletion: current.routines.find(r => r.id === task.routineId)?.scheduleMode === 'after_completion', taskId: id, integrated: isIntegratedPrimary(current, task) && current.routines.some(r => r.parentRoutineId === task.routineId && !r.archivedAt), expectedVersion: task.version, sourceEventId, eventId: newId(), eventAt: nowIso(), actorMemberId: currentMember?.id })
    },
    restoreTaskToToday: async (id, sourceEventId) => {
      const current = dataRef.current; const task = current?.tasks.find((item) => item.id === id)
      if (!current || !task) return
      if (isLegacyLinkedTask(current, task)) throw new Error('Historical linked activities cannot be restored independently in integrated mode.')
      await performRuntimeMutation({ id: newId(), workspaceId: current.workspace.id, kind: 'reopen_today', afterCompletion: current.routines.find(r => r.id === task.routineId)?.scheduleMode === 'after_completion', taskId: id, integrated: isIntegratedPrimary(current, task) && current.routines.some(r => r.parentRoutineId === task.routineId && !r.archivedAt), expectedVersion: task.version, sourceEventId, eventId: newId(), eventAt: nowIso(), actorMemberId: currentMember?.id })
    },
    importBackup: async (backup) => {
      const current = dataRef.current
      if (!current || !currentMember || currentMember.role !== 'owner') throw new Error('Only the household owner can import a backup.')
      if (exclusiveRef.current) throw new Error('A household restore is already in progress.')
      exclusiveRef.current = true
      setSaving(true)
      try {
        if (isCloud) await coordinatorRef.current?.requireExclusive()
        const imported = materializeTasks({ ...prepareImportedWorkspace(backup, current, currentMember),
          extraCareMode: current.extraCareMode, recurrenceMode: current.recurrenceMode })
        if (isCloud) await replaceCloudData(imported, user?.id)
        else saveLocalData(imported)
        if (isCloud && user?.id) {
          // Only clear the outbox AFTER successful destructive replacement.
          coordinatorRef.current?.resetAfterExclusive()
          dataRef.current = attachCoordinator(user.id, imported.workspace.id, imported)
          try { saveCloudCache(workspaceScope(user.id, imported.workspace.id), imported) }
          catch (err) { reportError(err, 'cache restored household') }
        } else dataRef.current = imported
        setData(imported)
        setError(null)
      } catch (err) {
        reportError(err, 'import backup')
        throw err
      } finally {
        exclusiveRef.current = false
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
  }), [data, workspaces, visibleOwner, catalogOwner, loading, saving, error, online, pendingSync, syncConflicts, currentMember, user, isCloud, cloudUser, commit, commitVisualOverride, commitSceneDecorations, cancelFutureTasks, performRuntimeMutation, activateWorkspace, refreshWorkspaceCatalog, newestActiveWorkspace, rememberWorkspace, reportError, attachCoordinator])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}
