/** Phase 16D. Navigation-scoped timings, no user IDs, household data or telemetry upload. */
export type StartupMilestone = 'bundle-execution' | 'auth-ready' | 'catalog-start' | 'catalog-ready' | 'workspace-selected' | 'snapshot-read' |
  'snapshot-hydrated' | 'cloud-read-start' | 'tables-start' | 'tables-end' | 'cloud-read-end' | 'materialization-end' |
  'overview-paint' | 'boot-exit'
const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
const marks: Partial<Record<StartupMilestone, number>> = {}
let path: 'cold' | 'warm' | 'offline' | 'local' = 'cold'
export function startupMark(name: StartupMilestone): void {
  if (marks[name] !== undefined) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  marks[name] = Math.round((now - started) * 10) / 10
  try { performance.mark(`housecare:${name}`) } catch { /* instrumentation optional */ }
  if (name === 'boot-exit') {
    try { sessionStorage.setItem('housecare:startup:last', JSON.stringify(readStartupWaterfall())) }
    catch { /* diagnostics must not affect boot */ }
  }
}
export function startupPath(value: typeof path): void { path = value }
export function readStartupWaterfall(): { path: typeof path; milestonesMs: Partial<Record<StartupMilestone, number>> } {
  return { path, milestonesMs: { ...marks } }
}
startupMark('bundle-execution')

/** Run recurrence generation after the first opportunity to paint the usable UI. */
export function afterFirstFrame(work: () => void): void {
  if (typeof requestAnimationFrame === 'function' && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
    requestAnimationFrame(() => { setTimeout(work, 0) })
  } else { setTimeout(work, 0) }
}
