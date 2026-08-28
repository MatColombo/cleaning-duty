export type Locale = 'en' | 'it'
export type CareSensitivity = 'relaxed' | 'balanced' | 'strict'
export type MemberRole = 'owner' | 'member'
export type MemberStatus = 'active' | 'invited'
export type AdvancedAssignmentStrategy = 'round_robin' | 'least_recent' | 'weighted' | 'workload'
export type TaskState = 'scheduled' | 'completed' | 'skipped' | 'cancelled'
export type ScheduleMode = 'fixed' | 'after_completion'
export type StockStatus = 'available' | 'low' | 'reserve_only' | 'out_of_stock'
export type MetadataTarget = 'entity' | 'action' | 'supply'
export type MetadataFieldType = 'text' | 'number' | 'boolean' | 'choice' | 'multi_choice'
export type MetadataValue = string | number | boolean | string[] | null
export type LayoutSceneKind = 'floor' | 'outdoor'
export type LayoutShape = 'rect' | 'polygon'
export type LayoutRole = 'area' | 'object'
export type RelationKind = 'door' | 'passage' | 'stairs' | 'link'

export type TaskEventType =
  | 'TASK_CREATED'
  | 'ASSIGNED'
  | 'POSTPONED'
  | 'REASSIGNED'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'REOPENED'
  | 'CANCELLED'
  | 'NOTIFIED'
  | 'NOTIFICATION_FAILED'
  | 'TARGET_COMPLETED'

export type SupplyEventType =
  | 'SUPPLY_CREATED'
  | 'SUPPLY_UPDATED'
  | 'STOCK_CHANGED'
  | 'SUPPLY_ARCHIVED'

export interface Workspace {
  id: string
  name: string
  timezone: string
  careSensitivity: CareSensitivity
  ownerUserId?: string
  createdAt: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId?: string
  displayName: string
  email?: string
  role: MemberRole
  status: MemberStatus
  /** Optional advanced-assignment labels such as 'bathroom' or 'heavy-work'. */
  labels: string[]
  /** If set, advanced assignment may exclude this member for occurrences due before this instant. */
  unavailableUntil?: string
  createdAt: string
}

export interface MetadataFieldDefinition {
  id: string
  workspaceId: string
  target: MetadataTarget
  name: string
  fieldType: MetadataFieldType
  options: string[]
  archivedAt?: string
  createdAt: string
}

export interface EntityType {
  id: string
  workspaceId: string
  name: string
  icon?: string
  archivedAt?: string
  createdAt: string
}

export interface Entity {
  id: string
  workspaceId: string
  typeId: string
  parentId?: string
  name: string
  labels: string[]
  metadata: Record<string, MetadataValue>
  archivedAt?: string
  createdAt: string
}

export interface LayoutScene {
  id: string
  workspaceId: string
  name: string
  kind: LayoutSceneKind
  order: number
  archivedAt?: string
  createdAt: string
}

export interface LayoutPoint {
  x: number
  y: number
}

/**
 * A layout element is only a visual placement of a semantic Entity. Removing
 * it never removes the underlying Entity or historical references.
 */
export interface LayoutElement {
  id: string
  workspaceId: string
  sceneId: string
  entityId: string
  role: LayoutRole
  shape: LayoutShape
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  /** Polygon points are local to the element box and stored as 0..1 ratios. */
  points?: LayoutPoint[]
  labelPosition: 'center' | 'top'
  archivedAt?: string
  createdAt: string
}

/** Semantic connection between entities/scenes. Geometry is derived from the
 * current layout, so relations survive redraws. */
export interface EntityRelation {
  id: string
  workspaceId: string
  fromEntityId: string
  toEntityId?: string
  targetSceneId?: string
  kind: RelationKind
  label?: string
  archivedAt?: string
  createdAt: string
}

export interface ActionDefinition {
  id: string
  workspaceId: string
  name: string
  icon?: string
  instructions?: string
  defaultSupplyIds: string[]
  metadata: Record<string, MetadataValue>
  revision: number
  archivedAt?: string
  createdAt: string
}

/**
 * Old Phase-1 daily/weekday variants are kept in the union so existing local
 * data can be upgraded without breaking. New routines use interval,
 * weekdays, monthlyNth, or once.
 */
export type RecurrenceRule =
  | { kind: 'once'; date: string }
  | { kind: 'daily'; interval: number; anchorDate: string }
  | { kind: 'interval'; unit: 'hour' | 'day' | 'week' | 'month'; interval: number; anchorDate: string }
  | { kind: 'weekdays'; weekdays: number[]; intervalWeeks: number; anchorDate: string }
  | { kind: 'monthlyNth'; weekday: number; ordinal: 1 | 2 | 3 | 4 | -1; intervalMonths: number; anchorDate: string }

