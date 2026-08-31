import type { User } from '@supabase/supabase-js'
import type { WorkspaceData, WorkspaceSummary } from '../types/domain'
import { normalizeWorkspaceData } from './dataMigrations'
import { supabase } from './supabase'
import { newId, nowIso } from './id'
import type { OfflineMutation } from './offline'

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function dedupeBy<T>(rows: T[], keyOf: (row: T) => string): T[] {
  const unique = new Map<string, T>()
  for (const row of rows) unique.set(keyOf(row), row)
  return [...unique.values()]
}

function persistenceError(table: string, error: unknown): Error {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : undefined
  const message = typeof record?.message === 'string' ? record.message : String(error)
  const code = typeof record?.code === 'string' ? ` (${record.code})` : ''
  const detail = typeof record?.details === 'string' && record.details ? ` — ${record.details}` : ''
  return new Error(`Could not save ${table}${code}: ${message}${detail}`, { cause: error })
}

async function persistCleanlinessState(db: ReturnType<typeof client>, data: WorkspaceData): Promise<void> {
  const workspaceId = data.workspace.id
  if (data.completionSnapshots.length) {
    const { error } = await db.from('completion_snapshots').upsert(dedupeBy(data.completionSnapshots, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, occurrence_id: row.occurrenceId, source_routine_id: row.sourceRoutineId, trajectory_routine_id: row.trajectoryRoutineId,
      item_id: row.itemId, cleanliness_channel: row.cleanlinessChannel, completed_at: row.completedAt, refresh_level_pct_snapshot: row.refreshLevelPctSnapshot,
      cleanliness_before_pct: row.cleanlinessBeforePct, cleanliness_after_pct: row.cleanlinessAfterPct, health_refresh_applied: row.healthRefreshApplied,
      scheduled_slot_at: row.scheduledSlotAt, actor_member_id: row.actorMemberId ?? null,
    })), { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw persistenceError('completion_snapshots', error)
  }
  if (data.healthTrajectories.length) {
    const rows = dedupeBy(data.healthTrajectories, (row) => `${row.routineId}:${row.itemId}:${row.cleanlinessChannel}`).map((row) => ({
      workspace_id: workspaceId, item_id: row.itemId, routine_id: row.routineId, cleanliness_channel: row.cleanlinessChannel,
      health_anchor_at: row.healthAnchorAt, health_anchor_pct: row.healthAnchorPct, health_due_at: row.healthDueAt, health_overdue_end_at: row.healthOverdueEndAt,
      last_refresh_completion_id: row.lastRefreshCompletionId ?? null, updated_at: row.updatedAt,
    }))
    const { error } = await db.from('health_trajectories').upsert(rows, { onConflict: 'routine_id,item_id,cleanliness_channel' })
    if (error) throw persistenceError('health_trajectories', error)
  }
}

export async function listCloudWorkspaces(user: User): Promise<WorkspaceSummary[]> {
  const db = client()
  const { error: claimError } = await db.rpc('claim_workspace_invites')
  if (claimError) throw claimError
  const { data: memberships, error: membershipError } = await db
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
  if (membershipError) throw membershipError
  const rows = memberships ?? []
  if (!rows.length) return []
  const roleByWorkspace = new Map(rows.map((row) => [row.workspace_id as string, row.role as WorkspaceSummary['role']]))
  const { data: workspaces, error: workspaceError } = await db
    .from('workspaces')
    .select('id, name, timezone, owner_user_id, archived_at, created_at')
    .in('id', [...roleByWorkspace.keys()])
    .order('created_at', { ascending: false })
  if (workspaceError) throw workspaceError
  return (workspaces ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    role: roleByWorkspace.get(row.id) ?? 'member',
    ownerUserId: row.owner_user_id ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
  }))
}

