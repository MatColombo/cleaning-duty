/** Phase 19A: pure deterministic decorative projection. Never touches the geometry model. */
import { stableVisualHash } from '../visual/id'
import { homeEntityArtId } from '../components/home/homeArtwork'
import type { Entity, EntityType, LayoutElement, LayoutScene } from '../types/domain'

export type HomeMotif = 'tiles' | 'parquet' | 'rays' | 'waves' | 'garden' | 'neutral'
export type HomeSilhouette = 'sink' | 'oven' | 'sofa' | 'bed' | 'table' | 'shower' | 'plant' | 'washer' | 'lamp' | 'tool' | 'generic'
export interface IllustratedElementRecipe {
  readonly seed: string
  readonly motif: HomeMotif
  readonly silhouette: HomeSilhouette
  readonly rotation: number
  readonly density: number
}
export const HOME_ILLUSTRATION_GENERATOR = 1
const KNOWN_SILHOUETTES: Readonly<Record<string, HomeSilhouette>> = {
  sink: 'sink', oven: 'oven', stovetop: 'oven', 'coffee-machine': 'oven',
  sofa: 'sofa', chair: 'sofa', bed: 'bed', table: 'table', countertop: 'table',
  'shower-head': 'shower', bathtub: 'shower', toilet: 'shower',
  plant: 'plant', washer: 'washer', dishwasher: 'washer', dryer: 'washer',
  lamp: 'lamp', broom: 'tool', mop: 'tool', vacuum: 'tool', 'spray-bottle': 'tool',
}
export function illustratedElementRecipe(scene: Pick<LayoutScene, 'id'|'kind'>, element: Pick<LayoutElement, 'id'|'role'>,
  entity: Pick<Entity, 'name'>, type?: Pick<EntityType,'name'>): IllustratedElementRecipe {
  const seed = stableVisualHash(`home-illustrated-v1|${scene.id}|${element.id}`)
  const subject = homeEntityArtId(entity, type, element.role === 'area')
  const environment: HomeMotif = scene.kind === 'outdoor' ? 'garden'
    : subject === 'sink' || subject === 'shower-head' || subject === 'washer' ? 'tiles'
    : subject === 'sofa' || subject === 'bed' || subject === 'table' ? 'parquet'
    : subject === 'plant' ? 'garden'
    : subject === 'oven' ? 'rays' : 'neutral'
  const alternatives: HomeMotif[] = environment === 'neutral' ? ['neutral', 'waves', 'rays'] : [environment]
  const number = parseInt(seed, 36) >>> 0
  return Object.freeze({ seed, motif: alternatives[number % alternatives.length],
    silhouette: KNOWN_SILHOUETTES[subject] ?? 'generic', rotation: (number % 5) - 2, density: 1 + (number % 3) })
}
export function homeIllustrationDetail(zoom: number, compact = false): 'minimal'|'normal'|'rich' {
  return compact || zoom < .9 ? 'minimal' : zoom >= 1.5 ? 'rich' : 'normal'
}
