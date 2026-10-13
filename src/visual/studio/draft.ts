import { EXPRESSION_IDS, type ExpressionId } from '../expressions'
import { POSE_IDS, type PoseId } from '../poses'
import { listPrimitiveDefinitions, hasPrimitiveDefinition } from '../registry'
import { CARD_PALETTE_VARIANTS, ENVIRONMENT_FAMILIES, type CardPaletteVariant, type EnvironmentFamily } from '../procedural/taxonomy'
import type { CardVisualRecipe } from '../procedural/recipe'

/** Preview-only, nonpersistent values. No arbitrary URLs, markup, colors, or scripts. */
export const STUDIO_OBJECT_IDS = Object.freeze(listPrimitiveDefinitions()
  .filter(({ metadata }) => !metadata.demoOnly && (metadata.family === 'object' || metadata.family === 'tool' || metadata.family === 'supply'))
  .map(({ metadata }) => metadata.id).sort())
export const STUDIO_GESTURES = ['thumb', 'open', 'fist', 'point', 'hold'] as const
export const STUDIO_PROPS = ['none', 'sparkle-4', 'sparkle-6', 'action-rays', 'steam', 'droplets', 'shine'] as const
export const STUDIO_PROPORTIONS = ['standard', 'compact', 'tall'] as const
export const STUDIO_ANIMATIONS = ['none', 'tilt', 'blink', 'gesture'] as const
export type StudioGesture = typeof STUDIO_GESTURES[number]
export type StudioProp = typeof STUDIO_PROPS[number]
export type StudioProportion = typeof STUDIO_PROPORTIONS[number]
export type StudioAnimation = typeof STUDIO_ANIMATIONS[number]

export interface StudioOverrides {
  readonly subjectId?: string
  readonly expression?: ExpressionId
  readonly eyes?: ExpressionId
  readonly mouth?: ExpressionId
  readonly brows?: ExpressionId
  readonly pose?: PoseId
  readonly handGesture?: StudioGesture
  readonly scale?: number
  readonly proportion?: StudioProportion
  readonly prop?: StudioProp
  readonly scene?: EnvironmentFamily
  readonly paletteVariant?: CardPaletteVariant
  readonly animation?: StudioAnimation
}
export type StudioField = keyof StudioOverrides

const enums = {
  expression: EXPRESSION_IDS, eyes: EXPRESSION_IDS, mouth: EXPRESSION_IDS, brows: EXPRESSION_IDS,
  pose: POSE_IDS, handGesture: STUDIO_GESTURES, proportion: STUDIO_PROPORTIONS,
  prop: STUDIO_PROPS, scene: ENVIRONMENT_FAMILIES, paletteVariant: CARD_PALETTE_VARIANTS,
  animation: STUDIO_ANIMATIONS,
} as const

export function sanitizeStudioOverrides(value: unknown): StudioOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({})
  const source = value as Record<string, unknown>
  const output: Record<string, string | number> = {}
  if (typeof source.subjectId === 'string' && STUDIO_OBJECT_IDS.includes(source.subjectId) && hasPrimitiveDefinition(source.subjectId)) {
    output.subjectId = source.subjectId
  }
  for (const [field, allowed] of Object.entries(enums)) {
    const candidate = source[field]
    if (typeof candidate === 'string' && (allowed as readonly string[]).includes(candidate)) output[field] = candidate
  }
  if (typeof source.scale === 'number' && Number.isFinite(source.scale)) {
    output.scale = Math.round(Math.max(.75, Math.min(1.25, source.scale)) * 20) / 20
  }
  // Auto-equivalent defaults do not become saved override entries.
  if (output.prop === 'none') delete output.prop
  if (output.proportion === 'standard') delete output.proportion
  if (output.animation === 'none') delete output.animation
  return Object.freeze(output as StudioOverrides)
}

export function overlayStudioRecipe(auto: CardVisualRecipe, raw: unknown): CardVisualRecipe {
  const patch = sanitizeStudioOverrides(raw)
  if (Object.keys(patch).every((key) => !['subjectId', 'expression', 'pose', 'scene', 'paletteVariant'].includes(key))) return auto
  return Object.freeze({
    ...auto,
    semantics: Object.freeze({ ...auto.semantics, subjectId: patch.subjectId ?? auto.semantics.subjectId,
      environment: patch.scene ?? auto.semantics.environment }),
    expression: patch.expression ?? auto.expression,
    pose: patch.pose ?? auto.pose,
    paletteVariant: patch.paletteVariant ?? auto.paletteVariant,
  })
}

/** A draft snapshot is immutable so Undo always restores exactly the previous rendering. */
export function studioUndo(history: readonly StudioOverrides[]): { history: StudioOverrides[]; current: StudioOverrides } {
  if (history.length < 2) return { history: [...history], current: history[0] ?? {} }
  const next = history.slice(0, -1)
  return { history: next, current: next[next.length - 1] }
}