export interface AdvancedAssignmentPolicy {
  mode: 'advanced'
  strategy: AdvancedAssignmentStrategy
  /** Candidate pool. Empty means all active members. */
  memberIds: string[]
  /** Every required label must be present on an eligible member. */
  requiredMemberLabels: string[]
  excludeUnavailable: boolean
  /** Used only by weighted rotation. Missing/invalid values default to 1. */
  weights: Record<string, number>
}

export type AssignmentPolicy =
  | { mode: 'me'; memberId: string }
  | { mode: 'member'; memberId: string }
  | { mode: 'alternate'; memberIds: string[] }
  | { mode: 'unassigned' }
  | AdvancedAssignmentPolicy

export type TargetSelectorCondition =
  | { kind: 'type'; typeId: string }
  | { kind: 'label'; label: string }
  | { kind: 'descendant_of'; entityId: string; includeRoot: boolean }

export interface AdvancedTargetSelector {
  /** Conditions are evaluated without source-code rules. */
  match: 'all' | 'any'
  conditions: TargetSelectorCondition[]
}

export type ReminderPolicy =
  | { mode: 'none' }
  | { mode: 'at_due' }
  | { mode: 'offset'; minutesBefore: number }
  | { mode: 'previous_day'; time?: string }

export interface ScheduleExceptions {
  /** Local YYYY-MM-DD dates suppressed from the recurring pattern. */
  excludedDates: string[]
  /** Explicit local YYYY-MM-DDTHH:mm occurrences added to the schedule. */
  includedDateTimes: string[]
}

export interface Routine {
  id: string
  workspaceId: string
  name: string
  actionId: string
  targetEntityIds: string[]
  /** A selected entity in this list resolves to itself and all descendants. */
  includeDescendantTargetIds: string[]
  /** Optional advanced selector, combined with the simple explicit targets. */
  advancedTargetSelector?: AdvancedTargetSelector
  recurrence: RecurrenceRule
  timeOfDay: string
  scheduleMode: ScheduleMode
  exceptions: ScheduleExceptions
  assignment: AssignmentPolicy
  reminder: ReminderPolicy
  /** undefined = inherit Action defaults; [] = explicitly no supplies. */
  supplyIdsOverride?: string[]
  revision: number
  archivedAt?: string
  createdAt: string
}

export interface TaskTargetSnapshot {
  entityId: string
  entityName: string
  entityTypeName: string
  /** Human-readable reasons captured when the task is materialized. */
  matchReasons: string[]
  completedAt?: string
  completedByMemberId?: string
}

export interface TaskExplanationSnapshot {
  schedule: string
  assignment: string
  targetSummary: string
}

export interface TaskSupplySnapshot {
  supplyId: string
  supplyName: string
}

export interface TaskOccurrence {
  id: string
  workspaceId: string
  routineId: string
  routineRevision: number
  routineNameSnapshot: string
  actionNameSnapshot: string
  originalDueAt: string
  dueAt: string
  state: TaskState
  assigneeMemberId?: string
  targets: TaskTargetSnapshot[]
  supplies: TaskSupplySnapshot[]
  explanation: TaskExplanationSnapshot
  version: number
  createdAt: string
}

export interface TaskEvent {
  id: string
  workspaceId: string
  taskId: string
  type: TaskEventType
  at: string
  actorMemberId?: string
  metadata: Record<string, unknown>
}

export interface Supply {
  id: string
  workspaceId: string
  name: string
  icon?: string
  status: StockStatus
  /** Optional secondary inventory detail. Qualitative status remains primary. */
  quantity?: number
  unit?: string
  metadata: Record<string, MetadataValue>
  /** Optimistic concurrency token used by offline stock changes. */
  version: number
  archivedAt?: string
  createdAt: string
}

export interface SupplyEvent {
  id: string
  workspaceId: string
  supplyId: string
  type: SupplyEventType
  at: string
  actorMemberId?: string
  metadata: Record<string, unknown>
}

export interface WorkspaceData {
  workspace: Workspace
  members: WorkspaceMember[]
  fieldDefinitions: MetadataFieldDefinition[]
  entityTypes: EntityType[]
  entities: Entity[]
  layoutScenes: LayoutScene[]
  layoutElements: LayoutElement[]
  entityRelations: EntityRelation[]
  actions: ActionDefinition[]
  routines: Routine[]
  tasks: TaskOccurrence[]
  taskEvents: TaskEvent[]
  supplies: Supply[]
  supplyEvents: SupplyEvent[]
}

export interface SessionUser {
  id: string
  email?: string
  displayName: string
}
