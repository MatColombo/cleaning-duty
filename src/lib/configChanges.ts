/** Phase 16A: lossless, targeted changes from the existing V1 domain shape.
 * These are the existing PostgreSQL columns: no V1 table is reinterpreted. */
import type { WorkspaceData } from '../types/domain'

export type DbRow = Record<string, unknown>
export interface EntityChange {
  table: string
  key: DbRow
  /** null means the row must not yet exist; otherwise CAS only these fields. */
  before: DbRow | null
  /** null is a deletion (only routine_targets); otherwise insert/update. */
  after: DbRow | null
}
export interface LocalOverlay {
  section: keyof WorkspaceData
  id: string
  fields: string[]
  after: Record<string, unknown> | null
}
export interface ConfigChangeSet { changes: EntityChange[]; overlays: LocalOverlay[] }

const specialKeys: Record<string, string[]> = {
  routine_targets: ['routine_id', 'entity_id'],
  task_targets: ['task_id', 'entity_id'],
  health_trajectories: ['routine_id', 'item_id', 'cleanliness_channel'],
}
export const appendOnlyTables = new Set(['task_events', 'supply_events', 'completion_snapshots', 'task_targets'])
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
export const entityKey = (table: string, row: DbRow): DbRow =>
  Object.fromEntries((specialKeys[table] ?? ['id']).map((field) => [field, row[field]]))
const keyId = (row: DbRow, table: string): string => JSON.stringify(entityKey(table, row))
const own = (value: DbRow, key: string) => Object.prototype.hasOwnProperty.call(value, key)

