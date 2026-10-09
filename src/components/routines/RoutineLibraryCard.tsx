import { useI18n } from '../../contexts/I18nContext'
import type { AssignmentPolicy, RecurrenceRule, Routine, WorkspaceData } from '../../types/domain'
import { RoutineIdentityArtwork } from './RoutineIdentityArtwork'
import { linkedRoutineConfigs } from './routinePresentation'

const weekdayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

interface Props {
  routine: Routine
  data: WorkspaceData
  onEdit: (routine: Routine) => void
  onStatusChange: (id: string, status: 'active' | 'paused' | 'ended') => void
  onArchive: (id: string) => void
}

export function RoutineLibraryCard({ routine, data, onEdit, onStatusChange, onArchive }: Props) {
  const { t, locale } = useI18n()
  const action = data.actions.find((item) => item.id === routine.actionId && !item.archivedAt)
  const targetNames = routine.targetEntityIds.map((id) => {
    const name = data.entities.find((item) => item.id === id)?.name
    return name ? `${name}${routine.includeDescendantTargetIds.includes(id) ? ' +' : ''}` : undefined
  }).filter((name): name is string => Boolean(name))
  const supplyIds = routine.supplyIdsOverride ?? action?.defaultSupplyIds ?? []
  const supplyNames = supplyIds.map((id) => data.supplies.find((item) => item.id === id && !item.archivedAt)?.name).filter((name): name is string => Boolean(name))
  const linked = linkedRoutineConfigs(data, routine.id)
  const label = (key: 'what' | 'where' | 'when' | 'who' | 'supplies') => t(key)

  function scheduleText(rule: RecurrenceRule) {
    if (rule.kind === 'once') return rule.date
    if (rule.kind === 'daily') return `${t('every')} ${rule.interval} ${t('days')}`
    if (rule.kind === 'interval') {
      const unit = rule.unit === 'hour' ? t('hours') : rule.unit === 'day' ? t('days') : rule.unit === 'week' ? t('weeks') : t('months')
      return `${t('every')} ${rule.interval} ${unit}`
    }
    if (rule.kind === 'weekdays') return `${rule.weekdays.map((day) => t(weekdayKeys[day])).join(', ')} · ${t('every')} ${rule.intervalWeeks} ${t('weeks')}`
    const ordinal = rule.ordinal === 1 ? t('first') : rule.ordinal === 2 ? t('second') : rule.ordinal === 3 ? t('third') : rule.ordinal === 4 ? t('fourth') : t('last')
    return `${ordinal} ${t(weekdayKeys[rule.weekday])} · ${t('every')} ${rule.intervalMonths} ${t('months')}`
  }
  function assignmentText(policy: AssignmentPolicy) {
    if (policy.mode === 'unassigned') return t('anyone')
    if (policy.mode === 'everyone') return t('everyone')
    if (policy.mode === 'alternate') return t('alternate')
    if (policy.mode === 'advanced') return `${t('advanced')} · ${t(policy.strategy === 'round_robin' ? 'roundRobin' : policy.strategy === 'least_recent' ? 'leastRecent' : policy.strategy === 'weighted' ? 'weightedRotation' : 'workloadAware')}`
    return data.members.find((member) => member.id === policy.memberId)?.displayName ?? t('anyone')
  }
  const targetSummary = [...targetNames, ...(routine.advancedTargetSelector?.conditions.length ? [t('dynamicTargets')] : [])].join(', ') || '—'
  const careLabel = routine.careLevel === 'deep' ? t('deepCleaning') : t('routineCleaning')
  const statusLabel = routine.status === 'active' ? t('active') : routine.status === 'paused' ? t('paused') : t('ended')
  return <article className={`card v2-routine-card is-${routine.status}`}>
    <div className="v2-routine-card-main">
      <RoutineIdentityArtwork routine={routine} data={data} />
      <div className="v2-routine-card-copy">
        <div className="v2-routine-card-topline">
          <span className="v2-print-eyebrow">{action?.name ?? t('action')}</span>
          <span className={`v2-routine-status is-${routine.status}`}>{statusLabel}</span>
        </div>
        <h2 className="hc-card-title">{routine.name}</h2>
        <div className="v2-routine-chips">
          <span className={`care-level-tag ${routine.careLevel}`}>{careLabel}</span>
          <span className="v2-routine-mode">{routine.scheduleMode === 'after_completion' ? t('afterCompletion') : t('fixedCalendar')}</span>
          {routine.affectsCleanliness === false && <span className="v2-routine-not-tracked">{t('cleanlinessExcluded')}</span>}
        </div>
        <dl className="v2-routine-facts">
          <div><dt>{label('where')}</dt><dd>{targetSummary}</dd></div>
          <div><dt>{label('when')}</dt><dd>{scheduleText(routine.recurrence)} · {routine.timeOfDay}</dd></div>
          <div><dt>{label('who')}</dt><dd>{assignmentText(routine.assignment)}</dd></div>
          <div><dt>{label('supplies')}</dt><dd>{supplyNames.length ? supplyNames.join(', ') : t('noRequiredProducts')}</dd></div>
        </dl>
      </div>
    </div>
    {linked.length > 0 && <section className="v2-routine-linked-config" aria-label={t('additionalActivities')}>
      <div className="v2-routine-linked-head">
        <span className="v2-routine-linked-stamp">✦ {t('extraCare')}</span>
        <span className="v2-routine-config-label">{locale === 'it' ? 'Configurazione · non ancora un’attività prevista' : 'Configured · not an issued task'}</span>
      </div>
      <ul>{linked.map((child) => <li key={child.id}>
        <strong>{child.name}</strong>
        <span>{t('everyParentTriggers').replace('N', String(child.triggerEvery ?? 1))}</span>
        {child.targetEntityIds.length > 0 && <small>{child.targetEntityIds.map((id) => data.entities.find((entity) => entity.id === id)?.name).filter(Boolean).join(', ')}</small>}
        <small>{[data.actions.find((item) => item.id === child.actionId)?.name,
          child.careLevel === 'deep' ? t('deepCleaning') : t('routineCleaning'),
          child.affectsCleanliness === false ? t('cleanlinessExcluded') : null,
        ].filter(Boolean).join(' · ')}</small>
      </li>)}</ul>
    </section>}
    <div className="v2-routine-actions" aria-label={locale === 'it' ? `Gestisci ${routine.name}` : `Manage ${routine.name}`}>
      <button type="button" className="button primary small" onClick={() => onEdit(routine)}>{t('edit')}</button>
      {routine.status === 'active' && <button type="button" className="button secondary small" onClick={() => onStatusChange(routine.id, 'paused')}>{t('pause')}</button>}
      {routine.status === 'paused' && <button type="button" className="button secondary small" onClick={() => onStatusChange(routine.id, 'active')}>{t('resume')}</button>}
      {routine.status !== 'ended' && <button type="button" className="button secondary small" onClick={() => {
        if (window.confirm(t('endRoutineConfirm'))) onStatusChange(routine.id, 'ended')
      }}>{t('endRoutine')}</button>}
      <button type="button" className="button ghost small danger-text" onClick={() => onArchive(routine.id)}>{t('archive')}</button>
    </div>
  </article>
}
