import { Sheet } from '../Sheet'
import { useI18n } from '../../contexts/I18nContext'
import { formatTaskDateTime } from '../../lib/date'
import type { Supply, WorkspaceData } from '../../types/domain'

interface Props { supply: Supply; data: WorkspaceData; onClose: () => void }
/** History remains an inspection-only view of canonical supplyEvents. */
export function SupplyHistorySheet({ supply, data, onClose }: Props) {
  const { t, locale } = useI18n()
  const events = data.supplyEvents.filter((event) => event.supplyId === supply.id)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return <Sheet title={`${supply.name} · ${t('stockHistory')}`} onClose={onClose}><div className="v2-supply-history timeline">
    {events.map((event) => <div className="timeline-item" key={event.id}>
      <span>{event.type === 'STOCK_CHANGED' ? `${String(event.metadata.from ?? '—')} → ${String(event.metadata.to ?? '—')}` : event.type.replaceAll('_', ' ').toLowerCase()}</span>
      <small>{formatTaskDateTime(event.at, locale, data.workspace.timezone)}</small>
    </div>)}
  </div></Sheet>
}
