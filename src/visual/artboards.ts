export interface VectorArtboard {
  readonly id: 'icon' | 'small-object' | 'main-object' | 'scene' | 'card-art'
  readonly width: number
  readonly height: number
  readonly viewBox: string
}

function artboard(id: VectorArtboard['id'], width: number, height: number): VectorArtboard {
  return Object.freeze({ id, width, height, viewBox: `0 0 ${width} ${height}` })
}

export const VECTOR_ARTBOARDS = Object.freeze({
  icon: artboard('icon', 64, 64),
  smallObject: artboard('small-object', 128, 128),
  mainObject: artboard('main-object', 240, 240),
  scene: artboard('scene', 480, 320),
  cardArt: artboard('card-art', 640, 420),
})

export type VectorArtboardKey = keyof typeof VECTOR_ARTBOARDS
