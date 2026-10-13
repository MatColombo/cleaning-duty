import { useState } from 'react'
import type { CardSupply } from '../../lib/cardSupplies'
import { visibleCardSupplies } from '../../lib/cardSupplies'
import type { StockStatus } from '../../types/domain'
import { useI18n } from '../../contexts/I18nContext'
import { Sheet } from '../Sheet'

const statusKeys: Record<StockStatus, 'outOfStock' | 'reserveOnly' | 'low' | 'available'> = {
  out_of_stock: 'outOfStock', reserve_only: 'reserveOnly', low: 'low', available: 'available',
}

export function CareCardSupplies({ supplies }: { supplies: CardSupply[] }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  if (!supplies.length) return null
  const { shown, hiddenCount } = visibleCardSupplies(supplies)
  const stockLabel = (status: StockStatus | null) => status === null ? t('productUnavailable') : t(statusKeys[status])
  return <section className="v2-care-supplies" aria-label={t('requiredProducts')}>
    <span className="v2-care-supplies-heading">{t('requiredProducts')}</span>
    <div className="v2-care-supplies-chips">
      {shown.map(supply => <span className="v2-care-supply-chip" key={supply.supplyId} title={`${supply.name}: ${stockLabel(supply.status)}`}>
        {supply.status && <span aria-hidden="true" className={`stock-dot stock-${supply.status}`} />}
        <span className="v2-care-supply-name">{supply.name}</span>
        <span className="v2-care-supply-status">{stockLabel(supply.status)}</span>
      </span>)}
      {hiddenCount > 0 && <button type="button" className="v2-care-supplies-more" aria-label={`${t('allRequiredSupplies')} (${supplies.length})`} aria-haspopup="dialog" onClick={() => setExpanded(true)}>+{hiddenCount}</button>}
    </div>
    {expanded && <Sheet title={t('allRequiredSupplies')} onClose={() => setExpanded(false)}>
      <p className="muted v2-care-stock-hint">{t('cardStockQuantityHint')}</p>
      <ul className="v2-care-supply-full-list">{supplies.map(supply => <li key={supply.supplyId}>
        <span className="v2-care-supply-full-name"><strong>{supply.name}</strong><span>{stockLabel(supply.status)}</span></span>
        <span className="v2-care-supply-full-quantity">{supply.quantity == null ? t('stockQuantityNotReported') : `${supply.quantity}${supply.unit ? ` ${supply.unit}` : ''}`}</span>
      </li>)}</ul>
    </Sheet>}
  </section>
}
