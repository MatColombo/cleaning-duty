/** Presentation-only geometry. The authoritative numbers come from analytics.ts. */
export function outcomeBarShares(counts: readonly [number, number, number]): readonly [number, number, number] {
  const safe = counts.map((count) => Number.isFinite(count) ? Math.max(0, count) : 0)
  const total = safe[0] + safe[1] + safe[2]
  if (total === 0) return [0, 0, 0]
  return [safe[0] / total * 100, safe[1] / total * 100, safe[2] / total * 100]
}