/** Build exact cloud-row representations of the data already persisted by saveCloudData. */
export function serializeWorkspace(data: WorkspaceData): Record<string, DbRow[]> {
  const w = data.workspace.id
  return {
    workspaces: [{ id: w, name: data.workspace.name, timezone: data.workspace.timezone, care_sensitivity: data.workspace.careSensitivity,
      owner_user_id: data.workspace.ownerUserId ?? null, created_at: data.workspace.createdAt }],
    workspace_members: data.members.map((x) => ({ id: x.id, workspace_id: w, user_id: x.userId ?? null, display_name: x.displayName,
      email: x.email ?? null, role: x.role, status: x.status, labels: x.labels, unavailable_until: x.unavailableUntil ?? null, created_at: x.createdAt })),
    metadata_field_definitions: data.fieldDefinitions.map((x) => ({ id: x.id, workspace_id: w, target: x.target, name: x.name,
      field_type: x.fieldType, options: x.options, archived_at: x.archivedAt ?? null, created_at: x.createdAt })),
    entity_types: data.entityTypes.map((x) => ({ id: x.id, workspace_id: w, name: x.name, icon: x.icon ?? null,
      archived_at: x.archivedAt ?? null, created_at: x.createdAt })),
    entities: data.entities.map((x) => ({ id: x.id, workspace_id: w, type_id: x.typeId, parent_id: x.parentId ?? null,
      name: x.name, labels: x.labels, metadata: x.metadata, archived_at: x.archivedAt ?? null, created_at: x.createdAt })),
    layout_scenes: data.layoutScenes.map((x) => ({ id: x.id, workspace_id: w, name: x.name, scene_kind: x.kind,
      scene_order: x.order, background_color: x.backgroundColor ?? '#f8f9f6', archived_at: x.archivedAt ?? null, created_at: x.createdAt })),
    layout_elements: data.layoutElements.map((x) => ({ id: x.id, workspace_id: w, scene_id: x.sceneId, entity_id: x.entityId,
      layout_role: x.role, shape: x.shape, x: x.x, y: x.y, width: x.width, height: x.height, rotation: x.rotation,
      z_index: x.zIndex, points: x.points ?? null, label_position: x.labelPosition, label_font_size: x.labelFontSize ?? 19,
      label_wrap: x.labelWrap ?? false, label_width: x.labelWidth ?? null, label_rotation: x.labelRotation ?? 0,
      fill_color: x.fillColor ?? null, text_color: x.textColor ?? null, text_background_color: x.textBackgroundColor ?? null,
      archived_at: x.archivedAt ?? null, created_at: x.createdAt })),
    entity_relations: data.entityRelations.map((x) => ({ id: x.id, workspace_id: w, from_entity_id: x.fromEntityId,
      to_entity_id: x.toEntityId ?? null, target_scene_id: x.targetSceneId ?? null, relation_kind: x.kind,
      label: x.label ?? null, archived_at: x.archivedAt ?? null, created_at: x.createdAt })),
    supplies: data.supplies.map((x) => ({ id: x.id, workspace_id: w, name: x.name, icon: x.icon ?? null,
      status: x.status, quantity: x.quantity ?? null, unit: x.unit ?? null, metadata: x.metadata, version: x.version,
      archived_at: x.archivedAt ?? null, created_at: x.createdAt })),
    supply_events: data.supplyEvents.map((x) => ({ id: x.id, workspace_id: w, supply_id: x.supplyId,
      event_type: x.type, event_at: x.at, actor_member_id: x.actorMemberId ?? null, metadata: x.metadata })),
    action_definitions: data.actions.map((x) => ({ id: x.id, workspace_id: w, name: x.name, icon: x.icon ?? null,
      instructions: x.instructions ?? null, default_supply_ids: x.defaultSupplyIds, metadata: x.metadata,
      revision: x.revision, archived_at: x.archivedAt ?? null, created_at: x.createdAt })),
    routines: data.routines.map((x) => ({ id: x.id, workspace_id: w, name: x.name, action_id: x.actionId,
      recurrence: x.recurrence, time_of_day: x.timeOfDay, routine_timezone: x.routineTimezone ?? data.workspace.timezone,
      schedule_mode: x.scheduleMode, schedule_exceptions: x.exceptions, assignment: x.assignment,
      advanced_target_selector: x.advancedTargetSelector ?? null, reminder: x.reminder,
      cleanliness_channel: x.cleanlinessChannel ?? (x.careLevel === 'deep' ? 'deep' : 'regular'),
      care_level: x.careLevel ?? (x.cleanlinessChannel === 'deep' ? 'deep' : 'routine'),
      refresh_level_pct: x.refreshLevelPct ?? 100, status: x.status ?? 'active',
      affects_cleanliness: x.affectsCleanliness !== false, parent_routine_id: x.parentRoutineId ?? null,
      trigger_every: x.parentRoutineId ? x.triggerEvery ?? 1 : null,
      supply_ids_override: x.supplyIdsOverride ?? null, revision: x.revision,
      archived_at: x.archivedAt ?? null, created_at: x.createdAt })),
    routine_targets: data.routines.flatMap((x) => x.targetEntityIds.map((id) => ({ workspace_id: w, routine_id: x.id,
      entity_id: id, include_descendants: x.includeDescendantTargetIds.includes(id) }))),
    task_occurrences: data.tasks.map((x) => ({ id: x.id, workspace_id: w, routine_id: x.routineId, routine_revision: x.routineRevision,
      trigger_ordinal: x.triggerOrdinal ?? null, parent_occurrence_id: x.parentOccurrenceId ?? null,
      routine_name_snapshot: x.routineNameSnapshot, action_name_snapshot: x.actionNameSnapshot,
      cleanliness_channel: x.cleanlinessChannel ?? (x.careLevel === 'deep' ? 'deep' : 'regular'),
      care_level: x.careLevel ?? (x.cleanlinessChannel === 'deep' ? 'deep' : 'routine'),
      scheduled_slot_at: x.scheduledSlotAt ?? x.originalDueAt, effective_due_at: x.effectiveDueAt ?? x.dueAt,
      original_due_at: x.scheduledSlotAt ?? x.originalDueAt, due_at: x.effectiveDueAt ?? x.dueAt,
      completed_at: x.completedAt ?? null, state: x.state,
      ...(data.recurrenceMode === 'atomic' ? { successor_of_event_id: x.successorOfEventId ?? null } : {}),
      assignment_scope: x.assignmentScope ?? (x.assigneeMemberId ? 'member' : 'unassigned'),
      assignee_member_id: x.assigneeMemberId ?? null, supplies_snapshot: x.supplies, explanation_snapshot: x.explanation,
      version: x.version, created_at: x.createdAt })),
    task_targets: data.tasks.flatMap((x) => x.targets.map((t) => ({ workspace_id: w, task_id: x.id, entity_id: t.entityId,
      entity_name_snapshot: t.entityName, entity_type_name_snapshot: t.entityTypeName, match_reasons: t.matchReasons,
      completed_at: t.completedAt ?? null, completed_by_member_id: t.completedByMemberId ?? null }))),
    task_events: data.taskEvents.map((x) => ({ id: x.id, workspace_id: w, task_id: x.taskId,
      event_type: x.type, event_at: x.at, actor_member_id: x.actorMemberId ?? null, metadata: x.metadata })),
    health_trajectories: data.healthTrajectories.map((x) => ({ workspace_id: w, item_id: x.itemId, routine_id: x.routineId,
      cleanliness_channel: x.cleanlinessChannel, health_anchor_at: x.healthAnchorAt, health_anchor_pct: x.healthAnchorPct,
      health_due_at: x.healthDueAt, health_overdue_end_at: x.healthOverdueEndAt,
      last_refresh_completion_id: x.lastRefreshCompletionId ?? null, updated_at: x.updatedAt })),
    completion_snapshots: data.completionSnapshots.map((x) => ({ id: x.id, workspace_id: w, occurrence_id: x.occurrenceId,
      source_routine_id: x.sourceRoutineId, trajectory_routine_id: x.trajectoryRoutineId, item_id: x.itemId,
      cleanliness_channel: x.cleanlinessChannel, completed_at: x.completedAt,
      refresh_level_pct_snapshot: x.refreshLevelPctSnapshot, cleanliness_before_pct: x.cleanlinessBeforePct,
      cleanliness_after_pct: x.cleanlinessAfterPct, health_refresh_applied: x.healthRefreshApplied,
      scheduled_slot_at: x.scheduledSlotAt, actor_member_id: x.actorMemberId ?? null })),
  }
}

