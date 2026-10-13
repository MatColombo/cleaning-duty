import type { StockStatus, TaskOccurrence, TaskSupplySnapshot, WorkspaceData } from '../types/domain'
import type { AdditionalActivityAppendixEntry } from './presentation'

/** Existing canonical Stock order from home.ts; missing inventory must not be presented as Available. */
const STOCK_PRIORITY: Record<StockStatus, number> = {
  out_of_stock: 0, reserve_only: 1, low: 2, available: 3,
}

export interface CardSupply {
  supplyId: string
  name: string
  /** null means inventory missing/archived; do not invent a stock state. */
  status: StockStatus | null
  /** On-hand inventory; these are NOT amounts required to perform the activity. */
  quantity?: number
  unit?: string
}

/** Merge primary and *due* appendix requirements by supply ID without losing unknown stock. */
export function requiredCardSupplies(data: WorkspaceData, task: TaskOccurrence, appendix: AdditionalActivityAppendixEntry[]): CardSupply[] {
  const snapshots: TaskSupplySnapshot[] = [
    ...task.supplies,
    ...appendix.filter(extra => extra.status === 'due' || (extra.status == null && extra.occurrence?.state === 'scheduled'))
      .flatMap(extra => extra.supplies),
  ]
  const byId = new Map<string, CardSupply>()
  const inventory = new Map(data.supplies.filter(supply => !supply.archivedAt).map(supply => [supply.id, supply]))
  for (const snapshot of snapshots) {
    if (!snapshot.supplyId || byId.has(snapshot.supplyId)) continue
    const supply = inventory.get(snapshot.supplyId)
    byId.set(snapshot.supplyId, {
      supplyId: snapshot.supplyId, name: supply?.name || snapshot.supplyName || snapshot.supplyId,
      status: supply?.status ?? null,
      ...(supply?.quantity != null ? { quantity: supply.quantity } : {}),
      ...(supply?.unit ? { unit: supply.unit } : {}),
    })
  }
  return [...byId.values()].sort((a, b) => {
    const left = a.status == null ? 4 : STOCK_PRIORITY[a.status]
    const right = b.status == null ? 4 : STOCK_PRIORITY[b.status]
    return left - right || a.name.localeCompare(b.name) || a.supplyId.localeCompare(b.supplyId)
  })
}

export function visibleCardSupplies(supplies: CardSupply[], count = 4) {
  return { shown: supplies.slice(0, count), hiddenCount: Math.max(0, supplies.length - count) }
}
