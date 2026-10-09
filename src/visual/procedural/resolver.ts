import type { ActionDefinition, Entity, EntityType, Routine, TaskOccurrence, WorkspaceData } from '../../types/domain'
import { hasPrimitiveDefinition } from '../registry'
import { matchActionFamily, matchEntityFamily, matchEnvironment, matchExactSubject } from './aliases'
import type { ActionFamily, EnvironmentFamily, SubjectFamily, VisualResolutionLevel } from './taxonomy'

/** Presentation-only projection; never add these fields to persisted domain models. */
export interface CardVisualInput {
  readonly routineId: string
  readonly actionId?: string
  readonly primaryTargetId?: string
  readonly occurrenceId: string
  readonly triggerOrdinal?: number
  readonly isLinkedActivity?: boolean
  readonly subjectName?: string
  readonly subjectTypeName?: string
  readonly actionName?: string
  readonly activityTitle?: string
  readonly environmentName?: string
  readonly environmentTypeName?: string
}

export interface CardSemanticResolution {
  readonly level: VisualResolutionLevel
  readonly subjectFamily: SubjectFamily
  readonly subjectId: string
  readonly toolId?: string
  readonly actionFamily: ActionFamily
  readonly environment: EnvironmentFamily
}

const entityFallback: Record<SubjectFamily, string> = {
  appliance: 'generic-appliance', fixture: 'generic-surface', furniture: 'generic-surface',
  surface: 'generic-surface', floor: 'generic-surface', glass: 'window',
  fabric: 'cloth', storage: 'generic-surface', room: 'house',
  outdoor: 'plant', 'generic-object': 'generic-surface',
}
const actionFallback: Record<ActionFamily, string> = {
  wipe: 'cloth', spray: 'spray-bottle', scrub: 'sponge', vacuum: 'vacuum', mop: 'mop',
  dust: 'cloth', wash: 'sponge', descale: 'cleaner-bottle', degrease: 'spray-bottle',
  disinfect: 'spray-bottle', polish: 'cloth', tidy: 'house', inspect: 'house',
  refill: 'cleaner-bottle', move: 'generic-surface', maintain: 'generic-appliance',
  'generic-care': 'generic-surface',
}
const actionTools: Partial<Record<ActionFamily, string>> = {
  wipe: 'cloth', spray: 'spray-bottle', scrub: 'sponge', vacuum: 'vacuum',
  mop: 'mop', dust: 'cloth', wash: 'sponge', descale: 'cleaner-bottle',
  degrease: 'spray-bottle', disinfect: 'spray-bottle', polish: 'cloth',
  refill: 'cleaner-bottle',
}
const environmentDefaults: Partial<Record<string, EnvironmentFamily>> = {
  oven: 'kitchen', stovetop: 'kitchen', 'coffee-machine': 'kitchen', sink: 'kitchen',
  countertop: 'kitchen', 'shower-head': 'bathroom', sofa: 'living',
}

/**
 * Trust order:
 * - exact subject from structured type or compatible entity name;
 * - structured entity type family (never an Action title guessing the target);
 * - action family;
 * - a deliberate generic object.
 * A specific, incompatible structured type beats free-text names.
 */
export function resolveCardVisualSemantics(input: CardVisualInput): CardSemanticResolution {
  const actionFamily = matchActionFamily(input.actionName || input.activityTitle)
  const typeExact = matchExactSubject(input.subjectTypeName)
  const typedFamily = matchEntityFamily(input.subjectTypeName)
  const namedExact = matchExactSubject(input.subjectName)
  // Broad entity types (e.g. Surface) may still contain a recognizable sink.
  // A specific incompatible type (e.g. Appliance for a named sink) wins.
  const broadFamilies: readonly SubjectFamily[] = ['surface', 'floor', 'storage', 'generic-object']
  const compatibleName = namedExact && (!typedFamily || typedFamily === namedExact.family || broadFamilies.includes(typedFamily))
  const exact = typeExact ?? (compatibleName ? namedExact : undefined)

  let subjectId: string
  let family: SubjectFamily
  let level: VisualResolutionLevel
  if (exact) {
    subjectId = exact.primitiveId
    family = exact.family
    level = 'exact-subject'
  } else if (typedFamily && typedFamily !== 'generic-object') {
    subjectId = entityFallback[typedFamily]
    family = typedFamily
    level = 'entity-family'
  } else if (actionFamily !== 'generic-care') {
    subjectId = actionFallback[actionFamily]
    family = 'generic-object'
    level = 'action-family'
  } else {
    subjectId = 'generic-surface'
    family = 'generic-object'
    level = 'generic'
  }

  const preferredTool = actionTools[actionFamily]
  const toolId = preferredTool && preferredTool !== subjectId ? preferredTool : undefined
  const environment = matchEnvironment(input.environmentTypeName)
    ?? matchEnvironment(input.environmentName)
    ?? matchEnvironment(input.subjectName)
    ?? environmentDefaults[subjectId]
    ?? 'generic-interior'
  // Prove each choice is backed by authored geometry, not an inferred SVG filename.
  if (!hasPrimitiveDefinition(subjectId) || (toolId && !hasPrimitiveDefinition(toolId))) {
    throw new Error('V2 semantic resolver references an unknown authored primitive')
  }
  return Object.freeze({ level, subjectFamily: family, subjectId, toolId, actionFamily, environment })
}

/**
 * Convenience adapter for the *existing* domain. Prefer canonical snapshots so
 * archived/renamed targets in history remain understandable. Does not mutate data.
 */
export function cardVisualInputFromDomain(
  task: Pick<TaskOccurrence, 'id' | 'routineId' | 'triggerOrdinal' | 'routineNameSnapshot' | 'actionNameSnapshot' | 'targets' | 'parentOccurrenceId'>,
  data: Pick<WorkspaceData, 'routines' | 'actions' | 'entities' | 'entityTypes'>,
): CardVisualInput {
  const routine: Routine | undefined = data.routines.find((item) => item.id === task.routineId)
  const action: ActionDefinition | undefined = routine && data.actions.find((item) => item.id === routine.actionId)
  const primary = task.targets[0]
  const primaryTargetId = primary?.entityId ?? routine?.targetEntityIds[0] ?? routine?.includeDescendantTargetIds[0]
  const entity: Entity | undefined = primaryTargetId ? data.entities.find((item) => item.id === primaryTargetId) : undefined
  const entityType: EntityType | undefined = entity && data.entityTypes.find((item) => item.id === entity.typeId)
  let parent = entity
  let environmentName: string | undefined
  let environmentTypeName: string | undefined
  const seen = new Set<string>()
  while (parent?.parentId && !seen.has(parent.parentId)) {
    seen.add(parent.parentId)
    parent = data.entities.find((item) => item.id === parent!.parentId)
    if (!parent) break
    const typeName = data.entityTypes.find((type) => type.id === parent!.typeId)?.name
    if (matchEnvironment(parent.name) || matchEnvironment(typeName)) {
      environmentName = parent.name
      environmentTypeName = typeName
      break
    }
  }
  return {
    routineId: task.routineId,
    actionId: routine?.actionId,
    primaryTargetId,
    occurrenceId: task.id,
    triggerOrdinal: task.triggerOrdinal,
    isLinkedActivity: Boolean(task.parentOccurrenceId),
    subjectName: primary?.entityName ?? entity?.name,
    subjectTypeName: primary?.entityTypeName ?? entityType?.name,
    actionName: task.actionNameSnapshot || action?.name,
    activityTitle: task.routineNameSnapshot,
    environmentName,
    environmentTypeName,
  }
}
