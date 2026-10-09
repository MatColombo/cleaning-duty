import type { Routine, WorkspaceData } from '../../types/domain'
import { matchEnvironment } from './aliases'
import { getCardVisualRecipe } from './cache'
import { stableRoutineVisualSeed, type CardVisualRecipe } from './recipe'
import type { CardVisualInput } from './resolver'

/**
 * Routine-library art is a configuration identity, not a task edition.
 * Input contains NO TaskOccurrence fields. Routine/action/primary-target IDs and
 * visual version define the stable identity; metadata is only semantic context.
 */
export function routineIdentityVisualInput(
  routine: Pick<Routine, 'id' | 'actionId' | 'name' | 'targetEntityIds'>,
  data: Pick<WorkspaceData, 'actions' | 'entities' | 'entityTypes'>,
): CardVisualInput {
  const targetId = routine.targetEntityIds[0]
  const entity = data.entities.find((item) => item.id === targetId)
  const type = data.entityTypes.find((item) => item.id === entity?.typeId)
  const action = data.actions.find((item) => item.id === routine.actionId)
  let parent = entity
  let environmentName: string | undefined
  let environmentTypeName: string | undefined
  const seen = new Set<string>()
  while (parent?.parentId && !seen.has(parent.parentId)) {
    seen.add(parent.parentId)
    parent = data.entities.find((item) => item.id === parent!.parentId)
    if (!parent) break
    const parentType = data.entityTypes.find((item) => item.id === parent!.typeId)?.name
    if (matchEnvironment(parent.name) || matchEnvironment(parentType)) {
      environmentName = parent.name
      environmentTypeName = parentType
      break
    }
  }
  return {
    routineId: routine.id, actionId: routine.actionId, primaryTargetId: targetId,
    // Constant identity key: never a generated occurrence, trigger ordinal, date or due state.
    occurrenceId: 'routine-library-identity-v1',
    subjectName: entity?.name, subjectTypeName: type?.name,
    actionName: action?.name, activityTitle: routine.name,
    environmentName, environmentTypeName,
  }
}

/**
 * Reuse the validated V1 renderer's bounded composition without supplying a real
 * occurrence. All edition choices therefore derive ONLY from stable routine input.
 * The collection/occurrence artwork retains its separate edition stream.
 */
export function getRoutineIdentityRecipe(
  routine: Pick<Routine, 'id' | 'actionId' | 'name' | 'targetEntityIds'>,
  data: Pick<WorkspaceData, 'actions' | 'entities' | 'entityTypes'>,
): CardVisualRecipe {
  const input = routineIdentityVisualInput(routine, data)
  const stableSeed = stableRoutineVisualSeed(input)
  const base = getCardVisualRecipe(input)
  return Object.freeze({
    ...base,
    stableSeed,
    occurrenceSeed: stableSeed,
    edition: Object.freeze({ stamp: 'house-care' as const, ordinal: null }),
  })
}
