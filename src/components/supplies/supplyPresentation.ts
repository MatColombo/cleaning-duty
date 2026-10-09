import type { ActionDefinition, Routine, StockStatus, Supply } from '../../types/domain'
import { stableVisualHash } from '../../visual/id'
import { HOUSE_CARE_VISUAL_VERSION } from '../../visual/version'
import { matchExactSubject, normalizeVisualPhrase } from '../../visual/procedural/aliases'
import { hasPrimitiveDefinition } from '../../visual/registry'
import type { ExpressionId } from '../../visual/expressions'
import type { PoseId } from '../../visual/poses'

const statusExpressions: Record<StockStatus, ExpressionId> = {
  available: 'proud', low: 'worried', reserve_only: 'focused', out_of_stock: 'tired',
}
const statusPoses: Record<StockStatus, PoseId> = {
  available: 'thumbs-up', low: 'shrug', reserve_only: 'hands-on-hips', out_of_stock: 'arms-down',
}

/** Curated supply-role vocabulary, separate from appliance/entity inference. */
const supplyRoleAliases: readonly { readonly phrases: readonly string[]; readonly id: string }[] = [
  { phrases: ['microfiber cloth', 'microfibre cloth', 'microfiber', 'microfibre', 'microfibra', 'panni', 'panno'], id: 'microfiber-stack' },
  { phrases: ['sponge', 'sponges', 'spugna', 'spugne', 'spugnetta'], id: 'sponge' },
  { phrases: ['dishwasher tablets', 'dishwasher pods', 'tablet', 'tablets', 'pastiglie', 'capsule', 'tabs lavastoviglie'], id: 'tablet-pack' },
  { phrases: ['paper towels', 'paper roll', 'toilet paper', 'paper', 'carta', 'rotolo', 'scottex'], id: 'paper-roll' },
  { phrases: ['spray', 'glass cleaner', 'window cleaner', 'vetri', 'sgrassatore', 'degreaser', 'spruzzino'], id: 'spray-bottle' },
  { phrases: ['detergent', 'laundry', 'detersivo', 'ammorbidente', 'fabric softener'], id: 'detergent-bottle' },
  { phrases: ['brush', 'scrubber', 'spazzola', 'spazzolino'], id: 'scrub-brush' },
  { phrases: ['floor cleaner', 'disinfectant', 'bleach', 'descaler', 'anticalcare', 'disincrostante', 'disinfettante', 'candeggina', 'detergente', 'cleaner', 'sapone'], id: 'cleaner-bottle' },
  { phrases: ['bucket', 'secchio'], id: 'bucket' },
  { phrases: ['broom', 'scopa'], id: 'broom' },
] as const

function hasPhrase(text: string, phrase: string): boolean {
  return (` ${text} `).includes(` ${normalizeVisualPhrase(phrase)} `)
}

export function supplyPrimitiveId(name: string): string {
  const normalized = normalizeVisualPhrase(name)
  const specialized = supplyRoleAliases.find(({ phrases }) => phrases.some((phrase) => hasPhrase(normalized, phrase)))
  // Explicitly reject any non-supply subject returned by generic entity matching.
  const exact = matchExactSubject(name)?.primitiveId
  const safeSubjects = new Set(['spray-bottle', 'cleaner-bottle', 'detergent-bottle', 'sponge', 'cloth', 'microfiber-stack', 'tablet-pack', 'paper-roll', 'generic-supply', 'bucket', 'duster', 'scrub-brush', 'squeegee', 'broom', 'mop'])
  const id = specialized?.id ?? (exact && safeSubjects.has(exact) ? exact : 'generic-supply')
  if (!hasPrimitiveDefinition(id)) throw new Error(`Supply artwork is not authored: ${id}`)
  return id
}

export function supplyLibraryVisual(supply: Pick<Supply, 'id' | 'name' | 'status'>) {
  const hash = parseInt(stableVisualHash(`supply-library-v${HOUSE_CARE_VISUAL_VERSION}|${supply.id}`), 36)
  const inks = ['teal', 'turquoise', 'mustard', 'coral'] as const
  return Object.freeze({
    subjectId: supplyPrimitiveId(supply.name),
    expression: statusExpressions[supply.status],
    pose: statusPoses[supply.status],
    ink: inks[hash % inks.length],
    identityKey: `supply-library-v${HOUSE_CARE_VISUAL_VERSION}-${supply.id}`,
  })
}

export function activeSupplyReferences(supplyId: string, actions: readonly ActionDefinition[], routines: readonly Routine[]): boolean {
  return actions.some((action) => !action.archivedAt && action.defaultSupplyIds.includes(supplyId))
    || routines.some((routine) => !routine.archivedAt && (routine.supplyIdsOverride?.includes(supplyId) ?? false))
}

export function supplyStatusCounts(supplies: readonly Supply[]): Record<StockStatus, number> {
  return supplies.reduce((counts, supply) => {
    if (!supply.archivedAt) counts[supply.status] += 1
    return counts
  }, { available: 0, low: 0, reserve_only: 0, out_of_stock: 0 } as Record<StockStatus, number>)
}

export function filterSupplyLibrary(supplies: readonly Supply[], query: string, status: StockStatus | 'all'): Supply[] {
  const q = normalizeVisualPhrase(query)
  return supplies.filter((supply) => !supply.archivedAt && (status === 'all' || supply.status === status)
    && (!q || normalizeVisualPhrase([supply.name, supply.unit ?? ''].join(' ')).includes(q)))
}
