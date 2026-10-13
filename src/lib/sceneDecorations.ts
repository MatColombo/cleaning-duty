/** Phase 19B: explicit scene decoration instructions only. Never store procedural defaults or SVG. */
import type { WorkspaceData } from '../types/domain'
import { HOME_ILLUSTRATION_GENERATOR } from './homeIllustration'
export const SCENE_DECORATION_SCHEMA = 1
export const SCENE_DECORATION_MAX_BYTES = 6144
export const SCENE_DECORATION_MAX_ITEMS = 16
export const SCENE_PROPS = ['plant','rug','lamp','shelf','starburst','tiles','sofa','counter','picture'] as const
export const SCENE_INKS = ['teal','coral','mustard','ink'] as const
export const SCENE_LAYERS = ['behind','above'] as const
export type SceneProp = typeof SCENE_PROPS[number]
export type SceneInk = typeof SCENE_INKS[number]
export type SceneLayer = typeof SCENE_LAYERS[number]
export interface SceneDecoration {
  id: string
  kind: SceneProp
  ink: SceneInk
  layer: SceneLayer
  x: number
  y: number
  scale: number
  rotation: number
  /** Optional existing placement anchor. Renderer ignores missing/archived anchors. */
  elementId?: string
}
export interface SceneDecorationRow {
  workspaceId: string
  sceneId: string
  generatorVersion: number
  schemaVersion: number
  items: SceneDecoration[]
  revision: number
  lastMutationId: string
  updatedAt: string
  orphanedAt?: string
}
export interface SceneDecorationMutation {
  workspaceId: string
  sceneId: string
  expectedRevision: number
  generatorVersion: number
  items: SceneDecoration[]
}
const safeId = /^[a-zA-Z0-9_-]{1,80}$/
const allowedKeys = new Set(['id','kind','ink','layer','x','y','scale','rotation','elementId'])
const numeric = (value: unknown, min: number, max: number, step: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    && Math.abs(Math.round(value / step) * step - value) < 1e-6
export function validatedSceneDecorations(value: unknown): SceneDecoration[] {
  if (!Array.isArray(value) || value.length > SCENE_DECORATION_MAX_ITEMS) throw new Error('Invalid scene decoration list (maximum 16 items).')
  const seen = new Set<string>()
  const items: SceneDecoration[] = value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid scene decoration.')
    const row = item as Record<string, unknown>
    if (Object.keys(row).some(key => !allowedKeys.has(key))) throw new Error('Unsupported decoration property.')
    if (typeof row.id !== 'string' || !safeId.test(row.id) || seen.has(row.id)) throw new Error('Invalid or duplicate decoration ID.')
    seen.add(row.id)
    if (!SCENE_PROPS.includes(row.kind as SceneProp) || !SCENE_INKS.includes(row.ink as SceneInk)
      || !SCENE_LAYERS.includes(row.layer as SceneLayer)) throw new Error('Unsupported decoration preset.')
    if (!numeric(row.x,0,1000,1) || !numeric(row.y,0,700,1) || !numeric(row.scale,.5,2,.1)
      || !numeric(row.rotation,-180,180,15)) throw new Error('Decoration geometry outside approved bounds.')
    if (row.elementId !== undefined && (typeof row.elementId !== 'string' || !safeId.test(row.elementId))) throw new Error('Invalid element anchor ID.')
    return { id: row.id, kind: row.kind as SceneProp, ink: row.ink as SceneInk, layer: row.layer as SceneLayer,
      x: row.x as number, y: row.y as number, scale: row.scale as number, rotation: row.rotation as number,
      ...(row.elementId ? { elementId: row.elementId as string } : {}) }
  })
  if (new TextEncoder().encode(JSON.stringify(items)).length > SCENE_DECORATION_MAX_BYTES) throw new Error('Decoration JSON exceeds 6 KiB.')
  return items
}
export function sceneExists(data: WorkspaceData, sceneId: string): boolean {
  return data.layoutScenes.some(scene => scene.id === sceneId && !scene.archivedAt)
}
export function sceneRow(data: WorkspaceData, sceneId: string): SceneDecorationRow | undefined {
  return data.sceneDecorations?.find(row => row.sceneId === sceneId && !row.orphanedAt)
}
export function readableSceneDecorations(data: WorkspaceData, sceneId: string): SceneDecoration[] {
  if (!sceneExists(data, sceneId)) return []
  const row = sceneRow(data, sceneId)
  if (!row || row.generatorVersion !== HOME_ILLUSTRATION_GENERATOR || row.schemaVersion !== SCENE_DECORATION_SCHEMA) return []
  try {
    return validatedSceneDecorations(row.items).filter(item => !item.elementId || data.layoutElements.some(element =>
      !element.archivedAt && element.sceneId === sceneId && element.id === item.elementId))
  } catch { return [] }
}
export function overlaySceneMutation(data: WorkspaceData, mutation: SceneDecorationMutation, id: string, at: string): WorkspaceData {
  if (data.workspace.id !== mutation.workspaceId || !sceneExists(data, mutation.sceneId)) return data
  const items = validatedSceneDecorations(mutation.items)
  const row: SceneDecorationRow = { workspaceId: data.workspace.id, sceneId: mutation.sceneId, items,
    generatorVersion: mutation.generatorVersion, schemaVersion: SCENE_DECORATION_SCHEMA,
    revision: mutation.expectedRevision + 1, lastMutationId: id, updatedAt: at }
  return { ...data, sceneDecorations: [...(data.sceneDecorations ?? []).filter(x => x.sceneId !== mutation.sceneId), row] }
}
export function sceneMutationConfirmed(data: WorkspaceData, mutation: SceneDecorationMutation, id: string): boolean {
  const row = sceneRow(data, mutation.sceneId)
  return Boolean(row && row.lastMutationId === id && row.revision === mutation.expectedRevision + 1)
}
export function prepareSceneDecorationImport(value: unknown, data: WorkspaceData): SceneDecorationRow[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 200) throw new Error('Invalid scene decoration backup collection.')
  const unique = new Set<string>()
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid scene decoration backup row.')
    const row = item as Record<string, unknown>
    if (typeof row.sceneId !== 'string' || unique.has(row.sceneId) || !data.layoutScenes.some(s => s.id === row.sceneId)) throw new Error('Backup references a missing or duplicate Home scene.')
    unique.add(row.sceneId)
    if (row.generatorVersion !== HOME_ILLUSTRATION_GENERATOR || row.schemaVersion !== SCENE_DECORATION_SCHEMA
      || !Number.isSafeInteger(row.revision) || (row.revision as number) < 1
      || typeof row.lastMutationId !== 'string' || typeof row.updatedAt !== 'string') throw new Error('Unsupported scene decoration backup version or revision.')
    if (row.orphanedAt && typeof row.orphanedAt !== 'string') throw new Error('Invalid scene orphan marker.')
    return { workspaceId: data.workspace.id, sceneId: row.sceneId, items: validatedSceneDecorations(row.items),
      generatorVersion: HOME_ILLUSTRATION_GENERATOR, schemaVersion: SCENE_DECORATION_SCHEMA,
      revision: row.revision as number, lastMutationId: row.lastMutationId, updatedAt: row.updatedAt,
      ...(row.orphanedAt ? { orphanedAt: row.orphanedAt as string } : {}) }
  })
}