const domainSections: (keyof WorkspaceData)[] = [
  'members', 'fieldDefinitions', 'entityTypes', 'entities', 'layoutScenes', 'layoutElements',
  'entityRelations', 'supplies', 'supplyEvents', 'actions', 'routines', 'tasks', 'taskEvents',
  'healthTrajectories', 'completionSnapshots',
]
function domainId(section: keyof WorkspaceData, row: Record<string, unknown>): string {
  return section === 'healthTrajectories' ? `${row.routineId}:${row.itemId}:${row.cleanlinessChannel}` : String(row.id)
}
export function buildConfigChanges(before: WorkspaceData, after: WorkspaceData): ConfigChangeSet {
  if (before.workspace.id !== after.workspace.id) throw new Error('Cannot sync across households')
  const from = serializeWorkspace(before), to = serializeWorkspace(after)
  const changes: EntityChange[] = []
  for (const table of Object.keys(to)) {
    const old = new Map(from[table].map((r) => [keyId(r, table), r]))
    const next = new Map(to[table].map((r) => [keyId(r, table), r]))
    for (const [id, current] of next) {
      const prior = old.get(id)
      if (!prior) changes.push({ table, key: entityKey(table, current), before: null, after: current })
      else {
        const dirty = Object.keys(current).filter((field) => !same(prior[field], current[field]))
        if (dirty.length) {
          if (appendOnlyTables.has(table)) throw new Error(`Cannot update immutable ${table} row`)
          changes.push({ table, key: entityKey(table, current),
            before: Object.fromEntries(dirty.map((field) => [field, prior[field] ?? null])),
            after: Object.fromEntries(dirty.map((field) => [field, current[field] ?? null])) })
        }
      }
    }
    for (const [id, prior] of old) if (!next.has(id)) {
      if (table !== 'routine_targets' && table !== 'health_trajectories') {
        // Normal domain deletions are archives; audit/target snapshots are immutable.
        throw new Error(`Unexpected deletion from ${table}`)
      }
      changes.push({ table, key: entityKey(table, prior), before: prior, after: null })
    }
  }
  const overlays: LocalOverlay[] = []
  for (const field of Object.keys(after.workspace) as (keyof WorkspaceData['workspace'])[]) {
    if (!same(before.workspace[field], after.workspace[field])) overlays.push({ section: 'workspace', id: before.workspace.id,
      fields: [field], after: after.workspace as unknown as Record<string, unknown> })
  }
  for (const section of domainSections) {
    const beforeRows = before[section] as unknown as Record<string, unknown>[]
    const afterRows = after[section] as unknown as Record<string, unknown>[]
    const old = new Map(beforeRows.map((r) => [domainId(section, r), r]))
    const next = new Map(afterRows.map((r) => [domainId(section, r), r]))
    for (const [id, row] of next) {
      const prior = old.get(id)
      const fields = prior ? Object.keys(row).filter((k) => !same(prior[k], row[k])) : Object.keys(row)
      if (fields.length) overlays.push({ section, id, fields, after: row })
    }
    for (const [id] of old) if (!next.has(id)) overlays.push({ section, id, fields: [], after: null })
  }
  return { changes, overlays }
}