export async function loadCloudData(user: User, requestedWorkspaceId?: string): Promise<WorkspaceData | null> {
  const db = client()
  await db.rpc('claim_workspace_invites')
  let membershipQuery = db
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
  if (requestedWorkspaceId) membershipQuery = membershipQuery.eq('workspace_id', requestedWorkspaceId)
  const { data: membership, error: membershipError } = await membershipQuery.limit(1).maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) return null
  const workspaceId = membership.workspace_id as string

  const results = await Promise.all([
    db.from('workspaces').select('*').eq('id', workspaceId).single(),
    db.from('workspace_members').select('*').eq('workspace_id', workspaceId).order('created_at'),
    db.from('metadata_field_definitions').select('*').eq('workspace_id', workspaceId).order('created_at'),
    db.from('entity_types').select('*').eq('workspace_id', workspaceId).order('created_at'),
    db.from('entities').select('*').eq('workspace_id', workspaceId).order('created_at'),
    db.from('layout_scenes').select('*').eq('workspace_id', workspaceId).order('scene_order'),
    db.from('layout_elements').select('*').eq('workspace_id', workspaceId).order('z_index'),
    db.from('entity_relations').select('*').eq('workspace_id', workspaceId).order('created_at'),
    db.from('supplies').select('*').eq('workspace_id', workspaceId).order('created_at'),
    db.from('supply_events').select('*').eq('workspace_id', workspaceId).order('event_at'),
    db.from('action_definitions').select('*').eq('workspace_id', workspaceId).order('created_at'),
    db.from('routines').select('*').eq('workspace_id', workspaceId).order('created_at'),
    db.from('routine_targets').select('*').eq('workspace_id', workspaceId),
    db.from('task_occurrences').select('*').eq('workspace_id', workspaceId).order('due_at'),
    db.from('task_targets').select('*').eq('workspace_id', workspaceId),
    db.from('task_events').select('*').eq('workspace_id', workspaceId).order('event_at'),
    db.from('health_trajectories').select('*').eq('workspace_id', workspaceId),
    db.from('completion_snapshots').select('*').eq('workspace_id', workspaceId).order('completed_at'),
  ])
  for (const result of results) if (result.error) throw result.error

  const [workspaceResult, membersResult, fieldsResult, typesResult, entitiesResult, scenesResult, layoutElementsResult, relationsResult, suppliesResult, supplyEventsResult, actionsResult, routinesResult, routineTargetsResult, tasksResult, taskTargetsResult, eventsResult, healthResult, completionSnapshotsResult] = results
  const workspaceRow = workspaceResult.data
  const members = membersResult.data ?? []
  const fields = fieldsResult.data ?? []
  const entityTypes = typesResult.data ?? []
  const entities = entitiesResult.data ?? []
  const layoutScenes = scenesResult.data ?? []
  const layoutElements = layoutElementsResult.data ?? []
  const entityRelations = relationsResult.data ?? []
  const supplies = suppliesResult.data ?? []
  const supplyEvents = supplyEventsResult.data ?? []
  const actions = actionsResult.data ?? []
  const routines = routinesResult.data ?? []
  const routineTargets = routineTargetsResult.data ?? []
  const tasks = tasksResult.data ?? []
  const taskTargets = taskTargetsResult.data ?? []
  const events = eventsResult.data ?? []
  const healthTrajectories = healthResult.data ?? []
  const completionSnapshots = completionSnapshotsResult.data ?? []

  const normalized = normalizeWorkspaceData({
    workspace: {
      id: workspaceRow.id,
      name: workspaceRow.name,
      timezone: workspaceRow.timezone,
      careSensitivity: workspaceRow.care_sensitivity ?? 'balanced',
      ownerUserId: workspaceRow.owner_user_id ?? undefined,
      archivedAt: workspaceRow.archived_at ?? undefined,
      createdAt: workspaceRow.created_at,
    },
    members: members.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, userId: row.user_id ?? undefined,
      displayName: row.display_name, email: row.email ?? undefined, role: row.role, status: row.status, labels: row.labels ?? [], unavailableUntil: row.unavailable_until ?? undefined, createdAt: row.created_at,
    })),
    fieldDefinitions: fields.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, target: row.target, name: row.name,
      fieldType: row.field_type, options: row.options ?? [], archivedAt: row.archived_at ?? undefined, createdAt: row.created_at,
    })),
    entityTypes: entityTypes.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, name: row.name, icon: row.icon ?? undefined,
      archivedAt: row.archived_at ?? undefined, createdAt: row.created_at,
    })),
    entities: entities.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, typeId: row.type_id, parentId: row.parent_id ?? undefined,
      name: row.name, labels: row.labels ?? [], metadata: row.metadata ?? {}, archivedAt: row.archived_at ?? undefined, createdAt: row.created_at,
    })),
    layoutScenes: layoutScenes.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, name: row.name, kind: row.scene_kind, order: row.scene_order,
      backgroundColor: row.background_color ?? undefined, archivedAt: row.archived_at ?? undefined, createdAt: row.created_at,
    })),
    layoutElements: layoutElements.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, sceneId: row.scene_id, entityId: row.entity_id, role: row.layout_role ?? 'object', shape: row.shape,
      x: Number(row.x), y: Number(row.y), width: Number(row.width), height: Number(row.height), rotation: Number(row.rotation),
      zIndex: row.z_index, points: row.points ?? undefined, labelPosition: row.label_position ?? 'center',
      labelFontSize: row.label_font_size == null ? 19 : Number(row.label_font_size), labelWrap: row.label_wrap ?? false,
      labelWidth: row.label_width == null ? undefined : Number(row.label_width), labelRotation: row.label_rotation == null ? 0 : Number(row.label_rotation),
      fillColor: row.fill_color ?? undefined, textColor: row.text_color ?? undefined, textBackgroundColor: row.text_background_color ?? undefined,
      archivedAt: row.archived_at ?? undefined, createdAt: row.created_at,
    })),
    entityRelations: entityRelations.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, fromEntityId: row.from_entity_id, toEntityId: row.to_entity_id ?? undefined,
      targetSceneId: row.target_scene_id ?? undefined, kind: row.relation_kind, label: row.label ?? undefined,
      archivedAt: row.archived_at ?? undefined, createdAt: row.created_at,
    })),
    supplies: supplies.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, name: row.name, icon: row.icon ?? undefined, status: row.status,
      quantity: row.quantity == null ? undefined : Number(row.quantity), unit: row.unit ?? undefined, metadata: row.metadata ?? {},
      version: row.version ?? 1, archivedAt: row.archived_at ?? undefined, createdAt: row.created_at,
    })),
    supplyEvents: supplyEvents.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, supplyId: row.supply_id, type: row.event_type,
      at: row.event_at, actorMemberId: row.actor_member_id ?? undefined, metadata: row.metadata ?? {},
    })),
    actions: actions.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, name: row.name, icon: row.icon ?? undefined,
      instructions: row.instructions ?? undefined, defaultSupplyIds: row.default_supply_ids ?? [], metadata: row.metadata ?? {},
      revision: row.revision, archivedAt: row.archived_at ?? undefined, createdAt: row.created_at,
    })),
    routines: routines.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, name: row.name, actionId: row.action_id,
      targetEntityIds: routineTargets.filter((target) => target.routine_id === row.id).map((target) => target.entity_id),
      includeDescendantTargetIds: routineTargets.filter((target) => target.routine_id === row.id && target.include_descendants).map((target) => target.entity_id),
      recurrence: row.recurrence, timeOfDay: String(row.time_of_day).slice(0, 5), routineTimezone: row.routine_timezone ?? workspaceRow.timezone,
      scheduleMode: row.schedule_mode ?? 'fixed', exceptions: row.schedule_exceptions ?? { excludedDates: [], includedDateTimes: [] },
      assignment: row.assignment, advancedTargetSelector: row.advanced_target_selector ?? undefined, reminder: row.reminder ?? { mode: 'none' },
      cleanlinessChannel: row.cleanliness_channel ?? (row.care_level === 'deep' ? 'deep' : 'regular'), careLevel: row.care_level ?? (row.cleanliness_channel === 'deep' ? 'deep' : 'routine'),
      refreshLevelPct: Number(row.refresh_level_pct ?? 100), status: row.status ?? 'active', supplyIdsOverride: row.supply_ids_override ?? undefined,
      revision: row.revision, archivedAt: row.archived_at ?? undefined, createdAt: row.created_at,
    })),
    tasks: tasks.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, routineId: row.routine_id, routineRevision: row.routine_revision,
      routineNameSnapshot: row.routine_name_snapshot, actionNameSnapshot: row.action_name_snapshot,
      cleanlinessChannel: row.cleanliness_channel ?? (row.care_level === 'deep' ? 'deep' : 'regular'), careLevel: row.care_level ?? (row.cleanliness_channel === 'deep' ? 'deep' : 'routine'),
      scheduledSlotAt: row.scheduled_slot_at ?? row.original_due_at, effectiveDueAt: row.effective_due_at ?? row.due_at,
      originalDueAt: row.scheduled_slot_at ?? row.original_due_at, dueAt: row.effective_due_at ?? row.due_at, completedAt: row.completed_at ?? undefined, state: row.state,
      assigneeMemberId: row.assignee_member_id ?? undefined,
      targets: taskTargets.filter((target) => target.task_id === row.id).map((target) => ({
        entityId: target.entity_id, entityName: target.entity_name_snapshot, entityTypeName: target.entity_type_name_snapshot, matchReasons: target.match_reasons ?? [], completedAt: target.completed_at ?? undefined, completedByMemberId: target.completed_by_member_id ?? undefined,
      })),
      supplies: row.supplies_snapshot ?? [], explanation: row.explanation_snapshot ?? { schedule: '', assignment: '', targetSummary: '' }, version: row.version, createdAt: row.created_at,
    })),
    taskEvents: events.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, taskId: row.task_id, type: row.event_type,
      at: row.event_at, actorMemberId: row.actor_member_id ?? undefined, metadata: row.metadata ?? {},
    })),
    healthTrajectories: healthTrajectories.map((row) => ({
      workspaceId: row.workspace_id, itemId: row.item_id, routineId: row.routine_id, cleanlinessChannel: row.cleanliness_channel,
      healthAnchorAt: row.health_anchor_at, healthAnchorPct: Number(row.health_anchor_pct), healthDueAt: row.health_due_at, healthOverdueEndAt: row.health_overdue_end_at,
      lastRefreshCompletionId: row.last_refresh_completion_id ?? undefined, updatedAt: row.updated_at,
    })),
    completionSnapshots: completionSnapshots.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, occurrenceId: row.occurrence_id, sourceRoutineId: row.source_routine_id, trajectoryRoutineId: row.trajectory_routine_id,
      itemId: row.item_id, cleanlinessChannel: row.cleanliness_channel, completedAt: row.completed_at, refreshLevelPctSnapshot: Number(row.refresh_level_pct_snapshot),
      cleanlinessBeforePct: Number(row.cleanliness_before_pct), cleanlinessAfterPct: Number(row.cleanliness_after_pct), healthRefreshApplied: row.health_refresh_applied,
      scheduledSlotAt: row.scheduled_slot_at, actorMemberId: row.actor_member_id ?? undefined,
    })),
  })
  const rawHealthByKey = new Map(healthTrajectories.map((row) => [`${row.routine_id}:${row.item_id}:${row.cleanliness_channel}`, row]))
  const healthStateChanged = normalized.healthTrajectories.length !== healthTrajectories.length || normalized.healthTrajectories.some((row) => {
    const raw = rawHealthByKey.get(`${row.routineId}:${row.itemId}:${row.cleanlinessChannel}`) as Record<string, any> | undefined
    return !raw
      || raw.health_anchor_at !== row.healthAnchorAt
      || Number(raw.health_anchor_pct) !== row.healthAnchorPct
      || raw.health_due_at !== row.healthDueAt
      || raw.health_overdue_end_at !== row.healthOverdueEndAt
      || (raw.last_refresh_completion_id ?? undefined) !== row.lastRefreshCompletionId
  })
  const rawSnapshotIds = new Set(completionSnapshots.map((row) => row.id))
  const completionStateChanged = normalized.completionSnapshots.length !== completionSnapshots.length
    || normalized.completionSnapshots.some((row) => !rawSnapshotIds.has(row.id))
  if (healthStateChanged || completionStateChanged) await persistCleanlinessState(db, normalized)
  return normalized
}

