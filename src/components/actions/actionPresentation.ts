import type { ActionDefinition, Routine, Supply } from '../../types/domain'
import { stableVisualHash } from '../../visual/id'
import { HOUSE_CARE_VISUAL_VERSION } from '../../visual/version'
import { matchActionFamily, normalizeVisualPhrase } from '../../visual/procedural/aliases'
import type { ActionFamily } from '../../visual/procedural/taxonomy'
import { hasPrimitiveDefinition } from '../../visual/registry'
import type { ExpressionId } from '../../visual/expressions'
import type { PoseId } from '../../visual/poses'

/** The Actions library is a catalog of reusable tools, not a task/occurrence view. */
export interface ActionLibraryVisual {
  readonly family: ActionFamily
  readonly subjectId: string
  readonly expression: ExpressionId
  readonly pose: PoseId
  readonly ink: 'teal' | 'coral' | 'mustard' | 'turquoise'
  readonly identityKey: string
}

const actionSubjects: Record<ActionFamily, string> = {
  wipe: 'cloth', spray: 'spray-bottle', scrub: 'scrub-brush',
  vacuum: 'vacuum', mop: 'mop', dust: 'duster', wash: 'sponge',
  descale: 'cleaner-bottle', degrease: 'spray-bottle', disinfect: 'spray-bottle',
  polish: 'cloth', tidy: 'broom', inspect: 'generic-tool',
  refill: 'detergent-bottle', move: 'generic-tool', maintain: 'generic-tool',
  'generic-care': 'generic-tool',
}
const actionPoses: Partial<Record<ActionFamily, PoseId>> = {
  wipe: 'hold-cloth', spray: 'present', scrub: 'scrub', vacuum: 'present',
  mop: 'present', dust: 'wave', wash: 'hold-sponge', descale: 'present',
  degrease: 'fist-pump', disinfect: 'present', polish: 'hold-cloth', tidy: 'celebrate',
  inspect: 'point', refill: 'present', move: 'hands-on-hips', maintain: 'present',
}
const expressions: readonly ExpressionId[] = ['joyful', 'proud', 'smile', 'focused']
const inks = ['teal', 'coral', 'mustard', 'turquoise'] as const

/** Stable per Action ID; never uses a pseudo occurrence or persisted image. */
export function actionLibraryVisual(action: Pick<ActionDefinition, 'id' | 'name'>): ActionLibraryVisual {
  const family = matchActionFamily(action.name)
  const subjectId = actionSubjects[family]
  if (!hasPrimitiveDefinition(subjectId)) throw new Error(`Action artwork is not authored: ${subjectId}`)
  const hash = parseInt(stableVisualHash(`action-library-v${HOUSE_CARE_VISUAL_VERSION}|${action.id}`), 36)
  return Object.freeze({
    family, subjectId,
    expression: expressions[hash % expressions.length],
    pose: actionPoses[family] ?? 'thumbs-up',
    ink: inks[Math.floor(hash / 17) % inks.length],
    identityKey: `action-library-v${HOUSE_CARE_VISUAL_VERSION}-${action.id}`,
  })
}

export function activeActionReferences(actionId: string, routines: readonly Routine[]): boolean {
  return routines.some((routine) => !routine.archivedAt && routine.actionId === actionId)
}

export function filterActionLibrary(
  actions: readonly ActionDefinition[], supplies: readonly Supply[], query: string, family: ActionFamily | 'all',
): ActionDefinition[] {
  const q = normalizeVisualPhrase(query)
  return actions.filter((action) => {
    if (action.archivedAt) return false
    if (family !== 'all' && matchActionFamily(action.name) !== family) return false
    if (!q) return true
    const names = action.defaultSupplyIds.map((id) => supplies.find((supply) => supply.id === id)?.name ?? '')
    return normalizeVisualPhrase([action.name, action.instructions ?? '', ...names].join(' ')).includes(q)
  })
}
