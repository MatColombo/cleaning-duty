import { generateCardVisualRecipe, type CardVisualRecipe } from './recipe'
import type { CardVisualInput } from './resolver'

/** Include semantic source fields: editing/renaming a target must not return a stale recipe. */
function recipeCacheKey(input: CardVisualInput): string {
  return JSON.stringify([
    input.routineId, input.actionId, input.primaryTargetId, input.occurrenceId,
    input.triggerOrdinal, input.isLinkedActivity, input.subjectName, input.subjectTypeName,
    input.actionName, input.activityTitle, input.environmentName, input.environmentTypeName,
  ])
}

/** Memory-only LRU. Independent from components, storage and Supabase. */
export class CardVisualRecipeCache {
  private readonly entries = new Map<string, CardVisualRecipe>()
  readonly maxEntries: number

  constructor(maxEntries = 512) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 4096) {
      throw new Error('Visual recipe cache size must be an integer between 1 and 4096')
    }
    this.maxEntries = maxEntries
  }

  get(input: CardVisualInput): CardVisualRecipe {
    const key = recipeCacheKey(input)
    const previous = this.entries.get(key)
    if (previous) {
      this.entries.delete(key)
      this.entries.set(key, previous)
      return previous
    }
    const recipe = generateCardVisualRecipe(input)
    this.entries.set(key, recipe)
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest)
    }
    return recipe
  }

  clear(): void { this.entries.clear() }
  get size(): number { return this.entries.size }
}

const sharedCardVisualRecipeCache = new CardVisualRecipeCache()
export function getCardVisualRecipe(input: CardVisualInput): CardVisualRecipe {
  return sharedCardVisualRecipeCache.get(input)
}
/** Intended for deterministic tests or explicitly clearing after a visual-language upgrade. */
export function clearCardVisualRecipeCache(): void {
  sharedCardVisualRecipeCache.clear()
}
