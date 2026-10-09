import type { VectorArtboard } from './artboards'

export type PrimitiveFamily =
  | 'brand'
  | 'environment'
  | 'object'
  | 'tool'
  | 'supply'
  | 'decoration'
  | 'foundation-demo'

export interface VectorPoint {
  readonly x: number
  readonly y: number
}

export interface SafeInset {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export interface LimbAnchors {
  readonly leftArm?: VectorPoint
  readonly rightArm?: VectorPoint
  readonly leftLeg?: VectorPoint
  readonly rightLeg?: VectorPoint
}

export interface PrimitiveMetadata {
  readonly id: string
  readonly family: PrimitiveFamily
  readonly artboard: VectorArtboard
  readonly safeInset: SafeInset
  readonly faceAnchor?: VectorPoint
  readonly limbAnchors?: LimbAnchors
  readonly supportedActionFamilies: readonly string[]
  readonly supportedEnvironmentFamilies: readonly string[]
  readonly demoOnly?: boolean
}

export interface VectorPalette {
  readonly paper: string
  readonly surface: string
  readonly ink: string
  readonly inkMuted: string
  readonly primary: string
  readonly primarySoft: string
  readonly mustard: string
  readonly coral: string
  readonly danger: string
  readonly turquoise: string
}

export type VectorPatternKey =
  | 'halftoneFine'
  | 'halftoneMedium'
  | 'halftoneCoarse'
  | 'halftoneDiagonal'
  | 'halftoneRadialComic'
  | 'sparkles'
  | 'actionRays'

export interface VectorIdScope {
  readonly prefix: string
  id(localId: string): string
  url(localId: string): string
}

export interface PrimitiveRenderContext {
  readonly palette: VectorPalette
  readonly ids: VectorIdScope
  pattern(key: VectorPatternKey): string
}

export interface PrimitiveRenderLayers {
  /** Geometry-only silhouette. Child nodes should not set fill/stroke so a registration ink can be applied by the renderer. */
  readonly registration?: string
  readonly body: string
  readonly foreground?: string
}

export interface PrimitiveDefinition {
  readonly metadata: PrimitiveMetadata
  render(context: PrimitiveRenderContext): PrimitiveRenderLayers
}

export interface InkRegistrationOffset {
  readonly x: number
  readonly y: number
}
