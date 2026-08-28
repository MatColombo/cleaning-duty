import type { Locale, WorkspaceData } from '../types/domain'
import { newId, nowIso } from './id'

export function canApplyStarterPack(data: WorkspaceData) {
  return !data.entityTypes.some((item) => !item.archivedAt)
    && !data.entities.some((item) => !item.archivedAt)
    && !data.actions.some((item) => !item.archivedAt)
    && !data.supplies.some((item) => !item.archivedAt)
    && !data.layoutScenes.some((item) => !item.archivedAt)
}

export function applyStarterPack(data: WorkspaceData, locale: Locale): WorkspaceData {
  if (!canApplyStarterPack(data)) throw new Error(locale === 'it' ? 'Il pacchetto iniziale è disponibile solo per una casa vuota.' : 'The starter pack is available only for an empty household.')
  const workspaceId = data.workspace.id
  const createdAt = nowIso()
  const text = locale === 'it' ? {
    room: 'Stanza', surface: 'Superficie', furniture: 'Arredo', appliance: 'Elettrodomestico',
    kitchen: 'Cucina', bathroom: 'Bagno', bedroom: 'Camera', living: 'Soggiorno', floor: 'Pavimento', counter: 'Piano cucina', sink: 'Lavandino', bed: 'Letto', sofa: 'Divano',
    mop: 'Passare il mocio', vacuum: 'Aspirare', wipe: 'Pulire superficie', linen: 'Cambiare lenzuola', check: 'Controllare',
    floorCleaner: 'Detergente pavimenti', generalCleaner: 'Detergente multiuso', sponges: 'Spugne', ground: 'Piano terra',
    mopLabel: 'lavabile', vacuumLabel: 'aspirabile', dustLabel: 'spolverabile', wetLabel: 'zona-umida',
  } : {
    room: 'Room', surface: 'Surface', furniture: 'Furniture', appliance: 'Appliance',
    kitchen: 'Kitchen', bathroom: 'Bathroom', bedroom: 'Bedroom', living: 'Living room', floor: 'Floor', counter: 'Counter', sink: 'Sink', bed: 'Bed', sofa: 'Sofa',
    mop: 'Mop', vacuum: 'Vacuum', wipe: 'Wipe surface', linen: 'Change bed linen', check: 'Check',
    floorCleaner: 'Floor cleaner', generalCleaner: 'General cleaner', sponges: 'Sponges', ground: 'Ground floor',
    mopLabel: 'moppable', vacuumLabel: 'vacuumable', dustLabel: 'dustable', wetLabel: 'wet-area',
  }
  const typeIds = { room: newId(), surface: newId(), furniture: newId(), appliance: newId() }
  const entityTypes = [
    { id: typeIds.room, workspaceId, name: text.room, icon: '▭', createdAt },
    { id: typeIds.surface, workspaceId, name: text.surface, icon: '▱', createdAt },
    { id: typeIds.furniture, workspaceId, name: text.furniture, icon: '□', createdAt },
    { id: typeIds.appliance, workspaceId, name: text.appliance, icon: '◫', createdAt },
  ]
  const kitchen = newId(), bathroom = newId(), bedroom = newId(), living = newId()
  const entities = [
    { id: kitchen, workspaceId, typeId: typeIds.room, name: text.kitchen, labels: ['food-area'], metadata: {}, createdAt },
    { id: bathroom, workspaceId, typeId: typeIds.room, name: text.bathroom, labels: [text.wetLabel], metadata: {}, createdAt },
    { id: bedroom, workspaceId, typeId: typeIds.room, name: text.bedroom, labels: [], metadata: {}, createdAt },
    { id: living, workspaceId, typeId: typeIds.room, name: text.living, labels: [], metadata: {}, createdAt },
    { id: newId(), workspaceId, typeId: typeIds.surface, parentId: kitchen, name: `${text.kitchen} ${text.floor.toLowerCase()}`, labels: [text.mopLabel, text.vacuumLabel], metadata: {}, createdAt },
    { id: newId(), workspaceId, typeId: typeIds.surface, parentId: kitchen, name: text.counter, labels: [text.dustLabel], metadata: {}, createdAt },
    { id: newId(), workspaceId, typeId: typeIds.surface, parentId: kitchen, name: text.sink, labels: [text.wetLabel], metadata: {}, createdAt },
    { id: newId(), workspaceId, typeId: typeIds.surface, parentId: bathroom, name: `${text.bathroom} ${text.floor.toLowerCase()}`, labels: [text.mopLabel, text.vacuumLabel], metadata: {}, createdAt },
    { id: newId(), workspaceId, typeId: typeIds.surface, parentId: bathroom, name: text.sink, labels: [text.wetLabel], metadata: {}, createdAt },
    { id: newId(), workspaceId, typeId: typeIds.surface, parentId: bedroom, name: `${text.bedroom} ${text.floor.toLowerCase()}`, labels: [text.vacuumLabel], metadata: {}, createdAt },
    { id: newId(), workspaceId, typeId: typeIds.furniture, parentId: bedroom, name: text.bed, labels: [text.dustLabel], metadata: {}, createdAt },
    { id: newId(), workspaceId, typeId: typeIds.surface, parentId: living, name: `${text.living} ${text.floor.toLowerCase()}`, labels: [text.vacuumLabel], metadata: {}, createdAt },
    { id: newId(), workspaceId, typeId: typeIds.furniture, parentId: living, name: text.sofa, labels: [text.dustLabel], metadata: {}, createdAt },
  ]
  const floorCleaner = newId(), generalCleaner = newId(), sponges = newId()
  const supplies = [
    { id: floorCleaner, workspaceId, name: text.floorCleaner, status: 'available' as const, metadata: {}, version: 1, createdAt },
    { id: generalCleaner, workspaceId, name: text.generalCleaner, status: 'available' as const, metadata: {}, version: 1, createdAt },
    { id: sponges, workspaceId, name: text.sponges, status: 'available' as const, metadata: {}, version: 1, createdAt },
  ]
  const actions = [
    { id: newId(), workspaceId, name: text.mop, icon: '≈', instructions: '', defaultSupplyIds: [floorCleaner], metadata: {}, revision: 1, createdAt },
    { id: newId(), workspaceId, name: text.vacuum, icon: '↯', instructions: '', defaultSupplyIds: [], metadata: {}, revision: 1, createdAt },
    { id: newId(), workspaceId, name: text.wipe, icon: '◇', instructions: '', defaultSupplyIds: [generalCleaner, sponges], metadata: {}, revision: 1, createdAt },
    { id: newId(), workspaceId, name: text.linen, icon: '▤', instructions: '', defaultSupplyIds: [], metadata: {}, revision: 1, createdAt },
    { id: newId(), workspaceId, name: text.check, icon: '✓', instructions: '', defaultSupplyIds: [], metadata: {}, revision: 1, createdAt },
  ]
  const sceneId = newId()
  const layoutScenes = [{ id: sceneId, workspaceId, name: text.ground, kind: 'floor' as const, order: 0, createdAt }]
  const roomGeometry = [
    [kitchen, 45, 45, 430, 300], [living, 495, 45, 460, 300], [bathroom, 45, 365, 280, 250], [bedroom, 345, 365, 610, 250],
  ] as const
  const layoutElements = roomGeometry.map(([entityId, x, y, width, height], index) => ({
    id: newId(), workspaceId, sceneId, entityId, role: 'area' as const, shape: 'rect' as const,
    x, y, width, height, rotation: 0, zIndex: index + 1, labelPosition: 'center' as const, createdAt,
  }))
  const supplyEvents = supplies.map((supply) => ({ id: newId(), workspaceId, supplyId: supply.id, type: 'SUPPLY_CREATED' as const, at: createdAt, metadata: { status: supply.status } }))
  return { ...data, entityTypes: [...data.entityTypes, ...entityTypes], entities: [...data.entities, ...entities], supplies: [...data.supplies, ...supplies], supplyEvents: [...data.supplyEvents, ...supplyEvents], actions: [...data.actions, ...actions], layoutScenes: [...data.layoutScenes, ...layoutScenes], layoutElements: [...data.layoutElements, ...layoutElements] }
}
