import type { AdvancedAssignmentPolicy, AssignmentPolicy, Routine, WorkspaceData, WorkspaceMember } from '../types/domain'

export interface AssignmentResolution {
  memberId?: string
  explanation: string
  conflict?: string
}

function activeMembers(data: WorkspaceData, policy?: AdvancedAssignmentPolicy, dueAt?: string): WorkspaceMember[] {
  let members = data.members.filter((member) => member.status === 'active')
  if (policy?.memberIds.length) members = members.filter((member) => policy.memberIds.includes(member.id))
  if (policy?.requiredMemberLabels.length) {
    members = members.filter((member) => policy.requiredMemberLabels.every((required) => member.labels.some((label) => label.toLocaleLowerCase() === required.toLocaleLowerCase())))
  }
  if (policy?.excludeUnavailable && dueAt) {
    const due = new Date(dueAt).getTime()
    members = members.filter((member) => !member.unavailableUntil || new Date(member.unavailableUntil).getTime() <= due)
  }
  return members
}

function memberName(data: WorkspaceData, id?: string) {
  return id ? data.members.find((member) => member.id === id)?.displayName ?? 'Unknown member' : 'Anyone'
}

function weightedMember(policy: AdvancedAssignmentPolicy, members: WorkspaceMember[], index: number): WorkspaceMember | undefined {
  const ring = members.flatMap((member) => Array.from({ length: Math.max(1, Math.min(20, Math.round(policy.weights[member.id] ?? 1))) }, () => member))
  return ring.length ? ring[index % ring.length] : undefined
}

function lastAssignedAt(data: WorkspaceData, memberId: string, dueAt: string): number {
  return data.tasks
    .filter((task) => task.assigneeMemberId === memberId && new Date(task.dueAt).getTime() < new Date(dueAt).getTime())
    .reduce((latest, task) => Math.max(latest, new Date(task.dueAt).getTime()), 0)
}

function workload(data: WorkspaceData, memberId: string, dueAt: string): number {
  const center = new Date(dueAt).getTime()
  const windowMs = 3 * 24 * 60 * 60 * 1000
  return data.tasks.filter((task) => task.state === 'scheduled' && task.assigneeMemberId === memberId && Math.abs(new Date(task.dueAt).getTime() - center) <= windowMs).length
}

export function resolveAssignment(data: WorkspaceData, routine: Routine, index: number, dueAt: string): AssignmentResolution {
  const policy: AssignmentPolicy = routine.assignment
  if (policy.mode === 'unassigned') return { explanation: 'No automatic assignee; anyone can take this task.' }
  if (policy.mode === 'me' || policy.mode === 'member') {
    return { memberId: policy.memberId, explanation: `Fixed assignment to ${memberName(data, policy.memberId)}.` }
  }
  if (policy.mode === 'alternate') {
    const eligible = policy.memberIds.filter((id) => data.members.some((member) => member.id === id && member.status === 'active'))
    const memberId = eligible.length ? eligible[index % eligible.length] : undefined
    return memberId
      ? { memberId, explanation: `Alternating assignment selected ${memberName(data, memberId)}.` }
      : { explanation: 'No active member is available in the alternating list.', conflict: 'No eligible assignee' }
  }

  const members = activeMembers(data, policy, dueAt)
  if (!members.length) return { explanation: 'Advanced assignment found no eligible active member.', conflict: 'No eligible assignee' }

  let selected: WorkspaceMember | undefined
  if (policy.strategy === 'round_robin') selected = members[index % members.length]
  else if (policy.strategy === 'weighted') selected = weightedMember(policy, members, index)
  else if (policy.strategy === 'least_recent') selected = [...members].sort((a, b) => lastAssignedAt(data, a.id, dueAt) - lastAssignedAt(data, b.id, dueAt) || a.id.localeCompare(b.id))[0]
  else selected = [...members].sort((a, b) => workload(data, a.id, dueAt) - workload(data, b.id, dueAt) || a.id.localeCompare(b.id))[0]

  const strategyText = policy.strategy === 'round_robin' ? 'round robin'
    : policy.strategy === 'least_recent' ? 'least recently assigned'
      : policy.strategy === 'weighted' ? 'weighted rotation' : 'lowest nearby workload'
  const filters: string[] = []
  if (policy.requiredMemberLabels.length) filters.push(`labels: ${policy.requiredMemberLabels.join(', ')}`)
  if (policy.excludeUnavailable) filters.push('unavailable people excluded')
  return {
    memberId: selected?.id,
    explanation: `${memberName(data, selected?.id)} selected by ${strategyText}${filters.length ? ` (${filters.join('; ')})` : ''}.`,
  }
}
