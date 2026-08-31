import { useMemo } from 'react'
import type { Routine, WorkspaceData } from '../types/domain'
import { simulateRoutine } from '../lib/simulation'
import { formatTaskDateTime } from '../lib/date'
import { useI18n } from '../contexts/I18nContext'

export function RoutineSimulation({ data, routine }: { data: WorkspaceData; routine: Routine }) {
  const { t, locale } = useI18n()
  const rows = useMemo(() => simulateRoutine(data, routine, 30), [data, routine])
  return <div className="simulation-box"><div className="section-header"><div><strong>{t('simulation30')}</strong><small>{t('simulationHint')}</small></div><span className="count-pill">{rows.length}</span></div>
    {!rows.length ? <p className="muted compact-text">{t('noSimulationRows')}</p> : <div className="simulation-list">{rows.map((row, index) => <div className="simulation-row" key={`${row.dueAt}-${index}`}><div><strong>{formatTaskDateTime(row.dueAt, locale, data.workspace.timezone)}</strong><small>{row.targetNames.join(', ') || t('noMatchedTargets')}</small></div><div><span>{row.assignmentScope === 'everyone' ? t('everyone') : row.assigneeName ?? t('anyone')}</span>{row.conflicts.length > 0 && <small className="danger-text">{row.conflicts.join(' · ')}</small>}</div></div>)}</div>}
  </div>
}
