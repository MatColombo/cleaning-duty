import type { TaskOccurrence } from '../../types/domain'
import type { CareCardContext, DeckPriority } from '../../lib/overviewDeck'
import { overdueCalendarDays } from '../../lib/overviewDeck'
import { formatTaskDateTime, formatTaskTime } from '../../lib/date'
import { useI18n } from '../../contexts/I18nContext'

export function CareCardMeta({ task, context, priority, now, timezone }: {
  task: TaskOccurrence; context: CareCardContext; priority: DeckPriority; now: Date; timezone: string
}) {
  const { t, locale } = useI18n()
  const assignment = context.assignmentScope === 'everyone' ? t('everyone') : context.assignmentScope === 'unassigned' ? t('anyone') : context.assigneeName ?? t('anyone')
  const dueAt = task.effectiveDueAt ?? task.dueAt
  const daysLate = priority === 'overdue' ? overdueCalendarDays(dueAt, now, timezone) : 0
  const status = priority === 'overdue' ? `${daysLate} ${t(daysLate === 1 ? 'dayOverdue' : 'daysOverdue')}` : t(priority === 'dueNow' ? 'dueNow' : 'laterToday')
  const supplies = context.supplyAlerts
  const targetCompleted = task.targets.filter((target) => target.completedAt).length
  return <div className="v2-care-meta">
    <span className={`v2-care-due v2-care-due-${priority}`}><strong>{status}</strong><span>{priority === 'overdue' ? formatTaskDateTime(dueAt, locale, timezone) : formatTaskTime(dueAt, locale, timezone)}</span></span>
    <div className="v2-care-meta-grid">
      <div><span className="v2-meta-label">{t('assignment')}</span><strong>{assignment}</strong></div>
      <div><span className="v2-meta-label">{task.cleanlinessChannel === 'deep' ? t('deepCleaning') : t('routineCleaning')}</span><strong>{context.cleanlinessExcluded ? t('cleanlinessExcluded') : context.cleanlinessScore == null ? t('notTracked') : `${Math.round(context.cleanlinessScore)}%`}</strong></div>
    </div>
    {task.targets.length > 1 && <div className="v2-care-inline"><span>{t('taskTargets')}</span><strong>{targetCompleted}/{task.targets.length}</strong></div>}
    {supplies.length > 0 && <div className="v2-care-stock"><span>{t('supplyAlerts')}</span><strong>{supplies.map(({name, status}) => `${name}: ${t(status === 'low' ? 'low' : status === 'out_of_stock' ? 'outOfStock' : 'reserveOnly')}`).join(' · ')}</strong></div>}
  </div>
}
