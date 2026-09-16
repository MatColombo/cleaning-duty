import { useI18n } from '../contexts/I18nContext'
import type { TaskOccurrence, WorkspaceData } from '../types/domain'

export function TaskProducts({ task, data }: { task: TaskOccurrence; data: WorkspaceData }) {
  const { t } = useI18n()
  if (!task.supplies.length) return null
  return <div className="overview-supply-strip" aria-label={t('requiredProducts')}>
    {task.supplies.map((snapshot) => {
      const supply = data.supplies.find((item) => item.id === snapshot.supplyId && !item.archivedAt)
      const label = !supply ? t('productUnavailable') : supply.status === 'available' ? t('available') : supply.status === 'low' ? t('low') : supply.status === 'reserve_only' ? t('reserveOnly') : t('outOfStock')
      return <span className="overview-supply" key={snapshot.supplyId}>
        {supply && <span className={`stock-dot stock-${supply.status}`} aria-hidden="true" />}
        {snapshot.supplyName}: {label}{supply?.quantity != null ? ` (${supply.quantity}${supply.unit ? ` ${supply.unit}` : ''})` : ''}
      </span>
    })}
  </div>
}
