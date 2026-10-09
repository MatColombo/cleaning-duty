import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { HomeStatusHeader } from '../components/home/HomeStatusHeader'
import { HomeInspector } from '../components/home/HomeInspector'
import { RoomModeController } from '../components/home/RoomModeController'
import { resolveHomeItemSelection } from '../components/home/homeSelection'
import { EmptyState } from '../components/EmptyState'
import { FormField } from '../components/FormField'
import { HomeLayoutCanvas } from '../components/HomeLayoutCanvas'
import { SvgCharacter } from '../visual/SvgCharacter'
import { MetadataFields } from '../components/MetadataFields'
import { Sheet } from '../components/Sheet'
import { useData } from '../contexts/DataContext'
import { useI18n } from '../contexts/I18nContext'
import { careEstimateForEntity, homeCleanlinessSummary, scheduledTasksForEntity, supplyAlertsForEntity } from '../lib/home'
import { buildRoomWorkflow, roomStatusMap } from '../lib/room'
import type { Entity, LayoutRole, LayoutSceneKind, MetadataValue, RelationKind, TaskOccurrence } from '../types/domain'

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
  const location = useLocation()
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
  // Existing critical-item links use /home?item=<entityId>. Select their real
  // layout placement (if present) without making placement the semantic source.
  useEffect(() => {
    if (!data) return
    const resolved = resolveHomeItemSelection(data, new URLSearchParams(location.search).get('item'))
    if (!resolved) return
    setSelectedElementId(resolved.elementId)
    setSelectedEntityId(resolved.entityId)
    if (resolved.sceneId) setActiveSceneId(resolved.sceneId)
  }, [location.search, data?.workspace.id])
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

  return <div className={`stack page-stack home-page v2-home-page ${editMode ? "is-editing" : "is-viewing"}`}>
    <HomeStatusHeader editMode={editMode} hasScenes={scenes.length > 0}
      regular={homeCleanliness.regular} deep={homeCleanliness.deep}
      onToggleEdit={() => { setEditMode((value) => !value); setSelectedElementId('') }} />

    {!scenes.length ? <section className="empty-layout card section-card">
      <span className="v2-home-empty-layout-art" aria-hidden="true"><SvgCharacter id="house" decorative expression="smile" pose="wave" misregistration={false} /></span>
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
        <section className="layout-card card v2-home-layout-card">
          <div className="v2-home-layout-caption"><strong>{activeScene?.name ?? t('home')}</strong>
            {!editMode && <span className="v2-home-layout-key"><span className="v2-home-map-key overdue" />{t('overdue')}<span className="v2-home-map-key due" />{t('dueTodayShort')}</span>}
          </div>
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
      <section className={`home-inspector home-selection-details v2-home-inspector${selectedIsRoom && !editMode ? ' room-detail-open' : ''}`}>
        {editMode ? <EditorInspector /> : <HomeInspector data={data} selectedEntity={selectedEntity}
          selectedType={types.find((item) => item.id === selectedEntity?.typeId)} selectedCare={selectedCare}
          selectedTasks={selectedTasks} selectedSupplies={selectedSupplies} isRoom={selectedIsRoom}
          roomWorkflow={selectedRoomWorkflow} now={clockNow}
          onClose={() => { setSelectedElementId(''); setSelectedEntityId('') }} onStartRoom={startRoom} />}
      </section>
    </>}

    {sceneOpen && <SceneSheet onClose={() => setSceneOpen(false)} />}
    {sceneEditOpen && activeScene && <SceneSettingsSheet onClose={() => setSceneEditOpen(false)} />}
    {placementRole && <AddPlacementSheet role={placementRole} onClose={() => setPlacementRole(null)} />}
    {placeExistingOpen && <PlaceExistingSheet onClose={() => setPlaceExistingOpen(false)} />}
    {connectionOpen && <ConnectionSheet onClose={() => setConnectionOpen(false)} />}
    {typesOpen && <StructureSheet onClose={() => setTypesOpen(false)} />}
    {entityEditOpen && selectedEntity && <EntitySheet entity={selectedEntity} onClose={() => setEntityEditOpen(false)} />}
    {roomModeEntityId && entities.find((entity) => entity.id === roomModeEntityId) && <RoomModeController
      room={entities.find((entity) => entity.id === roomModeEntityId)!} data={data} now={clockNow}
      handled={roomSessionHandled} deferredIds={roomDeferredIds} onDeferredIds={setRoomDeferredIds}
      onHandled={setRoomSessionHandled} onRememberUndo={(task, eventId, verb) => rememberUndo(task, eventId, verb, true)}
      completeTask={completeTask} skipTask={skipTask} onClose={() => setRoomModeEntityId(null)} />}
    {undo && <div className="undo-snackbar" role="status"><span>{undo.message}</span><button onClick={() => void undoLast()}>{t('undo')}</button></div>}
  </div>


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
