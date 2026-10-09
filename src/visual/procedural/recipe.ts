import { deterministicInkOffset } from '../misregistration'
import { stableVisualHash } from '../id'
import type { ExpressionId } from '../expressions'
import { POSE_IDS, type PoseId } from '../poses'
import { DECORATION_IDS, type DecorationId } from '../decorations'
import { VECTOR_PATTERN_KEYS } from '../patterns'
import { HOUSE_CARE_VISUAL_VERSION } from '../version'
import { resolveCardVisualSemantics, type CardSemanticResolution, type CardVisualInput } from './resolver'
import {
  CARD_BORDER_STYLES, CARD_PALETTE_VARIANTS, CARD_STAMPS, CARD_TEMPLATES,
  type CardBorderStyle, type CardPaletteVariant, type CardStamp, type CardTemplate,
} from './taxonomy'
import type { InkRegistrationOffset, VectorPatternKey } from '../types'

export interface CardDecorationPlacement {
  readonly id: DecorationId
  /** Position in the canonical 640 × 420 Card Art viewBox, not CSS pixels. */
  readonly x: number
  readonly y: number
  readonly scale: number
}
export interface CardVisualRecipe {
  readonly version: typeof HOUSE_CARE_VISUAL_VERSION
  readonly stableSeed: string
  readonly occurrenceSeed: string
  readonly semantics: CardSemanticResolution
  readonly paletteVariant: CardPaletteVariant
  readonly template: CardTemplate
  readonly border: CardBorderStyle
  readonly backgroundPattern: VectorPatternKey
  readonly personality: 'cheerful' | 'steady' | 'focused'
  readonly expression: ExpressionId
  readonly pose: PoseId
  readonly decorations: readonly CardDecorationPlacement[]
  readonly halftone: 'fine' | 'medium' | 'coarse'
  readonly inkOffset: InkRegistrationOffset
  /** Controlled wear coefficient; geometric only (no SVG turbulence). */
  readonly distress: number
  readonly edition: { readonly stamp: CardStamp; readonly ordinal: number | null }
}

/** Fixed v1 stream; never depend on ambient time, Math.random(), or array insertion order. */
function prng(seed: string): () => number {
  let state = Number.parseInt(stableVisualHash(seed), 36) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function one<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)]!
}

export function stableRoutineVisualSeed(input: Pick<CardVisualInput, 'routineId' | 'actionId' | 'primaryTargetId'>): string {
  return stableVisualHash(JSON.stringify([
    input.routineId, input.actionId || 'unknown-action', input.primaryTargetId || 'no-target', HOUSE_CARE_VISUAL_VERSION,
  ]))
}
export function occurrenceVisualSeed(stableSeed: string, input: Pick<CardVisualInput, 'occurrenceId' | 'triggerOrdinal'>): string {
  const ordinal = Number.isSafeInteger(input.triggerOrdinal) && (input.triggerOrdinal ?? 0) > 0 ? input.triggerOrdinal : 0
  return stableVisualHash(JSON.stringify([stableSeed, input.occurrenceId, ordinal]))
}

