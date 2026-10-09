import type { Entity, EntityType } from '../../types/domain'
import { matchEnvironment } from '../../visual/procedural/aliases'
import { resolveCardVisualSemantics } from '../../visual/procedural/resolver'
import type { ExpressionId } from '../../visual/expressions'

/** Decorative projection only. Never used to classify rooms for scheduling or edit semantics. */
const roomMotifs = {
  kitchen: 'countertop', bathroom: 'shower-head', living: 'sofa',
  bedroom: 'bed', dining: 'table', hallway: 'house', utility: 'washer',
  outdoor: 'plant', 'generic-interior': 'house',
} as const

export function homeEntityArtId(entity: Pick<Entity, 'name'>, entityType?: Pick<EntityType, 'name'>, isRoom = false): string {
  if (isRoom) {
    const environment = matchEnvironment(entity.name) ?? matchEnvironment(entityType?.name) ?? 'generic-interior'
    return roomMotifs[environment]
  }
  return resolveCardVisualSemantics({
    routineId: 'home-presentation', occurrenceId: 'home-presentation',
    subjectName: entity.name, subjectTypeName: entityType?.name,
  }).subjectId
}

/** The actual numeric score and status text remain independently visible in HTML. */
export function homeMoodExpression(score: number | null): ExpressionId {
  return score == null ? 'neutral' : score >= 70 ? 'proud' : score >= 40 ? 'focused' : score >= 20 ? 'worried' : 'sweaty'
}

/** Color-independent room badge label derived from the existing room workflow. */
export function homeRoomStatusLabel(status: 'none' | 'due_today' | 'overdue' | 'both', due: string, overdue: string): string | null {
  if (status === 'both') return `${overdue} · ${due}`
  if (status === 'overdue') return overdue
  if (status === 'due_today') return due
  return null
}
