import type { Routine, WorkspaceData } from '../../types/domain'

export type RoutineStatusFilter = 'all' | 'active' | 'paused' | 'ended'
export type RoutineCareFilter = 'all' | 'routine' | 'deep'

export interface RoutineLibraryCounts {
  regularActive: number
  deepActive: number
  paused: number
  ended: number
}

export function parentRoutines(data: Pick<WorkspaceData, 'routines'>): Routine[] {
  return data.routines.filter((routine) => !routine.archivedAt && !routine.parentRoutineId)
}

export function linkedRoutineConfigs(data: Pick<WorkspaceData, 'routines'>, parentId: string): Routine[] {
  return data.routines.filter((routine) => routine.parentRoutineId === parentId && !routine.archivedAt)
}

/** Presentation-only counts: paused/ended routines never inflate the active total. */
export function routineLibraryCounts(routines: readonly Routine[]): RoutineLibraryCounts {
  return {
    regularActive: routines.filter((item) => item.status === 'active' && item.careLevel !== 'deep').length,
    deepActive: routines.filter((item) => item.status === 'active' && item.careLevel === 'deep').length,
    paused: routines.filter((item) => item.status === 'paused').length,
    ended: routines.filter((item) => item.status === 'ended').length,
  }
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
}

/** This never mutates, schedules, or creates occurrences; it filters configuration rows. */
export function filterRoutinesForLibrary(
  routines: readonly Routine[],
  data: Pick<WorkspaceData, 'actions' | 'entities'>,
  query: string,
  status: RoutineStatusFilter,
  care: RoutineCareFilter,
): Routine[] {
  const needle = normalizeText(query)
  return routines.filter((routine) => {
    if (status !== 'all' && routine.status !== status) return false
    if (care !== 'all' && routine.careLevel !== care) return false
    if (!needle) return true
    const action = data.actions.find((item) => item.id === routine.actionId)
    const targets = routine.targetEntityIds.map((id) => data.entities.find((item) => item.id === id)?.name ?? '')
    return normalizeText([routine.name, action?.name ?? '', ...targets].join(' ')).includes(needle)
  })
}