export async function createCloudWorkspace(user: User, name: string, ownerName: string, timezone: string): Promise<WorkspaceData> {
  const db = client()
  const workspaceId = newId()
  const memberId = newId()
  const createdAt = nowIso()
  const { error: workspaceError } = await db.from('workspaces').insert({
    id: workspaceId, name, timezone, owner_user_id: user.id, created_at: createdAt,
  })
  if (workspaceError) throw workspaceError
  const { error: memberError } = await db.from('workspace_members').insert({
    id: memberId, workspace_id: workspaceId, user_id: user.id, display_name: ownerName,
    email: user.email ?? null, role: 'owner', status: 'active', labels: [], unavailable_until: null, created_at: createdAt,
  })
  if (memberError) throw memberError
  return {
    workspace: { id: workspaceId, name, timezone, careSensitivity: 'balanced', ownerUserId: user.id, createdAt },
    members: [{ id: memberId, workspaceId, userId: user.id, displayName: ownerName, email: user.email, role: 'owner', status: 'active', labels: [], createdAt }],
    fieldDefinitions: [], entityTypes: [], entities: [], layoutScenes: [], layoutElements: [], entityRelations: [], actions: [], routines: [], tasks: [], taskEvents: [], healthTrajectories: [], completionSnapshots: [], supplies: [], supplyEvents: [],
  }
}