const cheerfulExpressions: readonly ExpressionId[] = ['joyful', 'smile', 'proud', 'relieved']
const steadyExpressions: readonly ExpressionId[] = ['smile', 'neutral', 'focused', 'proud']
const focusedExpressions: readonly ExpressionId[] = ['focused', 'neutral', 'worried', 'sweaty']
const actionPoses: Partial<Record<CardSemanticResolution['actionFamily'], readonly PoseId[]>> = {
  wipe: ['hold-cloth', 'scrub', 'thumbs-up'], spray: ['present', 'thumbs-up'],
  scrub: ['scrub', 'hold-sponge', 'fist-pump'], vacuum: ['fist-pump', 'present'],
  mop: ['scrub', 'present'], dust: ['hold-cloth', 'wave'], wash: ['hold-sponge', 'scrub'],
  descale: ['hold-sponge', 'fist-pump'], degrease: ['hold-sponge', 'fist-pump'],
  disinfect: ['fist-pump', 'thumbs-up'], polish: ['hold-cloth', 'present'],
  tidy: ['celebrate', 'thumbs-up'], inspect: ['point', 'hands-on-hips'],
  refill: ['present', 'point'], move: ['shrug', 'hands-on-hips'],
  maintain: ['point', 'fist-pump'],
}
const stampPool: readonly CardStamp[] = CARD_STAMPS.filter((stamp) => stamp !== 'extra-care')
const allowedAccents: readonly DecorationId[] = DECORATION_IDS.filter((item) => [
  'sparkle-4', 'sparkle-6', 'action-rays', 'steam', 'droplets', 'bubbles', 'dust', 'shine',
].includes(item))
const backgroundOptions: readonly VectorPatternKey[] = VECTOR_PATTERN_KEYS.filter((item) => [
  'halftoneFine', 'halftoneMedium', 'halftoneCoarse', 'halftoneDiagonal', 'halftoneRadialComic',
].includes(item))

/**
 * Only pure, compact visual instructions. No SVG markup, user text, binary image,
 * due-date assessment, reward value, or database writes.
 */
export function generateCardVisualRecipe(input: CardVisualInput): CardVisualRecipe {
  const stableSeed = stableRoutineVisualSeed(input)
  const occurrenceSeed = occurrenceVisualSeed(stableSeed, input)
  const identityRandom = prng(`v1|routine|${stableSeed}`)
  const editionRandom = prng(`v1|occurrence|${occurrenceSeed}`)
  const semantics = resolveCardVisualSemantics(input)
  const paletteVariant = one(CARD_PALETTE_VARIANTS, identityRandom)
  const template = one(CARD_TEMPLATES, identityRandom)
  const border = one(CARD_BORDER_STYLES, identityRandom)
  const backgroundPattern = one(backgroundOptions, identityRandom)
  const personality = one(['cheerful', 'steady', 'focused'] as const, identityRandom)
  const expressions = personality === 'cheerful' ? cheerfulExpressions : personality === 'steady' ? steadyExpressions : focusedExpressions
  const expression = one(expressions, editionRandom)
  const pose = one(actionPoses[semantics.actionFamily] ?? POSE_IDS, editionRandom)
  const count = 1 + Math.floor(editionRandom() * 3) // 1..3 small accents
  const decorations: CardDecorationPlacement[] = []
  for (let index = 0; index < count; index += 1) {
    // Accents occupy assigned side margins, away from the subject's face.
    const leftSide = index % 2 === 0
    decorations.push(Object.freeze({
      id: one(allowedAccents, editionRandom),
      x: leftSide ? 54 + Math.round(editionRandom() * 90) : 495 + Math.round(editionRandom() * 90),
      y: 58 + Math.round(editionRandom() * 290),
      scale: Number((0.18 + editionRandom() * 0.19).toFixed(2)),
    }))
  }
  const halftone = one(['fine', 'medium', 'coarse'] as const, editionRandom)
  const offset = deterministicInkOffset(`v1|${occurrenceSeed}`, 1.5)
  const inkOffset = Object.freeze({ x: offset.x, y: offset.y })
  const distress = Number((0.04 + editionRandom() * 0.2).toFixed(2))
  const ordinal = Number.isSafeInteger(input.triggerOrdinal) && (input.triggerOrdinal ?? 0) > 0 ? input.triggerOrdinal! : null
  const edition = Object.freeze({ stamp: input.isLinkedActivity === true ? 'extra-care' as const : one(stampPool, editionRandom), ordinal })
  return Object.freeze({
    version: HOUSE_CARE_VISUAL_VERSION, stableSeed, occurrenceSeed, semantics,
    paletteVariant, template, border, backgroundPattern, personality, expression,
    pose, decorations: Object.freeze(decorations), halftone, inkOffset, distress, edition,
  })
}
