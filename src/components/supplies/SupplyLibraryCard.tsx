import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import type { StockStatus, Supply } from '../../types/domain'
import { SvgCharacter } from '../../visual/SvgCharacter'
import { supplyLibraryVisual } from './supplyPresentation'

const STATUS_ORDER: readonly StockStatus[] = ['available', 'low', 'reserve_only', 'out_of_stock']
interface Props {
  supply: Supply
  inUse: boolean
  onEdit: (supply: Supply) => void
  onArchive: (id: string) => void
  onHistory: (supply: Supply) => void
  onStatusChange: (id: string, status: StockStatus) => Promise<void>
}

export function SupplyLibraryCard({ supply, inUse, onEdit, onArchive, onHistory, onStatusChange }: Props) {
  const { t, locale } = useI18n()
  const [busy, setBusy] = useState(false)
  const [statusError, setStatusError] = useState(false)
  const artwork = supplyLibraryVisual(supply)
  const labels: Record<StockStatus, string> = {
    available: t('available'), low: t('low'), reserve_only: t('reserveOnly'), out_of_stock: t('outOfStock'),
  }
  const copy = locale === 'it'
    ? { supply: 'SCORTA DOMESTICA', amount: 'Quantità', noAmount: 'Quantità non registrata', used: 'In uso da un’azione o routine non archiviata' }
    : { supply: 'HOUSEHOLD SUPPLY', amount: 'Quantity', noAmount: 'Quantity not recorded', used: 'In use by a non-archived action or routine' }
  async function changeStatus(status: StockStatus) {
    if (busy || status === supply.status) return
    setBusy(true)
    setStatusError(false)
    try { await onStatusChange(supply.id, status) }
    catch { setStatusError(true) }
    finally { setBusy(false) }
  }
  return <article className={`card v2-supply-card is-${supply.status}`}>
    <div className="v2-supply-card-primary">
      <div className={`v2-supply-art v2-ink-${artwork.ink}`} aria-hidden="true"><span className="v2-supply-art-star">✦</span>
        <SvgCharacter id={artwork.subjectId} instanceKey={artwork.identityKey} decorative expression={artwork.expression} pose={artwork.pose} misregistration={false} />
      </div>
      <div className="v2-supply-card-copy">
        <span className="v2-print-eyebrow">{copy.supply}</span>
        <div className="v2-supply-card-name">{supply.icon && <span className="v2-supply-original-icon" aria-label={t('icon')}>{supply.icon}</span>}<h2 className="hc-card-title">{supply.name}</h2></div>
        <button type="button" className={`v2-supply-status is-${supply.status}`} onClick={() => onHistory(supply)} title={t('stockHistory')}>
          <span className={`stock-dot stock-${supply.status}`} aria-hidden="true" />{labels[supply.status]} <span aria-hidden="true">↗</span>
        </button>
        <p className="v2-supply-quantity"><strong>{copy.amount}:</strong> {supply.quantity != null ? `${supply.quantity}${supply.unit ? ` ${supply.unit}` : ''}` : copy.noAmount}</p>
      </div>
    </div>
    <div className="v2-supply-status-quick" role="group" aria-label={`${t('reportStock')}: ${supply.name}`}>
      {STATUS_ORDER.map((status) => <button type="button" key={status} className={supply.status === status ? `is-${status} selected` : `is-${status}`}
        aria-label={`${supply.name}: ${labels[status]}`} aria-pressed={supply.status === status} title={labels[status]} disabled={busy}
        onClick={() => { void changeStatus(status) }}><span className={`stock-dot stock-${status}`} aria-hidden="true" /><span>{labels[status]}</span></button>)}
    </div>
    {statusError && <p className="v2-supply-error" role="alert">{locale === 'it' ? 'Aggiornamento non riuscito. Riprova.' : 'Stock update failed. Try again.'}</p>}
    <div className="v2-supply-card-actions">
      <button type="button" className="button secondary small" onClick={() => onHistory(supply)}>{t('stockHistory')}</button>
      <button type="button" className="button primary small" onClick={() => onEdit(supply)}>{t('edit')}</button>
      <button type="button" className="button ghost small danger-text" disabled={inUse} title={inUse ? copy.used : t('archive')}
        onClick={() => onArchive(supply.id)}>{t('archive')}</button>
    </div>
  </article>
}
