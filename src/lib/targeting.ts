import type { AdvancedTargetSelector, Entity, Routine, WorkspaceData } from '../types/domain'

export interface ResolvedTarget {
  entity: Entity
  reasons: string[]
}

export function descendantIds(data: WorkspaceData, parentId: string): string[] {
  const direct = data.entities.filter((item) => !item.archivedAt && item.parentId === parentId)
  return direct.flatMap((item) => [item.id, ...descendantIds(data, item.id)])
}

function selectorReason(data: WorkspaceData, condition: AdvancedTargetSelector['conditions'][number], entity: Entity): string | null {
  if (condition.kind === 'type') {
    if (entity.typeId !== condition.typeId) return null
    const typeName = data.entityTypes.find((type) => type.id === condition.typeId)?.name ?? 'selected type'
    return `Type is ${typeName}`
  }
  if (condition.kind === 'label') {
    if (!entity.labels.some((label) => label.toLocaleLowerCase() === condition.label.toLocaleLowerCase())) return null
    return `Label ${condition.label}`
  }
  const descendants = new Set(descendantIds(data, condition.entityId))
  const matches = descendants.has(entity.id) || (condition.includeRoot && entity.id === condition.entityId)
  if (!matches) return null
  const root = data.entities.find((item) => item.id === condition.entityId)?.name ?? 'selected area'
  return entity.id === condition.entityId ? `Area ${root}` : `Inside ${root}`
}

export function matchesAdvancedSelector(data: WorkspaceData, selector: AdvancedTargetSelector, entity: Entity): { matches: boolean; reasons: string[] } {
  if (!selector.conditions.length) return { matches: false, reasons: [] }
  const results = selector.conditions.map((condition) => selectorReason(data, condition, entity))
  const matches = selector.match === 'all' ? results.every(Boolean) : results.some(Boolean)
  return { matches, reasons: matches ? results.filter((reason): reason is string => Boolean(reason)) : [] }
}

export function resolvedRoutineTargets(data: WorkspaceData, routine: Routine): ResolvedTarget[] {
  const reasons = new Map<string, string[]>()
  const add = (entityId: string, reason: string) => {
    const entity = data.entities.find((item) => item.id === entityId && !item.archivedAt)
    if (!entity) return
    reasons.set(entityId, [...new Set([...(reasons.get(entityId) ?? []), reason])])
  }

  const includeDescendants = new Set(routine.includeDescendantTargetIds ?? [])
  for (const entityId of routine.targetEntityIds ?? []) {
    const entity = data.entities.find((item) => item.id === entityId && !item.archivedAt)
    if (!entity) continue
    add(entityId, includeDescendants.has(entityId) ? `Selected area ${entity.name}` : `Selected ${entity.name}`)
    if (includeDescendants.has(entityId)) {
      for (const childId of descendantIds(data, entityId)) add(childId, `Inside ${entity.name}`)
    }
  }

  const selector = routine.advancedTargetSelector
  if (selector?.conditions.length) {
    for (const entity of data.entities.filter((item) => !item.archivedAt)) {
      const result = matchesAdvancedSelector(data, selector, entity)
      if (result.matches) for (const reason of result.reasons) add(entity.id, reason)
    }
  }

  return [...reasons.entries()].flatMap(([entityId, matchReasons]) => {
    const entity = data.entities.find((item) => item.id === entityId && !item.archivedAt)
    return entity ? [{ entity, reasons: matchReasons }] : []
  })
}

export function selectorSummary(data: WorkspaceData, selector?: AdvancedTargetSelector): string {
  if (!selector?.conditions.length) return ''
  const parts = selector.conditions.map((condition) => {
    if (condition.kind === 'type') return `type ${data.entityTypes.find((item) => item.id === condition.typeId)?.name ?? 'unknown'}`
    if (condition.kind === 'label') return `label ${condition.label}`
    const name = data.entities.find((item) => item.id === condition.entityId)?.name ?? 'unknown area'
    return `${condition.includeRoot ? 'in/under' : 'inside'} ${name}`
  })
  return `${selector.match === 'all' ? 'All conditions' : 'Any condition'}: ${parts.join(selector.match === 'all' ? ' + ' : ' / ')}`
}
