/** Pure tab-cycle decision used by modal Sheet, including the House Menu. */
export interface FocusTarget { focus(): void }

export function nextWrappedFocus<T extends FocusTarget>(
  focusables: readonly T[],
  active: T | null,
  backwards: boolean,
): T | null {
  if (!focusables.length) return null
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (backwards && (active === first || !focusables.includes(active as T))) return last
  if (!backwards && (active === last || !focusables.includes(active as T))) return first
  return null
}