export async function saveCloudData(data: WorkspaceData, actorUserId?: string): Promise<void> {
  const db = client()
  const workspaceId = data.workspace.id
  const isOwner = Boolean(actorUserId && data.workspace.ownerUserId === actorUserId)

  if (isOwner) {
    const { error: workspaceError } = await db.from('workspaces').upsert({
      id: workspaceId, name: data.workspace.name, timezone: data.workspace.timezone, care_sensitivity: data.workspace.careSensitivity,
      owner_user_id: data.workspace.ownerUserId ?? null, created_at: data.workspace.createdAt,
    })
    if (workspaceError) throw persistenceError('workspaces', workspaceError)
    if (data.members.length) {
      const { error } = await db.from('workspace_members').upsert(dedupeBy(data.members, (row) => row.id).map((row) => ({
        id: row.id, workspace_id: workspaceId, user_id: row.userId ?? null, display_name: row.displayName,
        email: row.email ?? null, role: row.role, status: row.status, labels: row.labels, unavailable_until: row.unavailableUntil ?? null, created_at: row.createdAt,
      })))
      if (error) throw persistenceError('workspace_members', error)
    }
  }

  if (data.fieldDefinitions.length) {
    const { error } = await db.from('metadata_field_definitions').upsert(dedupeBy(data.fieldDefinitions, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, target: row.target, name: row.name, field_type: row.fieldType,
      options: row.options, archived_at: row.archivedAt ?? null, created_at: row.createdAt,
    })))
    if (error) throw persistenceError('metadata_field_definitions', error)
  }
  if (data.entityTypes.length) {
    const { error } = await db.from('entity_types').upsert(dedupeBy(data.entityTypes, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, name: row.name, icon: row.icon ?? null,
      archived_at: row.archivedAt ?? null, created_at: row.createdAt,
    })))
    if (error) throw persistenceError('entity_types', error)
  }
  if (data.entities.length) {
    const { error } = await db.from('entities').upsert(dedupeBy(data.entities, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, type_id: row.typeId, parent_id: row.parentId ?? null,
      name: row.name, labels: row.labels, metadata: row.metadata, archived_at: row.archivedAt ?? null, created_at: row.createdAt,
    })))
    if (error) throw persistenceError('entities', error)
  }
  if (data.layoutScenes.length) {
    const { error } = await db.from('layout_scenes').upsert(dedupeBy(data.layoutScenes, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, name: row.name, scene_kind: row.kind, scene_order: row.order, background_color: row.backgroundColor ?? '#f8f9f6',
      archived_at: row.archivedAt ?? null, created_at: row.createdAt,
    })))
    if (error) throw persistenceError('layout_scenes', error)
  }
  if (data.layoutElements.length) {
    const { error } = await db.from('layout_elements').upsert(dedupeBy(data.layoutElements, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, scene_id: row.sceneId, entity_id: row.entityId, layout_role: row.role, shape: row.shape,
      x: row.x, y: row.y, width: row.width, height: row.height, rotation: row.rotation, z_index: row.zIndex,
      points: row.points ?? null, label_position: row.labelPosition, label_font_size: row.labelFontSize ?? 19,
      label_wrap: row.labelWrap ?? false, label_width: row.labelWidth ?? null, label_rotation: row.labelRotation ?? 0,
      fill_color: row.fillColor ?? null, text_color: row.textColor ?? null, text_background_color: row.textBackgroundColor ?? null, archived_at: row.archivedAt ?? null, created_at: row.createdAt,
    })))
    if (error) throw persistenceError('layout_elements', error)
  }
  if (data.entityRelations.length) {
    const { error } = await db.from('entity_relations').upsert(dedupeBy(data.entityRelations, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, from_entity_id: row.fromEntityId, to_entity_id: row.toEntityId ?? null,
      target_scene_id: row.targetSceneId ?? null, relation_kind: row.kind, label: row.label ?? null,
      archived_at: row.archivedAt ?? null, created_at: row.createdAt,
    })))
    if (error) throw persistenceError('entity_relations', error)
  }
  if (data.supplies.length) {
    const { error } = await db.from('supplies').upsert(dedupeBy(data.supplies, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, name: row.name, icon: row.icon ?? null, status: row.status,
      quantity: row.quantity ?? null, unit: row.unit ?? null, metadata: row.metadata, version: row.version,
      archived_at: row.archivedAt ?? null, created_at: row.createdAt,
    })))
    if (error) throw persistenceError('supplies', error)
  }
  if (data.supplyEvents.length) {
    const { error } = await db.from('supply_events').upsert(dedupeBy(data.supplyEvents, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, supply_id: row.supplyId, event_type: row.type,
      event_at: row.at, actor_member_id: row.actorMemberId ?? null, metadata: row.metadata,
    })), { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw persistenceError('supply_events', error)
  }
  if (data.actions.length) {
    const { error } = await db.from('action_definitions').upsert(dedupeBy(data.actions, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, name: row.name, icon: row.icon ?? null,
      instructions: row.instructions ?? null, default_supply_ids: row.defaultSupplyIds, metadata: row.metadata,
      revision: row.revision, archived_at: row.archivedAt ?? null, created_at: row.createdAt,
    })))
    if (error) throw persistenceError('action_definitions', error)
  }
  if (data.routines.length) {
    const { error } = await db.from('routines').upsert(dedupeBy(data.routines, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, name: row.name, action_id: row.actionId,
      recurrence: row.recurrence, time_of_day: row.timeOfDay, routine_timezone: row.routineTimezone ?? data.workspace.timezone, schedule_mode: row.scheduleMode,
      schedule_exceptions: row.exceptions, assignment: row.assignment, advanced_target_selector: row.advancedTargetSelector ?? null, reminder: row.reminder,
      cleanliness_channel: row.cleanlinessChannel ?? (row.careLevel === 'deep' ? 'deep' : 'regular'), care_level: row.careLevel ?? (row.cleanlinessChannel === 'deep' ? 'deep' : 'routine'),
      refresh_level_pct: row.refreshLevelPct ?? 100, status: row.status ?? 'active',
      supply_ids_override: row.supplyIdsOverride ?? null, revision: row.revision,
      archived_at: row.archivedAt ?? null, created_at: row.createdAt,
    })))
    if (error) throw persistenceError('routines', error)
  }
  if (data.tasks.length) {
    const { error } = await db.from('task_occurrences').upsert(dedupeBy(data.tasks, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, routine_id: row.routineId, routine_revision: row.routineRevision,
      routine_name_snapshot: row.routineNameSnapshot, action_name_snapshot: row.actionNameSnapshot,
      cleanliness_channel: row.cleanlinessChannel ?? (row.careLevel === 'deep' ? 'deep' : 'regular'), care_level: row.careLevel ?? (row.cleanlinessChannel === 'deep' ? 'deep' : 'routine'),
      scheduled_slot_at: row.scheduledSlotAt ?? row.originalDueAt, effective_due_at: row.effectiveDueAt ?? row.dueAt,
      original_due_at: row.scheduledSlotAt ?? row.originalDueAt, due_at: row.effectiveDueAt ?? row.dueAt, completed_at: row.completedAt ?? null, state: row.state,
      assignee_member_id: row.assigneeMemberId ?? null, supplies_snapshot: row.supplies, explanation_snapshot: row.explanation,
      version: row.version, created_at: row.createdAt,
    })))
    if (error) throw persistenceError('task_occurrences', error)
  }
  if (data.taskEvents.length) {
    const { error } = await db.from('task_events').upsert(dedupeBy(data.taskEvents, (row) => row.id).map((row) => ({
      id: row.id, workspace_id: workspaceId, task_id: row.taskId, event_type: row.type,
      event_at: row.at, actor_member_id: row.actorMemberId ?? null, metadata: row.metadata,
    })), { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw persistenceError('task_events', error)
  }

  await persistCleanlinessState(db, data)

  const { error: deleteRoutineTargetsError } = await db.from('routine_targets').delete().eq('workspace_id', workspaceId)
  if (deleteRoutineTargetsError) throw persistenceError('routine_targets cleanup', deleteRoutineTargetsError)
  const routineTargets = dedupeBy(data.routines.flatMap((routine) => routine.targetEntityIds.map((entityId) => ({
    workspace_id: workspaceId, routine_id: routine.id, entity_id: entityId,
    include_descendants: routine.includeDescendantTargetIds.includes(entityId),
  }))), (row) => `${row.routine_id}:${row.entity_id}`)
  if (routineTargets.length) {
    const { error } = await db.from('routine_targets').insert(routineTargets)
    if (error) throw persistenceError('routine_targets', error)
  }

  const taskTargets = dedupeBy(data.tasks.flatMap((task) => task.targets.map((target) => ({
    workspace_id: workspaceId, task_id: task.id, entity_id: target.entityId,
    entity_name_snapshot: target.entityName, entity_type_name_snapshot: target.entityTypeName, match_reasons: target.matchReasons, completed_at: target.completedAt ?? null, completed_by_member_id: target.completedByMemberId ?? null,
  }))), (row) => `${row.task_id}:${row.entity_id}`)
  if (taskTargets.length) {
    const { error } = await db.from('task_targets').upsert(taskTargets, { onConflict: 'task_id,entity_id', ignoreDuplicates: true })
    if (error) throw persistenceError('task_targets', error)
  }
}

export async function replaceCloudData(data: WorkspaceData, actorUserId?: string): Promise<void> {
  if (!actorUserId || data.workspace.ownerUserId !== actorUserId) throw new Error('Only the household owner can import a backup.')
  const db = client()
  const { error } = await db.rpc('reset_workspace_content', { target_workspace_id: data.workspace.id })
  if (error) throw error
  await saveCloudData(data, actorUserId)
}



export async function archiveCloudWorkspace(workspaceId: string): Promise<void> {
  const { error } = await client().rpc('archive_workspace', { target_workspace_id: workspaceId })
  if (error) throw error
}

export async function restoreCloudWorkspace(workspaceId: string): Promise<void> {
  const { error } = await client().rpc('restore_workspace', { target_workspace_id: workspaceId })
  if (error) throw error
}

export async function deleteCloudWorkspace(workspaceId: string): Promise<void> {
  const { error } = await client().rpc('delete_workspace_permanently', { target_workspace_id: workspaceId })
  if (error) throw error
}

export interface CloudMutationResult {
  applied: boolean
  conflict: boolean
  actualVersion?: number
}

export async function applyCloudMutation(mutation: OfflineMutation): Promise<CloudMutationResult> {
  const db = client()
  if (mutation.kind === 'supply_status') {
    const { data, error } = await db.rpc('apply_supply_status_mutation', {
      target_supply_id: mutation.supplyId,
      expected_version: mutation.expectedVersion,
      new_status: mutation.status,
      event_id: mutation.eventId,
      event_at: mutation.eventAt,
      source_task_id: mutation.sourceTaskId ?? null,
    })
    if (error) throw error
    return data as CloudMutationResult
  }
  if (mutation.kind === 'undo') {
    const { data, error } = await db.rpc('undo_task_mutation', {
      target_task_id: mutation.taskId,
      expected_version: mutation.expectedVersion,
      source_event_id: mutation.sourceEventId ?? null,
      event_id: mutation.eventId,
      event_at: mutation.eventAt,
    })
    if (error) throw error
    return data as CloudMutationResult
  }
  if (mutation.kind === 'complete_target') {
    const { data, error } = await db.rpc('apply_task_target_completion', {
      target_task_id: mutation.taskId,
      target_entity_id: mutation.targetEntityId ?? null,
      expected_version: mutation.expectedVersion,
      event_id: mutation.eventId,
      event_at: mutation.eventAt,
      completion_effects: mutation.completionEffects ?? [],
    })
    if (error) throw error
    return data as CloudMutationResult
  }
  const { data, error } = await db.rpc('apply_task_mutation', {
    target_task_id: mutation.taskId,
    expected_version: mutation.expectedVersion,
    mutation_kind: mutation.kind,
    event_id: mutation.eventId,
    event_at: mutation.eventAt,
    new_effective_due_at: mutation.kind === 'postpone' ? mutation.effectiveDueAt ?? mutation.dueAt ?? null : null,
    completion_effects: mutation.kind === 'complete' ? mutation.completionEffects ?? [] : [],
    new_assignee_member_id: mutation.kind === 'reassign' ? mutation.assigneeMemberId ?? null : null,
    clear_assignee: mutation.kind === 'reassign' ? Boolean(mutation.clearAssignee) : false,
  })
  if (error) throw error
  return data as CloudMutationResult
}
