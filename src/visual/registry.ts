import { foundationDemoPrimitives } from './primitives/foundation'
import { authoredObjectPrimitives } from './primitives/authored'
import { expandedObjectPrimitives } from './primitives/expanded'
import type { PrimitiveDefinition } from './types'

const definitions: readonly PrimitiveDefinition[] = Object.freeze([
  ...foundationDemoPrimitives,
  ...authoredObjectPrimitives,
  ...expandedObjectPrimitives,
])

const byId = new Map(definitions.map((definition) => [definition.metadata.id, definition] as const))
if (byId.size !== definitions.length) throw new Error('Duplicate House Care V2 primitive id')

export function listPrimitiveDefinitions(): readonly PrimitiveDefinition[] {
  return definitions
}

export function getPrimitiveDefinition(id: string): PrimitiveDefinition {
  const definition = byId.get(id)
  if (!definition) throw new Error(`Unknown House Care V2 primitive: ${id}`)
  return definition
}

export function hasPrimitiveDefinition(id: string): boolean {
  return byId.has(id)
}
