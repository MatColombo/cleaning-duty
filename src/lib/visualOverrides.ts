import type { WorkspaceData } from '../types/domain'
import { HOUSE_CARE_VISUAL_VERSION } from '../visual/version'
import { sanitizeStudioOverrides, type StudioOverrides } from '../visual/studio/draft'

export const VISUAL_OVERRIDE_SCHEMA = 1
export const VISUAL_OVERRIDE_MAX_BYTES = 2048
export const VISUAL_SUBJECT_KINDS = ['routine', 'action', 'entity'] as const
export type VisualSubjectKind = typeof VISUAL_SUBJECT_KINDS[number]
export interface VisualOverrideRow {
  workspaceId: string
  subjectType: VisualSubjectKind
  subjectId: string
  generatorVersion: number
  schemaVersion: number
  overrides: StudioOverrides
  revision: number
  lastMutationId: string
  updatedAt: string
}
export interface VisualOverrideMutation {
  workspaceId: string
  subjectType: VisualSubjectKind
  subjectId: string
  expectedRevision: number
  generatorVersion: number
  overrides: StudioOverrides
}
export function visualKey(kind: VisualSubjectKind, id: string): string { return `${kind}:${id}` }
export function visualSubjectExists(data: WorkspaceData, kind: VisualSubjectKind, id: string): boolean {
  const items = kind === 'routine' ? data.routines : kind === 'action' ? data.actions : data.entities
  return items.some((item) => item.id === id)
}
export function validVisualSubject(data: WorkspaceData, kind: VisualSubjectKind, id: string): boolean {
  const items = kind === 'routine' ? data.routines : kind === 'action' ? data.actions : data.entities
  return items.some((item) => item.id === id && !item.archivedAt)
}
export function validatedVisualOverrides(value: unknown): StudioOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid visual override JSON.')
  const source = value as Record<string, unknown>
  const clean = sanitizeStudioOverrides(source)
  // Persist only canonical enum keys and bounded numeric values; do not silently
  // strip potentially dangerous/unrecognized content from a cloud save.
  if (Object.keys(source).some((key) => !(key in clean))) {
    // Auto-equivalent values (none / standard) may be omitted by sanitizer.
    const allowedDefaults: Record<string, string> = { prop: 'none', proportion: 'standard', animation: 'none' }
    if (Object.keys(source).some((key) => !(key in clean) && source[key] !== allowedDefaults[key])) throw new Error('Unsupported visual override field or value.')
  }
  if (typeof source.scale === 'number' && clean.scale !== source.scale) throw new Error('Visual scale must be within range and aligned to 0.05 steps.')
  const bytes = new TextEncoder().encode(JSON.stringify(clean)).length
  if (bytes > VISUAL_OVERRIDE_MAX_BYTES) throw new Error('Visual override exceeds the 2 KiB limit.')
  return clean
}
export function rowForVisualMutation(data: WorkspaceData, mutation: VisualOverrideMutation, id: string, at: string): VisualOverrideRow {
  if (!validVisualSubject(data, mutation.subjectType, mutation.subjectId)) throw new Error('Visual subject is not in this household.')
  const overrides = validatedVisualOverrides(mutation.overrides)
  return { workspaceId: data.workspace.id, subjectType: mutation.subjectType, subjectId: mutation.subjectId,
    generatorVersion: mutation.generatorVersion, schemaVersion: VISUAL_OVERRIDE_SCHEMA, overrides,
    revision: mutation.expectedRevision + 1, lastMutationId: id, updatedAt: at }
}
export function overlayVisualMutation(data: WorkspaceData, mutation: VisualOverrideMutation, id: string, at: string): WorkspaceData {
  if (data.workspace.id !== mutation.workspaceId) return data
  const newRow = rowForVisualMutation(data, mutation, id, at)
  const rows = (data.visualOverrides ?? []).filter((row) => visualKey(row.subjectType, row.subjectId) !== visualKey(mutation.subjectType, mutation.subjectId))
  return { ...data, visualOverrides: [...rows, newRow] }
}
export function readableVisualOverride(data: WorkspaceData, kind: VisualSubjectKind, id: string): StudioOverrides | undefined {
  const row = data.visualOverrides?.find((entry) => entry.subjectType === kind && entry.subjectId === id)
  if (!row || row.generatorVersion !== HOUSE_CARE_VISUAL_VERSION || row.schemaVersion !== VISUAL_OVERRIDE_SCHEMA
    || !validVisualSubject(data, kind, id)) return undefined
  try { return validatedVisualOverrides(row.overrides) } catch { return undefined }
}
export function visualMutationConfirmed(data: WorkspaceData, mutation: VisualOverrideMutation, id: string): boolean {
  return Boolean(data.visualOverrides?.some((row) => row.subjectType === mutation.subjectType && row.subjectId === mutation.subjectId
    && row.revision === mutation.expectedRevision + 1 && row.lastMutationId === id))
}
/** For backup v10: reject invalid/orphan rows rather than re-scope foreign IDs. */
export function prepareVisualOverrideImport(rows: unknown, data: WorkspaceData): VisualOverrideRow[] {
  if (rows == null) return []
  if (!Array.isArray(rows) || rows.length > 1000) throw new Error('Invalid visual override backup collection.')
  const unique = new Set<string>()
  return rows.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid visual override backup row.')
    const row = value as Record<string, unknown>
    const kind = row.subjectType
    if (!VISUAL_SUBJECT_KINDS.includes(kind as VisualSubjectKind) || typeof row.subjectId !== 'string' || !visualSubjectExists(data, kind as VisualSubjectKind, row.subjectId)) throw new Error('Backup visual override refers to an unknown subject.')
    const key = visualKey(kind as VisualSubjectKind, row.subjectId)
    if (unique.has(key)) throw new Error('Duplicate visual override in backup.')
    unique.add(key)
    if (row.generatorVersion !== HOUSE_CARE_VISUAL_VERSION || row.schemaVersion !== VISUAL_OVERRIDE_SCHEMA) {
      // Fail closed for unknown backup format; an existing cloud row can remain
      // opaque without being silently rewritten by an older client.
      throw new Error('Backup visual override uses an unsupported generator or schema version.')
    }
    if (!Number.isSafeInteger(row.revision) || (row.revision as number) < 1 || typeof row.lastMutationId !== 'string' || typeof row.updatedAt !== 'string') throw new Error('Malformed visual override revision.')
    const overrides = validatedVisualOverrides(row.overrides)
    if (new TextEncoder().encode(JSON.stringify(overrides)).length > VISUAL_OVERRIDE_MAX_BYTES) throw new Error('Oversized visual override backup.')
    return { workspaceId: data.workspace.id, subjectType: kind as VisualSubjectKind, subjectId: row.subjectId,
      generatorVersion: row.generatorVersion as number, schemaVersion: row.schemaVersion as number, overrides,
      revision: row.revision as number, lastMutationId: row.lastMutationId, updatedAt: row.updatedAt }
  })
}

/** Stable precedence: routine-specific > entity-specific > Action-wide artwork. */
export function effectiveVisualOverrides(data: WorkspaceData, input: {
  routineId?: string; actionId?: string; primaryTargetId?: string
}): StudioOverrides | undefined {
  if (input.routineId && data.routines.some((row) => row.id === input.routineId)) {
    if (data.visualOverrides?.some((row) => row.subjectType === 'routine' && row.subjectId === input.routineId))
      return readableVisualOverride(data, 'routine', input.routineId) ?? {}
  }
  if (input.primaryTargetId && data.visualOverrides?.some((row) => row.subjectType === 'entity' && row.subjectId === input.primaryTargetId))
    return readableVisualOverride(data, 'entity', input.primaryTargetId) ?? {}
  if (input.actionId && data.visualOverrides?.some((row) => row.subjectType === 'action' && row.subjectId === input.actionId))
    return readableVisualOverride(data, 'action', input.actionId) ?? {}
  return undefined
}
