import { CleanlinessMood } from '../components/CleanlinessMood'
import { TaskProducts } from '../components/TaskProducts'
import { activityTitle, activitySubtitle, groupLinkedTaskOccurrences } from '../lib/presentation'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { EmptyState } from '../components/EmptyState'
import { FormField } from '../components/FormField'
import { HomeLayoutCanvas } from '../components/HomeLayoutCanvas'
import { Illustration } from '../components/Illustration'
import { MetadataFields } from '../components/MetadataFields'
import { Sheet } from '../components/Sheet'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { addDays, formatTaskDateTime, formatTaskTime, localDateInZone } from '../lib/date'
import { careEstimateForEntity, homeCleanlinessSummary, scheduledTasksForEntity, supplyAlertsForEntity } from '../lib/home'
import { buildRoomWorkflow, roomStatusMap } from '../lib/room'
import type { Entity, LayoutElement, LayoutRole, LayoutSceneKind, MetadataValue, RelationKind, TaskOccurrence } from '../types/domain'

interface UndoState { taskId: string; eventId: string; message: string; fromRoomMode?: boolean }

export function HomePage() {
  const {
    data,
    addEntityType,
    archiveEntityType,
    addEntity,
    updateEntity,
    archiveEntity,
    addLayoutScene,
    updateLayoutScene,
    archiveLayoutScene,
    addLayoutElement,
    updateLayoutElement,
    archiveLayoutElement,
    addEntityRelation,
    archiveEntityRelation,
    completeTask,
    skipTask,
    undoTaskAction,
  } = useData()
  const { t, locale } = useI18n()
  const [editMode, setEditMode] = useState(false)
  const [activeSceneId, setActiveSceneId] = useState('')
  const [selectedElementId, setSelectedElementId] = useState('')
  const [selectedEntityId, setSelectedEntityId] = useState('')
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [layoutZoom, setLayoutZoom] = useState(1)
  const [fitRequest, setFitRequest] = useState(0)
  const [sceneOpen, setSceneOpen] = useState(false)
  const [sceneEditOpen, setSceneEditOpen] = useState(false)
  const [placementRole, setPlacementRole] = useState<LayoutRole | null>(null)
  const [placeExistingOpen, setPlaceExistingOpen] = useState(false)
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [typesOpen, setTypesOpen] = useState(false)
  const [entityEditOpen, setEntityEditOpen] = useState(false)
  const [clockNow, setClockNow] = useState(() => new Date())
  const [undo, setUndo] = useState<UndoState | null>(null)
  const [roomModeEntityId, setRoomModeEntityId] = useState<string | null>(null)
  const [roomSessionHandled, setRoomSessionHandled] = useState(0)
  const [roomDeferredIds, setRoomDeferredIds] = useState<string[]>([])

  const scenes = useMemo(() => data?.layoutScenes.filter((item) => !item.archivedAt).sort((a, b) => a.order - b.order) ?? [], [data?.layoutScenes])
  useEffect(() => {
    if (!scenes.length) { setActiveSceneId(''); return }
    if (!activeSceneId || !scenes.some((scene) => scene.id === activeSceneId)) setActiveSceneId(scenes[0].id)
  }, [scenes, activeSceneId])
  useEffect(() => { const id = window.setInterval(() => setClockNow(new Date()), 60_000); return () => window.clearInterval(id) }, [])
  useEffect(() => { if (!undo) return; const id = window.setTimeout(() => setUndo(null), 7000); return () => window.clearTimeout(id) }, [undo])

  if (!data) return null

  const entities = data.entities.filter((item) => !item.archivedAt)
  const types = data.entityTypes.filter((item) => !item.archivedAt)
  const selectedElement = data.layoutElements.find((item) => item.id === selectedElementId && !item.archivedAt)
  const selectedEntity = entities.find((item) => item.id === (selectedElement?.entityId || selectedEntityId))
  const activeScene = scenes.find((scene) => scene.id === activeSceneId)
  const placedOnScene = data.layoutElements.filter((item) => !item.archivedAt && item.sceneId === activeSceneId)
  const selectedCare = selectedEntity ? careEstimateForEntity(data, selectedEntity.id, clockNow) : null
  const selectedTasks = selectedEntity ? scheduledTasksForEntity(data, selectedEntity.id) : []
  const selectedSupplies = selectedEntity ? supplyAlertsForEntity(data, selectedEntity.id) : []
  const homeCleanliness = homeCleanlinessSummary(data, clockNow)
  const roomEntityIds = placedOnScene.filter((item) => item.role === 'area').map((item) => item.entityId)
  const roomStatuses = roomStatusMap(data, roomEntityIds, clockNow)
  const selectedIsRoom = selectedElement?.role === 'area'
  const selectedRoomWorkflow = selectedEntity && selectedIsRoom ? buildRoomWorkflow(data, selectedEntity.id, clockNow) : null

  function selectElement(elementId: string) {
    setSelectedElementId(elementId)
    const element = data!.layoutElements.find((item) => item.id === elementId)
    setSelectedEntityId(element?.entityId ?? '')
  }

  function openScene(sceneId: string) {
    setActiveSceneId(sceneId)
    setLayoutZoom(1)
    setFitRequest((value) => value + 1)
    setSelectedElementId('')
    setSelectedEntityId('')
  }

  function rememberUndo(task: TaskOccurrence, eventId: string | null, verb: string, fromRoomMode = false) {
    if (!eventId) return
    setUndo({ taskId: task.id, eventId, message: `${task.actionNameSnapshot} ${verb}`, fromRoomMode })
  }

  async function undoLast() {
    if (!undo || !window.confirm(t('confirmRestoreTask'))) return
    const value = undo
    setUndo(null)
    await undoTaskAction(value.taskId, value.eventId)
    if (value.fromRoomMode) setRoomSessionHandled((count) => Math.max(0, count - 1))
  }

  function startRoom(entityId: string) {
    setRoomModeEntityId(entityId)
    setRoomSessionHandled(0)
    setRoomDeferredIds([])
  }

  function groupNameForEntity(entity: Entity): string {
    let current: Entity | undefined = entity
    const visited = new Set<string>()
    while (current?.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId)
      const parent = entities.find((candidate) => candidate.id === current!.parentId)
      if (!parent) break
      if (data!.layoutElements.some((element) => !element.archivedAt && element.entityId === parent.id && element.role === 'area')) return parent.name
      current = parent
    }
    if (data!.layoutElements.some((element) => !element.archivedAt && element.entityId === entity.id && element.role === 'area')) return entity.name
    return locale === 'it' ? 'Altro' : 'Other'
  }

  function groupedEntityOptions(items: Entity[]) {
    const groups = new Map<string, Entity[]>()
    for (const entity of items) { const label = groupNameForEntity(entity); groups.set(label, [...(groups.get(label) ?? []), entity]) }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, rows]) => <optgroup key={label} label={label}>{rows.sort((a, b) => a.name.localeCompare(b.name)).map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</optgroup>)
  }

  return <div className="stack page-stack home-page">
    <header className="page-title-row">
      <div><div className="eyebrow">{t('home')}</div><h1>{editMode ? t('editHome') : t('homeCockpit')}</h1></div>
      {scenes.length > 0 && <button className={`button ${editMode ? 'primary' : 'secondary'} small`} onClick={() => { setEditMode((value) => !value); setSelectedElementId('') }}>
        {editMode ? t('doneEditing') : t('editHome')}
      </button>}
    </header>

    {scenes.length > 0 && <section className="home-cleanliness-bars" aria-label={t('homeCleanliness')}>
      <CleanlinessSummary label={t('regularCleanliness')} score={homeCleanliness.regular} />
      <CleanlinessSummary label={t('deepCleanliness')} score={homeCleanliness.deep} deep />
    </section>}

    {!scenes.length ? <section className="empty-layout card section-card">
      <Illustration id="onboardingHome" className="empty-layout-illustration" />
      <h2>{t('createHomeLayout')}</h2>
      <p className="muted compact-text">{t('createHomeLayoutHint')}</p>
      <button className="button primary align-start" onClick={() => setSceneOpen(true)}>+ {t('addFloorArea')}</button>
    </section> : <>
      <div className="scene-row">
        <div className="scene-tabs" role="tablist">
          {scenes.map((scene) => <button key={scene.id} className={scene.id === activeSceneId ? 'scene-tab selected' : 'scene-tab'} onClick={() => openScene(scene.id)}>{scene.kind === 'outdoor' ? '◇ ' : ''}{scene.name}</button>)}
        </div>
        {editMode && <button className="button secondary small" onClick={() => setSceneOpen(true)}>+ {t('scene')}</button>}
      </div>

      {editMode && <div className="editor-toolbar card">
        <div className="editor-tools">
          <button className="button secondary small" onClick={() => setPlacementRole('area')}>+ {t('area')}</button>
          <button className="button secondary small" onClick={() => setPlacementRole('object')}>+ {t('item')}</button>
          <button className="button secondary small" disabled={!entities.some((entity) => !placedOnScene.some((item) => item.entityId === entity.id))} onClick={() => setPlaceExistingOpen(true)}>{t('placeExisting')}</button>
          <button className="button secondary small" disabled={!placedOnScene.length} onClick={() => setConnectionOpen(true)}>+ {t('connection')}</button>
          <button className="button ghost small" onClick={() => setTypesOpen(true)}>{t('structureTypes')}</button>
        </div>
        <label className="snap-toggle"><input type="checkbox" checked={snapToGrid} onChange={(event) => setSnapToGrid(event.target.checked)} /> {t('snapGrid')}</label>
      </div>}

      <div className="home-workspace">
        <section className="layout-card card">
          <div className="layout-zoom-controls" aria-label={t('layoutZoom')}>
            <button type="button" className="icon-button" aria-label={t('zoomOut')} title={t('zoomOut')} disabled={layoutZoom <= 0.75} onClick={() => setLayoutZoom((value) => Math.max(0.75, Math.round((value - 0.25) * 100) / 100))}>−</button>
            <button type="button" className="zoom-readout" title={t('fitLayout')} onClick={() => { setLayoutZoom(1); setFitRequest((value) => value + 1) }}>{Math.round(layoutZoom * 100)}%</button>
            <button type="button" className="icon-button" aria-label={t('zoomIn')} title={t('zoomIn')} disabled={layoutZoom >= 2.5} onClick={() => setLayoutZoom((value) => Math.min(2.5, Math.round((value + 0.25) * 100) / 100))}>+</button>
          </div>
          <small className="layout-pan-hint">{t('panLayoutHint')}</small>
          {activeScene && <HomeLayoutCanvas
            data={data}
            sceneId={activeScene.id}
            overlay="objects"
            editMode={editMode}
            snapToGrid={snapToGrid}
            selectedElementId={selectedElementId}
            onSelectElement={selectElement}
            onSelectEntity={setSelectedEntityId}
            onGeometryCommit={(id, patch) => updateLayoutElement(id, patch)}
            onOpenScene={openScene}
            zoom={layoutZoom}
            fitRequest={fitRequest}
            roomStatuses={editMode ? new Map() : roomStatuses}
          />}
          {!placedOnScene.length && <div className="layout-empty-overlay">{editMode ? t('addFirstArea') : t('layoutEmpty')}</div>}
        </section>

      </div>
      <section className={`home-inspector home-selection-details${selectedIsRoom ? ' room-detail-open' : ''}`}>
        {editMode ? <EditorInspector /> : <CockpitInspector />}
      </section>
    </>}

    {sceneOpen && <SceneSheet onClose={() => setSceneOpen(false)} />}
    {sceneEditOpen && activeScene && <SceneSettingsSheet onClose={() => setSceneEditOpen(false)} />}
    {placementRole && <AddPlacementSheet role={placementRole} onClose={() => setPlacementRole(null)} />}
    {placeExistingOpen && <PlaceExistingSheet onClose={() => setPlaceExistingOpen(false)} />}
    {connectionOpen && <ConnectionSheet onClose={() => setConnectionOpen(false)} />}
    {typesOpen && <StructureSheet onClose={() => setTypesOpen(false)} />}
    {entityEditOpen && selectedEntity && <EntitySheet entity={selectedEntity} onClose={() => setEntityEditOpen(false)} />}
    {roomModeEntityId && <RoomModeSheet roomEntityId={roomModeEntityId} onClose={() => setRoomModeEntityId(null)} />}
    {undo && <div className="undo-snackbar" role="status"><span>{undo.message}</span><button onClick={() => void undoLast()}>{t('undo')}</button></div>}
  </div>


  function careLabel(status: string) {
    if (status === 'fresh') return t('fresh')
    if (status === 'good') return t('good')
    if (status === 'due_soon') return t('dueSoon')
    if (status === 'needs_attention') return t('needsAttention')
    if (status === 'overdue') return t('overdue')
    return t('notTracked')
  }

  function stockLabel(status: string) {
    if (status === 'available') return t('available')
    if (status === 'low') return t('low')
    if (status === 'reserve_only') return t('reserveOnly')
    return t('outOfStock')
  }

  function taskDue(task: TaskOccurrence) {
    return task.effectiveDueAt ?? task.dueAt
  }

  function roomTaskWhen(task: TaskOccurrence, compactUpcoming = false) {
    const due = new Date(taskDue(task))
    const day = localDateInZone(data!.workspace.timezone, due)
    const today = localDateInZone(data!.workspace.timezone, clockNow)
    const tomorrow = addDays(today, 1)
    if (compactUpcoming && day === tomorrow) return `${t('tomorrow')} · ${formatTaskTime(taskDue(task), locale, data!.workspace.timezone)}`
    if (compactUpcoming) {
      const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: data!.workspace.timezone }).format(due)
      return `${weekday} · ${formatTaskTime(taskDue(task), locale, data!.workspace.timezone)}`
    }
    return formatTaskDateTime(taskDue(task), locale, data!.workspace.timezone)
  }

  function RoomTaskRows({ tasks, upcoming = false }: { tasks: TaskOccurrence[]; upcoming?: boolean }) {
    if (!tasks.length) return <p className="muted compact-text">{t('nothingScheduled')}</p>
    return <div className="room-task-list">{groupLinkedTaskOccurrences(tasks).map(({ task, linkedActivities }) => <div className="room-task-row-group" key={task.id}>
      <div className="room-task-row">
        <div><strong>{activityTitle(task)}</strong><small>{activitySubtitle(task)}</small>{task.parentOccurrenceId && <small className="linked-task-label">{t('additionalActivity')}</small>}{task.parentOccurrenceId && task.supplies.length > 0 ? <div className="linked-products-section standalone"><small className="linked-subsection-label">{t('additionalProducts')}</small><TaskProducts task={task} data={data!} /></div> : <TaskProducts task={task} data={data!} />}</div>
        <small>{roomTaskWhen(task, upcoming)}</small>
      </div>
      {linkedActivities.length > 0 && <section className="home-linked-activities" aria-label={t('additionalActivities')}>
        <div className="linked-section-heading"><strong>{t('additionalActivities')}</strong><span>{linkedActivities.length}</span></div>
        {linkedActivities.map((linked) => <div className="home-linked-activity" key={linked.id}>
          <div><strong>{activityTitle(linked)}</strong><small>{activitySubtitle(linked)}</small>{linked.supplies.length > 0 && <div className="linked-products-section"><small className="linked-subsection-label">{t('additionalProducts')}</small><TaskProducts task={linked} data={data!} /></div>}</div>
          <small>{roomTaskWhen(linked, upcoming)}</small>
        </div>)}
      </section>}
    </div>)}</div>
  }

  function CockpitInspector() {
    if (!selectedEntity || !selectedCare) return <div className="inspector-empty"><span>⌖</span><p>{t('tapLayout')}</p></div>
    const type = types.find((item) => item.id === selectedEntity.typeId)

    if (selectedIsRoom && selectedRoomWorkflow) return <div className="stack inspector-content room-detail-panel">
      <div className="room-detail-heading">
        <div><div className="eyebrow">{t('roomDetails')}</div><h2>{selectedEntity.name}</h2></div>
        <button className="button ghost small room-detail-close" onClick={() => { setSelectedElementId(''); setSelectedEntityId('') }}>{t('close')}</button>
      </div>
      <div className="dual-care-summary room-cleanliness-summary">
        <div className="care-health-detail routine"><div className="care-health-heading"><span>{t('regularCleanliness')}</span><strong>{careLabel(selectedCare.routine.status)}</strong></div><div className="care-health-track-ui"><span style={{ width: `${selectedCare.routine.score ?? 0}%` }} /></div><b><CleanlinessMood score={selectedCare.routine.score} /> {selectedCare.routine.score == null ? '—' : `${Math.round(selectedCare.routine.score)}%`}</b></div>
        <div className="care-health-detail deep"><div className="care-health-heading"><span>{t('deepCleanliness')}</span><strong>{selectedCare.deep ? careLabel(selectedCare.deep.status) : t('notTracked')}</strong></div><div className="care-health-track-ui"><span style={{ width: `${selectedCare.deep?.score ?? 0}%` }} /></div><b><CleanlinessMood score={selectedCare.deep?.score} /> {selectedCare.deep?.score == null ? '—' : `${Math.round(selectedCare.deep.score)}%`}</b></div>
      </div>
      <section className="inspector-section room-work-section overdue-room-work">
        <div className="section-header"><h3>{t('overdue')}</h3><span className="count-pill small-pill">{selectedRoomWorkflow.overdue.length}</span></div>
        <RoomTaskRows tasks={selectedRoomWorkflow.overdue} />
      </section>
      <section className="inspector-section room-work-section today-room-work">
        <div className="section-header"><h3>{t('dueTodayShort')}</h3><span className="count-pill small-pill">{selectedRoomWorkflow.dueToday.length}</span></div>
        <RoomTaskRows tasks={selectedRoomWorkflow.dueToday} />
      </section>
      <section className="inspector-section room-work-section">
        <div className="section-header"><h3>{t('upcoming')}</h3><small>{t('nextSevenDays')}</small></div>
        <RoomTaskRows tasks={selectedRoomWorkflow.upcoming} upcoming />
      </section>
      <button className="button primary start-room-button" disabled={!selectedRoomWorkflow.queue.length} onClick={() => startRoom(selectedEntity.id)}>{t('startRoom')}</button>
      {!selectedRoomWorkflow.queue.length && <p className="muted compact-text room-start-hint">{t('nothingDueInRoom')}</p>}
    </div>

    return <div className="stack inspector-content">
      <div><div className="eyebrow">{type?.name}</div><h2>{selectedEntity.name}</h2></div>
      <div className="dual-care-summary">
        <div className="care-health-detail routine"><div className="care-health-heading"><span>{t('regularCleanliness')}</span><strong>{careLabel(selectedCare.routine.status)}</strong></div><div className="care-health-track-ui"><span style={{ width: `${selectedCare.routine.score ?? 0}%` }} /></div><b><CleanlinessMood score={selectedCare.routine.score} /> {selectedCare.routine.score == null ? '—' : `${Math.round(selectedCare.routine.score)}%`}</b></div>
        <div className="care-health-detail deep"><div className="care-health-heading"><span>{t('deepCleanliness')}</span><strong>{selectedCare.deep ? careLabel(selectedCare.deep.status) : t('notTracked')}</strong></div><div className="care-health-track-ui"><span style={{ width: `${selectedCare.deep?.score ?? 0}%` }} /></div><b><CleanlinessMood score={selectedCare.deep?.score} /> {selectedCare.deep?.score == null ? '—' : `${Math.round(selectedCare.deep.score)}%`}</b></div>
      </div>
      <section className="inspector-section">
        <div className="section-header"><h3>{t('currentTasks')}</h3><span className="count-pill small-pill">{selectedTasks.length}</span></div>
        {!selectedTasks.length ? <p className="muted compact-text">{t('noCurrentTasks')}</p> : <div className="mini-list">{groupLinkedTaskOccurrences(selectedTasks).slice(0, 5).map(({ task, linkedActivities }) => <div className="mini-list-group" key={task.id}><div className="mini-list-row"><div><strong>{activityTitle(task)}</strong><small>{activitySubtitle(task)}</small>{task.parentOccurrenceId && <small className="linked-task-label">{t('additionalActivity')}</small>}{task.parentOccurrenceId && task.supplies.length > 0 ? <div className="linked-products-section standalone"><small className="linked-subsection-label">{t('additionalProducts')}</small><TaskProducts task={task} data={data!} /></div> : <TaskProducts task={task} data={data!} />}</div><small>{formatTaskDateTime(taskDue(task), locale, data!.workspace.timezone)}</small></div>{linkedActivities.length > 0 && <section className="home-linked-activities compact"><div className="linked-section-heading"><strong>{t('additionalActivities')}</strong><span>{linkedActivities.length}</span></div>{linkedActivities.map((linked) => <div className="home-linked-activity" key={linked.id}><div><strong>{activityTitle(linked)}</strong><small>{activitySubtitle(linked)}</small>{linked.supplies.length > 0 && <div className="linked-products-section"><small className="linked-subsection-label">{t('additionalProducts')}</small><TaskProducts task={linked} data={data!} /></div>}</div><small>{formatTaskDateTime(taskDue(linked), locale, data!.workspace.timezone)}</small></div>)}</section>}</div>)}</div>}
      </section>
      <section className="inspector-section">
        <h3>{t('supplyAlerts')}</h3>
        {!selectedSupplies.length ? <p className="muted compact-text">{t('noSupplyAlerts')}</p> : <div className="mini-list">{selectedSupplies.map((supply) => <div className="mini-list-row" key={supply.id}><strong>{supply.name}</strong><span className={`stock-badge stock-${supply.status}`}>{stockLabel(supply.status)}</span></div>)}</div>}
      </section>
      {selectedEntity.labels.length > 0 && <div className="chip-list">{selectedEntity.labels.map((label) => <span key={label} className="chip">{label}</span>)}</div>}
    </div>
  }

  function RoomModeSheet({ roomEntityId, onClose }: { roomEntityId: string; onClose: () => void }) {
    const room = entities.find((entity) => entity.id === roomEntityId)
    if (!room) return null
    const workflow = buildRoomWorkflow(data!, roomEntityId, clockNow)
    const deferredRank = new Map(roomDeferredIds.map((id, index) => [id, index]))
    const queue = [...workflow.queue].sort((a, b) => {
      const aRank = deferredRank.get(a.id)
      const bRank = deferredRank.get(b.id)
      if (aRank == null && bRank == null) return 0
      if (aRank == null) return -1
      if (bRank == null) return 1
      return aRank - bRank
    })
    const current = queue[0]
    const total = roomSessionHandled + queue.length

    function moveLater() {
      if (!current) return
      setRoomDeferredIds((ids) => [...ids.filter((id) => id !== current.id), current.id])
    }

    async function completeCurrent() {
      if (!current || !window.confirm(t('confirmCompleteTask'))) return
      const eventId = await completeTask(current.id)
      rememberUndo(current, eventId, t('completed').toLowerCase(), true)
      if (eventId) {
        setRoomSessionHandled((count) => count + 1)
        setRoomDeferredIds((ids) => ids.filter((id) => id !== current.id))
      }
    }

    async function skipCurrent() {
      if (!current || !window.confirm(t('confirmSkipTask'))) return
      const eventId = await skipTask(current.id)
      rememberUndo(current, eventId, t('skipped').toLowerCase(), true)
      if (eventId) {
        setRoomSessionHandled((count) => count + 1)
        setRoomDeferredIds((ids) => ids.filter((id) => id !== current.id))
      }
    }

    return <Sheet title={room.name} onClose={onClose}><div className="stack room-mode">
      {current ? <>
        <div className="room-mode-progress"><span>{t('roomCleaning')}</span><strong>{roomSessionHandled + 1} {t('of')} {total}</strong></div>
        <section className="room-mode-card">
          <span className={`room-mode-state ${workflow.overdue.some((task) => task.id === current.id) ? 'overdue' : 'today'}`}>{workflow.overdue.some((task) => task.id === current.id) ? t('overdue') : t('dueTodayShort')}</span>
          <h2>{activityTitle(current)}</h2>
          <p>{activitySubtitle(current)}</p>
          {current.parentOccurrenceId && current.supplies.length > 0 ? <div className="linked-products-section standalone"><small className="linked-subsection-label">{t('additionalProducts')}</small><TaskProducts task={current} data={data!} /></div> : <TaskProducts task={current} data={data!} />}
          <small>{roomTaskWhen(current)}</small>
        </section>
        <button className="button primary room-done-button" onClick={() => void completeCurrent()}>{t('done')}</button>
        <div className="room-mode-secondary-actions"><button className="button secondary" onClick={() => void skipCurrent()}>{t('skip')}</button><button className="button ghost" onClick={moveLater}>{t('later')}</button></div>
      </> : <div className="room-mode-complete">
        <Illustration id="allDone" className="room-complete-illustration" />
        <h2>{t('roomHandled')}</h2>
        <p className="muted">{t('roomHandledHint')}</p>
        <button className="button primary" onClick={onClose}>{t('backToLayout')}</button>
      </div>}
    </div></Sheet>
  }

  function EditorInspector() {
    if (!activeScene) return null
    if (!selectedElement || !selectedEntity) return <div className="stack inspector-content">
      <div><div className="eyebrow">{t('editing')}</div><h2>{activeScene.name}</h2></div>
      <p className="muted compact-text">{t('selectToEdit')}</p>
      <div className="action-section stack tight-stack">
        <button className="button secondary" onClick={() => setPlacementRole('area')}>+ {t('addArea')}</button>
        <button className="button secondary" onClick={() => setPlacementRole('object')}>+ {t('addObject')}</button>
        <button className="button ghost" onClick={() => setSceneEditOpen(true)}>{t('sceneSettings')}</button>
        <button className="button danger-outline" onClick={() => { if (window.confirm(t('confirmRemoveScene'))) void archiveLayoutScene(activeScene.id) }}>{t('removeScene')}</button>
      </div>
    </div>

    const type = types.find((item) => item.id === selectedEntity.typeId)
    const relations = data!.entityRelations.filter((item) => !item.archivedAt && (item.fromEntityId === selectedEntity.id || item.toEntityId === selectedEntity.id))
    return <div className="stack inspector-content">
      <div><div className="eyebrow">{type?.name}</div><h2>{selectedEntity.name}</h2></div>
      <button className="button secondary small align-start" onClick={() => setEntityEditOpen(true)}>{t('editDetails')}</button>
      <fieldset className="field-group compact-group"><legend>{t('geometry')}</legend>
        <div className="geometry-grid">
          <FormField label="X"><CommittedNumberInput value={selectedElement.x} min={0} max={1000 - selectedElement.width} onCommit={(value) => updateLayoutElement(selectedElement.id, { x: value })} /></FormField>
          <FormField label="Y"><CommittedNumberInput value={selectedElement.y} min={0} max={700 - selectedElement.height} onCommit={(value) => updateLayoutElement(selectedElement.id, { y: value })} /></FormField>
          <FormField label={t('width')}><CommittedNumberInput value={selectedElement.width} min={60} max={1000 - selectedElement.x} onCommit={(value) => updateLayoutElement(selectedElement.id, { width: value })} /></FormField>
          <FormField label={t('height')}><CommittedNumberInput value={selectedElement.height} min={50} max={700 - selectedElement.y} onCommit={(value) => updateLayoutElement(selectedElement.id, { height: value })} /></FormField>
        </div>
        <div className="rotation-row"><button className="button secondary small" onClick={() => void updateLayoutElement(selectedElement.id, { rotation: selectedElement.rotation - 15 })}>↺ 15°</button><strong>{selectedElement.rotation}°</strong><button className="button secondary small" onClick={() => void updateLayoutElement(selectedElement.id, { rotation: selectedElement.rotation + 15 })}>15° ↻</button></div>
      </fieldset>
      <fieldset className="field-group compact-group"><legend>{t('shape')}</legend>
        <div className="segmented two"><button className={selectedElement.shape === 'rect' ? 'selected' : ''} onClick={() => void updateLayoutElement(selectedElement.id, { shape: 'rect' })}>{t('rectangle')}</button><button className={selectedElement.shape === 'polygon' ? 'selected' : ''} onClick={() => void updateLayoutElement(selectedElement.id, { shape: 'polygon', points: selectedElement.points?.length ? selectedElement.points : defaultPolygon() })}>{t('polygon')}</button></div>
        {selectedElement.shape === 'polygon' && <div className="inline-fields polygon-tools"><button className="button secondary small" onClick={() => void updateLayoutElement(selectedElement.id, { points: addCorner(selectedElement.points ?? defaultPolygon()) })}>+ {t('corner')}</button><button className="button ghost small" disabled={(selectedElement.points?.length ?? 4) <= 3} onClick={() => void updateLayoutElement(selectedElement.id, { points: (selectedElement.points ?? defaultPolygon()).slice(0, -1) })}>− {t('corner')}</button></div>}
      </fieldset>
      <fieldset className="field-group compact-group"><legend>{t('appearance')}</legend>
        <div className="color-settings-grid">
          <FormField label={t('objectColor')}><input type="color" value={selectedElement.fillColor ?? (selectedElement.role === 'area' ? '#f1f4ef' : '#ffffff')} onChange={(event) => void updateLayoutElement(selectedElement.id, { fillColor: event.target.value })} /></FormField>
          <FormField label={t('textColor')}><input type="color" value={selectedElement.textColor ?? '#24332b'} onChange={(event) => void updateLayoutElement(selectedElement.id, { textColor: event.target.value })} /></FormField>
          <FormField label={t('textBackground')}><div className="color-with-clear"><input type="color" value={selectedElement.textBackgroundColor ?? '#ffffff'} onChange={(event) => void updateLayoutElement(selectedElement.id, { textBackgroundColor: event.target.value })} /><button type="button" className="button ghost tiny" onClick={() => void updateLayoutElement(selectedElement.id, { textBackgroundColor: undefined })}>{t('none')}</button></div></FormField>
        </div>
        <p className="muted compact-text">{t('contourColorHint')}</p>
      </fieldset>
      <fieldset className="field-group compact-group"><legend>{t('label')}</legend>
        <div className="segmented three"><button className={selectedElement.labelPosition === 'top' ? 'selected' : ''} onClick={() => void updateLayoutElement(selectedElement.id, { labelPosition: 'top' })}>{t('top')}</button><button className={selectedElement.labelPosition === 'center' ? 'selected' : ''} onClick={() => void updateLayoutElement(selectedElement.id, { labelPosition: 'center' })}>{t('center')}</button><button className={selectedElement.labelPosition === 'bottom' ? 'selected' : ''} onClick={() => void updateLayoutElement(selectedElement.id, { labelPosition: 'bottom' })}>{t('bottom')}</button></div>
        <div className="label-orientation-grid" aria-label={t('textOrientation')}><button type="button" className={(selectedElement.labelRotation ?? 0) === 0 ? 'selected' : ''} onClick={() => void updateLayoutElement(selectedElement.id, { labelRotation: 0 })}>{t('horizontal')}</button><button type="button" className={(selectedElement.labelRotation ?? 0) === -45 ? 'selected' : ''} onClick={() => void updateLayoutElement(selectedElement.id, { labelRotation: -45 })}>↗ {t('diagonal')}</button><button type="button" className={(selectedElement.labelRotation ?? 0) === 45 ? 'selected' : ''} onClick={() => void updateLayoutElement(selectedElement.id, { labelRotation: 45 })}>↘ {t('diagonal')}</button><button type="button" className={(selectedElement.labelRotation ?? 0) === -90 ? 'selected' : ''} onClick={() => void updateLayoutElement(selectedElement.id, { labelRotation: -90 })}>{t('vertical')}</button></div>
        <div className="geometry-grid label-settings-grid">
          <FormField label={t('textSize')}><CommittedNumberInput value={selectedElement.labelFontSize ?? 19} min={10} max={48} onCommit={(value) => updateLayoutElement(selectedElement.id, { labelFontSize: value })} /></FormField>
          <FormField label={t('textWidth')}><CommittedNumberInput value={selectedElement.labelWidth ?? Math.max(120, selectedElement.width)} min={40} max={1000} onCommit={(value) => updateLayoutElement(selectedElement.id, { labelWidth: value })} /></FormField>
        </div>
        <label className="snap-toggle label-wrap-toggle"><input type="checkbox" checked={selectedElement.labelWrap ?? false} onChange={(event) => void updateLayoutElement(selectedElement.id, { labelWrap: event.target.checked })} /> {t('wrapText')}</label>
        <p className="muted compact-text">{selectedElement.labelWrap ? t('wrapTextHint') : t('textOverflowHint')}</p>
      </fieldset>
      {relations.length > 0 && <section className="inspector-section"><h3>{t('connections')}</h3><div className="mini-list">{relations.map((relation) => <div className="mini-list-row" key={relation.id}><span>{relation.kind}{relation.label ? ` · ${relation.label}` : ''}</span><button className="icon-button danger-text" onClick={() => void archiveEntityRelation(relation.id)}>×</button></div>)}</div></section>}
      <div className="action-section stack tight-stack">
        <button className="button secondary" onClick={() => void updateLayoutElement(selectedElement.id, { zIndex: selectedElement.zIndex + 1 })}>{t('bringForward')}</button>
        <button className="button ghost" onClick={() => void updateLayoutElement(selectedElement.id, { zIndex: selectedElement.zIndex - 1 })}>{t('sendBackward')}</button>
        <button className="button danger-outline" onClick={() => { void archiveLayoutElement(selectedElement.id); setSelectedElementId(''); setSelectedEntityId('') }}>{t('removeFromLayout')}</button>
      </div>
    </div>
  }

  function SceneSheet({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState('')
    const [kind, setKind] = useState<LayoutSceneKind>('floor')
    async function submit(event: FormEvent) {
      event.preventDefault()
      const id = await addLayoutScene(name.trim(), kind)
      setActiveSceneId(id)
      setEditMode(true)
      onClose()
    }
    return <Sheet title={t('addFloorArea')} onClose={onClose}><form className="stack" onSubmit={submit}>
      <FormField label={t('name')}><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === 'floor' ? t('groundFloorExample') : t('gardenExample')} /></FormField>
      <FormField label={t('sceneType')}><div className="segmented two"><button type="button" className={kind === 'floor' ? 'selected' : ''} onClick={() => setKind('floor')}>{t('floor')}</button><button type="button" className={kind === 'outdoor' ? 'selected' : ''} onClick={() => setKind('outdoor')}>{t('outdoor')}</button></div></FormField>
      <button className="button primary">{t('save')}</button>
    </form></Sheet>
  }

  function SceneSettingsSheet({ onClose }: { onClose: () => void }) {
    if (!activeScene) return null
    const scene = activeScene
    const [name, setName] = useState(scene.name)
    const [kind, setKind] = useState<LayoutSceneKind>(scene.kind)
    const [backgroundColor, setBackgroundColor] = useState(scene.backgroundColor ?? '#f8f9f6')
    async function submit(event: FormEvent) { event.preventDefault(); await updateLayoutScene(scene.id, { name: name.trim(), kind, backgroundColor }); onClose() }
    return <Sheet title={t('sceneSettings')} onClose={onClose}><form className="stack" onSubmit={submit}>
      <FormField label={t('name')}><input required value={name} onChange={(event) => setName(event.target.value)} /></FormField>
      <FormField label={t('sceneType')}><div className="segmented two"><button type="button" className={kind === 'floor' ? 'selected' : ''} onClick={() => setKind('floor')}>{t('floor')}</button><button type="button" className={kind === 'outdoor' ? 'selected' : ''} onClick={() => setKind('outdoor')}>{t('outdoor')}</button></div></FormField>
      <FormField label={t('layoutBackground')}><input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} /></FormField>
      <div className="two-columns"><button type="button" className="button secondary" onClick={() => void updateLayoutScene(scene.id, { order: scene.order - 1 })}>{t('moveEarlier')}</button><button type="button" className="button secondary" onClick={() => void updateLayoutScene(scene.id, { order: scene.order + 1 })}>{t('moveLater')}</button></div>
      <button className="button primary">{t('save')}</button>
      <button type="button" className="button danger-outline" onClick={() => { if (window.confirm(t('confirmRemoveScene'))) { void archiveLayoutScene(scene.id); onClose() } }}>{t('removeScene')}</button>
    </form></Sheet>
  }

  function AddPlacementSheet({ role, onClose }: { role: LayoutRole; onClose: () => void }) {
    const [name, setName] = useState('')
    const [typeChoice, setTypeChoice] = useState(types[0]?.id ?? '__new__')
    const [newTypeName, setNewTypeName] = useState(role === 'area' ? (locale === 'it' ? 'Stanza' : 'Room') : (locale === 'it' ? 'Oggetto' : 'Item'))
    const [newTypeIcon, setNewTypeIcon] = useState(role === 'area' ? '□' : '·')
    const [parentId, setParentId] = useState(role === 'object' && selectedEntity ? selectedEntity.id : '')
    const [labels, setLabels] = useState('')
    const [shape, setShape] = useState<'rect' | 'polygon'>('rect')
    async function submit(event: FormEvent) {
      event.preventDefault()
      if (!activeSceneId) return
      let typeId = typeChoice
      if (typeChoice === '__new__') typeId = await addEntityType(newTypeName.trim() || (role === 'area' ? 'Room' : 'Item'), newTypeIcon.trim())
      const entityId = await addEntity({ name: name.trim(), typeId, parentId: parentId || undefined, labels: labels.split(',').map((value) => value.trim()).filter(Boolean), metadata: {} })
      const index = placedOnScene.length
      const width = role === 'area' ? 320 : 130
      const height = role === 'area' ? 220 : 100
      const x = 60 + (index * 45) % 520
      const y = 60 + (index * 35) % 360
      const elementId = await addLayoutElement({ sceneId: activeSceneId, entityId, role, shape, x, y, width, height, rotation: 0, zIndex: role === 'area' ? index : 100 + index, points: shape === 'polygon' ? defaultPolygon() : undefined, labelPosition: 'center' })
      setSelectedElementId(elementId); setSelectedEntityId(entityId)
      onClose()
    }
    return <Sheet title={role === 'area' ? t('addArea') : t('addObject')} onClose={onClose}><form className="stack" onSubmit={submit}>
      <FormField label={t('name')}><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></FormField>
      <FormField label={t('type')}><select value={typeChoice} onChange={(event) => setTypeChoice(event.target.value)}>{types.map((type) => <option key={type.id} value={type.id}>{type.icon ? `${type.icon} ` : ''}{type.name}</option>)}<option value="__new__">+ {t('newType')}</option></select></FormField>
      {typeChoice === '__new__' && <div className="two-columns"><FormField label={t('newType')}><input required value={newTypeName} onChange={(event) => setNewTypeName(event.target.value)} /></FormField><FormField label={t('icon')}><input maxLength={4} value={newTypeIcon} onChange={(event) => setNewTypeIcon(event.target.value)} /></FormField></div>}
      <FormField label={t('inside')}><select value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">{t('noParent')}</option>{groupedEntityOptions(entities)}</select></FormField>
      <FormField label={t('labels')} hint={t('commaSeparated')}><input value={labels} onChange={(event) => setLabels(event.target.value)} /></FormField>
      {role === 'area' && <FormField label={t('shape')}><div className="segmented two"><button type="button" className={shape === 'rect' ? 'selected' : ''} onClick={() => setShape('rect')}>{t('rectangle')}</button><button type="button" className={shape === 'polygon' ? 'selected' : ''} onClick={() => setShape('polygon')}>{t('polygon')}</button></div></FormField>}
      <button className="button primary">{t('addToLayout')}</button>
    </form></Sheet>
  }

  function PlaceExistingSheet({ onClose }: { onClose: () => void }) {
    const available = entities.filter((entity) => !placedOnScene.some((item) => item.entityId === entity.id))
    const [entityId, setEntityId] = useState(available[0]?.id ?? '')
    const hasChildren = entityId ? entities.some((item) => item.parentId === entityId) : false
    const [role, setRole] = useState<LayoutRole>(hasChildren ? 'area' : 'object')
    async function submit(event: FormEvent) {
      event.preventDefault()
      if (!activeSceneId || !entityId) return
      const index = placedOnScene.length
      const elementId = await addLayoutElement({ sceneId: activeSceneId, entityId, role, shape: 'rect', x: 70 + (index * 45) % 520, y: 70 + (index * 35) % 360, width: role === 'area' ? 320 : 130, height: role === 'area' ? 220 : 100, rotation: 0, zIndex: role === 'area' ? index : 100 + index, labelPosition: 'center' })
      setSelectedElementId(elementId); setSelectedEntityId(entityId)
      onClose()
    }
    return <Sheet title={t('placeExisting')} onClose={onClose}>{!available.length ? <EmptyState>{t('everythingPlaced')}</EmptyState> : <form className="stack" onSubmit={submit}>
      <FormField label={t('itemsPlaces')}><select value={entityId} onChange={(event) => { const value = event.target.value; setEntityId(value); setRole(entities.some((item) => item.parentId === value) ? 'area' : 'object') }}>{groupedEntityOptions(available)}</select></FormField>
      <FormField label={t('displayAs')}><div className="segmented two"><button type="button" className={role === 'area' ? 'selected' : ''} onClick={() => setRole('area')}>{t('area')}</button><button type="button" className={role === 'object' ? 'selected' : ''} onClick={() => setRole('object')}>{t('item')}</button></div></FormField>
      <button className="button primary">{t('addToLayout')}</button>
    </form>}</Sheet>
  }

  function ConnectionSheet({ onClose }: { onClose: () => void }) {
    const placedEntities = placedOnScene.map((item) => entities.find((entity) => entity.id === item.entityId)).filter((item): item is Entity => Boolean(item))
    const [fromEntityId, setFromEntityId] = useState(selectedEntity?.id && placedEntities.some((item) => item.id === selectedEntity.id) ? selectedEntity.id : placedEntities[0]?.id ?? '')
    const [destination, setDestination] = useState(() => {
      const other = placedEntities.find((item) => item.id !== fromEntityId)
      const otherScene = scenes.find((scene) => scene.id !== activeSceneId)
      return other ? `entity:${other.id}` : otherScene ? `scene:${otherScene.id}` : ''
    })
    const [kind, setKind] = useState<RelationKind>('door')
    const [label, setLabel] = useState('')
    async function submit(event: FormEvent) {
      event.preventDefault()
      if (!fromEntityId || !destination) return
      const [destinationKind, id] = destination.split(':')
      await addEntityRelation({ fromEntityId, toEntityId: destinationKind === 'entity' ? id : undefined, targetSceneId: destinationKind === 'scene' ? id : undefined, kind, label: label.trim() || undefined })
      onClose()
    }
    const destinations = [
      ...placedEntities.filter((item) => item.id !== fromEntityId).map((item) => ({ value: `entity:${item.id}`, label: item.name })),
      ...scenes.filter((scene) => scene.id !== activeSceneId).map((scene) => ({ value: `scene:${scene.id}`, label: `↕ ${scene.name}` })),
    ]
    return <Sheet title={t('addConnection')} onClose={onClose}>{!destinations.length ? <EmptyState>{t('needConnectionDestination')}</EmptyState> : <form className="stack" onSubmit={submit}>
      <FormField label={t('from')}><select value={fromEntityId} onChange={(event) => setFromEntityId(event.target.value)}>{groupedEntityOptions(placedEntities)}</select></FormField>
      <FormField label={t('to')}><select required value={destination} onChange={(event) => setDestination(event.target.value)}><optgroup label={locale === 'it' ? 'Stanze e oggetti' : 'Rooms and items'}>{destinations.filter((item) => item.value.startsWith('entity:')).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup><optgroup label={locale === 'it' ? 'Piani / aree' : 'Floors / areas'}>{destinations.filter((item) => item.value.startsWith('scene:')).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup></select></FormField>
      <FormField label={t('connectionType')}><select value={kind} onChange={(event) => setKind(event.target.value as RelationKind)}><option value="door">{t('door')}</option><option value="passage">{t('passage')}</option><option value="stairs">{t('stairs')}</option><option value="link">{t('link')}</option></select></FormField>
      <FormField label={t('label')}><input value={label} onChange={(event) => setLabel(event.target.value)} /></FormField>
      <button className="button primary">{t('save')}</button>
    </form>}</Sheet>
  }

  function StructureSheet({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState('')
    const [icon, setIcon] = useState('')
    async function addType(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; await addEntityType(name.trim(), icon.trim()); setName(''); setIcon('') }
    const roots = entities.filter((entity) => !entity.parentId || !entities.some((candidate) => candidate.id === entity.parentId))
    return <Sheet title={t('structureTypes')} onClose={onClose}><div className="stack">
      <section><h3>{t('entityTypes')}</h3><form className="inline-form type-inline" onSubmit={addType}><input required placeholder={t('name')} value={name} onChange={(event) => setName(event.target.value)} /><input className="icon-input" maxLength={4} placeholder={t('icon')} value={icon} onChange={(event) => setIcon(event.target.value)} /><button className="button secondary small">+</button></form><div className="chip-list">{types.map((type) => <span className="chip" key={type.id}>{type.icon && <span>{type.icon}</span>}{type.name}<button disabled={entities.some((entity) => entity.typeId === type.id)} onClick={() => void archiveEntityType(type.id)}>×</button></span>)}</div></section>
      <section><h3>{t('itemsPlaces')}</h3><div className="structure-tree">{roots.map((entity) => <StructureNode key={entity.id} entity={entity} depth={0} />)}</div></section>
    </div></Sheet>
  }

  function StructureNode({ entity, depth }: { entity: Entity; depth: number }) {
    const children = entities.filter((item) => item.parentId === entity.id)
    const type = types.find((item) => item.id === entity.typeId)
    return <><button className="structure-row" style={{ paddingLeft: 12 + depth * 18 }} onClick={() => { setSelectedEntityId(entity.id); const placement = data!.layoutElements.find((item) => !item.archivedAt && item.entityId === entity.id); setSelectedElementId(placement?.id ?? ''); setEntityEditOpen(true) }}><span>{type?.icon || '·'}</span><span><strong>{entity.name}</strong><small>{type?.name}</small></span></button>{children.map((child) => <StructureNode key={child.id} entity={child} depth={depth + 1} />)}</>
  }

  function EntitySheet({ entity, onClose }: { entity: Entity; onClose: () => void }) {
    const fields = data!.fieldDefinitions.filter((field) => !field.archivedAt && field.target === 'entity')
    const [name, setName] = useState(entity.name)
    const [typeId, setTypeId] = useState(entity.typeId)
    const [parentId, setParentId] = useState(entity.parentId ?? '')
    const [labels, setLabels] = useState(entity.labels.join(', '))
    const [metadata, setMetadata] = useState<Record<string, MetadataValue>>(entity.metadata)
    const unavailable = new Set([entity.id, ...descendantIds(entity.id)])
    async function submit(event: FormEvent) { event.preventDefault(); await updateEntity(entity.id, { name: name.trim(), typeId, parentId: parentId || undefined, labels: labels.split(',').map((value) => value.trim()).filter(Boolean), metadata }); onClose() }
    return <Sheet title={t('editDetails')} onClose={onClose}><form className="stack" onSubmit={submit}>
      <FormField label={t('name')}><input required autoFocus value={name} onChange={(event) => setName(event.target.value)} /></FormField>
      <FormField label={t('type')}><select value={typeId} onChange={(event) => setTypeId(event.target.value)}>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></FormField>
      <FormField label={t('inside')}><select value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">{t('noParent')}</option>{groupedEntityOptions(entities.filter((item) => !unavailable.has(item.id)))}</select></FormField>
      <FormField label={t('labels')}><input value={labels} onChange={(event) => setLabels(event.target.value)} /></FormField>
      <MetadataFields definitions={fields} values={metadata} onChange={setMetadata} />
      <button className="button primary">{t('save')}</button>
      <button type="button" className="button danger-outline" disabled={data!.routines.some((routine) => !routine.archivedAt && routine.targetEntityIds.includes(entity.id))} onClick={() => { if (window.confirm(t('confirmArchiveEntity'))) { void archiveEntity(entity.id); onClose() } }}>{t('archive')}</button>
    </form></Sheet>
  }

  function descendantIds(parentId: string): string[] {
    const direct = entities.filter((item) => item.parentId === parentId)
    return direct.flatMap((item) => [item.id, ...descendantIds(item.id)])
  }
}

function CleanlinessSummary({ label, score, deep = false }: { label: string; score: number | null; deep?: boolean }) {
  const { t } = useI18n()
  const rounded = score == null ? null : Math.round(score)
  const display = rounded == null ? t('notTracked') : `${rounded}%`
  return <div className={`home-cleanliness-row${deep ? ' deep' : ''}`}>
    <div className="home-cleanliness-label"><span>{label}</span><strong><CleanlinessMood score={score} /> {display}</strong></div>
    <div className="home-cleanliness-track" aria-label={`${label}: ${display}`}><span style={{ width: `${rounded ?? 0}%` }} /></div>
  </div>
}

function CommittedNumberInput({ value, min, max, onCommit }: { value: number; min: number; max: number; onCommit: (value: number) => void | Promise<void> }) {
  const [draft, setDraft] = useState(String(Math.round(value)))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(String(Math.round(value)))
  }, [value])

  function commit() {
    focused.current = false
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) { setDraft(String(Math.round(value))); return }
    const next = Math.max(min, Math.min(max, parsed))
    setDraft(String(Math.round(next)))
    if (next !== value) void onCommit(next)
  }

  return <input
    type="number"
    inputMode="numeric"
    min={min}
    max={max}
    value={draft}
    onFocus={(event) => { focused.current = true; event.currentTarget.select() }}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={commit}
    onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.blur()
      if (event.key === 'Escape') { setDraft(String(Math.round(value))); event.currentTarget.blur() }
    }}
  />
}

function defaultPolygon() {
  return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
}

function addCorner(points: { x: number; y: number }[]) {
  if (points.length < 2) return defaultPolygon()
  let bestIndex = 0
  let bestDistance = -1
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    const distance = (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    if (distance > bestDistance) { bestDistance = distance; bestIndex = index }
  }
  const a = points[bestIndex]
  const b = points[(bestIndex + 1) % points.length]
  const next = [...points]
  next.splice(bestIndex + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  return next
}
