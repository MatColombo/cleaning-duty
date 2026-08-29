import type { AssignmentPolicy, WorkspaceData, WorkspaceMember } from '../types/domain'
import { normalizeWorkspaceData } from './dataMigrations'

export const BACKUP_SCHEMA_VERSION = 6
export const APPLICATION_VERSION = '1.0.1'

export interface HouseholdBackup {
  schema_version: number
  exported_at: string
  application_version: string
  data: WorkspaceData
}

export function createHouseholdBackup(data: WorkspaceData): HouseholdBackup {
  const clean = normalizeWorkspaceData(structuredClone(data))
  clean.workspace = { ...clean.workspace, ownerUserId: undefined }
  clean.members = clean.members.map((member) => ({ ...member, userId: undefined }))
  return {
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    application_version: APPLICATION_VERSION,
    data: clean,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function parseHouseholdBackup(text: string): HouseholdBackup {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('The selected file is not valid JSON.') }
  if (!isObject(parsed)) throw new Error('Invalid backup file.')
  const schemaVersion = Number(parsed.schema_version)
  if (![2, 3, 4, 5, BACKUP_SCHEMA_VERSION].includes(schemaVersion)) {
    throw new Error(`Unsupported backup schema version. Supported: 2-${BACKUP_SCHEMA_VERSION}.`)
  }
  if (!isObject(parsed.data)) throw new Error('Backup data is missing.')
  const data = parsed.data as unknown as WorkspaceData
  if (!data.workspace?.id || !data.workspace?.name || !Array.isArray(data.members)) throw new Error('Backup household data is incomplete.')
  if (!Array.isArray(data.entities) || !Array.isArray(data.actions) || !Array.isArray(data.routines) || !Array.isArray(data.tasks)) {
    throw new Error('Backup collections are incomplete.')
  }
  return { ...parsed, schema_version: BACKUP_SCHEMA_VERSION, data: normalizeWorkspaceData(data) } as HouseholdBackup
}

function remapAssignment(policy: AssignmentPolicy, memberMap: Map<string, string>): AssignmentPolicy {
  if (policy.mode === 'unassigned') return policy
  if (policy.mode === 'alternate') return { ...policy, memberIds: policy.memberIds.map((id) => memberMap.get(id) ?? id) }
  if (policy.mode === 'advanced') {
    const weights: Record<string, number> = {}
    for (const [id, weight] of Object.entries(policy.weights ?? {})) weights[memberMap.get(id) ?? id] = weight
    return { ...policy, memberIds: policy.memberIds.map((id) => memberMap.get(id) ?? id), weights }
  }
  return { ...policy, memberId: memberMap.get(policy.memberId) ?? policy.memberId }
}

function normalizedEmail(email?: string) {
  return email?.trim().toLowerCase() || undefined
}

export function prepareImportedWorkspace(backup: HouseholdBackup, current: WorkspaceData, currentMember: WorkspaceMember): WorkspaceData {
  const source = normalizeWorkspaceData(structuredClone(backup.data))
  const workspaceId = current.workspace.id
  const sourceOwner = source.members.find((member) => member.role === 'owner') ?? source.members[0]
  if (!sourceOwner) throw new Error('Backup has no household owner.')

  const memberMap = new Map<string, string>([[sourceOwner.id, currentMember.id]])
  const currentByEmail = new Map(current.members.flatMap((member) => normalizedEmail(member.email) ? [[normalizedEmail(member.email)!, member] as const] : []))
  const members = source.members.map((member) => {
    if (member.id === sourceOwner.id) {
      return {
        ...member,
        id: currentMember.id,
        workspaceId,
        userId: currentMember.userId,
        email: currentMember.email ?? member.email,
        role: 'owner' as const,
        status: 'active' as const,
      }
    }
    const existing = normalizedEmail(member.email) ? currentByEmail.get(normalizedEmail(member.email)!) : undefined
    const id = existing?.id ?? member.id
    memberMap.set(member.id, id)
    return {
      ...member,
      id,
      workspaceId,
      userId: existing?.userId,
      status: existing?.userId ? 'active' as const : member.email ? 'invited' as const : member.status,
      role: 'member' as const,
    }
  })

  const withWorkspace = <T extends { workspaceId: string }>(items: T[]) => items.map((item) => ({ ...item, workspaceId }))

  return {
    workspace: {
      ...source.workspace,
      id: workspaceId,
      ownerUserId: current.workspace.ownerUserId,
      createdAt: current.workspace.createdAt,
    },
    members,
    fieldDefinitions: withWorkspace(source.fieldDefinitions),
    entityTypes: withWorkspace(source.entityTypes),
    entities: withWorkspace(source.entities),
    layoutScenes: withWorkspace(source.layoutScenes),
    layoutElements: withWorkspace(source.layoutElements),
    entityRelations: withWorkspace(source.entityRelations),
    actions: withWorkspace(source.actions),
    routines: withWorkspace(source.routines).map((routine) => ({ ...routine, assignment: remapAssignment(routine.assignment, memberMap) })),
    tasks: withWorkspace(source.tasks).map((task) => ({ ...task, assigneeMemberId: task.assigneeMemberId ? memberMap.get(task.assigneeMemberId) ?? task.assigneeMemberId : undefined, targets: task.targets.map((target) => ({ ...target, completedByMemberId: target.completedByMemberId ? memberMap.get(target.completedByMemberId) ?? target.completedByMemberId : undefined })) })),
    taskEvents: withWorkspace(source.taskEvents).map((event) => ({ ...event, actorMemberId: event.actorMemberId ? memberMap.get(event.actorMemberId) ?? event.actorMemberId : undefined })),
    supplies: withWorkspace(source.supplies),
    supplyEvents: withWorkspace(source.supplyEvents).map((event) => ({ ...event, actorMemberId: event.actorMemberId ? memberMap.get(event.actorMemberId) ?? event.actorMemberId : undefined })),
  }
}