/** Merge A->B queued config edits without losing CAS preconditions or append-only events. */
export function combineConfigChanges(first: ConfigChangeSet, second: ConfigChangeSet): ConfigChangeSet {
  const combined = new Map<string, EntityChange>()
  for (const change of [...first.changes, ...second.changes]) {
    const id = `${change.table}:${JSON.stringify(change.key)}`
    const existing = combined.get(id)
    if (!existing) { combined.set(id, change); continue }
    if (existing.before === null) {
      if (change.after === null) combined.delete(id)
      else combined.set(id, { ...existing, after: { ...existing.after, ...change.after } })
    } else if (change.after === null) {
      combined.set(id, { ...existing, after: null })
    } else {
      const old = { ...existing.before }
      for (const [field, value] of Object.entries(change.before ?? {})) if (!own(existing.after ?? {}, field) && !own(old, field)) old[field] = value
      const updated = { ...existing.after, ...change.after }
      for (const field of Object.keys(updated)) if (own(old, field) && same(old[field], updated[field])) { delete old[field]; delete updated[field] }
      if (Object.keys(updated).length) combined.set(id, { ...existing, before: old, after: updated })
      else combined.delete(id)
    }
  }
  const overlays = new Map<string, LocalOverlay>()
  for (const item of [...first.overlays, ...second.overlays]) {
    const id = `${item.section}:${item.id}`
    const old = overlays.get(id)
    overlays.set(id, old && item.after ? { ...item, fields: [...new Set([...old.fields, ...item.fields])], after: { ...old.after, ...item.after } } : item)
  }
  return { changes: [...combined.values()], overlays: [...overlays.values()] }
}

export function overlayConfiguration(fresh: WorkspaceData, overlays: LocalOverlay[]): WorkspaceData {
  let output = fresh
  for (const change of overlays) {
    if (change.section === 'workspace') {
      if (change.after) output = { ...output, workspace: { ...output.workspace, ...Object.fromEntries(change.fields.map((f) => [f, change.after![f]])) } }
      continue
    }
    const section = change.section as Exclude<keyof WorkspaceData, 'workspace'>
    const existing = output[section] as unknown as Record<string, unknown>[]
    const index = existing.findIndex((r) => domainId(section, r) === change.id)
    if (!change.after) {
      if (index >= 0) output = { ...output, [section]: existing.filter((_, i) => i !== index) }
    } else if (index < 0) output = { ...output, [section]: [...existing, change.after] }
    else output = { ...output, [section]: existing.map((r, i) => i === index ? { ...r, ...Object.fromEntries(change.fields.map((f) => [f, change.after![f]])) } : r) }
  }
  return output
}

/** Confirm a server read actually contains all acknowledged configuration writes. */
export function configAcknowledgedIn(read: WorkspaceData, changes: EntityChange[]): boolean {
  const rows = serializeWorkspace(read)
  const generated = isGeneratedOccurrenceBatch(changes)
  if (generated) return changes.filter(change => change.table === 'task_occurrences').every(change =>
    rows.task_occurrences.some(row => row.id === change.key.id
      && row.routine_id === change.after?.routine_id
      && row.routine_revision === change.after?.routine_revision
      && row.scheduled_slot_at === change.after?.scheduled_slot_at))
  return changes.every((change) => {
    const row = rows[change.table]?.find((r) => keyId(r, change.table) === JSON.stringify(change.key))
    return change.after === null ? !row : Boolean(row && Object.entries(change.after).every(([k, v]) => same(row[k], v)))
  })
}

/** Only pure, append-only task materialization is eligible for the specialized
 * idempotent versioned RPC; never bypass CAS for user edits or lifecycle events. */
export function isGeneratedOccurrenceBatch(changes: EntityChange[]): boolean {
  return changes.some(change => change.table === 'task_occurrences') && changes.every(change => {
    if (change.before !== null || !change.after) return false
    if (change.table === 'task_occurrences') return change.after.state === 'scheduled' && change.after.version === 1
      && change.after.successor_of_event_id == null
    if (change.table === 'task_targets') return true
    if (change.table === 'task_events') return ['TASK_CREATED', 'ASSIGNED'].includes(String(change.after.event_type))
    return false
  })
}
