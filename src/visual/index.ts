export { VECTOR_ARTBOARDS } from './artboards'
export { createSvgIdScope, sanitizeSvgIdPart, stableVisualHash } from './id'
export { deterministicInkOffset } from './misregistration'
export { CSS_VECTOR_PALETTE, mixHex, vectorPaletteFromTheme } from './palette'
export { VECTOR_PATTERN_KEYS, renderVectorDefs } from './patterns'
export { getPrimitiveDefinition, hasPrimitiveDefinition, listPrimitiveDefinitions } from './registry'
export { renderPrimitiveSvg } from './render'
export { HOUSE_CARE_VISUAL_VERSION } from './version'
export type {
  InkRegistrationOffset,
  PrimitiveDefinition,
  PrimitiveFamily,
  PrimitiveMetadata,
  PrimitiveRenderContext,
  PrimitiveRenderLayers,
  SafeInset,
  VectorIdScope,
  VectorPalette,
  VectorPatternKey,
  VectorPoint,
} from './types'

// Phase 4: authored reusable visual language (no procedural choices).
export { AUTHORED_OBJECT_IDS } from './primitives/authored'
export { EXPRESSION_IDS, renderExpressionMark, renderExpressionPreviewSvg } from './expressions'
export { POSE_IDS, renderPoseLayers } from './poses'
export { DECORATION_IDS, renderDecorationSvg, renderDecorationMarkup } from './decorations'
export { renderManualCharacterSvg } from './compose'
export type { ExpressionId } from './expressions'
export type { PoseId } from './poses'
export type { DecorationId } from './decorations'
export type { ManualCharacterOptions, ManualDecoration } from './compose'

// Phase 5: pure semantic-to-art projection and deterministic v1 card recipes.
// No storage, task mutations, runtime AI, or presentation-page dependency.
export * from './procedural'

export { deriveVisualInkRoles, artContrastRatio } from './VisualPaletteAdapter'
